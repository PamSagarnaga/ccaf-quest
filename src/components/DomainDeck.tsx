"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { domains, tasksForDomain, scenariosForDomain } from "@/lib/blueprint";

const accentVar = (accent: string) => `var(--${accent})`;

export function DomainDeck() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {domains.map((d, i) => {
        const tasks = tasksForDomain(d.number);
        const scenarios = scenariosForDomain(d.number);
        const isOpen = open === d.number;
        const accent = accentVar(d.accent);

        return (
          <div
            key={d.number}
            className="rise codex-panel overflow-hidden transition-shadow duration-300"
            style={{
              animationDelay: `${0.15 + i * 0.09}s`,
              borderColor: isOpen ? accent : undefined,
              boxShadow: isOpen ? `0 0 32px -12px ${accent}` : undefined,
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : d.number)}
              className="group flex w-full items-center gap-5 px-5 py-5 text-left sm:px-7"
            >
              {/* Domain numeral */}
              <div
                className="grid size-14 shrink-0 place-items-center rounded-lg font-display text-2xl font-semibold tabular"
                style={{
                  color: accent,
                  background: `color-mix(in oklab, ${accent} 12%, transparent)`,
                  border: `1px solid color-mix(in oklab, ${accent} 40%, transparent)`,
                }}
              >
                {d.number}
              </div>

              {/* Title + weight bar */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="truncate font-display text-lg font-medium text-ink sm:text-xl">
                    {d.name}
                  </h3>
                  <span
                    className="shrink-0 font-mono text-sm font-semibold tabular"
                    style={{ color: accent }}
                  >
                    {d.weight}%
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                  style={{
                    background: "color-mix(in oklab, var(--accent) 14%, transparent)",
                  }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: accent }}
                    initial={{ width: 0 }}
                    animate={{ width: `${d.weight * 2.6}%` }}
                    transition={{
                      delay: 0.4 + i * 0.09,
                      duration: 0.8,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                </div>
                <p className="mt-2 font-mono text-xs text-muted">
                  {tasks.length} task statements · {scenarios.length} scenarios
                </p>
              </div>

              <svg
                className="size-5 shrink-0 text-faint transition-transform duration-300 group-hover:text-dim"
                style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border px-5 pb-6 pt-5 sm:px-7">
                    <p className="mb-5 max-w-2xl text-sm leading-relaxed text-dim">
                      {d.blurb}
                    </p>
                    <ol className="flex flex-col gap-2.5">
                      {tasks.map((t) => (
                        <li key={t.code} className="flex gap-3.5">
                          <span
                            className="mt-0.5 shrink-0 font-mono text-xs font-semibold tabular"
                            style={{ color: accent }}
                          >
                            {t.code}
                          </span>
                          <span className="text-sm leading-relaxed text-dim">
                            {t.statement}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
