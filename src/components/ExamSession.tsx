"use client";
import { useState } from "react";
import type { QuizQuestion } from "@/lib/quiz-types";
import { EXAM_DOMAIN_TARGETS } from "@/lib/quiz-types";
import { examLockoutIds, pickUnseen, recordExamSitting } from "@/lib/seen";
import { ExamRunner } from "@/components/ExamRunner";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds the weighted 60-item exam client-side, drawing each domain's quota
 * with cross-attempt dedup so repeat exams lead with fresh items. Items from
 * the last two sittings are locked out entirely — remembering an answer would
 * inflate the score without reflecting readiness. Runs once on mount, then
 * shuffles the combined set so domains aren't clustered.
 */
export function ExamSession({ pool }: { pool: QuizQuestion[] }) {
  const [questions] = useState(() => {
    const lockout = examLockoutIds();
    const out: QuizQuestion[] = [];
    for (const [domain, target] of Object.entries(EXAM_DOMAIN_TARGETS)) {
      const domainPool = pool.filter((q) => q.domain === Number(domain));
      out.push(...pickUnseen(domainPool, target, `exam_d${domain}`, lockout));
    }
    recordExamSitting(out.map((q) => q.id));
    return shuffle(out);
  });
  return <ExamRunner questions={questions} />;
}
