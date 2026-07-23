/**
 * Confidence calibration — track how sure you felt (captured BEFORE the
 * outcome is revealed) against whether you were actually right. The gap between
 * confidence and correctness is what tells you what to study:
 *   Certain + Correct  = known cold (a "padrenuestro")
 *   Certain + Wrong    = blind spot   (dangerous — you'd never study it)
 *   Unsure + Correct   = lucky/shaky  (fragile knowledge)
 *   Unsure + Wrong     = honest gap
 *
 * The must-know-cold universe is the quick-reference essentials, represented at
 * task-statement granularity (the bank comprehensively covers every quick-ref fact).
 */
import { domainByNumber } from "@/lib/blueprint";

export type Confidence = "certain" | "fairly" | "guessing";

export const CONFIDENCE_META: {
  key: Confidence;
  label: string;
  short: string;
  color: string;
}[] = [
  { key: "certain", label: "Certain", short: "100% sure", color: "var(--correct)" },
  { key: "fairly", label: "Fairly sure", short: "maybe", color: "var(--d1)" },
  { key: "guessing", label: "Guessing", short: "lucky guess", color: "var(--text-muted)" },
];

export type Quadrant = "solid" | "blindspot" | "lucky" | "gap";

export interface CalibrationEvent {
  date: string;
  kind: "quiz" | "card";
  taskCode: string | null;
  domain: number;
  correct: boolean;
  confidence: Confidence;
}

const KEY = "ccaf_calibration";

export function loadCalibration(): CalibrationEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function logCalibration(e: CalibrationEvent) {
  if (typeof window === "undefined") return;
  const all = loadCalibration();
  all.push(e);
  localStorage.setItem(KEY, JSON.stringify(all.slice(-2000)));
}

/** High confidence = "certain"; everything else counts as unsure. */
export function quadrantOf(e: CalibrationEvent): Quadrant {
  const high = e.confidence === "certain";
  if (high && e.correct) return "solid";
  if (high && !e.correct) return "blindspot";
  if (!high && e.correct) return "lucky";
  return "gap";
}

export interface QuadrantTotals {
  solid: number;
  blindspot: number;
  lucky: number;
  gap: number;
  total: number;
}

export function quadrantTotals(events: CalibrationEvent[]): QuadrantTotals {
  const t: QuadrantTotals = { solid: 0, blindspot: 0, lucky: 0, gap: 0, total: 0 };
  for (const e of events) {
    t[quadrantOf(e)]++;
    t.total++;
  }
  return t;
}

/**
 * Calibration score (0–100): how well confidence predicted correctness.
 * Overconfidence (certain but wrong) and underconfidence (guessing but right)
 * are the two miscalibrations; a fairly-sure answer is treated as neutral.
 */
export function calibrationScore(events: CalibrationEvent[]): number | null {
  if (events.length === 0) return null;
  let miss = 0;
  for (const e of events) {
    if (e.confidence === "certain" && !e.correct) miss++;
    if (e.confidence === "guessing" && e.correct) miss++;
  }
  return Math.round((1 - miss / events.length) * 100);
}

export interface TaskCalibration {
  taskCode: string;
  domain: number;
  totals: QuadrantTotals;
  status: "known-cold" | "blindspot" | "shaky" | "learning";
  attempts: number;
  lastCorrect: boolean | null;
}

/** Per-task-statement calibration profile. */
export function taskCalibration(events: CalibrationEvent[]): TaskCalibration[] {
  const byTask = new Map<string, CalibrationEvent[]>();
  for (const e of events) {
    if (!e.taskCode) continue;
    const arr = byTask.get(e.taskCode) ?? [];
    arr.push(e);
    byTask.set(e.taskCode, arr);
  }

  const out: TaskCalibration[] = [];
  for (const [taskCode, evs] of byTask) {
    const sorted = [...evs].sort((a, b) => +new Date(a.date) - +new Date(b.date));
    const totals = quadrantTotals(sorted);
    const last = sorted[sorted.length - 1];
    const recentBlind = sorted
      .slice(-3)
      .some((e) => quadrantOf(e) === "blindspot");

    let status: TaskCalibration["status"] = "learning";
    if (recentBlind || totals.blindspot > totals.solid) status = "blindspot";
    else if (totals.solid >= 2 && totals.blindspot === 0 && totals.lucky <= 1)
      status = "known-cold";
    else if (totals.lucky > 0 && totals.solid === 0) status = "shaky";

    out.push({
      taskCode,
      domain: Number(taskCode.split(".")[0]),
      totals,
      status,
      attempts: sorted.length,
      lastCorrect: last ? last.correct : null,
    });
  }
  return out.sort((a, b) => a.taskCode.localeCompare(b.taskCode));
}

export function taskLabel(taskCode: string): string {
  const d = domainByNumber(Number(taskCode.split(".")[0]));
  return `D${d.number} · ${taskCode}`;
}

// ── Gamification hooks ────────────────────────────────────
export function calibrationBonusXp(
  confidence: Confidence,
  correct: boolean
): number {
  // Reward honest, well-placed certainty. No penalty for honest guessing.
  return confidence === "certain" && correct ? 5 : 0;
}
