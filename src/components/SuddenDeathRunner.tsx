"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { QuizQuestion } from "@/lib/queries";
import { domainByNumber } from "@/lib/blueprint";
import { markActivity } from "@/lib/progress";
import { awardXp } from "@/lib/gamification";

const SECONDS = 60;
const REVEAL_MS = 1900;
const START_LIVES = 3;
const LIFE_ICON = "🤖";

export function SuddenDeathRunner({
  questions,
  mode,
}: {
  questions: QuizQuestion[];
  mode: "easy" | "hard";
}) {
  const [idx, setIdx] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(SECONDS);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [status, setStatus] = useState<"playing" | "over">("playing");
  const [outcome, setOutcome] = useState<"win" | "lose">("win");
  const livesRef = useRef(START_LIVES);

  const q = questions[idx];
  const correctLabel = useMemo(
    () => q?.options.find((o) => o.is_correct)?.label,
    [q]
  );

  // Reset timer each new question.
  useEffect(() => {
    setTimeLeft(SECONDS);
  }, [idx]);

  // Countdown.
  useEffect(() => {
    if (status !== "playing" || revealed) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          handleTimeout();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, revealed, idx]);

  function loseLife() {
    livesRef.current -= 1;
    setLives(livesRef.current);
    setCombo(0);
  }

  function advance() {
    if (livesRef.current <= 0) {
      setOutcome("lose");
      setStatus("over");
      markActivity();
      return;
    }
    if (idx + 1 >= questions.length) {
      setOutcome("win");
      setStatus("over");
      markActivity();
      return;
    }
    setIdx((i) => i + 1);
    setSelected(null);
    setRevealed(false);
  }

  function answer(label: string) {
    if (revealed || status !== "playing") return;
    setSelected(label);
    setRevealed(true);
    if (label === correctLabel) {
      const c = combo + 1;
      setCombo(c);
      setMaxCombo((m) => Math.max(m, c));
      setCorrectCount((n) => n + 1);
      awardXp(12 + c * 2, "sudden-death");
    } else {
      loseLife();
    }
    setTimeout(advance, REVEAL_MS);
  }

  function handleTimeout() {
    if (revealed) return;
    setRevealed(true);
    loseLife();
    setTimeout(advance, REVEAL_MS);
  }

  if (status === "over") {
    return (
      <Results
        outcome={outcome}
        correctCount={correctCount}
        total={questions.length}
        maxCombo={maxCombo}
        livesLeft={Math.max(0, lives)}
        mode={mode}
      />
    );
  }

  const dm = domainByNumber(q.domain);
  const accent = `var(--${dm.accent})`;
  const urgent = timeLeft <= 15;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-2xl flex-col px-5 pb-8 pt-5 sm:px-8">
      {/* Top: lives + progress + combo */}
      <div className="mb-3 flex items-center justify-between">
        <Link href="/sudden-death" className="font-mono text-xs text-muted hover:text-ink">
          ✕ Quit
        </Link>
        <div className="flex gap-1.5 text-2xl">
          {Array.from({ length: START_LIVES }).map((_, i) => (
            <motion.span
              key={i}
              animate={{
                scale: i === lives && lives < START_LIVES ? [1.3, 1] : 1,
                opacity: i < lives ? 1 : 0.25,
              }}
              style={{ filter: i < lives ? "none" : "grayscale(1)" }}
            >
              {LIFE_ICON}
            </motion.span>
          ))}
        </div>
        <span className="font-mono text-xs tabular text-muted">
          {idx + 1}/{questions.length}
        </span>
      </div>

      {/* Timer bar */}
      <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: urgent ? "var(--wrong)" : accent }}
          animate={{ width: `${(timeLeft / SECONDS) * 100}%` }}
          transition={{ ease: "linear", duration: revealed ? 0 : 1 }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span
          className="rounded-md px-2 py-1 font-mono text-[0.7rem] font-semibold"
          style={{
            color: accent,
            background: `color-mix(in oklab, ${accent} 14%, transparent)`,
          }}
        >
          D{q.domain} · {mode === "hard" ? "Hard" : "Easy"}
        </span>
        <AnimatePresence>
          {combo >= 2 && (
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-mono text-sm font-bold"
              style={{ color: "var(--d1)" }}
            >
              🔥 {combo}× combo
            </motion.span>
          )}
        </AnimatePresence>
        <span
          className="font-mono text-lg font-bold tabular"
          style={{ color: urgent ? "var(--wrong)" : "var(--text-muted)" }}
        >
          {timeLeft}s
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex flex-1 flex-col justify-center py-4"
        >
          <h2 className="mb-6 font-display text-xl leading-snug text-ink sm:text-2xl">
            {q.stem}
          </h2>
          <div className="flex flex-col gap-2.5">
            {q.options.map((o) => {
              const isCorrect = o.label === correctLabel;
              const isSel = selected === o.label;
              let border = "var(--border)";
              let bg = "var(--surface)";
              if (revealed) {
                if (isCorrect) {
                  border = "var(--correct)";
                  bg = "color-mix(in oklab, var(--correct) 12%, transparent)";
                } else if (isSel) {
                  border = "var(--wrong)";
                  bg = "color-mix(in oklab, var(--wrong) 12%, transparent)";
                }
              }
              return (
                <button
                  key={o.label}
                  disabled={revealed}
                  onClick={() => answer(o.label)}
                  className="rounded-xl border px-4 py-3.5 text-left transition-all disabled:cursor-default"
                  style={{ borderColor: border, background: bg }}
                >
                  <div className="flex gap-3">
                    <span
                      className="grid size-6 shrink-0 place-items-center rounded-md border font-mono text-xs font-semibold"
                      style={{ borderColor: border, color: "var(--text-muted)" }}
                    >
                      {o.label}
                    </span>
                    <span className="flex-1 text-sm leading-relaxed text-dim">
                      {o.body}
                    </span>
                    {revealed && isCorrect && (
                      <span style={{ color: "var(--correct)" }}>✓</span>
                    )}
                    {revealed && isSel && !isCorrect && (
                      <span style={{ color: "var(--wrong)" }}>✗</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

function Results({
  outcome,
  correctCount,
  total,
  maxCombo,
  livesLeft,
  mode,
}: {
  outcome: "win" | "lose";
  correctCount: number;
  total: number;
  maxCombo: number;
  livesLeft: number;
  mode: "easy" | "hard";
}) {
  const win = outcome === "win";
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-24 pt-20 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 140, damping: 13 }}
      >
        <div className="text-5xl">{win ? "🏆" : "💀"}</div>
        <p
          className="mt-3 font-display text-3xl font-semibold"
          style={{ color: win ? "var(--correct)" : "var(--wrong)" }}
        >
          {win ? "Survived!" : "Game Over"}
        </p>
        <p className="mt-1 font-mono text-sm text-muted">
          {mode === "hard" ? "Hard mode" : "Easy mode"}
        </p>
      </motion.div>

      <div className="codex-panel mx-auto mt-8 grid max-w-xs grid-cols-3 gap-2 p-4">
        <Stat n={`${correctCount}/${total}`} label="correct" />
        <Stat n={`${maxCombo}×`} label="best combo" />
        <Stat n={`${livesLeft}`} label="lives left" />
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/sudden-death"
          className="rounded-lg border border-border px-5 py-2.5 font-mono text-sm text-ink"
        >
          ← Modes
        </Link>
        <Link
          href={`/sudden-death/run?mode=${mode}`}
          className="rounded-lg px-5 py-2.5 font-mono text-sm font-semibold text-[color:var(--bg)]"
          style={{ background: "var(--cta)" }}
        >
          Again ↻
        </Link>
      </div>
    </main>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="sheen font-display text-2xl font-semibold tabular">{n}</div>
      <div className="font-mono text-[0.65rem] text-muted">{label}</div>
    </div>
  );
}
