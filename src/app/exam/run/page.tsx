import Link from "next/link";
import { getExamQuestions } from "@/lib/queries";
import { ExamRunner } from "@/components/ExamRunner";

export const metadata = { title: "Exam — The Architect's Codex" };

export default async function ExamRunPage() {
  const questions = await getExamQuestions();

  if (questions.length < 10) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-24 text-center">
        <p className="font-display text-2xl text-ink">
          Not enough questions in the bank yet for a full exam.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block font-mono text-sm text-accent hover:underline"
        >
          ← Home
        </Link>
      </main>
    );
  }

  return <ExamRunner questions={questions} />;
}
