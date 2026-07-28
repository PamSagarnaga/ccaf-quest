"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { QuizQuestion } from "@/lib/queries";
import { domains, domainByNumber } from "@/lib/blueprint";
import { markActivity, saveAttempt, type DomainScore } from "@/lib/progress";
import { awardXp } from "@/lib/gamification";
import {
  logCalibration,
  CONFIDENCE_META,
  calibrationBonusXp,
  type Confidence,
} from "@/lib/calibration";
import { loadFlags, toggleFlag } from "@/lib/flags";
import { recordItemResults } from "@/lib/itemStats";
import { logAnswers } from "@/lib/answers";

const EXAM_SECONDS = 120 * 60;
const PASS_SCALED = 720;

function mmss(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function ExamRunner({ questions }: { questions: QuizQuestion[] }) {
  const total = questions.length;
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>(
    () => Array(total).fill(null)
  );
  const [confidences, setConfidences] = useState<(Confidence | null)[]>(
    () => Array(total).fill(null)
  );
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [navOpen, setNavOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(EXAM_SECONDS);
  const startedAt = useRef(Date.now());

  useEffect(() => setFlagged(loadFlags()), []);

  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setFinished(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [finished]);

  const correctLabels = useMemo(
    () => questions.map((q) => q.options.find((o) => o.is_correct)?.label ?? ""),
    [questions]
  );

  if (finished) {
    return (
      <ExamResults
        questions={questions}
        answers={answers}
        confidences={confidences}
        correctLabels={correctLabels}
        flagged={flagged}
        secondsUsed={Math.min(
          EXAM_SECONDS,
          Math.round((Date.now() - startedAt.current) / 1000)
        )}
      />
    );
  }

  const q = questions[idx];
  const answeredCount = answers.filter(Boolean).length;
  const flagCount = questions.filter((qq) => flagged.has(qq.id)).length;
  const low = timeLeft <= 300;

  function select(label: string) {
    setAnswers((a) => a.map((v, i) => (i === idx ? label : v)));
  }
  function setConf(c: Confidence) {
    setConfidences((a) => a.map((v, i) => (i === idx ? c : v)));
  }
  function flag() {
    const now = toggleFlag(q.id);
    setFlagged((s) => {
      const next = new Set(s);
      if (now) next.add(q.id);
      else next.delete(q.id);
      return next;
    });
  }

  const dm = domainByNumber(q.domain);
  const accent = `var(--${dm.accent})`;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-3xl flex-col px-5 pb-28 pt-5 sm:px-8">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <Link href="/exam" className="font-mono text-xs text-muted hover:text-ink">
          ✕ Exit
        </Link>
        <div
          className="rounded-full border px-4 py-1.5 font-mono text-sm font-semibold tabular"
          style={{
            borderColor: low ? "var(--wrong)" : "var(--border)",
            color: low ? "var(--wrong)" : "var(--ink)",
            background: low
              ? "color-mix(in oklab, var(--wrong) 10%, transparent)"
              : "transparent",
          }}
        >
          ⏱ {mmss(timeLeft)}
        </div>
        <button
          onClick={() => setNavOpen((o) => !o)}
          className="font-mono text-xs text-accent"
        >
          {answeredCount}/{total} · nav
        </button>
      </div>

      {/* Navigator */}
      {navOpen && (
        <div className="codex-panel mb-5 p-4">
          <div className="grid grid-cols-10 gap-1.5">
            {questions.map((qq, i) => {
              const isCur = i === idx;
              const ans = answers[i] !== null;
              const fl = flagged.has(qq.id);
              return (
                <button
                  key={qq.id}
                  onClick={() => {
                    setIdx(i);
                    setNavOpen(false);
                  }}
                  className="grid aspect-square place-items-center rounded font-mono text-xs"
                  style={{
                    background: isCur
                      ? "var(--accent)"
                      : ans
                        ? "color-mix(in oklab, var(--accent) 22%, transparent)"
                        : "var(--surface-2)",
                    color: isCur ? "var(--bg)" : "var(--text-dim)",
                    outline: fl ? "2px solid var(--cta)" : "none",
                    outlineOffset: "-2px",
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <p className="mt-3 font-mono text-[0.7rem] text-muted">
            {answeredCount} answered · {flagCount} flagged ·{" "}
            <span style={{ color: "var(--cta)" }}>coral outline = flagged</span>
          </p>
        </div>
      )}

      {/* Question */}
      <div className="mb-4 flex items-center gap-2">
        <span
          className="rounded-md px-2 py-1 font-mono text-[0.7rem] font-semibold"
          style={{
            color: accent,
            background: `color-mix(in oklab, ${accent} 14%, transparent)`,
          }}
        >
          Q{idx + 1} · D{q.domain}
        </span>
        <button
          onClick={flag}
          className="ml-auto rounded-md border px-2 py-1 font-mono text-[0.7rem]"
          style={{
            borderColor: flagged.has(q.id) ? "var(--cta)" : "var(--border)",
            color: flagged.has(q.id) ? "var(--cta)" : "var(--text-muted)",
            background: flagged.has(q.id)
              ? "color-mix(in oklab, var(--cta) 12%, transparent)"
              : "transparent",
          }}
        >
          {flagged.has(q.id) ? "⚑ Flagged" : "⚐ Flag"}
        </button>
      </div>

      <h2 className="mb-5 font-display text-xl leading-snug text-ink sm:text-2xl">
        {q.stem}
      </h2>

      <div className="flex flex-col gap-2.5">
        {q.options.map((o) => {
          const sel = answers[idx] === o.label;
          return (
            <button
              key={o.label}
              onClick={() => select(o.label)}
              className="rounded-xl border px-4 py-3.5 text-left transition-all"
              style={{
                borderColor: sel ? "var(--accent)" : "var(--border)",
                background: sel
                  ? "color-mix(in oklab, var(--accent) 10%, transparent)"
                  : "var(--surface)",
              }}
            >
              <div className="flex gap-3">
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-md border font-mono text-xs font-semibold"
                  style={{
                    borderColor: sel ? "var(--accent)" : "var(--border)",
                    color: sel ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {o.label}
                </span>
                <span className="flex-1 text-sm leading-relaxed text-dim">
                  {o.body}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Confidence (optional, no reveal) */}
      <div className="mt-5">
        <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-wider text-muted">
          Confidence (optional)
        </div>
        <div className="grid grid-cols-3 gap-2">
          {CONFIDENCE_META.map((c) => {
            const sel = confidences[idx] === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setConf(c.key)}
                className="flex flex-col items-center rounded-lg border px-2 py-2 font-mono text-xs font-semibold transition-all"
                style={{
                  borderColor: sel
                    ? c.color
                    : `color-mix(in oklab, ${c.color} 30%, transparent)`,
                  background: sel
                    ? `color-mix(in oklab, ${c.color} 16%, transparent)`
                    : "transparent",
                  color: c.color,
                }}
              >
                {c.label}
                <span className="text-[0.6rem] font-normal text-muted">
                  {c.short}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer nav */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-[color:var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="rounded-lg border border-border px-4 py-2 font-mono text-sm text-ink disabled:opacity-30"
          >
            ← Back
          </button>
          {idx < total - 1 ? (
            <button
              onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
              className="rounded-lg px-5 py-2 font-mono text-sm font-semibold text-[color:var(--bg)]"
              style={{ background: "var(--accent)" }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="rounded-lg px-5 py-2 font-mono text-sm font-semibold text-[color:var(--bg)]"
              style={{ background: "var(--cta)" }}
            >
              Submit exam
            </button>
          )}
        </div>
      </div>

      {/* Submit confirm */}
      {confirming && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/50 p-5">
          <div className="codex-panel w-full max-w-sm p-6 text-center">
            <h3 className="font-display text-xl text-ink">Submit exam?</h3>
            <p className="mt-2 text-sm text-dim">
              {answeredCount}/{total} answered
              {total - answeredCount > 0 && (
                <span style={{ color: "var(--wrong)" }}>
                  {" "}
                  · {total - answeredCount} blank
                </span>
              )}
              {flagCount > 0 && <> · {flagCount} flagged</>}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-border px-5 py-2.5 font-mono text-sm text-ink"
              >
                Keep going
              </button>
              <button
                onClick={() => setFinished(true)}
                className="rounded-lg px-5 py-2.5 font-mono text-sm font-semibold text-[color:var(--bg)]"
                style={{ background: "var(--cta)" }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ExamResults({
  questions,
  answers,
  confidences,
  correctLabels,
  flagged,
  secondsUsed,
}: {
  questions: QuizQuestion[];
  answers: (string | null)[];
  confidences: (Confidence | null)[];
  correctLabels: string[];
  flagged: Set<string>;
  secondsUsed: number;
}) {
  const total = questions.length;
  const correct = answers.filter((a, i) => a === correctLabels[i]).length;
  const scaled = Math.round((correct / total) * 1000);
  const pass = scaled >= PASS_SCALED;

  // Identifies this sitting for the answer log's idempotent append. A ref
  // survives StrictMode's double-invoked effect (same instance, so the same
  // value), while a fresh sitting of the same questions gets a new one — the
  // question-id list alone would silently drop an immediate retake.
  const sittingId = useRef(
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );

  const perDomain = useMemo(() => {
    const acc: Record<number, DomainScore> = {};
    for (const d of domains) acc[d.number] = { correct: 0, total: 0 };
    questions.forEach((q, i) => {
      acc[q.domain].total++;
      if (answers[i] === correctLabels[i]) acc[q.domain].correct++;
    });
    return acc;
  }, [questions, answers, correctLabels]);

  useEffect(() => {
    try {
      // The answer log: every answered item, confidence or not. Keyed on the
      // sitting so StrictMode's double-invoke can't append it twice.
      const finishedAt = new Date().toISOString();
      logAnswers(
        questions.flatMap((q, i) =>
          answers[i] === null
            ? []
            : [
                {
                  ts: finishedAt,
                  itemId: q.id,
                  mode: "exam" as const,
                  domain: q.domain,
                  task: q.task_code,
                  scenario: q.scenario,
                  correct: answers[i] === correctLabels[i],
                  confidence: confidences[i] ?? null,
                },
              ]
        ),
        sittingId.current
      );
      // Calibration events for answered questions with a confidence.
      questions.forEach((q, i) => {
        if (answers[i] !== null && confidences[i]) {
          logCalibration({
            date: new Date().toISOString(),
            kind: "quiz",
            taskCode: q.task_code,
            domain: q.domain,
            correct: answers[i] === correctLabels[i],
            confidence: confidences[i]!,
          });
        }
      });
      // Progress attempt (scaled marks it as an exam).
      saveAttempt({
        date: new Date().toISOString(),
        mode: "quiz",
        domain: null,
        total,
        correct,
        pct: Math.round((correct / total) * 100),
        durationSec: secondsUsed,
        perDomain,
        scaled,
      });
      // Per-question mastery: record every answered item (skip skipped ones).
      recordItemResults(
        questions.flatMap((q, i) =>
          answers[i] === null
            ? []
            : [
                {
                  id: q.id,
                  domain: q.domain,
                  task: q.task_code,
                  scenario: q.scenario,
                  correct: answers[i] === correctLabels[i],
                },
              ]
        )
      );
      markActivity();
      const calibBonus = questions.reduce(
        (s, q, i) =>
          s +
          (confidences[i]
            ? calibrationBonusXp(confidences[i]!, answers[i] === correctLabels[i])
            : 0),
        0
      );
      awardXp(correct * 10 + 150 + (pass ? 200 : 0) + calibBonus, "exam");
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mins = Math.floor(secondsUsed / 60);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-14 sm:px-8">
      <div className="text-center">
        <p
          className="font-mono text-xs uppercase tracking-[0.3em]"
          style={{ color: pass ? "var(--correct)" : "var(--wrong)" }}
        >
          {pass ? "Pass" : "Below the 720 cut"}
        </p>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 14 }}
          className="mt-3"
        >
          <div
            className="font-display text-7xl font-semibold tabular"
            style={{ color: pass ? "var(--correct)" : "var(--wrong)" }}
          >
            {scaled}
          </div>
          <div className="mt-1 font-mono text-sm text-muted">
            scaled / 1000 · cut 720 · {correct}/{total} correct · {mins}m
          </div>
          <div className="mt-1 font-mono text-[0.7rem] text-faint">
            estimated scale (official conversion is equated & not published)
          </div>
        </motion.div>
      </div>

      {/* Per-domain */}
      <div className="codex-panel mt-8 p-6">
        <h3 className="mb-4 font-display text-lg text-ink">
          Percent-correct by domain
        </h3>
        <div className="flex flex-col gap-3">
          {domains.map((d) => {
            const s = perDomain[d.number];
            const p = s.total ? Math.round((s.correct / s.total) * 100) : 0;
            const accent = `var(--${d.accent})`;
            return (
              <div key={d.number}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-dim">
                    D{d.number} · {d.name}
                  </span>
                  <span className="font-mono tabular text-muted">
                    {p}% ({s.correct}/{s.total})
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: accent }}
                    initial={{ width: 0 }}
                    animate={{ width: `${p}%` }}
                    transition={{ duration: 0.7 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 font-mono text-[0.7rem] text-faint">
          Domain percentages are informational only — pass/fail is your total
          scaled score, exactly like the real report.
        </p>
      </div>

      {/* Review */}
      <h3 className="mb-4 mt-10 font-display text-xl text-ink">Review</h3>
      <div className="flex flex-col gap-3">
        {questions.map((q, i) => {
          const yours = answers[i];
          const right = yours === correctLabels[i];
          return (
            <div key={q.id} className="codex-panel p-5">
              <div className="mb-2 flex items-center gap-2 font-mono text-xs">
                <span className="text-muted">Q{i + 1} · D{q.domain}</span>
                {q.task_code && <span className="text-faint">· {q.task_code}</span>}
                {flagged.has(q.id) && (
                  <span style={{ color: "var(--cta)" }}>· ⚑</span>
                )}
                <span
                  className="ml-auto font-semibold"
                  style={{
                    color: yours === null
                      ? "var(--text-faint)"
                      : right
                        ? "var(--correct)"
                        : "var(--wrong)",
                  }}
                >
                  {yours === null ? "blank" : right ? "✓" : "✗"}
                </span>
              </div>
              <p className="mb-3 text-sm font-medium text-ink">{q.stem}</p>
              <div className="flex flex-col gap-1.5">
                {q.options.map((o) => {
                  const isRight = o.is_correct;
                  const isYours = yours === o.label;
                  return (
                    <div
                      key={o.label}
                      className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
                      style={{
                        borderColor: isRight
                          ? "var(--correct)"
                          : isYours
                            ? "var(--wrong)"
                            : "var(--border)",
                        background: isRight
                          ? "color-mix(in oklab, var(--correct) 10%, transparent)"
                          : isYours
                            ? "color-mix(in oklab, var(--wrong) 10%, transparent)"
                            : "transparent",
                        color: "var(--text-dim)",
                      }}
                    >
                      <span className="font-mono font-semibold">{o.label}.</span>{" "}
                      {o.body}
                      {o.rationale && (isRight || isYours) && (
                        <span className="mt-1 block text-muted">{o.rationale}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg border border-border px-5 py-2.5 font-mono text-sm text-ink"
        >
          ← Home
        </Link>
        <Link
          href="/exam/run"
          className="rounded-lg px-5 py-2.5 font-mono text-sm font-semibold text-[color:var(--bg)]"
          style={{ background: "var(--cta)" }}
        >
          New exam ↻
        </Link>
      </div>
    </main>
  );
}
