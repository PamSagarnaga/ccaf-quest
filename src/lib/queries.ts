import { createClient } from "@/lib/supabase/server";
import type { QuizOption, QuizQuestion } from "@/lib/quiz-types";
import { EXAM_DOMAIN_TARGETS } from "@/lib/quiz-types";

// Re-exported so existing importers can keep pulling these from queries.
export type { QuizOption, QuizQuestion } from "@/lib/quiz-types";
export { EXAM_DOMAIN_TARGETS } from "@/lib/quiz-types";

const QUESTION_SELECT =
  "id,domain,task_code,scenario,stem,type,difficulty,options:question_options(label,body,is_correct,rationale,sort)";

/** Count of questions per domain (1..5). */
export async function getDomainQuestionCounts(): Promise<Record<number, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("questions").select("domain");
  if (error) throw error;
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of (data ?? []) as { domain: number }[])
    counts[row.domain] = (counts[row.domain] ?? 0) + 1;
  return counts;
}

/**
 * Count of questions per task code. Feeds the trace page's coverage column:
 * accuracy on 3 of 12 questions means something very different from 12 of 12,
 * and without the denominator a thin task looks the same as a mastered one.
 */
export async function getTaskQuestionCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("questions").select("task_code");
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { task_code: string | null }[])
    if (row.task_code) counts[row.task_code] = (counts[row.task_code] ?? 0) + 1;
  return counts;
}

export interface Flashcard {
  id: string;
  domain: number;
  task_code: string | null;
  front: string;
  back: string;
  source_ref: string | null;
}

/** All flashcards, optionally filtered to one domain, ordered by task code. */
export async function getFlashcards(
  domain: number | null
): Promise<Flashcard[]> {
  const supabase = await createClient();
  let query = supabase
    .from("flashcards")
    .select("id,domain,task_code,front,back,source_ref");
  if (domain) query = query.eq("domain", domain);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Flashcard[]).sort((a, b) =>
    (a.task_code ?? "").localeCompare(b.task_code ?? "")
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

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

// Randomize option order at serve time and re-label A/B/C/D to match the new
// positions. The seed data always stores the correct answer first (sort 0),
// which made position A a dead giveaway; grading keys off `is_correct`, never
// the label, so shuffling here is safe across quizzes, exams, and drills.
function shuffleOpts(q: QuizQuestion): QuizQuestion {
  const options = shuffle(q.options).map((opt, index) => ({
    ...opt,
    label: OPTION_LABELS[index] ?? opt.label,
    sort: index,
  }));
  return { ...q, options };
}

/**
 * Full shuffled quiz pool, optionally filtered to one domain. Final selection
 * (size + cross-attempt dedup) happens client-side so we can prefer questions
 * the user hasn't seen yet — see `pickUnseen` and QuizSession.
 */
export async function getQuizPool(
  domain: number | null
): Promise<QuizQuestion[]> {
  const supabase = await createClient();
  let query = supabase.from("questions").select(QUESTION_SELECT);
  if (domain) query = query.eq("domain", domain);
  const { data, error } = await query;
  if (error) throw error;

  const questions = (data ?? []) as unknown as QuizQuestion[];
  return shuffle(questions).map(shuffleOpts);
}

/**
 * Full shuffled question pool for an exam. The weighted 60-item draw
 * (EXAM_DOMAIN_TARGETS) plus cross-attempt dedup runs client-side in
 * ExamSession so repeat exams surface fresh items first.
 */
export async function getExamPool(): Promise<QuizQuestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("questions").select(QUESTION_SELECT);
  if (error) throw error;
  const all = (data ?? []) as unknown as QuizQuestion[];
  return shuffle(all).map(shuffleOpts);
}

/** Full shuffled pool for the given difficulty tiers (1=recall, 2=applied, 3=scenario). */
export async function getDifficultyPool(
  tiers: number[]
): Promise<QuizQuestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_SELECT)
    .in("difficulty", tiers);
  if (error) throw error;
  const all = (data ?? []) as unknown as QuizQuestion[];
  return shuffle(all).map(shuffleOpts);
}

/** Fetch specific questions by id (for the flagged-review drill). */
export async function getQuestionsByIds(ids: string[]): Promise<QuizQuestion[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_SELECT)
    .in("id", ids);
  if (error) throw error;
  return ((data ?? []) as unknown as QuizQuestion[]).map(shuffleOpts);
}
