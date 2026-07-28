"use client";
/**
 * Performance trace — joins the two records of how the learner is actually
 * doing, which until now lived on separate pages and were never compared:
 *
 *   itemStats     what you got right   (every graded answer, per question id)
 *   calibration   what you knew cold   (confidence captured before the reveal)
 *
 * Neither alone is the picture. A task can sit at 80% accuracy while nearly
 * every one of those right answers was flagged "guessing" — scored as mastery,
 * held as luck. Only the join separates the two, so everything here is keyed to
 * task code (the finest grain both datasets share) and rolled up to domain.
 *
 * The two columns have different denominators on purpose: confidence is
 * optional in the exam runner and absent from sudden death, while flashcards
 * log calibration without touching itemStats. They are reported side by side,
 * never summed.
 */
import { domains, tasks, tasksForDomain, domainByNumber } from "@/lib/blueprint";
import { loadItemStats, type ItemStats } from "@/lib/itemStats";
import {
  loadCalibration,
  quadrantOf,
  type CalibrationEvent,
  type QuadrantTotals,
} from "@/lib/calibration";

/** Answers below this count are too thin to read as a verdict either way. */
export const MIN_CONFIDENT_N = 3;

/** Items on a 60-question exam expected to come from one task statement. */
function expectedExamItems(taskCode: string): number {
  const d = domainByNumber(Number(taskCode.split(".")[0]));
  return (60 * (d.weight / 100)) / tasksForDomain(d.number).length;
}

export interface TaskTrace {
  code: string;
  domain: number;
  statement: string;

  // From itemStats — "did you get it right"
  correct: number;
  wrong: number;
  answers: number;
  accuracy: number | null; // 0..1, null when never answered

  // From calibration — "did you know it cold"
  quadrants: QuadrantTotals;
  solidRate: number | null; // 0..1, null when no confidence logged

  // Bank coverage — how much of the task you've actually met
  bankTotal: number;
  distinctSeen: number;
  unseen: number;

  /**
   * 0..1 blend of the two signals, or null when neither has enough data.
   * Half "got it right", half "knew it cold" — a task carried by lucky guesses
   * lands well below its accuracy, which is the whole point of the join.
   */
  mastery: number | null;
  /** Thin evidence: a number is shown but shouldn't be trusted yet. */
  thin: boolean;
  /** Expected exam items from this task that you'd currently miss. */
  expectedMissed: number;
}

export interface DomainTrace {
  number: number;
  name: string;
  weight: number;
  accent: string;
  tasks: TaskTrace[];
  correct: number;
  answers: number;
  accuracy: number | null;
  quadrants: QuadrantTotals;
  solidRate: number | null;
  bankTotal: number;
  distinctSeen: number;
  unseen: number;
  mastery: number | null;
  expectedMissed: number;
}

const emptyQuadrants = (): QuadrantTotals => ({
  solid: 0,
  blindspot: 0,
  lucky: 0,
  gap: 0,
  total: 0,
});

function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}

/** Half accuracy, half solid-rate; whichever exists alone when only one does. */
function blendMastery(
  accuracy: number | null,
  solidRate: number | null
): number | null {
  if (accuracy !== null && solidRate !== null) return (accuracy + solidRate) / 2;
  return accuracy ?? solidRate;
}

export interface Trace {
  domains: DomainTrace[];
  /** Tasks worth studying next, worst first. Excludes anything untested. */
  priorities: TaskTrace[];
  /** Tasks with too little evidence to judge — a different kind of risk. */
  untested: TaskTrace[];
  totals: {
    answers: number;
    correct: number;
    quadrants: QuadrantTotals;
    bankTotal: number;
    distinctSeen: number;
  };
}

/**
 * Build the full trace. Bank counts come from the server (see
 * `getTaskQuestionCounts`); everything else is read from local state, which
 * `hydrateFromCloud` has already refreshed by the time a page mounts.
 */
