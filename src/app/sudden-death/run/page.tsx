import Link from "next/link";
import { getQuestionsByDifficulty } from "@/lib/queries";
import { SuddenDeathRunner } from "@/components/SuddenDeathRunner";

export const metadata = { title: "Sudden Death — The Architect's Codex" };

export default async function SuddenDeathRunPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const hard = mode === "hard";
  const tiers = hard ? [3] : [1, 2];
  const questions = await getQuestionsByDifficulty(tiers, 10);

  if (questions.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-24 text-center">
        <p className="font-display text-2xl text-ink">No questions available.</p>
        <Link
          href="/sudden-death"
          className="mt-6 inline-block font-mono text-sm text-accent hover:underline"
        >
          ← Back
        </Link>
      </main>
    );
  }

  return <SuddenDeathRunner questions={questions} mode={hard ? "hard" : "easy"} />;
}
