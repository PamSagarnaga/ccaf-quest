"use client";
import type { QuizQuestion } from "@/lib/queries";
import { pushToCloud } from "@/lib/sync";

const SEEN_STORAGE_KEY = "ccaf_seen";

// Map of bucket name -> ordered list of question ids already served in that
// context (e.g. "quiz", "quiz_d3", "exam_d1", "sd_hard"). Kept per-bucket so
// a practice quiz and the exam don't starve each other's pools.
// The reserved "__recent" bucket is a global, cross-mode recency window: ids
// served in ANY bucket recently, so a question just seen in a practice quiz
// sinks to the bottom of the next exam's draw instead of resurfacing.
type SeenMap = Record<string, string[]>;

const RECENT_BUCKET = "__recent";
const RECENT_CAP = 40;

// Reserved bucket holding one entry per past exam sitting, most recent first,
// each a "|"-joined list of the ids served in that sitting. Unlike __recent
// (a soft nudge), these ids are hard-excluded from the next exam draw: a repeat
// question is answered from memory, which inflates the score without reflecting
// any gain in knowledge.
const EXAM_HISTORY_BUCKET = "__exam_history";
const EXAM_LOCKOUT_SITTINGS = 2;

function loadSeen(): SeenMap {
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SeenMap) : {};
  } catch {
    return {};
  }
}

function saveSeen(map: SeenMap) {
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(map));
    void pushToCloud(SEEN_STORAGE_KEY);
  } catch {
    // non-fatal — selection already returned
  }
}

/**
 * Ids served in the last `EXAM_LOCKOUT_SITTINGS` exams. Pass to `pickUnseen` as
 * `exclude` so a repeat sitting can't recycle items the user still remembers.
 */
export function examLockoutIds(): Set<string> {
  const sittings = loadSeen()[EXAM_HISTORY_BUCKET] ?? [];
  return new Set(
    sittings.slice(0, EXAM_LOCKOUT_SITTINGS).flatMap((s) => s.split("|"))
  );
}

/** Record one completed exam draw as a sitting, trimming older history. */
export function recordExamSitting(ids: string[]) {
  if (ids.length === 0) return;
  const seenMap = loadSeen();
  const key = ids.join("|");
  // StrictMode runs the exam's useState initializer twice in dev; an identical
  // consecutive sitting would otherwise evict real history and halve the lockout.
  if ((seenMap[EXAM_HISTORY_BUCKET] ?? [])[0] === key) return;
  seenMap[EXAM_HISTORY_BUCKET] = [
    key,
    ...(seenMap[EXAM_HISTORY_BUCKET] ?? []),
  ].slice(0, EXAM_LOCKOUT_SITTINGS);
  saveSeen(seenMap);
}

/**
 * Pick up to `count` questions from an already-shuffled `pool`, preferring ones
 * the user hasn't seen in this `bucket`. When the unseen supply runs out we
 * start a fresh cycle (so quizzes never come up short) and reset the bucket to
 * only the newly served items. The selection is recorded before returning, so
 * back-to-back draws don't repeat.
 *
 * `exclude` ids are dropped from the pool outright — but only while enough
 * questions remain to fill `count`. A short pool falls back to the full pool
 * rather than returning an under-length exam.
 */
export function pickUnseen(
  pool: QuizQuestion[],
  count: number,
  bucket: string,
  exclude?: Set<string>
): QuizQuestion[] {
  if (pool.length === 0) return [];
  if (exclude?.size) {
    const eligible = pool.filter((q) => !exclude.has(q.id));
    if (eligible.length >= count) pool = eligible;
  }
  const seenMap = loadSeen();
  const seenIds = new Set(seenMap[bucket] ?? []);
  const recent = new Set(seenMap[RECENT_BUCKET] ?? []);

  // Within each group, push globally-recent ids to the back so a question just
  // served elsewhere won't lead this draw unless we truly have nothing fresher.
  const deprioritizeRecent = (arr: QuizQuestion[]): QuizQuestion[] => {
    const fresh = arr.filter((q) => !recent.has(q.id));
    const recentlySeen = arr.filter((q) => recent.has(q.id));
    return [...fresh, ...recentlySeen];
  };

  const unseen = deprioritizeRecent(pool.filter((q) => !seenIds.has(q.id)));
  const alreadySeen = deprioritizeRecent(pool.filter((q) => seenIds.has(q.id)));

  let chosen: QuizQuestion[];
  if (unseen.length >= count) {
    chosen = unseen.slice(0, count);
    seenMap[bucket] = [...seenIds, ...chosen.map((q) => q.id)];
  } else {
    // Not enough fresh items: serve all unseen, top up from the seen pile, and
    // begin a new cycle keyed off just what we served this round.
    chosen = [...unseen, ...alreadySeen.slice(0, count - unseen.length)];
    seenMap[bucket] = chosen.map((q) => q.id);
  }

  // Refresh the global recency window (most-recent first, de-duped, capped).
  const chosenIds = chosen.map((q) => q.id);
  seenMap[RECENT_BUCKET] = [
    ...chosenIds,
    ...(seenMap[RECENT_BUCKET] ?? []).filter((id) => !chosenIds.includes(id)),
  ].slice(0, RECENT_CAP);

  saveSeen(seenMap);
  return chosen;
}
