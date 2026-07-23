"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { domains, domainByNumber } from "@/lib/blueprint";
import {
  loadAttempts,
  loadLogs,
  domainMastery,
  readiness,
  streak,
  type QuizAttempt,
  type ExamLog,
  type Mastery,
} from "@/lib/progress";
import { loadSrs, isDue } from "@/lib/srs";
import {
  loadXp,
  levelFor,
  evaluateBadges,
  type LevelProgress,
} from "@/lib/gamification";
import {
  loadCalibration,
  quadrantTotals,
  calibrationScore,
  taskCalibration,
  type QuadrantTotals,
  type TaskCalibration,
} from "@/lib/calibration";

type EvaluatedBadge = ReturnType<typeof evaluateBadges>[number];

interface Snapshot {
  attempts: QuizAttempt[];
  logs: ExamLog[];
  mastery: Mastery[];
  ready: number | null;
  streak: { current: number; longest: number };
  cards: { reviewed: number; due: number; mastered: number };
  xpTotal: number;
  level: LevelProgress;
  badges: EvaluatedBadge[];
  calib: {
    totals: QuadrantTotals;
    score: number | null;
    tasks: TaskCalibration[];
  };
}

export function ProgressDashboard({
  totalQuestions,
  totalCards,
}: {
  totalQuestions: number;
  totalCards: number;
}) {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    const attempts = loadAttempts();
    const logs = loadLogs();
    const mastery = domainMastery(attempts, logs);
    const srs = loadSrs();
    const now = Date.now();
    const states = Object.values(srs);
    const ready = readiness(mastery);
    const str = streak();
    const xp = loadXp();
    const calEvents = loadCalibration();
    const calTotals = quadrantTotals(calEvents);
    const solidCount = calEvents.filter(
      (e) => e.confidence === "certain" && e.correct
    ).length;
    const calScore = calibrationScore(calEvents);
    setSnap({
      attempts,
      logs,
      mastery,
      ready,
      streak: str,
      cards: {
        reviewed: states.length,
        due: states.filter((s) => isDue(s, now)).length,
        mastered: states.filter((s) => s.interval >= 21).length,
      },
      xpTotal: xp.total,
      level: levelFor(xp.total),
      badges: evaluateBadges({
        attempts,
        logs,
        cardStates: states,
        mastery,
        streakLongest: str.longest,
        readiness: ready,
        xpTotal: xp.total,
        solidCount,
        calibScore: calScore,
        calibTotal: calEvents.length,
      }),
      calib: {
        totals: calTotals,
        score: calScore,
        tasks: taskCalibration(calEvents),
      },
    });
  }, []);

  if (!snap) {
    return (
      <main className="grid min-h-[70vh] place-items-center">
        <span className="font-mono text-sm text-muted">Reading your record…</span>
      </main>
    );
  }

  const hasData =
    snap.attempts.length > 0 || snap.logs.length > 0 || snap.cards.reviewed > 0;

  const withData = snap.mastery.filter((m) => m.pct !== null);
  const weakest =
    withData.length > 0
      ? withData.reduce((a, b) => (a.pct! <= b.pct! ? a : b))
      : null;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
      <p className="rise mb-3 font-mono text-xs uppercase tracking-[0.3em] text-accent">
        The ascent
      </p>
      <h1
        className="rise font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
        style={{ animationDelay: "0.05s" }}
      >
        Your <span className="sheen italic">progress</span>
      </h1>

      {!hasData ? (
        <div
          className="rise codex-panel mt-8 p-8 text-center"
          style={{ animationDelay: "0.1s" }}
        >
          <p className="text-dim">
            No data yet. Take a quiz, review some cards, or log a mock exam and
            your mastery will start filling in here.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/practice"
              className="rounded-lg px-5 py-2.5 font-mono text-sm font-semibold text-[color:var(--bg)]"
              style={{ background: "var(--cta)" }}
            >
              Take a quiz →
            </Link>
            <Link
              href="/log"
              className="rounded-lg border border-border px-5 py-2.5 font-mono text-sm text-ink"
            >
              Log an exam
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Level band */}
          <div
            className="rise codex-panel mt-8 flex flex-col gap-3 p-6"
            style={{ animationDelay: "0.08s", borderColor: "var(--border-strong)" }}
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="font-mono text-[0.7rem] uppercase tracking-wider text-muted">
                  Level {snap.level.level}
                </div>
                <div className="sheen font-display text-3xl font-semibold">
                  {snap.level.name}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-semibold tabular text-ink">
                  {snap.xpTotal.toLocaleString()}
                </div>
                <div className="font-mono text-[0.7rem] uppercase tracking-wider text-muted">
                  XP
                </div>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--accent)" }}
                initial={{ width: 0 }}
                animate={{ width: `${snap.level.pct}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="font-mono text-xs text-muted">
              {snap.level.nextName
                ? `${snap.level.span - snap.level.into} XP to ${snap.level.nextName}`
                : "Max level reached — Grand Architect"}
            </div>
          </div>

          {/* Top stats */}
          <div
            className="rise mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
            style={{ animationDelay: "0.1s" }}
          >
            <Stat
              label="Readiness"
              value={snap.ready !== null ? `${snap.ready}%` : "—"}
              hint="exam-weighted"
              highlight
            />
            <Stat
              label="Streak"
              value={`${snap.streak.current}🔥`}
              hint={`best ${snap.streak.longest}`}
            />
            <Stat
              label="Quizzes"
              value={String(snap.attempts.length)}
              hint={`${snap.logs.length} logged`}
            />
            <Stat
              label="Cards"
              value={`${snap.cards.mastered}`}
              hint={`mastered · ${snap.cards.due} due`}
            />
          </div>

          {/* Readiness note */}
          {snap.ready !== null && (
            <p
              className="rise mt-3 font-mono text-xs text-muted"
              style={{ animationDelay: "0.15s" }}
            >
              Target ~72%+ (a rough proxy for the 720/1000 cut line). Readiness
              is your exam-weighted accuracy across domains with data.
            </p>
          )}

          {/* Domain mastery */}
          <section className="mt-10">
            <div className="mb-5 flex items-end justify-between">
              <h2 className="font-display text-xl font-medium text-ink">
                Domain mastery
              </h2>
              {weakest && (
                <span className="font-mono text-xs text-muted">
                  focus:{" "}
                  <span style={{ color: `var(--${domainByNumber(weakest.domain).accent})` }}>
                    D{weakest.domain}
                  </span>
                </span>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {domains.map((d, i) => {
                const m = snap.mastery.find((x) => x.domain === d.number)!;
                const accent = `var(--${d.accent})`;
                const isWeak = weakest?.domain === d.number;
                return (
                  <div
                    key={d.number}
                    className="rise"
                    style={{ animationDelay: `${0.2 + i * 0.05}s` }}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm">
                        <span
                          className="font-mono font-semibold"
                          style={{ color: accent }}
                        >
                          D{d.number}
                        </span>
                        <span className="text-dim">{d.name}</span>
                        {isWeak && (
                          <span
                            className="rounded px-1.5 py-0.5 font-mono text-[0.6rem] uppercase"
                            style={{
                              color: "var(--cta)",
                              background:
                                "color-mix(in oklab, var(--cta) 14%, transparent)",
                            }}
                          >
                            weakest
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-xs tabular text-muted">
                        {m.pct !== null ? (
                          <>
                            {m.pct}%{" "}
                            <span className="text-faint">
                              ({m.correct}/{m.total})
                            </span>
                          </>
                        ) : (
                          "no data"
                        )}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)]">
                      {m.pct !== null && (
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: accent }}
                          initial={{ width: 0 }}
                          animate={{ width: `${m.pct}%` }}
                          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Calibration */}
          <Calibration calib={snap.calib} />

          {/* Badges */}
          <section className="mt-12">
            <div className="mb-5 flex items-end justify-between">
              <h2 className="font-display text-xl font-medium text-ink">Badges</h2>
              <span className="font-mono text-xs text-muted">
                {snap.badges.filter((b) => b.unlocked).length}/{snap.badges.length}{" "}
                earned
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {snap.badges.map((b, i) => (
                <div
                  key={b.id}
                  className="rise codex-panel flex items-center gap-3 px-4 py-3"
                  style={{
                    animationDelay: `${0.1 + i * 0.03}s`,
                    opacity: b.unlocked ? 1 : 0.45,
                    borderColor: b.unlocked
                      ? "var(--border-strong)"
                      : "var(--border)",
                  }}
                >
                  <span
                    className="text-2xl"
                    style={{ filter: b.unlocked ? "none" : "grayscale(1)" }}
                  >
                    {b.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-sm font-medium text-ink">
                      {b.name}
                    </span>
                    <span className="block text-xs leading-snug text-muted">
                      {b.desc}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* History */}
          <section className="mt-12">
            <h2 className="mb-5 font-display text-xl font-medium text-ink">
              Recent activity
            </h2>
            <History attempts={snap.attempts} logs={snap.logs} />
          </section>
        </>
      )}

      <p className="mt-12 font-mono text-[0.7rem] text-faint">
        {totalQuestions} questions · {totalCards} cards in the bank · progress
        stored locally on this device
      </p>
    </main>
  );
}

function Calibration({
  calib,
}: {
  calib: { totals: QuadrantTotals; score: number | null; tasks: TaskCalibration[] };
}) {
  const { totals, score, tasks } = calib;
  const blindSpots = tasks.filter((t) => t.status === "blindspot");
  const knownCold = tasks.filter((t) => t.status === "known-cold");
  const shaky = tasks.filter((t) => t.status === "shaky");

  const quad = [
    { key: "solid", label: "Known cold", sub: "sure + right", n: totals.solid, color: "var(--correct)" },
    { key: "blindspot", label: "Blind spots", sub: "sure + wrong", n: totals.blindspot, color: "var(--wrong)" },
    { key: "lucky", label: "Lucky", sub: "unsure + right", n: totals.lucky, color: "var(--d1)" },
    { key: "gap", label: "Honest gaps", sub: "unsure + wrong", n: totals.gap, color: "var(--text-muted)" },
  ];

  return (
    <section className="mt-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="font-display text-xl font-medium text-ink">Calibration</h2>
        {score !== null && (
          <span className="font-mono text-xs text-muted">
            calibration score{" "}
            <span
              className="font-semibold"
              style={{ color: score >= 80 ? "var(--correct)" : "var(--d1)" }}
            >
              {score}%
            </span>
          </span>
        )}
      </div>

      {totals.total === 0 ? (
        <p className="text-sm text-muted">
          No confidence data yet. Take a quiz or review flashcards — you&apos;ll
          rate how sure you are before each reveal, and this fills in.
        </p>
      ) : (
        <>
          <p className="mb-4 max-w-2xl text-sm text-dim">
            How your confidence lines up with being right. The goal: move
            everything into <span style={{ color: "var(--correct)" }}>known cold</span>.
            The <span style={{ color: "var(--wrong)" }}>blind spots</span> —
            sure but wrong — are what to fix first.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {quad.map((q) => (
              <div
                key={q.key}
                className="codex-panel px-4 py-4"
                style={{
                  borderColor:
                    q.n > 0
                      ? `color-mix(in oklab, ${q.color} 40%, transparent)`
                      : "var(--border)",
                }}
              >
                <div
                  className="font-display text-3xl font-semibold tabular"
                  style={{ color: q.n > 0 ? q.color : "var(--text-faint)" }}
                >
                  {q.n}
                </div>
                <div className="mt-1 font-mono text-xs text-ink">{q.label}</div>
                <div className="font-mono text-[0.65rem] text-muted">{q.sub}</div>
              </div>
            ))}
          </div>

          {blindSpots.length > 0 && (
            <TaskChips
              title="Fix first — blind spots"
              tasks={blindSpots}
              color="var(--wrong)"
            />
          )}
          {shaky.length > 0 && (
            <TaskChips title="Shore up — shaky" tasks={shaky} color="var(--d1)" />
          )}
          {knownCold.length > 0 && (
            <TaskChips
              title="Padrenuestros — known cold"
              tasks={knownCold}
              color="var(--correct)"
            />
          )}
        </>
      )}
    </section>
  );
}

function TaskChips({
  title,
  tasks,
  color,
}: {
  title: string;
  tasks: TaskCalibration[];
  color: string;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-wider" style={{ color }}>
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {tasks.map((t) => (
          <Link
            key={t.taskCode}
            href={`/practice/run?domain=${t.domain}&n=6`}
            className="rounded-md border px-2.5 py-1 font-mono text-xs transition-colors hover:border-[color:var(--accent)]"
            style={{
              borderColor: `color-mix(in oklab, ${color} 35%, transparent)`,
              color: "var(--text-dim)",
            }}
          >
            <span style={{ color: `var(--${domainByNumber(t.domain).accent})` }}>
              {t.taskCode}
            </span>{" "}
            <span className="text-muted">
              {t.totals.solid}▲ {t.totals.blindspot}▼
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="codex-panel px-4 py-4"
      style={
        highlight
          ? { borderColor: "var(--border-strong)" }
          : undefined
      }
    >
      <div
        className={`font-display text-3xl font-semibold tabular ${highlight ? "sheen" : "text-ink"}`}
      >
        {value}
      </div>
      <div className="mt-1 font-mono text-[0.7rem] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="font-mono text-[0.65rem] text-faint">{hint}</div>
    </div>
  );
}

function History({
  attempts,
  logs,
}: {
  attempts: QuizAttempt[];
  logs: ExamLog[];
}) {
  const items = [
    ...attempts.map((a) => ({
      kind: "quiz" as const,
      date: a.date,
      title:
        a.domain !== null
          ? `Quiz · D${a.domain} ${domainByNumber(a.domain).name}`
          : "Mixed quiz",
      right: `${a.pct}%`,
      pass: a.pct >= 72,
    })),
    ...logs.map((l) => {
      const pct =
        l.correct !== null && l.total
          ? Math.round((l.correct / l.total) * 100)
          : null;
      return {
        kind: "log" as const,
        date: l.date,
        title: `Logged · ${l.source}`,
        right: l.scaled !== null ? `${l.scaled}/1000` : pct !== null ? `${pct}%` : "—",
        pass: l.passed ?? (pct !== null ? pct >= 72 : null),
      };
    }),
  ]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 10);

  if (items.length === 0)
    return <p className="text-sm text-muted">No activity recorded yet.</p>;

  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{
                background: it.kind === "quiz" ? "var(--accent)" : "var(--cta)",
              }}
            />
            <span className="text-sm text-dim">{it.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-faint">
              {new Date(it.date).toLocaleDateString()}
            </span>
            <span
              className="font-mono text-sm font-semibold tabular"
              style={{
                color:
                  it.pass === null
                    ? "var(--text-muted)"
                    : it.pass
                      ? "var(--correct)"
                      : "var(--wrong)",
              }}
            >
              {it.right}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