export function buildTrace(
  taskBankCounts: Record<string, number>,
  stats: ItemStats = loadItemStats(),
  events: CalibrationEvent[] = loadCalibration()
): Trace {
  // Bucket both sources by task in one pass each.
  const perTask = new Map<
    string,
    { correct: number; wrong: number; seen: Set<string>; quadrants: QuadrantTotals }
  >();
  const bucket = (code: string) => {
    let b = perTask.get(code);
    if (!b) {
      b = { correct: 0, wrong: 0, seen: new Set(), quadrants: emptyQuadrants() };
      perTask.set(code, b);
    }
    return b;
  };

  for (const [id, st] of Object.entries(stats)) {
    if (!st.task) continue;
    const b = bucket(st.task);
    b.correct += st.correct;
    b.wrong += st.wrong;
    b.seen.add(id);
  }
  for (const e of events) {
    if (!e.taskCode) continue;
    const q = bucket(e.taskCode).quadrants;
    q[quadrantOf(e)]++;
    q.total++;
  }

  const taskTraces: TaskTrace[] = tasks.map((t) => {
    const b = perTask.get(t.code);
    const correct = b?.correct ?? 0;
    const wrong = b?.wrong ?? 0;
    const answers = correct + wrong;
    const quadrants = b?.quadrants ?? emptyQuadrants();
    const accuracy = ratio(correct, answers);
    const solidRate = ratio(quadrants.solid, quadrants.total);
    const mastery = blendMastery(accuracy, solidRate);
    const bankTotal = taskBankCounts[t.code] ?? 0;
    const distinctSeen = b?.seen.size ?? 0;
    return {
      code: t.code,
      domain: t.domain,
      statement: t.statement,
      correct,
      wrong,
      answers,
      accuracy,
      quadrants,
      solidRate,
      bankTotal,
      distinctSeen,
      unseen: Math.max(0, bankTotal - distinctSeen),
      mastery,
      thin: answers < MIN_CONFIDENT_N && quadrants.total < MIN_CONFIDENT_N,
      expectedMissed:
        mastery === null ? 0 : expectedExamItems(t.code) * (1 - mastery),
    };
  });

  const domainTraces: DomainTrace[] = domains.map((d) => {
    const own = taskTraces.filter((t) => t.domain === d.number);
    const quadrants = emptyQuadrants();
    let correct = 0;
    let answers = 0;
    let bankTotal = 0;
    let distinctSeen = 0;
    let expectedMissed = 0;
    for (const t of own) {
      correct += t.correct;
      answers += t.answers;
      bankTotal += t.bankTotal;
      distinctSeen += t.distinctSeen;
      expectedMissed += t.expectedMissed;
      quadrants.solid += t.quadrants.solid;
      quadrants.blindspot += t.quadrants.blindspot;
      quadrants.lucky += t.quadrants.lucky;
      quadrants.gap += t.quadrants.gap;
      quadrants.total += t.quadrants.total;
    }
    const accuracy = ratio(correct, answers);
    const solidRate = ratio(quadrants.solid, quadrants.total);
    return {
      number: d.number,
      name: d.name,
      weight: d.weight,
      accent: d.accent,
      tasks: own,
      correct,
      answers,
      accuracy,
      quadrants,
      solidRate,
      bankTotal,
      distinctSeen,
      unseen: Math.max(0, bankTotal - distinctSeen),
      mastery: blendMastery(accuracy, solidRate),
      expectedMissed,
    };
  });

  return {
    domains: domainTraces,
    priorities: taskTraces
      .filter((t) => !t.thin && t.expectedMissed > 0)
      .sort((a, b) => b.expectedMissed - a.expectedMissed)
      .slice(0, 5),
    untested: taskTraces
      .filter((t) => t.thin)
      .sort((a, b) => b.bankTotal - a.bankTotal),
    totals: domainTraces.reduce(
      (acc, d) => {
        acc.answers += d.answers;
        acc.correct += d.correct;
        acc.bankTotal += d.bankTotal;
        acc.distinctSeen += d.distinctSeen;
        acc.quadrants.solid += d.quadrants.solid;
        acc.quadrants.blindspot += d.quadrants.blindspot;
        acc.quadrants.lucky += d.quadrants.lucky;
        acc.quadrants.gap += d.quadrants.gap;
        acc.quadrants.total += d.quadrants.total;
        return acc;
      },
      {
        answers: 0,
        correct: 0,
        quadrants: emptyQuadrants(),
        bankTotal: 0,
        distinctSeen: 0,
      }
    ),
  };
}

export type QuestionVerdict = "missed" | "shaky" | "solid" | "unseen";

/** Classify one question from its lifetime tally. */
export function verdictFor(
  stat: { correct: number; wrong: number } | undefined
): QuestionVerdict {
  if (!stat) return "unseen";
  if (stat.wrong > 0) return stat.correct > stat.wrong ? "shaky" : "missed";
  return "solid";
}

export const VERDICT_META: Record<
  QuestionVerdict,
  { label: string; color: string; order: number }
> = {
  missed: { label: "Missed", color: "var(--wrong)", order: 0 },
  shaky: { label: "Shaky", color: "var(--d1)", order: 1 },
  unseen: { label: "Never seen", color: "var(--text-muted)", order: 2 },
  solid: { label: "Solid", color: "var(--correct)", order: 3 },
};
