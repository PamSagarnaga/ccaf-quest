"use client";
/**
 * The answer log — one append-only row per graded answer, and the single
 * source of truth for every rate the app reports.
 *
 * It replaces a two-store design that could not be reconciled: `itemStats`
 * kept a running tally per question (no dates, no history) while `calibration`
 * kept an event log. When the two disagreed there was no way to find the
 * answer responsible, because the tally had already thrown it away — and they
 * did disagree, since they were switched on a day apart and counted different
 * things. Accuracy and confidence must come from the same rows or they will
 * drift again.
 *
 * Both older stores keep being written for now: `calibration` holds 377
 * pre-existing ratings that can only ever be read at task level (no question
 * id was recorded), and `itemStats` still answers "which questions have I
 * seen" — a set, which can't contradict a rate. Neither feeds a score.
 */
import { pushToCloud } from "@/lib/sync";
import type { Confidence } from "@/lib/calibration";

const ANSWERS_KEY = "ccaf_answers";

/** Oldest rows are dropped past this. ~40 full exam sittings. */
const MAX_EVENTS = 5000;

export type AnswerMode = "quiz" | "exam" | "sudden" | "card";

export interface AnswerEvent {
  /** ISO timestamp. */
  ts: string;
  /** Question id, or flashcard id when mode is "card". */
  itemId: string;
  mode: AnswerMode;
  domain: number;
  task: string | null;
  scenario: string | null;
  correct: boolean;
  /** null when no confidence was captured (the exam tap is optional). */
  confidence: Confidence | null;
}

interface AnswerStore {
  v: 1;
  /**
   * Key of the most recent batch. React StrictMode double-invokes the effects
   * that flush an exam's answers; without this an entire sitting lands twice.
   */
  lastBatch?: string;
  events: AnswerEvent[];
}

const empty = (): AnswerStore => ({ v: 1, events: [] });

function read(): AnswerStore {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(ANSWERS_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as AnswerStore;
    // Anything without the version marker predates this store; ignore it
    // rather than guess at its shape.
    return parsed?.v === 1 && Array.isArray(parsed.events) ? parsed : empty();
  } catch {
    return empty();
  }
}

function write(store: AnswerStore) {
  try {
    localStorage.setItem(ANSWERS_KEY, JSON.stringify(store));
    void pushToCloud(ANSWERS_KEY);
  } catch {
    // non-fatal — the answer was already graded on screen
  }
}

/** Every logged answer, oldest first. */
export function loadAnswers(): AnswerEvent[] {
  return read().events;
}

/**
 * Append one batch of answers. Pass a whole quiz or sitting at once: one
 * localStorage write and one cloud push per call.
 *
 * `batchKey` makes the append idempotent — repeating the same key in a row is
 * a no-op, so a double-invoked effect can't duplicate a sitting. Callers that
 * log a single answer as it happens (a quiz question, a flashcard) can omit
 * it; those fire from an event handler, which runs once.
 */
export function logAnswers(events: AnswerEvent[], batchKey?: string): void {
  if (typeof window === "undefined" || events.length === 0) return;
  const store = read();
  if (batchKey !== undefined && store.lastBatch === batchKey) return;
  store.events = [...store.events, ...events].slice(-MAX_EVENTS);
  if (batchKey !== undefined) store.lastBatch = batchKey;
  write(store);
}

/** Append a single answer as it's graded. */
export function logAnswer(event: AnswerEvent): void {
  logAnswers([event]);
}
