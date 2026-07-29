import Link from "next/link";
import { domains, scenarios, tasksForDomain, domainByNumber } from "@/lib/blueprint";
import {
  getDomainQuestionCounts,
  getScenarioQuestionCounts,
} from "@/lib/queries";
import { CoverageBadge } from "@/components/CoverageBadge";

export const metadata = { title: "Practice — The Architect's Codex" };

/**
 * Drill lengths. `long` is capped per card by what the bank actually holds —
 * CI/CD has 26 questions, so a long CI/CD drill is 26, not a padded 30.
 */
const LENGTHS = { short: 15, long: 30 } as const;
type Length = keyof typeof LENGTHS;

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ len?: string }>;
}) {
  const { len } = await searchParams;
  const length: Length = len === "long" ? "long" : "short";
  const want = LENGTHS[length];

  const [counts, scenarioCounts] = await Promise.all([
    getDomainQuestionCounts(),
    getScenarioQuestionCounts(),
  ]);
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
      <CoverageBadge bankTotal={total} />

      {/* Mixed set */}
      {/* Length toggle. A search param rather than client state, so the choice
          survives a reload and can be linked to directly. */}
      <div className="rise mt-8 flex flex-wrap items-center gap-2" style={{ animationDelay: "0.13s" }}>
        <span className="font-mono text-xs uppercase tracking-widest text-muted">
          Length
        </span>
        {(Object.keys(LENGTHS) as Length[]).map((key) => {
          const active = key === length;
          return (
            <Link
              key={key}
              href={`/practice?len=${key}`}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className="rounded-md border px-3 py-1 font-mono text-xs capitalize transition-colors"
              style={{
                borderColor: active ? "var(--accent)" : "var(--border)",
                color: active ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              {key} · {LENGTHS[key]}
            </Link>
          );
        })}
      </div>

      {/* Mixed set */}
      <Link
        href={`/practice/run?n=${Math.min(want, total)}`}
        className="rise codex-panel group mt-4 flex items-center justify-between gap-4 px-6 py-5 transition-colors duration-300 hover:border-[color:var(--accent)]"
        style={{ animationDelay: "0.15s" }}
      >
        <div>
          <div className="font-display text-xl font-medium text-ink">
            Mixed exam
          </div>
          <div className="mt-1 text-sm text-muted">
            {Math.min(want, total)} questions drawn across all 5 domains ·
            weighted like the real exam
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
                  {/* The count is repeated here on purpose: the length toggle
                      scrolls off, and a drill should never start at a size the
                      card didn't show. */}
                  {disabled ? "coming soon" : `start ${Math.min(want, n)} →`}
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
              href={`/practice/run?domain=${d.number}&n=${Math.min(want, n)}`}
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

      {/* By scenario — the exam presents 4 of these 6, and each one is graded
          across several domains at once, so the drill is drawn to span them. */}
      <div className="mb-5 mt-12 flex items-end justify-between">
        <h2 className="font-display text-xl font-medium text-ink">
          By scenario
        </h2>
        <span className="font-mono text-xs text-muted">
          {scenarios.length} in the bank · 4 appear on the exam
        </span>
      </div>
      <p className="mb-5 max-w-xl text-sm text-dim">
        Each drill spans every domain the scenario covers, not just the one it
        has the most questions in. Results still file under their own task and
        domain on the trace page.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {scenarios.map((s, i) => {
          const stock = scenarioCounts[s.slug] ?? {};
          const n = Object.values(stock)
            .flatMap((byTask) => Object.values(byTask))
            .reduce((a, b) => a + b, 0);
          const missing = (s.primary_domains as readonly number[]).filter(
            (d) => !stock[d]
          );
          const disabled = n === 0;

          const body = (
            <>
              <div className="font-display text-base font-medium text-ink">
                {s.name}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(s.primary_domains as readonly number[]).map((d) => {
                  const meta = domainByNumber(d);
                  const empty = !stock[d];
                  return (
                    <span
                      key={d}
                      title={`D${d} · ${meta.name}${empty ? " — no questions yet" : ""}`}
                      className="rounded px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold"
                      style={
                        empty
                          ? {
                              color: "var(--text-faint)",
                              border: "1px dashed var(--border)",
                            }
                          : {
                              color: `var(--${meta.accent})`,
                              background: `color-mix(in oklab, var(--${meta.accent}) 14%, transparent)`,
                            }
                      }
                    >
                      D{d}
                    </span>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-xs text-muted">
                  {n} question{n === 1 ? "" : "s"}
                  {missing.length > 0 && ` · D${missing.join("/D")} empty`}
                </span>
                <span
                  className="font-mono text-xs font-semibold"
                  style={{
                    color: disabled ? "var(--text-faint)" : "var(--accent)",
                  }}
                >
                  {disabled ? "coming soon" : `start ${Math.min(want, n)} →`}
                </span>
              </div>
            </>
          );

          return disabled ? (
            <div
              key={s.slug}
              className="rise codex-panel px-5 py-4 opacity-55"
              style={{ animationDelay: `${0.2 + i * 0.05}s` }}
            >
              {body}
            </div>
          ) : (
            <Link
              key={s.slug}
              href={`/practice/run?scenario=${s.slug}&n=${Math.min(want, n)}`}
              className="rise codex-panel px-5 py-4 transition-shadow duration-300"
              style={{ animationDelay: `${0.2 + i * 0.05}s` }}
            >
              {body}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
