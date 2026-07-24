import { HeatmapView } from "@/components/HeatmapView";
import { getDomainQuestionCounts } from "@/lib/queries";

export const metadata = { title: "Heatmap — The Architect's Codex" };

export default async function HeatmapPage() {
  const counts = await getDomainQuestionCounts();
  const bankTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  return <HeatmapView bankTotal={bankTotal} />;
}
