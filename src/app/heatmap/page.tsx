import { TraceView } from "@/components/TraceView";
import { getTaskQuestionCounts } from "@/lib/queries";

export const metadata = { title: "Trace — The Architect's Codex" };

export default async function TracePage() {
  // Bank counts are the coverage denominator; the rest of the trace is built
  // client-side from local progress state.
  const taskBankCounts = await getTaskQuestionCounts();
  return <TraceView taskBankCounts={taskBankCounts} />;
}
