"use client";
import { useState } from "react";
import type { QuizQuestion } from "@/lib/queries";
import { pickUnseen } from "@/lib/seen";
import { QuizRunner } from "@/components/QuizRunner";

/**
 * Client shell that picks the actual quiz items from the full pool, preferring
 * questions not seen in recent quizzes for this domain, then hands them to the
 * runner. Selection runs once on mount so it stays stable across re-renders.
 */
export function QuizSession({
  pool,
  count,
  domain,
}: {
  pool: QuizQuestion[];
  count: number;
  domain: number | null;
}) {
  const bucket = domain ? `quiz_d${domain}` : "quiz";
  const [questions] = useState(() => pickUnseen(pool, count, bucket));
  return <QuizRunner questions={questions} domain={domain} />;
}
