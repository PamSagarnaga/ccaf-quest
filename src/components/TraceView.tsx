"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { scenarios } from "@/lib/blueprint";
import { loadAnswers, type AnswerEvent } from "@/lib/answers";
import {
  buildTrace,
  quadrantOfAnswer,
  verdictForQuestion,
  VERDICT_META,
  type DomainTrace,
  type Quadrants,
  type TaskTrace,
  type Trace,
  type QuestionVerdict,
} from "@/lib/trace";
import type { QuizQuestion } from "@/lib/quiz-types";

const SELECT =
  "id,domain,task_code,scenario,stem,type,difficulty,options:question_options(label,body,is_correct,rationale,sort)";

type SortKey = "blueprint" | "mastery" | "accuracy";

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const day = (iso: string) => iso.slice(0, 10);

/** Red→green blend keyed on a 0..1 score; neutral when there's no data. */
function scoreColor(v: number | null): string {
  if (v === null) return "var(--text-muted)";
  return `color-mix(in oklab, var(--correct) ${Math.round(v * 100)}%, var(--wrong))`;
}

/** Solid / lucky / gap / blind spot as a single proportional bar. */
function QuadrantBar({ q }: { q: Quadrants }) {
  if (q.total === 0)
    return (
      <div className="h-1.5 w-full rounded-full border border-dashed border-border" />
    );
  const seg = [
    { n: q.solid, color: "var(--correct)" },
    { n: q.lucky, color: "var(--d1)" },
    { n: q.gap, color: "var(--text-muted)" },
    { n: q.blindspot, color: "var(--wrong)" },
  ];
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full">
      {seg.map((s, i) =>
        s.n === 0 ? null : (
          <div
            key={i}
            style={{ width: `${(s.n / q.total) * 100}%`, background: s.color }}
          />
        )
      )}
    </div>
  );
}

