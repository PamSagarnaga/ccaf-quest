"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { QuizQuestion } from "@/lib/queries";
import { domainByNumber } from "@/lib/blueprint";
import { markActivity } from "@/lib/progress";
import { awardXp, type LevelProgress } from "@/lib/gamification";
import {
  logCalibration,
  calibrationBonusXp,
  CONFIDENCE_META,
  type Confidence,
} from "@/lib/calibration";
import { FlagButton } from "@/components/FlagButton";

interface Answer {
  questionId: string;
  domain: number;
  correct: boolean;
  confidence: Confidence;
}

function accentFor(domain: number) {
  return `var(--${domainByNumber(domain).accent})`;
}

export function QuizRunner({
  questions,
  domain,
}: {
  questions: QuizQuestion[];
  domain: number | null;
}) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [finished, setFinished] = useState(false);
  const startedAt = useRef(Date.now());

  const q = questions[idx];
  const isLast = idx === questions.length - 1;
  const correctLabel = useMemo(
    () => q?.options.find((o) => o.is_correct)?.label,
    [q]
  );

  function check(confidence: Confidence) {
    if (!selected || revealed) return;
    const correct = selected === correctLabel;
    setRevealed(true);
    setAnswers((prev) => [
      ...prev,
      { questionId: q.id, domain: q.domain, correct, confidence },
    ]);
    logCalibration({
      date: new Date().toISOString(),
      kind: "quiz",
      taskCode: q.task_code,
      domain: q.domain,
      correct,
      confidence,
    });
  }

  function next() {
    if (isLast) {
      setFinished(true);
      return;
    }
    setIdx((i) => i + 1);
    setSelected(null);
    setRevealed(false);
  }

  if (finished) {
    return (
      <Results
        answers={answers}
        total={questions.length}
        durationSec={Math.round((Date.now() - startedAt.current) / 1000)}
        domain={domain}
      />
    );
  }

  const progress = ((idx + (revealed ? 1 : 0)) / questions.length) * 100;
  const dm = domainByNumber(q.domain);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-28 pt-8 sm:px-8">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/practice"
          className="font-mono text-xs text-muted transition-colors hover:text-ink"
        >
          ✕ Exit
        </Link>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--accent)" }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
          />
        </div>
        <span className="font-mono text-xs tabular text-muted">
          {idx + 1}/{questions.length}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Tags */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-2 py-1 font-mono text-[0.7rem] font-semibold"
              style={{
                color: accentFor(q.domain),
                background: `color-mix(in oklab, ${accentFor(q.domain)} 14%, transparent)`,
              }}
            >
              D{q.domain} · {dm.name}
            </span>
            {q.task_code && (
              <span className="rounded-md border border-border px-2 py-1 font-mono text-[0.7rem] text-muted">
                Task {q.task_code}
              </span>
            )}
            <span className="ml-auto">
              <FlagButton questionId={q.id} />
            </span>
          </div>

          {/* Stem */}
          <h2 className="mb-6 font-display text-xl leading-snug text-ink sm:text-2xl">
            {q.stem}
          </h2>

          {/* Options */}
          <div className="flex flex-col gap-2.5">
            {q.options.map((o) => {
              const isSelected = selected === o.label;
              const isCorrect = o.label === correctLabel;
              let ring = "var(--border)";
              let bg = "var(--surface)";
              if (revealed) {
                if (isCorrect) {
                  ring = "var(--correct)";
                  bg = "color-mix(in oklab, var(--correct) 12%, transparent)";
                } else if (isSelected) {
                  ring = "var(--wrong)";
                  bg = "color-mix(in oklab, var(--wrong) 12%, transparent)";
                }
              } else if (isSelected) {
                ring = "var(--accent)";
                bg = "color-mix(in oklab, var(--accent) 10%, transparent)";
              }

              return (
                <button
                  key={o.label}
                  disabled={revealed}
                  onClick={() => setSelected(o.label)}
                  className="rounded-xl border px-4 py-3.5 text-left transition-all duration-200 disabled:cursor-default"
                  style={{ borderColor: ring, background: bg }}
                >
                  <div className="flex gap-3">
                    <span
                      className="grid size-6 shrink-0 place-items-center rounded-md font-mono text-xs font-semibold"
                      style={{
                        color: revealed
                          ? isCorrect
                            ? "var(--correct)"
                            : isSelected
                              ? "var(--wrong)"
                              : "var(--text-muted)"
                          : isSelected
                            ? "var(--accent)"
                            : "var(--text-muted)",
                        background: isSelected
                          ? "color-mix(in oklab, currentColor 14%, transparent)"
                          : "transparent",
                        border: `1px solid ${
                          isSelected ? "currentColor" : "var(--border)"
                        }`,
                      }}
                    >
                      {o.label}
                    </span>
                    <span className="flex-1 text-sm leading-relaxed text-dim">
                      {o.body}
                    </span>
                    {revealed && (isCorrect || isSelected) && (
                      <span
                        className="shrink-0 font-mono text-xs font-semibold"
                        style={{
                          color: isCorrect ? "var(--correct)" : "var(--wrong)",
                        }}
                      >
                        {isCorrect ? "✓" : "✗"}
                      </span>
                    )}
                  </div>

                  <AnimatePresence>
                    {revealed && o.rationale && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden pl-9 pt-2 text-xs leading-relaxed text-muted"
                      >
                        {o.rationale}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-[color:var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          {!revealed ? (
            <>
              <span className="hidden shrink-0 font-mono text-xs text-muted sm:block">
                {selected ? "How sure?" : "Select an answer"}
              </span>
              <div className="flex flex-1 justify-end gap-2">
                {CONFIDENCE_META.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => check(c.key)}
                    disabled={!selected}
                    title={c.short}
                    className="flex flex-col items-center rounded-lg border px-3 py-2 font-mono text-xs font-semibold transition-all disabled:opacity-30"
                    style={{
                      borderColor: `color-mix(in oklab, ${c.color} 45%, transparent)`,
                      background: `color-mix(in oklab, ${c.color} 10%, transparent)`,
                      color: c.color,
                    }}
                  >
                    {c.label}
                    <span className="text-[0.6rem] font-normal text-muted">
                      {c.short}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <span className="font-mono text-xs text-muted">
                {answers[answers.length - 1]?.correct
                  ? "Nailed it."
                  : "Review the explanation."}
              </span>
              <button
                onClick={next}
                className="rounded-lg px-5 py-2.5 font-mono text-sm font-semibold text-[color:var(--bg)]"
                style={{ background: "var(--cta)" }}
              >
                {isLast ? "See results" : "Next →"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Results({
  answers,
  total,
  durationSec,
  domain,
}: {
  answers: Answer[];
  total: number;
  durationSec: number;
  domain: number | null;
}) {
  const correct = answers.filter((a) => a.correct).length;
  const pct = Math.round((correct / total) * 100);
  const wrong = total - correct;
  const perfect = correct === total && total >= 5;
  const calibBonus = answers.reduce(
    (sum, a) => sum + calibrationBonusXp(a.confidence, a.correct),
    0
  );
  const blindSpots = answers.filter(
    (a) => a.confidence === "certain" && !a.correct
  ).length;
  const xpEarned = correct * 10 + wrong * 2 + 25 + (perfect ? 50 : 0) + calibBonus;
  const [leveledTo, setLeveledTo] = useState<LevelProgress | null>(null);

  // Per-domain tally
  const perDomain = useMemo(() => {
    const map: Record<number, { correct: number; total: number }> = {};
    for (const a of answers) {
      map[a.domain] ??= { correct: 0, total: 0 };
      map[a.domain].total++;
      if (a.correct) map[a.domain].correct++;
    }
    return map;
  }, [answers]);

  // Persist attempt to localStorage (single-user MVP)
  useEffect(() => {
    try {
      const key = "ccaf_attempts";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      prev.push({
        date: new Date().toISOString(),
        mode: "quiz",
        domain,
        total,
        correct,
        pct,
        durationSec,
        perDomain,
      });
      localStorage.setItem(key, JSON.stringify(prev));
      markActivity();
      const { leveledTo } = awardXp(xpEarned, "quiz");
      setLeveledTo(leveledTo);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pass = pct >= 72;
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-16 text-center">
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-mono text-xs uppercase tracking-[0.3em] text-accent"
      >
        {pass ? "Above the cut line" : "Keep forging"}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 140, damping: 14 }}
        className="mt-4"
      >
        <div className="sheen font-display text-7xl font-semibold tabular">
          {pct}%
        </div>
        <div className="mt-2 font-mono text-sm text-muted">
          {correct} / {total} correct · {mins}m {secs}s
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5"
        >
          <span
            className="font-mono text-sm font-semibold"
            style={{ color: "var(--accent)" }}
          >
            +{xpEarned} XP
          </span>
          {perfect && (
            <span className="font-mono text-xs" style={{ color: "var(--correct)" }}>
              · flawless bonus
            </span>
          )}
          {calibBonus > 0 && (
            <span className="font-mono text-xs text-muted">
              · +{calibBonus} calibration
            </span>
          )}
        </motion.div>
        {blindSpots > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-3 font-mono text-xs"
            style={{ color: "var(--wrong)" }}
          >
            ⚠ {blindSpots} blind spot{blindSpots === 1 ? "" : "s"} — sure but
            wrong. Check your Calibration panel.
          </motion.div>
        )}
        {leveledTo && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 160, damping: 12 }}
            className="mt-3 font-display text-lg"
            style={{ color: "var(--cta)" }}
          >
            ⬆ Level {leveledTo.level} — {leveledTo.name}!
          </motion.div>
        )}
      </motion.div>

      <div className="codex-panel mt-10 p-6 text-left">
        <h3 className="mb-4 font-display text-lg text-ink">By domain</h3>
        <div className="flex flex-col gap-3">
          {Object.entries(perDomain).map(([d, v]) => {
            const dn = Number(d);
            const p = Math.round((v.correct / v.total) * 100);
            return (
              <div key={d}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-dim">
                    D{d} · {domainByNumber(dn).name}
                  </span>
                  <span className="font-mono tabular text-muted">
                    {v.correct}/{v.total}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: accentFor(dn) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${p}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/practice"
          className="rounded-lg border border-border px-5 py-2.5 font-mono text-sm text-ink transition-colors hover:border-[color:var(--accent)]"
        >
          ← Practice menu
        </Link>
        <Link
          href={
            domain ? `/practice/run?domain=${domain}&n=${total}` : "/practice/run?n=12"
          }
          className="rounded-lg px-5 py-2.5 font-mono text-sm font-semibold text-[color:var(--bg)]"
          style={{ background: "var(--cta)" }}
        >
          Run again ↻
        </Link>
      </div>
    </main>
  );
}
