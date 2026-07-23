import Link from "next/link";
import { getExamPool } from "@/lib/queries";
import { ExamSession } from "@/components/ExamSession";

export const metadata = { title: "Exam — The Architect's Codex" };

export default async function ExamRunPage() {
  const pool = await getExamPool();

  if (pool.length < 10) {
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

  return <ExamSession pool={pool} />;
}
