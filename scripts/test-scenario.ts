/**
 * Headless suite for the scenario slice. Run from the repo root:
 *   npx tsx <this file>
 *
 * Covers the two claims the feature rests on:
 *   1. the draw spans every primary domain that has stock, even when the bank
 *      is lopsided (Code Generation: 34 D3 vs 6 D5);
 *   2. a scenario roll-up and the task roll-up are the same rows, so they can
 *      never report different numbers for the same answers.
 */
import { allocate } from "@/lib/scenarioDraw";
import { buildScenarioTrace } from "@/lib/scenarioTrace";
import { buildTrace } from "@/lib/trace";
import type { AnswerEvent } from "@/lib/answers";

let pass = 0;
const fails: string[] = [];
function ok(name: string, cond: boolean, extra = "") {
  if (cond) pass++;
  else fails.push(`${name}${extra ? ` — ${extra}` : ""}`);
}
const eq = (name: string, a: unknown, b: unknown) =>
  ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

const sum = (o: Record<number, number>) =>
  Object.values(o).reduce((a, b) => a + b, 0);

// ── allocate ────────────────────────────────────────────────
{
  // Code Generation's real shape: D3 deep, D5 shallow, both primary.
  const a = allocate({ 3: 34, 5: 6 }, 12, [3, 5]);
  eq("allocate: fills the request", sum(a), 12);
  ok("allocate: D5 present despite 6:34 imbalance", (a[5] ?? 0) >= 1, JSON.stringify(a));
  ok("allocate: D3 leads on weight", (a[3] ?? 0) > (a[5] ?? 0), JSON.stringify(a));

  // Floor beats weight: a 1-question domain still gets its slot.
  const b = allocate({ 3: 40, 5: 1 }, 10, [3, 5]);
  eq("allocate: floor honoured at stock 1", b[5], 1);
  eq("allocate: remainder spills to D3", b[3], 9);

  // A primary domain with no stock simply never appears — the caller reports it.
  const c = allocate({ 3: 20 }, 8, [3, 5]);
  eq("allocate: empty domain omitted", c, { 3: 8 });

  // Never over-allocate past stock.
  const d = allocate({ 1: 2, 2: 3 }, 20, [1, 2]);
  eq("allocate: capped by total stock", sum(d), 5);
  eq("allocate: per-domain cap respected", [d[1], d[2]], [2, 3]);

  // Incidental domains get no floor but can take remainder.
  const e = allocate({ 1: 10, 2: 10, 4: 10 }, 3, [1, 2]);
  ok("allocate: both primaries covered before incidental", (e[1] ?? 0) >= 1 && (e[2] ?? 0) >= 1, JSON.stringify(e));
  eq("allocate: total still 3", sum(e), 3);

  // Degenerate inputs.
  eq("allocate: zero count", allocate({ 1: 5 }, 0, [1]), {});
  eq("allocate: no stock", allocate({}, 5, [1, 2]), {});
  ok("allocate: count 1 with two primaries picks one", sum(allocate({ 1: 5, 2: 5 }, 1, [1, 2])) === 1);
}

// ── buildScenarioTrace ──────────────────────────────────────
const ev = (o: Partial<AnswerEvent> & { itemId: string }): AnswerEvent => ({
  ts: "2026-07-29T10:00:00.000Z",
  mode: "quiz",
  domain: 3,
  task: "3.1",
  scenario: "code-generation",
  correct: true,
  confidence: null,
  ...o,
});

const bank = {
  "code-generation": {
    3: { "3.1": 11, "3.2": 7 },
    5: { "5.4": 2, "5.1": 1 },
  },
  "cicd": { 3: { "3.6": 5 }, 4: { "4.1": 4 } },
};

{
  const t = buildScenarioTrace(bank, []);
  const cg = t.find((s) => s.slug === "code-generation")!;
  eq("empty log: accuracy null", cg.accuracy, null);
  eq("empty log: bank total counted", cg.bankTotal, 21);
  eq("empty log: both primaries unexercised", cg.unexercised, [3, 5]);
  eq("empty log: nothing unstocked", cg.unstocked, []);
  ok("empty log: flagged thin", cg.thin);
  eq("every scenario present", t.length, 6);

  // A scenario the bank has nothing for still appears, with its gaps named.
  const cs = t.find((s) => s.slug === "customer-support")!;
  eq("no stock: primaries reported unstocked", cs.unstocked, [1, 2, 5]);
  eq("no stock: not double-reported as unexercised", cs.unexercised, []);
}

