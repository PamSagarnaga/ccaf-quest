"use client";
import type { QuizQuestion } from "@/lib/queries";
import { pushToCloud } from "@/lib/sync";

const SEEN_STORAGE_KEY = "ccaf_seen";

// Map of bucket name -> ordered list of question ids already served in that
// context (e.g. "quiz", "quiz_d3", "exam_d1", "sd_hard"). Kept per-bucket so
// a practice quiz and the exam don't starve each other's pools.
type SeenMap = Record<string, string[]>;

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
 * Pick up to `count` questions from an already-shuffled `pool`, preferring ones
 * the user hasn't seen in this `bucket`. When the unseen supply runs out we
 * start a fresh cycle (so quizzes never come up short) and reset the bucket to
 * only the newly served items. The selection is recorded before returning, so
 * back-to-back draws don't repeat.
 */
export function pickUnseen(
  pool: QuizQuestion[],
  count: number,
  bucket: string
): QuizQuestion[] {
  if (pool.length === 0) return [];
  const seenMap = loadSeen();
  const seenIds = new Set(seenMap[bucket] ?? []);

  const unseen = pool.filter((q) => !seenIds.has(q.id));
  const alreadySeen = pool.filter((q) => seenIds.has(q.id));

  if (unseen.length >= count) {
    const chosen = unseen.slice(0, count);
    seenMap[bucket] = [...seenIds, ...chosen.map((q) => q.id)];
    saveSeen(seenMap);
    return chosen;
  }

  // Not enough fresh items: serve all unseen, top up from the seen pile, and
  // begin a new cycle keyed off just what we served this round.
  const chosen = [...unseen, ...alreadySeen.slice(0, count - unseen.length)];
  seenMap[bucket] = chosen.map((q) => q.id);
  saveSeen(seenMap);
  return chosen;
}
