"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { Flashcard } from "@/lib/queries";
import { domainByNumber } from "@/lib/blueprint";
import {
  loadSrs,
  saveCardState,
  schedule,
  isDue,
  isNew,
  intervalLabel,
  type CardState,
  type Rating,
} from "@/lib/srs";
import { markActivity } from "@/lib/progress";
import { logAnswer } from "@/lib/answers";
import { awardXp } from "@/lib/gamification";
import {
  logCalibration,
  calibrationBonusXp,
  CONFIDENCE_META,
  type Confidence,
} from "@/lib/calibration";

const XP_BY_RATING: Record<Rating, number> = {
  again: 2,
  hard: 5,
  good: 8,
  easy: 10,
};

const RATINGS: { key: Rating; label: string; color: string }[] = [
  { key: "again", label: "Again", color: "var(--wrong)" },
  { key: "hard", label: "Hard", color: "var(--d1)" },
  { key: "good", label: "Good", color: "var(--accent)" },
  { key: "easy", label: "Easy", color: "var(--correct)" },
];

export function FlashcardReviewer({
  cards,
  domain,
}: {
  cards: Flashcard[];
  domain: number | null;
}) {
  // Build the session queue once, from persisted SRS state.
  const [queue, setQueue] = useState<Flashcard[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [pendingConfidence, setPendingConfidence] = useState<Confidence | null>(
    null
  );
  const [reviewed, setReviewed] = useState(0);
  const [ratings, setRatings] = useState<Record<Rating, number>>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const srsRef = useRef<Record<string, CardState>>({});
  const sessionSize = useRef(0);

  useEffect(() => {
    const srs = loadSrs();
    srsRef.current = srs;
    const now = Date.now();
    const dueOrNew = cards.filter((c) => {
      const st = srs[c.id];
      return isNew(st) || isDue(st, now);
    });
    // New cards last, so review lands first; light shuffle within groups.
    const due = dueOrNew.filter((c) => !isNew(srs[c.id]));
    const fresh = dueOrNew.filter((c) => isNew(srs[c.id]));
    const q = [...shuffle(due), ...shuffle(fresh)];
    sessionSize.current = q.length;
    setQueue(q);
  }, [cards]);

  const current = queue?.[0];

  function reveal(confidence: Confidence) {
    setPendingConfidence(confidence);
    setFlipped(true);
  }

  function rate(rating: Rating) {
    if (!current) return;
    const nextState = schedule(srsRef.current[current.id], rating);
    srsRef.current[current.id] = nextState;
    saveCardState(current.id, nextState);
    markActivity();
    awardXp(XP_BY_RATING[rating], "flashcard");

    // Calibration: recalled well (good/easy) counts as "correct".
    const confidence = pendingConfidence ?? "fairly";
    const recalled = rating === "good" || rating === "easy";
    const ts = new Date().toISOString();
    logAnswer({
      ts,
      itemId: current.id,
      mode: "card",
      domain: current.domain,
      task: current.task_code,
      scenario: null,
      correct: recalled,
      confidence,
    });
    logCalibration({
      date: ts,
      kind: "card",
      taskCode: current.task_code,
      domain: current.domain,
      correct: recalled,
      confidence,
    });
    awardXp(calibrationBonusXp(confidence, recalled), "calibration");

    setRatings((r) => ({ ...r, [rating]: r[rating] + 1 }));
    setReviewed((n) => n + 1);

    setQueue((q) => {
      if (!q) return q;
      const [, ...rest] = q;
      // "Again" re-queues the card a few positions back for this session.
      if (rating === "again") {
        const insertAt = Math.min(3, rest.length);
        return [...rest.slice(0, insertAt), current, ...rest.slice(insertAt)];
      }
      return rest;
    });
    setFlipped(false);
    setPendingConfidence(null);
  }

  // ── Loading / done states ──
  if (queue === null) {
    return (
      <main className="grid min-h-[70vh] place-items-center">
        <span className="font-mono text-sm text-muted">Shuffling deck…</span>
      </main>
    );
  }

  if (!current) {
    return <Done ratings={ratings} reviewed={reviewed} domain={domain} />;
  }

  const dm = domainByNumber(current.domain);
  const accent = `var(--${dm.accent})`;
  const progress =
    sessionSize.current > 0
      ? (reviewed / (reviewed + queue.length)) * 100
      : 0;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-2xl flex-col px-5 pb-8 pt-6 sm:px-8">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/flashcards"
          className="font-mono text-xs text-muted transition-colors hover:text-ink"
        >
          ✕ Exit
        </Link>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: accent }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
          />
        </div>
        <span className="font-mono text-xs tabular text-muted">
          {queue.length} left
        </span>
      </div>

      {/* Card */}
      <div className="flex flex-1 items-center justify-center py-2">
        <button
          onClick={() => setFlipped((f) => !f)}
          className="group w-full"
          style={{ perspective: "1600px" }}
          aria-label="Flip card"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              <motion.div
                className="relative min-h-[19rem] w-full"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Front */}
                <Face
                  accent={accent}
                  domainLabel={`D${current.domain}`}
                  taskCode={current.task_code}
                  side="front"
                  hint="tap to flip"
                >
                  <p className="font-display text-2xl leading-snug text-ink sm:text-[1.75rem]">
                    {current.front}
                  </p>
                </Face>

                {/* Back */}
                <Face
                  accent={accent}
                  domainLabel={`D${current.domain}`}
                  taskCode={current.task_code}
                  side="back"
                  hint={current.source_ref ?? undefined}
                >
                  <p className="text-lg leading-relaxed text-dim">
                    {current.back}
                  </p>
                </Face>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </button>
      </div>

      {/* Rating bar */}
      <div className="mt-4 min-h-[4.5rem]">
        {flipped ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-4 gap-2"
          >
            {RATINGS.map((r) => (
              <button
                key={r.key}
                onClick={() => rate(r.key)}
                className="flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors duration-200"
                style={{
                  borderColor: `color-mix(in oklab, ${r.color} 45%, transparent)`,
                  background: `color-mix(in oklab, ${r.color} 8%, transparent)`,
                }}
              >
                <span
                  className="font-mono text-sm font-semibold"
                  style={{ color: r.color }}
                >
                  {r.label}
                </span>
                <span className="font-mono text-[0.65rem] text-muted">
                  {intervalLabel(srsRef.current[current.id], r.key)}
                </span>
              </button>
            ))}
          </motion.div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5">
            <span className="font-mono text-[0.7rem] uppercase tracking-wider text-muted">
              How sure are you? Then reveal.
            </span>
            <div className="grid w-full grid-cols-3 gap-2">
              {CONFIDENCE_META.map((c) => (
                <button
                  key={c.key}
                  onClick={() => reveal(c.key)}
                  className="flex flex-col items-center rounded-xl border px-2 py-2.5 font-mono text-sm font-semibold transition-all"
                  style={{
                    borderColor: `color-mix(in oklab, ${c.color} 45%, transparent)`,
                    background: `color-mix(in oklab, ${c.color} 8%, transparent)`,
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
          </div>
        )}
      </div>
    </main>
  );
}

function Face({
  children,
  accent,
  domainLabel,
  taskCode,
  side,
  hint,
}: {
  children: React.ReactNode;
  accent: string;
  domainLabel: string;
  taskCode: string | null;
  side: "front" | "back";
  hint?: string;
}) {
  return (
    <div
      className="codex-panel absolute inset-0 flex flex-col justify-between p-7 text-left"
      style={{
        backfaceVisibility: "hidden",
        transform: side === "back" ? "rotateY(180deg)" : undefined,
        borderColor: `color-mix(in oklab, ${accent} 30%, var(--border))`,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="rounded-md px-2 py-1 font-mono text-[0.7rem] font-semibold"
          style={{
            color: accent,
            background: `color-mix(in oklab, ${accent} 14%, transparent)`,
          }}
        >
          {domainLabel}
          {taskCode ? ` · ${taskCode}` : ""}
        </span>
        <span className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
          {side === "front" ? "prompt" : "answer"}
        </span>
      </div>

      <div className="flex flex-1 items-center py-5">{children}</div>

      {hint && (
        <div className="font-mono text-[0.7rem] text-faint">{hint}</div>
      )}
    </div>
  );
}

function Done({
  ratings,
  reviewed,
  domain,
}: {
  ratings: Record<Rating, number>;
  reviewed: number;
  domain: number | null;
}) {
  return (
    <main className="mx-auto w-full max-w-lg px-5 pb-24 pt-20 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 140, damping: 14 }}
      >
        <div className="sheen font-display text-6xl font-semibold tabular">
          {reviewed}
        </div>
        <p className="mt-2 font-mono text-sm text-muted">
          card{reviewed === 1 ? "" : "s"} reviewed
        </p>
      </motion.div>

      <div className="codex-panel mx-auto mt-8 flex max-w-xs justify-between gap-2 p-4">
        {RATINGS.map((r) => (
          <div key={r.key} className="flex-1">
            <div
              className="font-display text-2xl font-semibold tabular"
              style={{ color: r.color }}
            >
              {ratings[r.key]}
            </div>
            <div className="font-mono text-[0.65rem] text-muted">{r.label}</div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm text-dim">
        Nice work. Cards you rated lower will resurface sooner — come back
        tomorrow and the deck will know what to show you.
      </p>

      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/flashcards"
          className="rounded-lg border border-border px-5 py-2.5 font-mono text-sm text-ink transition-colors hover:border-[color:var(--accent)]"
        >
          ← Decks
        </Link>
        <Link
          href={domain ? `/practice/run?domain=${domain}&n=8` : "/practice"}
          className="rounded-lg px-5 py-2.5 font-mono text-sm font-semibold text-[color:var(--bg)]"
          style={{ background: "var(--cta)" }}
        >
          Test yourself →
        </Link>
      </div>
    </main>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
