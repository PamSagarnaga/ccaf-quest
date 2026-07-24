"use client";

import { useEffect, useState } from "react";
import { distinctSeen } from "@/lib/itemStats";

/**
 * Small "you've seen X% of the bank" line for the quiz/exam start screens, so
 * repeats driven by the pool running low are legible rather than surprising.
 * Renders nothing until mounted (localStorage is client-only) or before any
 * questions have been answered.
 */
export function CoverageBadge({ bankTotal }: { bankTotal: number }) {
  const [seen, setSeen] = useState<number | null>(null);

  useEffect(() => {
    setSeen(distinctSeen());
  }, []);

  if (!seen || bankTotal === 0) return null;
  const pct = Math.round((seen / bankTotal) * 100);

  return (
    <p className="mt-4 font-mono text-xs text-muted">
      You&apos;ve seen{" "}
      <span className="text-dim">
        {seen} of {bankTotal}
      </span>{" "}
      questions ({pct}%). Fresh items lead every draw until the pool runs low.
    </p>
  );
}
