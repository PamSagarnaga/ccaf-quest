import Link from "next/link";
import { domains, tasksForDomain } from "@/lib/blueprint";
import { getDomainQuestionCounts } from "@/lib/queries";

export const metadata = { title: "Practice — The Architect's Codex" };

export default async function PracticePage() {
  const counts = await getDomainQuestionCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
      <p className="rise mb-3 font-mono text-xs uppercase tracking-[0.3em] text-accent">
        Trial by fire
      </p>
      <h1
        className="rise font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
        style={{ animationDelay: "0.05s" }}
      >
        Choose your <span className="sheen italic">arena</span>
      </h1>
      <p
        className="rise mt-4 max-w-xl text-dim"
        style={{ animationDelay: "0.1s" }}
      >
        Pick a domain to drill, or take a mixed set across the whole blueprint.
        Each question is explained the moment you answer.
      </p>

      {/* Mixed set */}
      <Link
        href="/practice/run?n=12"
        className="rise codex-panel group mt-8 flex items-center justify-between gap-4 px-6 py-5 transition-colors duration-300 hover:border-[color:var(--accent)]"
        style={{ animationDelay: "0.15s" }}
      >
        <div>
          <div className="font-display text-xl font-medium text-ink">
            Mixed exam
          </div>
          <div className="mt-1 text-sm text-muted">
            12 questions drawn across all 5 domains · weighted like the real exam
          </div>
        </div>
        <span className="font-mono text-sm text-accent">{total} total →</span>
      </Link>

      <Link
        href="/flagged"
        className="rise mt-3 flex items-center justify-between rounded-lg border border-border px-6 py-3 transition-colors hover:border-[color:var(--cta)]"
        style={{ animationDelay: "0.17s" }}
      >
        <span className="font-mono text-sm text-dim">⚑ Review flagged questions</span>
        <span className="font-mono text-sm text-cta">→</span>
      </Link>

      <div className="mb-5 mt-10 flex items-end justify-between">
        <h2 className="font-display text-xl font-medium text-ink">By domain</h2>
        <span className="font-mono text-xs text-muted">
          drill one at a time
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {domains.map((d, i) => {
          const n = counts[d.number] ?? 0;
          const accent = `var(--${d.accent})`;
          const disabled = n === 0;
          const card = (
            <>
              <div className="flex items-center gap-4">
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-lg font-display text-lg font-semibold tabular"
                  style={{
                    color: accent,
                    background: `color-mix(in oklab, ${accent} 14%, transparent)`,
                    border: `1px solid color-mix(in oklab, ${accent} 38%, transparent)`,
                  }}
                >
                  {d.number}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-display text-base font-medium text-ink">
                    {d.name}
                  </div>
                  <div className="font-mono text-xs text-muted">
                    {d.weight}% of exam · {tasksForDomain(d.number).length} tasks
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-xs text-muted">
                  {n} question{n === 1 ? "" : "s"}
                </span>
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: disabled ? "var(--text-faint)" : accent }}
                >
                  {disabled ? "coming soon" : "start →"}
                </span>
              </div>
            </>
          );

          return disabled ? (
            <div
              key={d.number}
              className="rise codex-panel px-5 py-4 opacity-55"
              style={{ animationDelay: `${0.2 + i * 0.05}s` }}
            >
              {card}
            </div>
          ) : (
            <Link
              key={d.number}
              href={`/practice/run?domain=${d.number}&n=${Math.min(n, 10)}`}
              className="rise codex-panel px-5 py-4 transition-shadow duration-300"
              style={{
                animationDelay: `${0.2 + i * 0.05}s`,
                // subtle accent-tinted hover handled by border below
              }}
            >
              {card}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
