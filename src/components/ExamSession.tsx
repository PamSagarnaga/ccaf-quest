"use client";
import { useState } from "react";
import type { QuizQuestion } from "@/lib/queries";
import { EXAM_DOMAIN_TARGETS } from "@/lib/queries";
import { pickUnseen } from "@/lib/seen";
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
 * with cross-attempt dedup so repeat exams lead with fresh items. Runs once on
 * mount, then shuffles the combined set so domains aren't clustered.
 */
export function ExamSession({ pool }: { pool: QuizQuestion[] }) {
  const [questions] = useState(() => {
    const out: QuizQuestion[] = [];
    for (const [domain, target] of Object.entries(EXAM_DOMAIN_TARGETS)) {
      const domainPool = pool.filter((q) => q.domain === Number(domain));
      out.push(...pickUnseen(domainPool, target, `exam_d${domain}`));
    }
    return shuffle(out);
  });
  return <ExamRunner questions={questions} />;
}
