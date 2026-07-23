import Link from "next/link";
import { getQuizPool } from "@/lib/queries";
import { QuizSession } from "@/components/QuizSession";

export const metadata = { title: "Quiz — The Architect's Codex" };

export default async function RunPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; n?: string }>;
}) {
  const params = await searchParams;
  const domain = params.domain ? Number(params.domain) : null;
  const n = params.n ? Math.max(1, Math.min(30, Number(params.n))) : 10;

  const pool = await getQuizPool(domain);

  if (pool.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-24 text-center">
        <p className="font-display text-2xl text-ink">No questions here yet.</p>
        <Link
          href="/practice"
          className="mt-6 inline-block font-mono text-sm text-accent hover:underline"
        >
          ← Back to practice
        </Link>
      </main>
    );
  }

  return <QuizSession pool={pool} count={n} domain={domain} />;
}
