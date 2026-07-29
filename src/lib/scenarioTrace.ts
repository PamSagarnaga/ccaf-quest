"use client";
/**
 * Scenario trace — the same answers as `trace.ts`, sliced the other way.
 *
 * The exam presents 4 of 6 scenarios, and a scenario cuts across domains: the
 * Customer Support agent is graded on D1 orchestration, D2 tool design and D5
 * reliability at once. So "how am I doing on Customer Support" is a real
 * question that a domain-shaped view cannot answer, because strength in D2 can
 * hide the fact that the D5 half of that scenario has never been touched.
 *
 * Two things this deliberately does NOT do:
 *
 *  1. It does not introduce a store. Every number here is derived from the same
 *     `ccaf_answers` rows as the domain view, so a scenario figure and a task
 *     figure can never disagree — the rule from the answer-log rewrite.
 *  2. It does not average a scenario's domains into one headline and stop
 *     there. `unexercised` names the primary domains with no reps, because an
 *     untouched domain is the finding, and a mean over the domains that *do*
 *     have reps would bury it.
 *
 * Answers whose task falls outside the scenario's blueprint domains still
 * count. Questions are tagged with the scenario they're framed in, and the
 * blueprint's `primary_domains` is a statement about emphasis, not a fence.
 * Those rows land in `otherDomains` so the split stays visible.
 */
import {
  scenarios,
  tasks,
  domainByNumber,
  type Scenario,
} from "@/lib/blueprint";
import { loadAnswers, type AnswerEvent } from "@/lib/answers";
import {
  MIN_CONFIDENT_N,
  blendMastery,
  emptyQuadrants,
  quadrantOfAnswer,
  ratio,
  type Quadrants,
} from "@/lib/trace";

/** Bank stock for one scenario: domain → task code → question count. */
export type ScenarioBankCounts = Record<
  string,
  Record<number, Record<string, number>>
>;

export interface ScenarioTaskTrace {
  code: string;
  statement: string;
  correct: number;
  answers: number;
  accuracy: number | null;
  quadrants: Quadrants;
  solidRate: number | null;
  blindSpots: AnswerEvent[];
  bankTotal: number;
  distinctSeen: number;
  unseen: number;
  mastery: number | null;
  thin: boolean;
}

export interface ScenarioDomainTrace {
  number: number;
  name: string;
  accent: string;
  /** Listed in the scenario's `primary_domains`, as opposed to incidental. */
  primary: boolean;
  tasks: ScenarioTaskTrace[];
  correct: number;
  answers: number;
  accuracy: number | null;
  quadrants: Quadrants;
  solidRate: number | null;
  bankTotal: number;
  distinctSeen: number;
  unseen: number;
  mastery: number | null;
}

export interface ScenarioTrace {
  slug: string;
  name: string;
  description: string;
  /** Blueprint primary domains first, in blueprint order, then any others. */
  domains: ScenarioDomainTrace[];
  /** Primary domains with stock in the bank but no answers logged yet. */
  unexercised: number[];
  /** Primary domains the bank has no questions for at all. */
  unstocked: number[];
  correct: number;
  answers: number;
  accuracy: number | null;
  quadrants: Quadrants;
  solidRate: number | null;
  blindSpots: AnswerEvent[];
  bankTotal: number;
  distinctSeen: number;
  unseen: number;
  mastery: number | null;
  /** Fewer than MIN_CONFIDENT_N answers — too little to read either way. */
  thin: boolean;
}

const statementOf = (code: string) =>
  tasks.find((t) => t.code === code)?.statement ?? code;

/** Domains a scenario touches: blueprint primaries first, then any others. */
function domainOrder(s: Scenario, extra: Iterable<number>): number[] {
  const primary = [...s.primary_domains] as number[];
  const rest = [...new Set(extra)]
    .filter((d) => !primary.includes(d))
    .sort((a, b) => a - b);
  return [...primary, ...rest];
}

/**
 * Build the per-scenario trace.
 *
 * `bankCounts` comes from the server (`getScenarioQuestionCounts`) and supplies
 * the coverage denominators; `events` defaults to the live answer log and is
 * injectable so the tests can run headless.
 */
