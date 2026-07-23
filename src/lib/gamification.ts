/**
 * Gamification — XP, levels, and achievement badges.
 * XP is awarded forward (from the moment the feature shipped) and stored in
 * localStorage; badges are evaluated against the full progress snapshot.
 */
import type { QuizAttempt, ExamLog, Mastery } from "@/lib/progress";
import type { CardState } from "@/lib/srs";
import { pushToCloud } from "@/lib/sync";

// ── XP ────────────────────────────────────────────────────
export interface XpEvent {
  date: string;
  amount: number;
  reason: string;
}
export interface XpState {
  total: number;
  events: XpEvent[];
}

const XP_KEY = "ccaf_xp";

export function loadXp(): XpState {
  if (typeof window === "undefined") return { total: 0, events: [] };
  try {
    return JSON.parse(localStorage.getItem(XP_KEY) || "") as XpState;
  } catch {
    return { total: 0, events: [] };
  }
}

/** Add XP and return the new total (and whether a level was crossed). */
export function awardXp(
  amount: number,
  reason: string
): { total: number; leveledTo: LevelProgress | null } {
  if (typeof window === "undefined") return { total: 0, leveledTo: null };
  const state = loadXp();
  const before = levelFor(state.total).level;
  state.total += amount;
  state.events.unshift({ date: new Date().toISOString(), amount, reason });
  state.events = state.events.slice(0, 50);
  localStorage.setItem(XP_KEY, JSON.stringify(state));
  pushToCloud(XP_KEY);
  const after = levelFor(state.total);
  return {
    total: state.total,
    leveledTo: after.level > before ? after : null,
  };
}

// ── Levels (the ascent) ───────────────────────────────────
export interface Level {
  level: number;
  name: string;
  minXp: number;
}

export const LEVELS: Level[] = [
  { level: 1, name: "Initiate", minXp: 0 },
  { level: 2, name: "Apprentice", minXp: 100 },
  { level: 3, name: "Journeyman", minXp: 300 },
  { level: 4, name: "Adept", minXp: 600 },
  { level: 5, name: "Architect", minXp: 1000 },
  { level: 6, name: "Master Architect", minXp: 1600 },
  { level: 7, name: "Grand Architect", minXp: 2500 },
];

export interface LevelProgress {
  level: number;
  name: string;
  into: number; // xp earned into current level
  span: number; // xp span of current level (Infinity if max)
  nextName: string | null;
  pct: number; // 0–100 progress to next level
}

export function levelFor(total: number): LevelProgress {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (total >= LEVELS[i].minXp) idx = i;
  }
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const into = total - cur.minXp;
  const span = next ? next.minXp - cur.minXp : Infinity;
  return {
    level: cur.level,
    name: cur.name,
    into,
    span,
    nextName: next?.name ?? null,
    pct: next ? Math.min(100, Math.round((into / span) * 100)) : 100,
  };
}

// ── Badges ────────────────────────────────────────────────
export interface BadgeCtx {
  attempts: QuizAttempt[];
  logs: ExamLog[];
  cardStates: CardState[];
  mastery: Mastery[];
  streakLongest: number;
  readiness: number | null;
  xpTotal: number;
  solidCount: number; // certain + correct answers
  calibScore: number | null; // 0–100 calibration score
  calibTotal: number; // total confidence-rated answers
}

export interface Badge {
  id: string;
  name: string;
  desc: string;
  icon: string;
  check: (c: BadgeCtx) => boolean;
}

function domainsQuizzed(attempts: QuizAttempt[]): number {
  const set = new Set<number>();
  for (const a of attempts) {
    if (a.domain !== null) set.add(a.domain);
    for (const k of Object.keys(a.perDomain)) set.add(Number(k));
  }
  return set.size;
}

export const BADGES: Badge[] = [
  {
    id: "first-quiz",
    name: "First Steps",
    desc: "Complete your first quiz",
    icon: "🎯",
    check: (c) => c.attempts.length >= 1,
  },
  {
    id: "flawless",
    name: "Flawless",
    desc: "Score 100% on a quiz of 5+ questions",
    icon: "💎",
    check: (c) => c.attempts.some((a) => a.total >= 5 && a.correct === a.total),
  },
  {
    id: "cartographer",
    name: "Cartographer",
    desc: "Answer questions from all 5 domains",
    icon: "🗺️",
    check: (c) => domainsQuizzed(c.attempts) >= 5,
  },
  {
    id: "streak-3",
    name: "Kindled",
    desc: "Reach a 3-day study streak",
    icon: "🔥",
    check: (c) => c.streakLongest >= 3,
  },
  {
    id: "streak-7",
    name: "Ablaze",
    desc: "Reach a 7-day study streak",
    icon: "☄️",
    check: (c) => c.streakLongest >= 7,
  },
  {
    id: "scholar",
    name: "Scholar",
    desc: "Review 25 flashcards",
    icon: "📚",
    check: (c) => c.cardStates.length >= 25,
  },
  {
    id: "memorised",
    name: "Committed to Memory",
    desc: "Master 10 cards (21+ day interval)",
    icon: "🧠",
    check: (c) => c.cardStates.filter((s) => s.interval >= 21).length >= 10,
  },
  {
    id: "field-agent",
    name: "Field Agent",
    desc: "Log an external mock exam",
    icon: "📋",
    check: (c) => c.logs.length >= 1,
  },
  {
    id: "cut-line",
    name: "Above the Cut",
    desc: "Reach 72%+ exam-weighted readiness",
    icon: "⚔️",
    check: (c) => (c.readiness ?? 0) >= 72,
  },
  {
    id: "domain-master",
    name: "Domain Master",
    desc: "Reach 90%+ mastery in any domain",
    icon: "👑",
    check: (c) => c.mastery.some((m) => (m.pct ?? 0) >= 90),
  },
  {
    id: "centurion",
    name: "Centurion",
    desc: "Earn 1,000 XP",
    icon: "🏛️",
    check: (c) => c.xpTotal >= 1000,
  },
  {
    id: "rock-solid",
    name: "Rock Solid",
    desc: "Answer 'Certain' and be right 15 times",
    icon: "🪨",
    check: (c) => c.solidCount >= 15,
  },
  {
    id: "calibrated",
    name: "Well-Calibrated",
    desc: "80%+ calibration over 25+ answers",
    icon: "🎚️",
    check: (c) => c.calibTotal >= 25 && (c.calibScore ?? 0) >= 80,
  },
];

export function evaluateBadges(ctx: BadgeCtx) {
  return BADGES.map((b) => ({ ...b, unlocked: b.check(ctx) }));
}
