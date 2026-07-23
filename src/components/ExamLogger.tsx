"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { domains } from "@/lib/blueprint";
import {
  loadLogs,
  saveLog,
  deleteLog,
  type ExamLog,
  type DomainScore,
} from "@/lib/progress";
import { awardXp } from "@/lib/gamification";

const todayISO = () => new Date().toISOString().slice(0, 10);

export function ExamLogger() {
  const [logs, setLogs] = useState<ExamLog[] | null>(null);

  const [source, setSource] = useState("");
  const [date, setDate] = useState(todayISO());
  const [correct, setCorrect] = useState("");
  const [total, setTotal] = useState("60");
  const [scaled, setScaled] = useState("");
  const [notes, setNotes] = useState("");
  const [perDomain, setPerDomain] = useState<Record<number, { c: string; t: string }>>(
    () => Object.fromEntries(domains.map((d) => [d.number, { c: "", t: "" }]))
  );
  const [showDomains, setShowDomains] = useState(false);

  useEffect(() => setLogs(loadLogs()), []);

  function reset() {
    setSource("");
    setDate(todayISO());
    setCorrect("");
    setTotal("60");
    setScaled("");
    setNotes("");
    setPerDomain(Object.fromEntries(domains.map((d) => [d.number, { c: "", t: "" }])));
    setShowDomains(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!source.trim()) return;

    const pd: Record<number, DomainScore> = {};
    for (const d of domains) {
      const row = perDomain[d.number];
      const t = Number(row.t);
      const c = Number(row.c);
      if (t > 0) pd[d.number] = { correct: isNaN(c) ? 0 : c, total: t };
    }

    const scaledNum = scaled ? Number(scaled) : null;
    const log: ExamLog = {
      id: crypto.randomUUID(),
      date: new Date(date + "T12:00:00").toISOString(),
      source: source.trim(),
      correct: correct ? Number(correct) : null,
      total: total ? Number(total) : null,
      scaled: scaledNum,
      passed: scaledNum !== null ? scaledNum >= 720 : null,
      perDomain: pd,
      notes: notes.trim(),
    };

    saveLog(log);
    awardXp(30, "logged exam");
    setLogs(loadLogs());
    reset();
  }

  function remove(id: string) {
    deleteLog(id);
    setLogs(loadLogs());
  }

  const field =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-[color:var(--accent)]";
  const labelCls =
    "mb-1.5 block font-mono text-[0.7rem] uppercase tracking-wider text-muted";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
      <p className="rise mb-3 font-mono text-xs uppercase tracking-[0.3em] text-accent">
        Field record
      </p>
      <h1
        className="rise font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
        style={{ animationDelay: "0.05s" }}
      >
        Log an <span className="sheen italic">exam</span>
      </h1>
      <p className="rise mt-4 max-w-xl text-dim" style={{ animationDelay: "0.1s" }}>
        Took a mock somewhere else? Record it here — with the per-domain
        breakdown if you have it — and it feeds straight into your progress.
      </p>

      {/* Form */}
      <form
        onSubmit={submit}
        className="rise codex-panel mt-8 flex flex-col gap-5 p-6"
        style={{ animationDelay: "0.15s" }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Source</label>
            <input
              className={field}
              placeholder="e.g. cyberskill, cosx.ai…"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input
              type="date"
              className={field}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Correct</label>
            <input
              type="number"
              min="0"
              className={field}
              placeholder="46"
              value={correct}
              onChange={(e) => setCorrect(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Out of</label>
            <input
              type="number"
              min="1"
              className={field}
              placeholder="60"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Scaled (0–1000)</label>
            <input
              type="number"
              min="0"
              max="1000"
              className={field}
              placeholder="767"
              value={scaled}
              onChange={(e) => setScaled(e.target.value)}
            />
          </div>
        </div>

        {/* Per-domain (optional) */}
        <div>
          <button
            type="button"
            onClick={() => setShowDomains((s) => !s)}
            className="flex items-center gap-2 font-mono text-xs text-accent"
          >
            <span
              className="transition-transform duration-200"
              style={{ transform: showDomains ? "rotate(90deg)" : "none" }}
            >
              ▸
            </span>
            Per-domain breakdown (optional)
          </button>
          <AnimatePresence>
            {showDomains && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex flex-col gap-2">
                  {domains.map((d) => (
                    <div key={d.number} className="flex items-center gap-3">
                      <span
                        className="grid size-7 shrink-0 place-items-center rounded-md font-mono text-xs font-semibold"
                        style={{
                          color: `var(--${d.accent})`,
                          background: `color-mix(in oklab, var(--${d.accent}) 14%, transparent)`,
                        }}
                      >
                        {d.number}
                      </span>
                      <span className="flex-1 truncate text-sm text-dim">
                        {d.name}
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="✓"
                        className={`${field} w-16 text-center`}
                        value={perDomain[d.number].c}
                        onChange={(e) =>
                          setPerDomain((p) => ({
                            ...p,
                            [d.number]: { ...p[d.number], c: e.target.value },
                          }))
                        }
                      />
                      <span className="text-muted">/</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="tot"
                        className={`${field} w-16 text-center`}
                        value={perDomain[d.number].t}
                        onChange={(e) =>
                          setPerDomain((p) => ({
                            ...p,
                            [d.number]: { ...p[d.number], t: e.target.value },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            className={`${field} min-h-[4rem] resize-y`}
            placeholder="Weakest on code exploration; ran out of time…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!source.trim()}
            className="rounded-lg px-6 py-2.5 font-mono text-sm font-semibold text-[color:var(--bg)] transition-opacity disabled:opacity-40"
            style={{ background: "var(--cta)" }}
          >
            Save exam
          </button>
        </div>
      </form>

      {/* History */}
      <div className="mb-4 mt-12 flex items-end justify-between">
        <h2 className="font-display text-xl font-medium text-ink">Logged exams</h2>
        <span className="font-mono text-xs text-muted">
          {logs?.length ?? 0} recorded
        </span>
      </div>

      {logs && logs.length === 0 && (
        <p className="text-sm text-muted">
          Nothing logged yet. Your three real mocks would be a great start.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {logs
          ?.slice()
          .reverse()
          .map((l) => (
            <LogRow key={l.id} log={l} onDelete={() => remove(l.id)} />
          ))}
      </div>
    </main>
  );
}

function LogRow({ log, onDelete }: { log: ExamLog; onDelete: () => void }) {
  const pctFromCounts =
    log.correct !== null && log.total
      ? Math.round((log.correct / log.total) * 100)
      : null;
  const headline =
    log.scaled !== null
      ? `${log.scaled}/1000`
      : pctFromCounts !== null
        ? `${pctFromCounts}%`
        : "—";
  const pass =
    log.passed ?? (pctFromCounts !== null ? pctFromCounts >= 72 : null);

  return (
    <div className="codex-panel flex items-start gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-base font-medium text-ink">
            {log.source}
          </span>
          <span className="font-mono text-xs text-muted">
            {new Date(log.date).toLocaleDateString()}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
          <span className="text-dim">
            {log.correct !== null && log.total
              ? `${log.correct}/${log.total}`
              : ""}
          </span>
          {pass !== null && (
            <span style={{ color: pass ? "var(--correct)" : "var(--wrong)" }}>
              {pass ? "pass" : "below cut"}
            </span>
          )}
          {Object.entries(log.perDomain).map(([d, s]) => (
            <span
              key={d}
              className="rounded px-1.5 py-0.5"
              style={{
                color: `var(--d${d})`,
                background: `color-mix(in oklab, var(--d${d}) 12%, transparent)`,
              }}
            >
              D{d} {Math.round((s.correct / s.total) * 100)}%
            </span>
          ))}
        </div>
        {log.notes && (
          <p className="mt-2 text-sm leading-snug text-muted">{log.notes}</p>
        )}
      </div>
      <div className="text-right">
        <div className="sheen font-display text-xl font-semibold tabular">
          {headline}
        </div>
        <button
          onClick={onDelete}
          className="mt-1 font-mono text-[0.7rem] text-faint transition-colors hover:text-[color:var(--wrong)]"
        >
          delete
        </button>
      </div>
    </div>
  );
}