export function buildScenarioTrace(
  bankCounts: ScenarioBankCounts,
  events: AnswerEvent[] = loadAnswers()
): ScenarioTrace[] {
  // slug → domain → task → tally
  type Bucket = {
    correct: number;
    answers: number;
    quadrants: Quadrants;
    blindSpots: AnswerEvent[];
    seen: Set<string>;
  };
  const newBucket = (): Bucket => ({
    correct: 0,
    answers: 0,
    quadrants: emptyQuadrants(),
    blindSpots: [],
    seen: new Set(),
  });

  const log = new Map<string, Map<number, Map<string, Bucket>>>();
  for (const e of events) {
    if (!e.scenario || !e.task) continue;
    const byDomain = log.get(e.scenario) ?? new Map();
    log.set(e.scenario, byDomain);
    const byTask = byDomain.get(e.domain) ?? new Map<string, Bucket>();
    byDomain.set(e.domain, byTask);
    const b = byTask.get(e.task) ?? newBucket();
    byTask.set(e.task, b);

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

  return scenarios.map((s) => {
    const stock = bankCounts[s.slug] ?? {};
    const logged = log.get(s.slug) ?? new Map();
    const order = domainOrder(s, [
      ...Object.keys(stock).map(Number),
      ...logged.keys(),
    ]);

    const domainTraces: ScenarioDomainTrace[] = order.map((n) => {
      const meta = domainByNumber(n);
      const taskStock = stock[n] ?? {};
      const taskLog = logged.get(n) ?? new Map<string, Bucket>();
      const codes = [
        ...new Set([...Object.keys(taskStock), ...taskLog.keys()]),
      ].sort();

      const taskTraces: ScenarioTaskTrace[] = codes.map((code) => {
        const b = taskLog.get(code);
        const answers = b?.answers ?? 0;
        const correct = b?.correct ?? 0;
        const quadrants = b?.quadrants ?? emptyQuadrants();
        const accuracy = ratio(correct, answers);
        const solidRate = ratio(quadrants.solid, quadrants.total);
        const bankTotal = taskStock[code] ?? 0;
        const distinctSeen = b?.seen.size ?? 0;
        return {
          code,
          statement: statementOf(code),
          correct,
          answers,
          accuracy,
          quadrants,
          solidRate,
          blindSpots: [...(b?.blindSpots ?? [])].sort((x, y) =>
            y.ts.localeCompare(x.ts)
          ),
          bankTotal,
          distinctSeen,
          unseen: Math.max(0, bankTotal - distinctSeen),
          mastery: blendMastery(accuracy, solidRate),
          thin: answers < MIN_CONFIDENT_N,
        };
      });

      const roll = taskTraces.reduce(
        (acc, t) => {
          acc.correct += t.correct;
          acc.answers += t.answers;
          acc.bankTotal += t.bankTotal;
          acc.distinctSeen += t.distinctSeen;
          acc.quadrants.solid += t.quadrants.solid;
          acc.quadrants.lucky += t.quadrants.lucky;
          acc.quadrants.gap += t.quadrants.gap;
          acc.quadrants.blindspot += t.quadrants.blindspot;
          acc.quadrants.total += t.quadrants.total;
          return acc;
        },
        {
          correct: 0,
          answers: 0,
          bankTotal: 0,
          distinctSeen: 0,
          quadrants: emptyQuadrants(),
        }
      );
      const accuracy = ratio(roll.correct, roll.answers);
      const solidRate = ratio(roll.quadrants.solid, roll.quadrants.total);
      return {
        number: n,
        name: meta.name,
        accent: meta.accent,
        primary: (s.primary_domains as readonly number[]).includes(n),
        tasks: taskTraces,
        ...roll,
        accuracy,
        solidRate,
        unseen: Math.max(0, roll.bankTotal - roll.distinctSeen),
        mastery: blendMastery(accuracy, solidRate),
      };
    });

    const total = domainTraces.reduce(
      (acc, d) => {
        acc.correct += d.correct;
        acc.answers += d.answers;
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
        correct: 0,
        answers: 0,
        bankTotal: 0,
        distinctSeen: 0,
        quadrants: emptyQuadrants(),
      }
    );
    const accuracy = ratio(total.correct, total.answers);
    const solidRate = ratio(total.quadrants.solid, total.quadrants.total);

    const primaries = domainTraces.filter((d) => d.primary);
    return {
      slug: s.slug,
      name: s.name,
      description: s.description,
      domains: domainTraces,
      unexercised: primaries
        .filter((d) => d.answers === 0 && d.bankTotal > 0)
        .map((d) => d.number),
      unstocked: (s.primary_domains as readonly number[]).filter(
        (n) => !domainTraces.some((d) => d.number === n && d.bankTotal > 0)
      ),
      ...total,
      accuracy,
      solidRate,
      blindSpots: domainTraces
        .flatMap((d) => d.tasks.flatMap((t) => t.blindSpots))
        .sort((a, b) => b.ts.localeCompare(a.ts)),
      unseen: Math.max(0, total.bankTotal - total.distinctSeen),
      mastery: blendMastery(accuracy, solidRate),
      thin: total.answers < MIN_CONFIDENT_N,
    };
  });
}
