"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { domains, tasksForDomain, scenarios } from "@/lib/blueprint";
import {
  aggregate,
  distinctSeen,
  loadItemStats,
  type Bucket,
} from "@/lib/itemStats";

const EMPTY: Bucket = { correct: 0, wrong: 0, total: 0, distinct: 0 };

/** accuracy 0..100, or null when the bucket has no attempts yet. */
function accuracyOf(b: Bucket): number | null {
  return b.total === 0 ? null : Math.round((b.correct / b.total) * 100);
}

/** Red→green blend keyed on accuracy; neutral border when untouched. */
function cellColors(acc: number | null) {
  if (acc === null)
    return { bg: "transparent", border: "var(--border)" };
  const mix = `color-mix(in oklab, var(--correct) ${acc}%, var(--wrong))`;
  return {
    bg: `color-mix(in oklab, ${mix} 18%, transparent)`,
    border: mix,
  };
}

export function HeatmapView({ bankTotal }: { bankTotal: number }) {
  // localStorage is client-only; load after mount so SSR stays stable.
  const [loaded, setLoaded] = useState(false);
  const [byTask, setByTask] = useState<Record<string, Bucket>>({});
  const [byDomain, setByDomain] = useState<Record<string, Bucket>>({});
  const [byScenario, setByScenario] = useState<Record<string, Bucket>>({});
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    const stats = loadItemStats();
    setByTask(aggregate("task", stats));
    setByDomain(aggregate("domain", stats));
    setByScenario(aggregate("scenario", stats));
    setSeen(distinctSeen(stats));
    setLoaded(true);
  }, []);

  const coveragePct = bankTotal ? Math.round((seen / bankTotal) * 100) : 0;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
      <p className="rise mb-3 font-mono text-xs uppercase tracking-[0.3em] text-accent">
        Audit your reps
      </p>
      <h1
        className="rise font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
        style={{ animationDelay: "0.05s" }}
      >
        Mastery <span className="sheen italic">heatmap</span>
      </h1>
      <p
        className="rise mt-4 max-w-xl text-dim"
        style={{ animationDelay: "0.1s" }}
      >
        Every answered question, tallied by domain, task, and scenario. Greener
        cells mean higher accuracy; grey cells you haven&apos;t hit yet.
      </p>

      {/* Coverage banner */}
      <div className="rise codex-panel mt-8 p-5" style={{ animationDelay: "0.15s" }}>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-xs uppercase tracking-widest text-muted">
            Bank coverage
          </span>
          <span className="font-mono text-sm tabular text-dim">
            {seen} / {bankTotal} seen · {coveragePct}%
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)]">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${coveragePct}%`, background: "var(--accent)" }}
          />
        </div>
      </div>

      {!loaded ? null : seen === 0 ? (
        <p className="mt-10 text-center font-mono text-sm text-muted">
          No answers logged yet. Run a{" "}
          <Link href="/practice" className="text-accent hover:underline">
            practice quiz
          </Link>{" "}
          to start filling the map.
        </p>
      ) : (
        <>
          {/* Domain × task grid */}
          <section className="mt-10">
            <h2 className="mb-4 font-display text-lg text-ink">By domain &amp; task</h2>
            <div className="flex flex-col gap-5">
              {domains.map((d) => {
                const dBucket = byDomain[String(d.number)] ?? EMPTY;
                const dAcc = accuracyOf(dBucket);
                return (
                  <div key={d.number} className="codex-panel p-5">
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                      <span
                        className="font-mono text-sm font-semibold"
                        style={{ color: `var(--${d.accent})` }}
                      >
                        D{d.number} · {d.name}
                      </span>
                      <span className="font-mono text-xs tabular text-muted">
                        {dAcc === null
                          ? "— no reps"
                          : `${dAcc}% · ${dBucket.correct}/${dBucket.total}`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {tasksForDomain(d.number).map((t) => {
                        const b = byTask[t.code] ?? EMPTY;
                        const acc = accuracyOf(b);
                        const { bg, border } = cellColors(acc);
                        return (
                          <div
                            key={t.code}
                            title={t.statement}
                            className="rounded-lg border px-3 py-2.5"
                            style={{ background: bg, borderColor: border }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-semibold text-ink">
                                {t.code}
                              </span>
                              <span
                                className="font-mono text-xs tabular"
                                style={{
                                  color:
                                    acc === null
                                      ? "var(--text-muted)"
                                      : "var(--ink)",
                                }}
                              >
                                {acc === null ? "—" : `${acc}%`}
                              </span>
                            </div>
                            <div className="mt-1 font-mono text-[0.65rem] text-muted">
                              {acc === null
                                ? "no reps"
                                : `${b.correct}/${b.total} · ${b.distinct} Q`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Scenario breakdown */}
          <section className="mt-10">
            <h2 className="mb-4 font-display text-lg text-ink">By scenario</h2>
            <div className="codex-panel flex flex-col gap-4 p-5">
              {scenarios.map((s) => {
                const b = byScenario[s.slug] ?? EMPTY;
                const acc = accuracyOf(b);
                return (
                  <div key={s.slug}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-dim">{s.name}</span>
                      <span className="font-mono text-xs tabular text-muted">
                        {acc === null
                          ? "— no reps"
                          : `${acc}% · ${b.correct}/${b.total}`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${acc ?? 0}%`,
                          background:
                            acc === null
                              ? "transparent"
                              : `color-mix(in oklab, var(--correct) ${acc}%, var(--wrong))`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

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
