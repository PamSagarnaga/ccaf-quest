import Link from "next/link";
import { getFlashcards } from "@/lib/queries";
import { FlashcardReviewer } from "@/components/FlashcardReviewer";

export const metadata = { title: "Review — The Architect's Codex" };

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const params = await searchParams;
  const domain = params.domain ? Number(params.domain) : null;
  const cards = await getFlashcards(domain);

  if (cards.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-24 text-center">
        <p className="font-display text-2xl text-ink">No cards in this deck yet.</p>
        <Link
          href="/flashcards"
          className="mt-6 inline-block font-mono text-sm text-accent hover:underline"
        >
          ← Back to decks
        </Link>
      </main>
    );
  }

  return <FlashcardReviewer cards={cards} domain={domain} />;
}
