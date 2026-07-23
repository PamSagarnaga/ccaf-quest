/**
 * Progress aggregation across everything the learner does — in-app quiz
 * attempts, logged external mock exams, and flashcard activity.
 * Single-user MVP: all state lives in localStorage. (Moves to Supabase +
 * auth in a later phase.)
 */
import { domains } from "@/lib/blueprint";

export interface DomainScore {
  correct: number;
  total: number;
}

export interface QuizAttempt {
  date: string;
  mode: "quiz";
  domain: number | null;
  total: number;
  correct: number;
  pct: number;
  durationSec: number;
  perDomain: Record<number, DomainScore>;
  scaled?: number; // present when this attempt was a full exam simulation
}

export interface ExamLog {
  id: string;
  date: string; // ISO
  source: string;
  correct: number | null;
  total: number | null;
  scaled: number | null; // 0–1000 scaled score, if known
  passed: boolean | null;
  perDomain: Record<number, DomainScore>;
  notes: string;
}

const ATTEMPTS_KEY = "ccaf_attempts";
const LOGS_KEY = "ccaf_exam_logs";
const ACTIVITY_KEY = "ccaf_activity";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const loadAttempts = () => read<QuizAttempt[]>(ATTEMPTS_KEY, []);
export const loadLogs = () => read<ExamLog[]>(LOGS_KEY, []);

export function saveLog(log: ExamLog) {
  const logs = loadLogs();
  logs.push(log);
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  markActivity();
}

export function deleteLog(id: string) {
  const logs = loadLogs().filter((l) => l.id !== id);
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

/** Record that the learner did something today (for streaks). */
export function markActivity(date = new Date()) {
  if (typeof window === "undefined") return;
  const day = date.toISOString().slice(0, 10);
  const set = new Set(read<string[]>(ACTIVITY_KEY, []));
  set.add(day);
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify([...set]));
}

// ── Aggregations ──────────────────────────────────────────

export interface Mastery {
  domain: number;
  correct: number;
  total: number;
  pct: number | null; // null = no data yet
}

export function domainMastery(
  attempts: QuizAttempt[],
  logs: ExamLog[]
): Mastery[] {
  const acc: Record<number, DomainScore> = {};
  for (const d of domains) acc[d.number] = { correct: 0, total: 0 };

  const fold = (pd: Record<number, DomainScore> | undefined) => {
    if (!pd) return;
    for (const [k, v] of Object.entries(pd)) {
      const n = Number(k);
      if (!acc[n]) continue;
      acc[n].correct += v.correct;
      acc[n].total += v.total;
    }
  };
  attempts.forEach((a) => fold(a.perDomain));
  logs.forEach((l) => fold(l.perDomain));

  return domains.map((d) => {
    const s = acc[d.number];
    return {
      domain: d.number,
      correct: s.correct,
      total: s.total,
      pct: s.total > 0 ? Math.round((s.correct / s.total) * 100) : null,
    };
  });
}

/** Exam-weighted overall readiness across domains that have data. */
export function readiness(mastery: Mastery[]): number | null {
  let wsum = 0;
  let acc = 0;
  for (const m of mastery) {
    if (m.pct === null) continue;
    const w = domains.find((d) => d.number === m.domain)!.weight;
    acc += m.pct * w;
    wsum += w;
  }
  return wsum > 0 ? Math.round(acc / wsum) : null;
}

export function streak(): { current: number; longest: number } {
  const days = read<string[]>(ACTIVITY_KEY, []).sort();
  if (days.length === 0) return { current: 0, longest: 0 };

  const set = new Set(days);
  const dayMs = 86_400_000;
  const toDay = (d: string) => new Date(d + "T00:00:00Z").getTime();

  // Longest run anywhere
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (toDay(days[i]) - toDay(days[i - 1]) === dayMs) run++;
    else run = 1;
    longest = Math.max(longest, run);
  }

  // Current run ending today or yesterday
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - dayMs).toISOString().slice(0, 10);
  let cursor = set.has(today) ? today : set.has(yest) ? yest : null;
  let current = 0;
  while (cursor && set.has(cursor)) {
    current++;
    cursor = new Date(toDay(cursor) - dayMs).toISOString().slice(0, 10);
  }

  return { current, longest };
}
