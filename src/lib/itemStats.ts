"use client";
// Per-question mastery tracking. Every graded answer (quiz, exam sim, sudden
// death) tallies correct/wrong for that question id, tagged with its domain,
// task, and scenario so the /heatmap trace can be audited at any grain.
// Single-user MVP: localStorage, mirrored to the cloud like the other progress
// keys (see PROGRESS_STORAGE_KEYS in sync.ts).
import type { QuizQuestion } from "@/lib/quiz-types";
import { pushToCloud } from "@/lib/sync";

const ITEM_STATS_KEY = "ccaf_item_stats";

export interface ItemStat {
  domain: number;
  task: string | null;
  scenario: string | null;
  correct: number;
  wrong: number;
  lastSeen: string; // ISO
}

export type ItemStats = Record<string /* questionId */, ItemStat>;

export interface ItemResult {
  id: string;
  domain: number;
  task: string | null;
  scenario: string | null;
  correct: boolean;
}

function read(): ItemStats {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ITEM_STATS_KEY);
    return raw ? (JSON.parse(raw) as ItemStats) : {};
  } catch {
    return {};
  }
}

export const loadItemStats = (): ItemStats => read();

/** Convenience: build ItemResults from a set of questions + a correctness map. */
export function toItemResults(
  questions: QuizQuestion[],
  wasCorrect: (q: QuizQuestion, index: number) => boolean
): ItemResult[] {
  return questions.map((q, index) => ({
    id: q.id,
    domain: q.domain,
    task: q.task_code,
    scenario: q.scenario,
    correct: wasCorrect(q, index),
  }));
}

/**
 * Tally a batch of graded answers. One localStorage write + one cloud push per
 * call, so pass a whole attempt's worth at once. Idempotency is the caller's
 * job — fire this from a run-once effect so a re-render can't double-count.
 */
export function recordItemResults(results: ItemResult[]): void {
  if (typeof window === "undefined" || results.length === 0) return;
  const stats = read();
  const now = new Date().toISOString();
  for (const r of results) {
    const prev: ItemStat = stats[r.id] ?? {
      domain: r.domain,
      task: r.task,
      scenario: r.scenario,
      correct: 0,
      wrong: 0,
      lastSeen: now,
    };
    // Keep the classification current (cheap; guards against stale tags).
    prev.domain = r.domain;
    prev.task = r.task;
    prev.scenario = r.scenario;
    if (r.correct) prev.correct++;
    else prev.wrong++;
    prev.lastSeen = now;
    stats[r.id] = prev;
  }
  try {
    localStorage.setItem(ITEM_STATS_KEY, JSON.stringify(stats));
    void pushToCloud(ITEM_STATS_KEY);
  } catch {
    // non-fatal — the tally is best-effort
  }
}

export type Dimension = "domain" | "task" | "scenario";

export interface Bucket {
  correct: number;
  wrong: number;
  total: number;
  distinct: number; // distinct question ids that fall in this bucket
}

/**
 * Roll stats up by domain, task, or scenario. Keys are the dimension's value as
 * a string (domain number, task code, or scenario slug). Untagged items (null
 * task/scenario) are skipped for that dimension.
 */
export function aggregate(
  dimension: Dimension,
  stats: ItemStats = read()
): Record<string, Bucket> {
  const out: Record<string, Bucket> = {};
  for (const st of Object.values(stats)) {
    const key =
      dimension === "domain"
        ? String(st.domain)
        : dimension === "task"
          ? st.task
          : st.scenario;
    if (!key) continue;
    const bucket = (out[key] ??= { correct: 0, wrong: 0, total: 0, distinct: 0 });
    bucket.correct += st.correct;
    bucket.wrong += st.wrong;
    bucket.total += st.correct + st.wrong;
    bucket.distinct += 1;
  }
  return out;
}

/** Distinct question ids the learner has answered at least once. */
export function distinctSeen(stats: ItemStats = read()): number {
  return Object.keys(stats).length;
}
