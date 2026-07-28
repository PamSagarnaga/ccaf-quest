"use client";
/**
 * Performance trace — everything the trace page reports, derived from the
 * answer log and nothing else.
 *
 * Two numbers are worth separating and were previously conflated:
 *
 *   accuracy    did you pick the right option
 *   solid rate  did you say "certain" beforehand AND get it right
 *
 * A task can sit at 90% accuracy with almost every right answer rated unsure —
 * scored as mastery, held as luck. Both now come from the same rows, so they
 * cover the same answers over the same period and cannot drift apart.
 *
 * Two older stores survive and are deliberately kept out of the rates:
 *   - `itemStats` contributes only its key set, for coverage. A set of "seen"
 *     questions can't contradict a rate.
 *   - `calibration` holds ratings logged before the answer log existed. They
 *     carry no question id, so they're surfaced as a separate task-level
 *     history panel — never blended in.
 */
import { domains, tasks, tasksForDomain, domainByNumber } from "@/lib/blueprint";
import { loadAnswers, type AnswerEvent } from "@/lib/answers";
import { loadItemStats } from "@/lib/itemStats";
import { loadCalibration, quadrantOf, type CalibrationEvent } from "@/lib/calibration";

/** Answers below this count are too thin to read as a verdict either way. */
export const MIN_CONFIDENT_N = 3;

export interface Quadrants {
  solid: number;
  lucky: number;
  gap: number;
  blindspot: number;
  /** Rated answers only — answers with no confidence aren't counted here. */
  total: number;
}

const emptyQuadrants = (): Quadrants => ({
  solid: 0,
  lucky: 0,
  gap: 0,
  blindspot: 0,
  total: 0,
});

/** Which quadrant one logged answer falls in, or null when it wasn't rated. */
export function quadrantOfAnswer(
  e: AnswerEvent
): keyof Omit<Quadrants, "total"> | null {
  if (!e.confidence) return null;
  const certain = e.confidence === "certain";
  if (certain) return e.correct ? "solid" : "blindspot";
  return e.correct ? "lucky" : "gap";
}

/** Items on a 60-question exam expected to come from one task statement. */
function expectedExamItems(taskCode: string): number {
  const d = domainByNumber(Number(taskCode.split(".")[0]));
  return (60 * (d.weight / 100)) / tasksForDomain(d.number).length;
}

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

export interface TaskTrace {
  code: string;
  domain: number;
  statement: string;

  correct: number;
  answers: number;
  accuracy: number | null;

  quadrants: Quadrants;
  solidRate: number | null;
  /** Certain-and-wrong answers, newest first. Each carries its question id. */
  blindSpots: AnswerEvent[];

  bankTotal: number;
  distinctSeen: number;
  unseen: number;

  mastery: number | null;
  thin: boolean;
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
  quadrants: Quadrants;
  solidRate: number | null;
  bankTotal: number;
  distinctSeen: number;
  unseen: number;
  mastery: number | null;
  expectedMissed: number;
}

/** Pre-answer-log ratings. Task-level only — no question id was recorded. */
export interface LegacyTask {
  code: string;
  domain: number;
  quadrants: Quadrants;
}

export interface Legacy {
  tasks: LegacyTask[];
  totals: Quadrants;
  /** Range these ratings span, for labelling. */
  from: string | null;
  to: string | null;
}

export interface Trace {
  domains: DomainTrace[];
  priorities: TaskTrace[];
  untested: TaskTrace[];
  /** Every certain-and-wrong answer, newest first, across all tasks. */
  blindSpots: AnswerEvent[];
  totals: {
    answers: number;
    correct: number;
    quadrants: Quadrants;
    bankTotal: number;
    distinctSeen: number;
  };
  legacy: Legacy;
}

/**
 * Build the trace. Bank counts come from the server (`getTaskQuestionCounts`);
 * everything else is local state, already refreshed by `hydrateFromCloud`.
 *
 * Coverage is the union of question ids in the answer log and in the legacy
 * item tally, so it reflects everything ever answered — including sessions
 * that predate the log. `priorSeen` is injectable for tests; in the app it
 * comes from the tally.
 */
