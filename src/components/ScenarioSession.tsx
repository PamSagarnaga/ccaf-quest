"use client";
import { useState } from "react";
import Link from "next/link";
import type { QuizQuestion } from "@/lib/quiz-types";
import { domainByNumber, type Scenario } from "@/lib/blueprint";
import { drawScenarioSet } from "@/lib/scenarioDraw";
import { QuizRunner } from "@/components/QuizRunner";

/**
 * Client shell for a scenario drill. Same job as `QuizSession`, but the draw is
 * domain-balanced (see `scenarioDraw.ts`) so the set spans everything the
 * scenario covers instead of landing wherever the bank happens to be deepest.
 *
 * When a primary domain contributes nothing, that's stated on screen before the
 * first question rather than passed over. A drill that quietly skips a domain
 * would read as coverage the user doesn't actually have — the same class of
 * mistake the answer-log rewrite existed to remove.
 */
export function ScenarioSession({
  pool,
  count,
  scenario,
}: {
  pool: QuizQuestion[];
  count: number;
  scenario: Scenario;
}) {
  const [draw] = useState(() =>
    drawScenarioSet(pool, count, scenario.slug, scenario.primary_domains)
  );
  const [started, setStarted] = useState(false);

  const missing = (scenario.primary_domains as readonly number[]).filter(
    (d) => !draw.perDomain[d]
  );

  if (started)
    return (
      <QuizRunner
        questions={draw.questions}
        domain={null}
        scenario={{ slug: scenario.slug, name: scenario.name }}
      />
    );

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
      <p className="rise mb-3 font-mono text-xs uppercase tracking-[0.3em] text-accent">
        Scenario drill
      </p>
      <h1
        className="rise font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
        style={{ animationDelay: "0.05s" }}
      >
        {scenario.name}
      </h1>
      <p className="rise mt-4 text-dim" style={{ animationDelay: "0.1s" }}>
        {scenario.description}
      </p>

      <div className="codex-panel mt-8 p-5">
        <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
          {draw.questions.length} questions across
        </div>
        <div className="flex flex-col gap-2">
          {Object.entries(draw.perDomain)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([d, n]) => {
              const dn = Number(d);
              const meta = domainByNumber(dn);
              const primary = (
                scenario.primary_domains as readonly number[]
              ).includes(dn);
              return (
                <div key={d} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-dim">
                    <span
                      className="font-mono text-xs font-semibold"
                      style={{ color: `var(--${meta.accent})` }}
                    >
                      D{d}
                    </span>{" "}
                    {meta.name}
                    {!primary && (
                      <span className="ml-2 font-mono text-[0.65rem] text-muted">
                        incidental
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs tabular text-muted">
                    {n}
                  </span>
                </div>
              );
            })}
        </div>

        {missing.length > 0 && (
          <p
            className="mt-4 border-t border-border pt-3 font-mono text-[0.7rem] leading-relaxed"
            style={{ color: "var(--wrong)" }}
          >
            No questions available for{" "}
            {missing.map((d) => `D${d} ${domainByNumber(d).name}`).join(", ")} —
            this scenario covers {missing.length === 1 ? "it" : "them"} on the
            real exam, so this drill is short of full coverage.
          </p>
        )}
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/practice"
          className="rounded-lg border border-border px-5 py-2.5 font-mono text-sm text-ink transition-colors hover:border-[color:var(--accent)]"
        >
          ← Practice
        </Link>
        <button
          onClick={() => setStarted(true)}
          className="rounded-lg px-6 py-2.5 font-mono text-sm font-semibold text-[color:var(--bg)]"
          style={{ background: "var(--cta)" }}
        >
          Begin →
        </button>
      </div>
    </main>
  );
}
