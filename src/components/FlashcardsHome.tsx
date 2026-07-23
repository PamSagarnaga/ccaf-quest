"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Flashcard } from "@/lib/queries";
import { domains } from "@/lib/blueprint";
import { loadSrs, isDue, isNew, type CardState } from "@/lib/srs";

interface DeckStat {
  total: number;
  due: number;
  fresh: number;
}

function computeStats(
  cards: Flashcard[],
  srs: Record<string, CardState>,
  now: number
): Record<number, DeckStat> {
  const stats: Record<number, DeckStat> = {};
  for (const d of domains) stats[d.number] = { total: 0, due: 0, fresh: 0 };
  for (const c of cards) {
    const s = stats[c.domain];
    s.total++;
    const st = srs[c.id];
    if (isNew(st)) s.fresh++;
    else if (isDue(st, now)) s.due++;
  }
  return stats;
}

export function FlashcardsHome({ cards }: { cards: Flashcard[] }) {
  const [srs, setSrs] = useState<Record<string, CardState> | null>(null);

  useEffect(() => setSrs(loadSrs()), []);

  const now = Date.now();
  const stats = srs ? computeStats(cards, srs, now) : null;
  const totalDue = stats
    ? Object.values(stats).reduce((a, s) => a + s.due, 0)
    : 0;
  const totalFresh = stats
    ? Object.values(stats).reduce((a, s) => a + s.fresh, 0)
    : 0;
  const readyToReview = totalDue + totalFresh;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
      <p className="rise mb-3 font-mono text-xs uppercase tracking-[0.3em] text-accent">
        Sharpen recall
      </p>
      <h1
        className="rise font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
        style={{ animationDelay: "0.05s" }}
      >
        Flash<span className="sheen italic">cards</span>
      </h1>
      <p className="rise mt-4 max-w-xl text-dim" style={{ animationDelay: "0.1s" }}>
        Spaced repetition, the honest way — rate each card and the schedule
        decides when you see it again. Cards you find hard come back sooner.
      </p>

      {/* Review-all */}
      <div
        className="rise codex-panel mt-8 flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
        style={{ animationDelay: "0.15s" }}
      >
        <div>
          <div className="font-display text-xl font-medium text-ink">
            Today&apos;s review
          </div>
          <div className="mt-1 font-mono text-sm text-muted">
            {srs === null ? (
              "…"
            ) : (
              <>
                <span style={{ color: "var(--cta)" }}>{totalDue} due</span> ·{" "}
                <span style={{ color: "var(--accent)" }}>{totalFresh} new</span>{" "}
                · {cards.length} total
              </>
            )}
          </div>
        </div>
        {readyToReview > 0 ? (
          <Link
            href="/flashcards/review"
            className="rounded-lg px-6 py-2.5 text-center font-mono text-sm font-semibold text-[color:var(--bg)]"
            style={{ background: "var(--cta)" }}
          >
            Review all →
          </Link>
        ) : (
          <span className="rounded-lg border border-border px-6 py-2.5 text-center font-mono text-sm text-muted">
            {srs === null ? "loading…" : "All caught up ✓"}
          </span>
        )}
      </div>

      <div className="mb-5 mt-10 flex items-end justify-between">
        <h2 className="font-display text-xl font-medium text-ink">By domain</h2>
        <span className="font-mono text-xs text-muted">
          <span style={{ color: "var(--cta)" }}>due</span> ·{" "}
          <span style={{ color: "var(--accent)" }}>new</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {domains.map((d, i) => {
          const accent = `var(--${d.accent})`;
          const s = stats?.[d.number];
          const ready = s ? s.due + s.fresh : 0;
          const inner = (
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
                    {s ? `${s.total} cards` : "…"}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between font-mono text-xs">
                <span>
                  {s ? (
                    <>
                      <span style={{ color: "var(--cta)" }}>{s.due}</span>
                      <span className="text-faint"> / </span>
                      <span style={{ color: accent }}>{s.fresh}</span>
                    </>
                  ) : (
                    <span className="text-muted">…</span>
                  )}
                </span>
                <span
                  className="font-semibold"
                  style={{ color: ready > 0 ? accent : "var(--text-faint)" }}
                >
                  {ready > 0 ? "review →" : "done ✓"}
                </span>
              </div>
            </>
          );

          return ready > 0 ? (
            <Link
              key={d.number}
              href={`/flashcards/review?domain=${d.number}`}
              className="rise codex-panel px-5 py-4"
              style={{ animationDelay: `${0.2 + i * 0.05}s` }}
            >
              {inner}
            </Link>
          ) : (
            <div
              key={d.number}
              className="rise codex-panel px-5 py-4 opacity-70"
              style={{ animationDelay: `${0.2 + i * 0.05}s` }}
            >
              {inner}
            </div>
          );
        })}
      </div>
    </main>
  );
}
