import { getFlashcards } from "@/lib/queries";
import { FlashcardsHome } from "@/components/FlashcardsHome";

export const metadata = { title: "Flashcards — The Architect's Codex" };

export default async function FlashcardsPage() {
  const cards = await getFlashcards(null);
  return <FlashcardsHome cards={cards} />;
}