export function TraceView({
  taskBankCounts,
}: {
  taskBankCounts: Record<string, number>;
}) {
  // localStorage is client-only; build after mount so SSR stays stable.
  const [trace, setTrace] = useState<Trace | null>(null);
  const [events, setEvents] = useState<AnswerEvent[]>([]);
  const [sort, setSort] = useState<SortKey>("blueprint");

  useEffect(() => {
    const evs = loadAnswers();
    setEvents(evs);
    setTrace(buildTrace(taskBankCounts, evs));
  }, [taskBankCounts]);

  /** Answers grouped by question, so drill-downs don't rescan the log. */
  const byItem = useMemo(() => {
    const m = new Map<string, AnswerEvent[]>();
    for (const e of events) m.set(e.itemId, [...(m.get(e.itemId) ?? []), e]);
    return m;
  }, [events]);

  if (!trace) return null;

  const { totals, legacy } = trace;
  const coveragePct = totals.bankTotal
    ? Math.round((totals.distinctSeen / totals.bankTotal) * 100)
    : 0;
  const noLog = totals.answers === 0;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
      <p className="rise mb-3 font-mono text-xs uppercase tracking-[0.3em] text-accent">
        Audit your reps
      </p>
      <h1
        className="rise font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
        style={{ animationDelay: "0.05s" }}
      >
        Performance <span className="sheen italic">trace</span>
      </h1>
      <p className="rise mt-4 max-w-xl text-dim" style={{ animationDelay: "0.1s" }}>
        Every domain and task, scored two ways from the same answers: what you
        got <em>right</em>, and what you knew <em>cold</em>. A task can look
        strong on the first and be held up entirely by luck on the second.
      </p>

      <BlindSpots trace={trace} />

      {noLog ? (
        <p className="mt-10 rounded-xl border border-border p-5 text-center font-mono text-sm leading-relaxed text-muted">
          No answers in the log yet. Take a quiz and the numbers below start
          filling in.
          <br />
          Your earlier sessions are kept in{" "}
          <span className="text-dim">History</span> at the bottom.
        </p>
      ) : (
        <>
          <Summary trace={trace} coveragePct={coveragePct} />
          <Priorities trace={trace} />

          <section className="mt-12">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-lg text-ink">By domain &amp; task</h2>
              <div className="flex gap-1 font-mono text-xs">
                {(
                  [
                    ["blueprint", "blueprint"],
                    ["mastery", "weakest"],
                    ["accuracy", "accuracy"],
                  ] as [SortKey, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSort(key)}
                    className="rounded-md border px-2.5 py-1 transition-colors"
                    style={{
                      borderColor: sort === key ? "var(--accent)" : "var(--border)",
                      color: sort === key ? "var(--accent)" : "var(--text-muted)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-5">
              {trace.domains.map((d) => (
                <DomainPanel
                  key={d.number}
                  domain={d}
                  sort={sort}
                  byItem={byItem}
                />
              ))}
            </div>
          </section>

          <Legend />
          <Scenarios events={events} />
        </>
      )}

      <History legacy={legacy} />

      <div className="mt-10 flex justify-center gap-3">
        <Link
          href="/progress"
          className="rounded-lg border border-border px-5 py-2.5 font-mono text-sm text-ink transition-colors hover:border-[color:var(--accent)]"
        >
          ← Progress
        </Link>
        <Link
          href="/practice"
          className="rounded-lg px-5 py-2.5 font-mono text-sm font-semibold text-[color:var(--bg)]"
          style={{ background: "var(--cta)" }}
        >
          Drill a weak spot →
        </Link>
      </div>
    </main>
  );
}

/** The headline answer to "which questions am I confidently wrong about". */
function BlindSpots({ trace }: { trace: Trace }) {
  const events = trace.blindSpots;
  const legacyBlind = trace.legacy.totals.blindspot;
  const [questions, setQuestions] = useState<Map<string, QuizQuestion>>(
    new Map()
  );

  useEffect(() => {
    const ids = [...new Set(events.map((e) => e.itemId))];
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("questions").select(SELECT).in("id", ids);
      if (cancelled) return;
      const m = new Map<string, QuizQuestion>();
      for (const q of (data ?? []) as unknown as QuizQuestion[])
        m.set(q.id, { ...q, options: [...q.options].sort((a, b) => a.sort - b.sort) });
      setQuestions(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [events]);

  return (
    <section className="mt-10">
      <h2 className="mb-1 font-display text-lg text-ink">Blind spots</h2>
      <p className="mb-4 max-w-xl font-mono text-[0.7rem] leading-relaxed text-muted">
        Answers you were <span className="text-ink">certain</span> about and got
        wrong. The dangerous ones — you&apos;d never think to study them.
      </p>

      {events.length === 0 ? (
        <p className="rounded-xl border border-border p-4 font-mono text-xs leading-relaxed text-muted">
          None logged yet.
          {legacyBlind > 0 && (
            <>
              {" "}
              You have <span className="text-ink">{legacyBlind}</span> from before
              per-question tracking — see History below. Those recorded the task
              but not the question, so they can&apos;t be opened.
            </>
          )}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((e) => (
            <BlindSpotRow
              key={`${e.itemId}-${e.ts}`}
              event={e}
              question={questions.get(e.itemId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function BlindSpotRow({
  event,
  question,
}: {
  event: AnswerEvent;
  question?: QuizQuestion;
}) {
  const [open, setOpen] = useState(false);
  const answer = question?.options.find((o) => o.is_correct);
  return (
    <div
      className="rounded-xl border"
      style={{ borderColor: "color-mix(in oklab, var(--wrong) 40%, transparent)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="shrink-0 font-mono text-xs font-semibold text-ink">
          {event.task ?? "—"}
        </span>
        <span className="min-w-0 flex-1 text-xs leading-relaxed text-dim">
          {question ? question.stem : "Loading question…"}
        </span>
        <span className="shrink-0 font-mono text-[0.6rem] text-muted">
          {day(event.ts)} · {event.mode}
        </span>
        <span className="shrink-0 font-mono text-xs text-muted">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && answer && (
        <div className="border-t border-border px-4 py-3">
          <div className="font-mono text-[0.65rem] uppercase tracking-wider text-muted">
            Correct answer — {answer.label}
          </div>
          <div className="mt-1 text-xs text-ink">{answer.body}</div>
          {answer.rationale && (
            <p className="mt-2 text-xs leading-relaxed text-dim">
              {answer.rationale}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Summary({ trace, coveragePct }: { trace: Trace; coveragePct: number }) {
  const { totals } = trace;
  const q = totals.quadrants;
  const cells: [string, string, string][] = [
    [
      "Accuracy",
      pct(totals.answers ? totals.correct / totals.answers : null),
      `${totals.correct}/${totals.answers} answers`,
    ],
    [
      "Knew it cold",
      pct(q.total ? q.solid / q.total : null),
      `${q.solid}/${q.total} rated`,
    ],
    ["Lucky", String(q.lucky), "right, but unsure"],
    ["Blind spots", String(q.blindspot), "certain, but wrong"],
  ];
  return (
    <div className="rise codex-panel mt-8 p-5" style={{ animationDelay: "0.15s" }}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cells.map(([label, value, sub]) => (
          <div key={label}>
            <div className="font-mono text-xs uppercase tracking-widest text-muted">
              {label}
            </div>
            <div className="mt-1 font-display text-2xl tabular text-ink">
              {value}
            </div>
            <div className="font-mono text-[0.65rem] text-muted">{sub}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-muted">
          Bank coverage
        </span>
        <span className="font-mono text-sm tabular text-dim">
          {totals.distinctSeen} / {totals.bankTotal} seen · {coveragePct}%
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)]">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${coveragePct}%`, background: "var(--accent)" }}
        />
      </div>
      <p className="mt-3 font-mono text-[0.65rem] leading-relaxed text-muted">
        Accuracy counts every logged answer. &ldquo;Cold&rdquo; counts only the
        ones you rated — the confidence tap is optional in exams and absent in
        sudden death. Coverage also includes questions answered before the log
        existed.
      </p>
    </div>
  );
}

function Priorities({ trace }: { trace: Trace }) {
  const { priorities, untested } = trace;
  if (priorities.length === 0 && untested.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-1 font-display text-lg text-ink">Study next</h2>
      <p className="mb-4 max-w-xl font-mono text-[0.7rem] leading-relaxed text-muted">
        Ranked by expected exam damage: how many of the ~60 items this task is
        projected to contribute that you&apos;d currently get wrong. Weighted by
        the blueprint, so a weak task in a 27% domain outranks the same weakness
        in a 15% one.
      </p>
      <div className="codex-panel flex flex-col divide-y divide-[color:var(--border)] p-0">
        {priorities.map((t, i) => (
          <div key={t.code} className="flex items-baseline gap-3 px-5 py-3">
            <span className="font-mono text-xs text-muted">{i + 1}</span>
            <span className="font-mono text-sm font-semibold text-ink">{t.code}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-dim">
              {t.statement}
            </span>
            <span
              className="font-mono text-xs tabular"
              style={{ color: scoreColor(t.mastery) }}
            >
              {pct(t.mastery)}
            </span>
            <span className="w-12 text-right font-mono text-xs tabular text-muted">
              −{t.expectedMissed.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
      {untested.length > 0 && (
        <p className="mt-3 font-mono text-[0.7rem] leading-relaxed text-muted">
          <span className="text-dim">Too little data to judge:</span>{" "}
          {untested.map((t) => t.code).join(", ")} — fewer than 3 logged answers
          each. Unknown is its own risk; they aren&apos;t ranked because there&apos;s
          nothing to rank.
        </p>
      )}
    </section>
  );
}

function DomainPanel({
  domain,
  sort,
  byItem,
}: {
  domain: DomainTrace;
  sort: SortKey;
  byItem: Map<string, AnswerEvent[]>;
}) {
  const sorted = useMemo(() => {
    const t = [...domain.tasks];
    if (sort === "blueprint") return t;
    const key = (x: TaskTrace) => (sort === "mastery" ? x.mastery : x.accuracy);
    // Nulls last: no data isn't the same as a bad score.
    return t.sort((a, b) => {
      const av = key(a);
      const bv = key(b);
      if (av === null && bv === null) return a.code.localeCompare(b.code);
      if (av === null) return 1;
      if (bv === null) return -1;
      return av - bv;
    });
  }, [domain.tasks, sort]);

  return (
    <div className="codex-panel p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span
          className="font-mono text-sm font-semibold"
          style={{ color: `var(--${domain.accent})` }}
        >
          D{domain.number} · {domain.name}
        </span>
        <span className="font-mono text-xs tabular text-muted">
          {domain.weight}% of exam · {domain.distinctSeen}/{domain.bankTotal} seen
        </span>
      </div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-xs tabular">
        <span style={{ color: scoreColor(domain.accuracy) }}>
          {pct(domain.accuracy)} right
          <span className="text-muted"> ({domain.answers})</span>
        </span>
        <span style={{ color: scoreColor(domain.solidRate) }}>
          {pct(domain.solidRate)} cold
          <span className="text-muted"> ({domain.quadrants.total})</span>
        </span>
        <span className="text-muted">
          −{domain.expectedMissed.toFixed(1)} expected items
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {sorted.map((t) => (
          <TaskRow key={t.code} task={t} byItem={byItem} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  byItem,
}: {
  task: TaskTrace;
  byItem: Map<string, AnswerEvent[]>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:border-[color:var(--accent)]"
        aria-expanded={open}
      >
        <span className="font-mono text-xs font-semibold text-ink">{task.code}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-dim">{task.statement}</span>
          <span className="mt-1 block">
            <QuadrantBar q={task.quadrants} />
          </span>
        </span>
        <span className="shrink-0 text-right font-mono text-[0.7rem] tabular leading-tight">
          <span className="block" style={{ color: scoreColor(task.accuracy) }}>
            {pct(task.accuracy)} right
            <span className="text-muted"> ({task.answers})</span>
          </span>
          <span className="block" style={{ color: scoreColor(task.solidRate) }}>
            {pct(task.solidRate)} cold
            <span className="text-muted"> ({task.quadrants.total})</span>
          </span>
        </span>
        <span className="w-16 shrink-0 text-right font-mono text-[0.65rem] text-muted">
          {task.distinctSeen}/{task.bankTotal} seen
          {task.thin && <span className="block text-[0.6rem]">thin data</span>}
        </span>
        <span className="shrink-0 font-mono text-xs text-muted">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <TaskQuestions task={task} byItem={byItem} />}
    </div>
  );
}

function TaskQuestions({
  task,
  byItem,
}: {
  task: TaskTrace;
  byItem: Map<string, AnswerEvent[]>;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("questions")
        .select(SELECT)
        .eq("task_code", task.code);
      if (cancelled) return;
      const qs = ((data ?? []) as unknown as QuizQuestion[]).map((q) => ({
        ...q,
        options: [...q.options].sort((a, b) => a.sort - b.sort),
      }));
      setQuestions(qs);
    })();
    return () => {
      cancelled = true;
    };
  }, [task.code]);

  if (questions === null)
    return (
      <p className="border-t border-border px-3 py-3 font-mono text-xs text-muted">
        Loading questions…
      </p>
    );

  // Worst first: missed, then shaky, then never-seen, then solid.
  const ranked = questions
    .map((q) => {
      const evs = byItem.get(q.id) ?? [];
      return { q, evs, verdict: verdictForQuestion(evs) };
    })
    .sort((a, b) => VERDICT_META[a.verdict].order - VERDICT_META[b.verdict].order);

  return (
    <div className="flex flex-col divide-y divide-[color:var(--border)] border-t border-border">
      {ranked.map(({ q, evs, verdict }) => (
        <QuestionDetail key={q.id} q={q} verdict={verdict} events={evs} />
      ))}
    </div>
  );
}

function QuestionDetail({
  q,
  verdict,
  events,
}: {
  q: QuizQuestion;
  verdict: QuestionVerdict;
  events: AnswerEvent[];
}) {
  const [open, setOpen] = useState(verdict === "missed");
  const meta = VERDICT_META[verdict];
  const answer = q.options.find((o) => o.is_correct);
  const right = events.filter((e) => e.correct).length;
  const blind = events.some((e) => quadrantOfAnswer(e) === "blindspot");

  return (
    <div className="px-3 py-2.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 text-left"
        aria-expanded={open}
      >
        <span
          className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider"
          style={{
            color: meta.color,
            border: `1px solid color-mix(in oklab, ${meta.color} 45%, transparent)`,
          }}
        >
          {blind ? "Blind spot" : meta.label}
        </span>
        <span className="min-w-0 flex-1 text-xs leading-relaxed text-dim">
          {q.stem}
        </span>
        <span className="shrink-0 font-mono text-[0.6rem] tabular text-muted">
          {events.length ? `${right}✓/${events.length - right}✗` : "—"} · L
          {q.difficulty}
        </span>
      </button>
      {open && answer && (
        <div className="mt-2 rounded-md border border-border p-2.5">
          <div className="font-mono text-[0.65rem] uppercase tracking-wider text-muted">
            Answer {answer.label}
          </div>
          <div className="mt-1 text-xs text-ink">{answer.body}</div>
          {answer.rationale && (
            <p className="mt-2 text-xs leading-relaxed text-dim">
              {answer.rationale}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Scenario accuracy. Scenarios cut across domains, so this is the one view
 * here that isn't domain/task shaped — a task can be strong while one scenario
 * framing of it consistently isn't.
 */
function Scenarios({ events }: { events: AnswerEvent[] }) {
  const byScenario = useMemo(() => {
    const m = new Map<string, { correct: number; total: number }>();
    for (const e of events) {
      if (!e.scenario) continue;
      const b = m.get(e.scenario) ?? { correct: 0, total: 0 };
      b.total++;
      if (e.correct) b.correct++;
      m.set(e.scenario, b);
    }
    return m;
  }, [events]);

  return (
    <section className="mt-12">
      <h2 className="mb-4 font-display text-lg text-ink">By scenario</h2>
      <div className="codex-panel flex flex-col gap-4 p-5">
        {scenarios.map((s) => {
          const b = byScenario.get(s.slug);
          const acc = b && b.total ? b.correct / b.total : null;
          return (
            <div key={s.slug}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="text-dim">{s.name}</span>
                <span className="font-mono text-xs tabular text-muted">
                  {acc === null ? "— no reps" : `${pct(acc)} · ${b!.correct}/${b!.total}`}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(acc ?? 0) * 100}%`,
                    background: acc === null ? "transparent" : scoreColor(acc),
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Ratings from before the answer log. Task-level only — kept, never blended. */
function History({ legacy }: { legacy: Trace["legacy"] }) {
  const [open, setOpen] = useState(false);
  if (legacy.totals.total === 0) return null;
  const t = legacy.totals;
  return (
    <section className="mt-12">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-baseline justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <h2 className="font-display text-lg text-ink">History (task-level)</h2>
        <span className="font-mono text-xs text-muted">
          {t.total} ratings · {legacy.from ? day(legacy.from) : "—"} →{" "}
          {legacy.to ? day(legacy.to) : "—"} {open ? "−" : "+"}
        </span>
      </button>
      <p className="mt-2 max-w-xl font-mono text-[0.7rem] leading-relaxed text-muted">
        Confidence ratings logged before per-question tracking existed. They
        record the task but not the question, so nothing here opens to a
        question and none of it feeds the numbers above. Kept as history.
      </p>
      {open && (
        <div className="codex-panel mt-4 flex flex-col gap-2 p-5">
          <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
            <span>solid {t.solid}</span>
            <span>lucky {t.lucky}</span>
            <span>gap {t.gap}</span>
            <span style={{ color: "var(--wrong)" }}>blind {t.blindspot}</span>
          </div>
          {legacy.tasks.map((lt) => (
            <div key={lt.code} className="flex items-center gap-3">
              <span className="w-10 shrink-0 font-mono text-xs text-ink">
                {lt.code}
              </span>
              <span className="flex-1">
                <QuadrantBar q={lt.quadrants} />
              </span>
              <span className="w-28 shrink-0 text-right font-mono text-[0.65rem] tabular text-muted">
                {lt.quadrants.solid}/{lt.quadrants.total} cold
                {lt.quadrants.blindspot > 0 && (
                  <span style={{ color: "var(--wrong)" }}>
                    {" "}
                    · {lt.quadrants.blindspot} blind
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Legend() {
  const items: [string, string, string][] = [
    ["Solid", "var(--correct)", "certain and right — knew it cold"],
    ["Lucky", "var(--d1)", "right, but unsure — fragile"],
    ["Gap", "var(--text-muted)", "unsure and wrong — an honest hole"],
    ["Blind spot", "var(--wrong)", "certain and wrong — the dangerous one"],
  ];
  return (
    <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
      {items.map(([label, color, note]) => (
        <span key={label} className="flex items-center gap-2 font-mono text-[0.65rem]">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: color }}
            aria-hidden
          />
          <span className="text-ink">{label}</span>
          <span className="text-muted">{note}</span>
        </span>
      ))}
    </div>
  );
}
