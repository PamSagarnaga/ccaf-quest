import { createClient } from "@/lib/supabase/server";

export interface QuizOption {
  label: string;
  body: string;
  is_correct: boolean;
  rationale: string | null;
  sort: number;
}

export interface QuizQuestion {
  id: string;
  domain: number;
  task_code: string | null;
  scenario: string | null;
  stem: string;
  type: "single" | "multi";
  difficulty: number | null;
  options: QuizOption[];
}

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

function sortOpts(q: QuizQuestion): QuizQuestion {
  return { ...q, options: [...q.options].sort((a, b) => a.sort - b.sort) };
}

/** Fetch a shuffled quiz set, optionally filtered to one domain. */
export async function getQuizQuestions(
  domain: number | null,
  limit: number
): Promise<QuizQuestion[]> {
  const supabase = await createClient();
  let query = supabase.from("questions").select(QUESTION_SELECT);
  if (domain) query = query.eq("domain", domain);
  const { data, error } = await query;
  if (error) throw error;

  const questions = (data ?? []) as unknown as QuizQuestion[];
  return shuffle(questions).slice(0, limit).map(sortOpts);
}

// Blueprint-weighted item counts for a 60-item exam (sums to 60).
export const EXAM_DOMAIN_TARGETS: Record<number, number> = {
  1: 16,
  2: 11,
  3: 12,
  4: 12,
  5: 9,
};

/** A full 60-item exam draw, domain-weighted like the real blueprint. */
export async function getExamQuestions(): Promise<QuizQuestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("questions").select(QUESTION_SELECT);
  if (error) throw error;
  const all = (data ?? []) as unknown as QuizQuestion[];

  const out: QuizQuestion[] = [];
  for (const [d, n] of Object.entries(EXAM_DOMAIN_TARGETS)) {
    const pool = shuffle(all.filter((q) => q.domain === Number(d)));
    out.push(...pool.slice(0, n));
  }
  return shuffle(out).map(sortOpts);
}

/** Questions filtered by difficulty tier (1=recall, 2=applied, 3=scenario). */
export async function getQuestionsByDifficulty(
  tiers: number[],
  limit: number
): Promise<QuizQuestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_SELECT)
    .in("difficulty", tiers);
  if (error) throw error;
  const all = (data ?? []) as unknown as QuizQuestion[];
  return shuffle(all).slice(0, limit).map(sortOpts);
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
  return ((data ?? []) as unknown as QuizQuestion[]).map(sortOpts);
}