{
  const events: AnswerEvent[] = [
    ev({ itemId: "q1", correct: true, confidence: "certain" }),
    ev({ itemId: "q2", correct: false, confidence: "certain" }), // blind spot
    ev({ itemId: "q3", correct: true, confidence: "fairly" }), // lucky
    ev({ itemId: "q4", correct: true, confidence: null }), // accuracy only
    ev({ itemId: "q5", domain: 5, task: "5.4", correct: false, confidence: "guessing" }),
    // Another scenario entirely — must not leak in.
    ev({ itemId: "q6", scenario: "cicd", domain: 4, task: "4.1", correct: false }),
  ];
  const t = buildScenarioTrace(bank, events);
  const cg = t.find((s) => s.slug === "code-generation")!;

  eq("accuracy over all answers incl. unrated", cg.accuracy, 3 / 5);
  eq("cold rate over rated answers only", cg.solidRate, 1 / 4);
  eq("rated total excludes the unrated row", cg.quadrants.total, 4);
  eq("blind spot captured", cg.blindSpots.length, 1);
  eq("blind spot carries its question id", cg.blindSpots[0].itemId, "q2");
  eq("other scenario excluded", cg.answers, 5);

  const d3 = cg.domains.find((d) => d.number === 3)!;
  const d5 = cg.domains.find((d) => d.number === 5)!;
  eq("D3 answers", d3.answers, 4);
  eq("D5 answers", d5.answers, 1);
  eq("D5 accuracy", d5.accuracy, 0);
  eq("no domain left unexercised now", cg.unexercised, []);
  eq("domains ordered primary-first", cg.domains.map((d) => d.number), [3, 5]);
  ok("both marked primary", d3.primary && d5.primary);

  // Task rows survive the scenario slice with their ids intact.
  const t31 = d3.tasks.find((x) => x.code === "3.1")!;
  eq("task 3.1 answers", t31.answers, 4);
  eq("task 3.1 distinct questions seen", t31.distinctSeen, 4);
  eq("task 3.1 coverage denominator", t31.bankTotal, 11);
  eq("unseen = bank − seen", t31.unseen, 7);

  // A task with stock but no answers still shows up, so the gap is visible.
  const t51 = d5.tasks.find((x) => x.code === "5.1")!;
  eq("unanswered task still listed", t51.answers, 0);
  eq("unanswered task keeps its denominator", t51.bankTotal, 1);

  // ── The reconciliation claim ──────────────────────────────
  // Same events through the domain view: the scenario slice must agree.
  const domainTrace = buildTrace({ "3.1": 11, "3.2": 7, "5.4": 2, "5.1": 1, "4.1": 4 }, events, [], {});
  const allScenarioAnswers = t.reduce((a, s) => a + s.answers, 0);
  eq("scenario totals reconcile with domain totals", allScenarioAnswers, domainTrace.totals.answers);
  const allScenarioBlind = t.reduce((a, s) => a + s.blindSpots.length, 0);
  eq("blind spots reconcile", allScenarioBlind, domainTrace.blindSpots.length);
  const task31 = domainTrace.domains
    .find((d) => d.number === 3)!
    .tasks.find((x) => x.code === "3.1")!;
  eq("task 3.1 accuracy identical in both views", t31.accuracy, task31.accuracy);
}

{
  // Answers outside a scenario's blueprint domains are kept and marked
  // incidental rather than dropped on the floor.
  const events = [
    ev({ itemId: "x1", scenario: "cicd", domain: 1, task: "1.4", correct: true }),
    ev({ itemId: "x2", scenario: "cicd", domain: 3, task: "3.6", correct: true }),
  ];
  const cicd = buildScenarioTrace(bank, events).find((s) => s.slug === "cicd")!;
  eq("incidental domain retained", cicd.answers, 2);
  const d1 = cicd.domains.find((d) => d.number === 1)!;
  ok("incidental domain flagged not-primary", d1.primary === false);
  eq("primaries still lead the ordering", cicd.domains.slice(0, 2).map((d) => d.number), [3, 4]);
  eq("incidental domain sorted last", cicd.domains[cicd.domains.length - 1].number, 1);
}

{
  // Rows missing a task or a scenario tag are skipped, not crashed on.
  const events = [
    ev({ itemId: "n1", task: null }),
    ev({ itemId: "n2", scenario: null }),
    ev({ itemId: "n3", correct: true }),
  ];
  const cg = buildScenarioTrace(bank, events).find((s) => s.slug === "code-generation")!;
  eq("untagged rows skipped", cg.answers, 1);
}

console.log(`\n  ${pass} passed, ${fails.length} failed\n`);
for (const f of fails) console.log(`  ✗ ${f}`);
process.exit(fails.length ? 1 : 0);
