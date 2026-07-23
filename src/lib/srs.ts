/**
 * Lightweight SM-2-style spaced repetition.
 * State is persisted per-card in localStorage (single-user MVP);
 * this module stays pure so the scheduling is easy to reason about and test.
 */

export type Rating = "again" | "hard" | "good" | "easy";

export interface CardState {
  due: number; // epoch ms
  interval: number; // days
  ease: number; // 1.3 – 3.0
  reps: number; // consecutive successful reviews
  lapses: number;
}

const DAY = 86_400_000;
export const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 3.0;

const clampEase = (e: number) => Math.min(MAX_EASE, Math.max(MIN_EASE, e));

export function isDue(state: CardState | undefined, now = Date.now()): boolean {
  return !state || state.due <= now;
}

export function isNew(state: CardState | undefined): boolean {
  return !state;
}

/** Compute the next card state from a rating. */
export function schedule(
  state: CardState | undefined,
  rating: Rating,
  now = Date.now()
): CardState {
  const cur: CardState = state ?? {
    due: now,
    interval: 0,
    ease: DEFAULT_EASE,
    reps: 0,
    lapses: 0,
  };

  let { interval, ease, reps, lapses } = cur;

  switch (rating) {
    case "again":
      ease = clampEase(ease - 0.2);
      reps = 0;
      lapses += 1;
      interval = 0; // relearn — due again this session
      return { due: now, interval, ease, reps, lapses };

    case "hard":
      ease = clampEase(ease - 0.15);
      interval = Math.max(1, Math.round((interval || 1) * 1.2));
      reps += 1;
      break;

    case "good":
      if (reps === 0) interval = 1;
      else if (reps === 1) interval = 3;
      else interval = Math.round(interval * ease);
      reps += 1;
      break;

    case "easy":
      ease = clampEase(ease + 0.15);
      interval = reps === 0 ? 3 : Math.round(interval * ease * 1.3);
      reps += 1;
      break;
  }

  return { due: now + interval * DAY, interval, ease, reps, lapses };
}

/** Human-friendly preview of when a rating will bring the card back. */
export function intervalLabel(
  state: CardState | undefined,
  rating: Rating
): string {
  const next = schedule(state, rating);
  if (rating === "again" || next.interval === 0) return "<10m";
  if (next.interval === 1) return "1d";
  if (next.interval < 30) return `${next.interval}d`;
  if (next.interval < 365) return `${Math.round(next.interval / 30)}mo`;
  return `${(next.interval / 365).toFixed(1)}y`;
}

// ── localStorage persistence ──────────────────────────────
const KEY = "ccaf_srs";

export function loadSrs(): Record<string, CardState> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveCardState(id: string, state: CardState) {
  try {
    const all = loadSrs();
    all[id] = state;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}
