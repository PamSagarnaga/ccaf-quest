// Server-free shared types and constants for the quiz/exam surface. Kept
// separate from queries.ts (which imports the server-only Supabase client) so
// client components can import these without pulling `next/headers` into the
// browser bundle.

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

// Blueprint-weighted item counts for a 60-item exam (sums to 60).
export const EXAM_DOMAIN_TARGETS: Record<number, number> = {
  1: 16,
  2: 11,
  3: 12,
  4: 12,
  5: 9,
};
