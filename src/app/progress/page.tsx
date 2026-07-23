import { ProgressDashboard } from "@/components/ProgressDashboard";
import { getDomainQuestionCounts, getFlashcards } from "@/lib/queries";

export const metadata = { title: "Progress — The Architect's Codex" };

export default async function ProgressPage() {
  const [counts, cards] = await Promise.all([
    getDomainQuestionCounts(),
    getFlashcards(null),
  ]);
  const totalQuestions = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <ProgressDashboard totalQuestions={totalQuestions} totalCards={cards.length} />
  );
}
