"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadFlags } from "@/lib/flags";
import { QuizRunner } from "@/components/QuizRunner";
import type { QuizQuestion } from "@/lib/queries";

const SELECT =
  "id,domain,task_code,scenario,stem,type,difficulty,options:question_options(label,body,is_correct,rationale,sort)";

export function FlaggedReview() {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);

  useEffect(() => {
    const ids = [...loadFlags()];
    if (ids.length === 0) {
      setQuestions([]);
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("questions")
        .select(SELECT)
        .in("id", ids);
      const qs = ((data ?? []) as unknown as QuizQuestion[]).map((q) => ({
        ...q,
        options: [...q.options].sort((a, b) => a.sort - b.sort),
      }));
      setQuestions(qs);
    })();
  }, []);

  if (questions === null) {
    return (
      <main className="grid min-h-[70vh] place-items-center">
        <span className="font-mono text-sm text-muted">Loading flagged…</span>
      </main>
    );
  }

  if (questions.length === 0) {
    return (
      <main className="mx-auto w-full max-w-lg px-5 py-24 text-center">
        <div className="text-4xl">⚑</div>
        <p className="mt-4 font-display text-2xl text-ink">No flagged questions</p>
        <p className="mt-2 text-sm text-muted">
          Flag questions during practice or an exam (the ⚐ button) and they&apos;ll
          collect here for a focused review.
        </p>
        <Link
          href="/practice"
          className="mt-6 inline-block font-mono text-sm text-accent hover:underline"
        >
          ← Go practice
        </Link>
      </main>
    );
  }

  return <QuizRunner questions={questions} domain={null} />;
}