export function buildTrace(
  taskBankCounts: Record<string, number>,
  events: AnswerEvent[] = loadAnswers(),
  legacyRatings: CalibrationEvent[] = loadCalibration(),
  priorSeen: Record<string, { task: string | null }> = loadItemStats()
): Trace {
  const perTask = new Map<
    string,
    {
      correct: number;
      answers: number;
      quadrants: Quadrants;
      blindSpots: AnswerEvent[];
      seen: Set<string>;
    }
  >();
  const bucket = (code: string) => {
    let b = perTask.get(code);
    if (!b) {
      b = {
        correct: 0,
        answers: 0,
        quadrants: emptyQuadrants(),
        blindSpots: [],
        seen: new Set(),
      };
      perTask.set(code, b);
    }
    return b;
  };

  for (const e of events) {
    if (!e.task) continue;
    const b = bucket(e.task);
    b.answers++;
    if (e.correct) b.correct++;
    b.seen.add(e.itemId);
    const quad = quadrantOfAnswer(e);
    if (quad) {
      b.quadrants[quad]++;
      b.quadrants.total++;
      if (quad === "blindspot") b.blindSpots.push(e);
    }
  }

  // Coverage counts questions met before the log existed too. Those ids carry
  // no task, so they're folded in per task via the tally's own tagging.
  const priorByTask = new Map<string, Set<string>>();
  for (const [id, st] of Object.entries(priorSeen)) {
    const task = st?.task;
    if (!task) continue;
    const set = priorByTask.get(task) ?? new Set<string>();
    set.add(id);
    priorByTask.set(task, set);
  }

  const taskTraces: TaskTrace[] = tasks.map((t) => {
    const b = perTask.get(t.code);
    const answers = b?.answers ?? 0;
    const correct = b?.correct ?? 0;
    const quadrants = b?.quadrants ?? emptyQuadrants();
    const accuracy = ratio(correct, answers);
    const solidRate = ratio(quadrants.solid, quadrants.total);
    const mastery = blendMastery(accuracy, solidRate);
    const bankTotal = taskBankCounts[t.code] ?? 0;
    const seen = new Set([
      ...(b?.seen ?? []),
      ...(priorByTask.get(t.code) ?? []),
    ]);
    return {
      code: t.code,
      domain: t.domain,
      statement: t.statement,
      correct,
      answers,
      accuracy,
      quadrants,
      solidRate,
      blindSpots: [...(b?.blindSpots ?? [])].sort((x, y) =>
        y.ts.localeCompare(x.ts)
      ),
      bankTotal,
      distinctSeen: seen.size,
      unseen: Math.max(0, bankTotal - seen.size),
      mastery,
      thin: answers < MIN_CONFIDENT_N,
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
      quadrants.lucky += t.quadrants.lucky;
      quadrants.gap += t.quadrants.gap;
      quadrants.blindspot += t.quadrants.blindspot;
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
    blindSpots: taskTraces
      .flatMap((t) => t.blindSpots)
      .sort((a, b) => b.ts.localeCompare(a.ts)),
    totals: domainTraces.reduce(
      (acc, d) => {
        acc.answers += d.answers;
        acc.correct += d.correct;
        acc.bankTotal += d.bankTotal;
        acc.distinctSeen += d.distinctSeen;
        acc.quadrants.solid += d.quadrants.solid;
        acc.quadrants.lucky += d.quadrants.lucky;
        acc.quadrants.gap += d.quadrants.gap;
        acc.quadrants.blindspot += d.quadrants.blindspot;
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
    legacy: buildLegacy(legacyRatings, events),
  };
}

/**
 * Roll the pre-log calibration ratings up by task. Ratings that overlap the
 * answer log's own period are dropped: from the day the log shipped both
 * stores record the same answer, and counting it twice is the exact mistake
 * this rewrite exists to remove.
 */
function buildLegacy(
  ratings: CalibrationEvent[],
  events: AnswerEvent[]
): Legacy {
  const logStart = events.reduce<string | null>(
    (min, e) => (min === null || e.ts < min ? e.ts : min),
    null
  );
  const older = ratings.filter((r) => logStart === null || r.date < logStart);

  const byTask = new Map<string, Quadrants>();
  for (const r of older) {
    if (!r.taskCode) continue;
    const q = byTask.get(r.taskCode) ?? emptyQuadrants();
    q[quadrantOf(r)]++;
    q.total++;
    byTask.set(r.taskCode, q);
  }

  const totals = emptyQuadrants();
  for (const q of byTask.values()) {
    totals.solid += q.solid;
    totals.lucky += q.lucky;
    totals.gap += q.gap;
    totals.blindspot += q.blindspot;
    totals.total += q.total;
  }

  const dates = older.map((r) => r.date).sort();
  return {
    tasks: [...byTask.entries()]
      .map(([code, quadrants]) => ({
        code,
        domain: Number(code.split(".")[0]),
        quadrants,
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    totals,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
  };
}

export type QuestionVerdict = "missed" | "shaky" | "solid" | "unseen";

/** Classify one question from the answers logged against it. */
export function verdictForQuestion(events: AnswerEvent[]): QuestionVerdict {
  if (events.length === 0) return "unseen";
  const wrong = events.filter((e) => !e.correct).length;
  if (wrong === 0) return "solid";
  return wrong >= events.length - wrong ? "missed" : "shaky";
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
