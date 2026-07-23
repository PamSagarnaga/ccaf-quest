"use client";
import { useState } from "react";
import type { QuizQuestion } from "@/lib/queries";
import { pickUnseen } from "@/lib/seen";
import { SuddenDeathRunner } from "@/components/SuddenDeathRunner";

/** Picks up to 10 unseen items for the run, then hands them to the runner. */
export function SuddenDeathSession({
  pool,
  mode,
}: {
  pool: QuizQuestion[];
  mode: "easy" | "hard";
}) {
  const [questions] = useState(() => pickUnseen(pool, 10, `sd_${mode}`));
  return <SuddenDeathRunner questions={questions} mode={mode} />;
}
