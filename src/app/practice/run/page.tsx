import Link from "next/link";
import { getQuizPool, getScenarioPool } from "@/lib/queries";
import { scenarios } from "@/lib/blueprint";
import { QuizSession } from "@/components/QuizSession";
import { ScenarioSession } from "@/components/ScenarioSession";

export const metadata = { title: "Quiz — The Architect's Codex" };

function Empty({ message }: { message: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-24 text-center">
      <p className="font-display text-2xl text-ink">{message}</p>
      <Link
        href="/practice"
        className="mt-6 inline-block font-mono text-sm text-accent hover:underline"
      >
        ← Back to practice
      </Link>
    </main>
  );
}

export default async function RunPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; n?: string; scenario?: string }>;
}) {
  const params = await searchParams;
  const n = params.n ? Math.max(1, Math.min(30, Number(params.n))) : 10;

  // Scenario drill: the draw has to span every domain the scenario covers, so
  // it takes its own pool and its own session shell.
  if (params.scenario) {
    const scenario = scenarios.find((s) => s.slug === params.scenario);
    if (!scenario) return <Empty message="No such scenario." />;
    const pool = await getScenarioPool(scenario.slug);
    if (pool.length === 0)
      return <Empty message="No questions for this scenario yet." />;
    return <ScenarioSession pool={pool} count={n} scenario={scenario} />;
  }

  const domain = params.domain ? Number(params.domain) : null;
  const pool = await getQuizPool(domain);
  if (pool.length === 0) return <Empty message="No questions here yet." />;

  return <QuizSession pool={pool} count={n} domain={domain} />;
}
