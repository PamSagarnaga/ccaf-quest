import { TraceView } from "@/components/TraceView";
import {
  getScenarioQuestionCounts,
  getTaskQuestionCounts,
} from "@/lib/queries";

export const metadata = { title: "Trace — The Architect's Codex" };

export default async function TracePage() {
  // Bank counts are the coverage denominator; the rest of the trace is built
  // client-side from local progress state. The scenario view needs its own
  // counts because it slices by domain and task *within* a scenario.
  const [taskBankCounts, scenarioBankCounts] = await Promise.all([
    getTaskQuestionCounts(),
    getScenarioQuestionCounts(),
  ]);
  return (
    <TraceView
      taskBankCounts={taskBankCounts}
      scenarioBankCounts={scenarioBankCounts}
    />
  );
}
