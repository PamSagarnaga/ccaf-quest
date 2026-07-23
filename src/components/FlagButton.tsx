"use client";

import { useEffect, useState } from "react";
import { isFlagged, toggleFlag } from "@/lib/flags";

/** A bookmark toggle for a question. Reads/writes localStorage flags. */
export function FlagButton({
  questionId,
  size = 18,
}: {
  questionId: string;
  size?: number;
}) {
  const [flagged, setFlagged] = useState(false);

  useEffect(() => setFlagged(isFlagged(questionId)), [questionId]);

  return (
    <button
      onClick={() => setFlagged(toggleFlag(questionId))}
      aria-label={flagged ? "Unflag question" : "Flag question to revisit"}
      title={flagged ? "Flagged — click to unflag" : "Flag to revisit"}
      className="grid place-items-center rounded-md border px-2 py-1 transition-colors"
      style={{
        borderColor: flagged ? "var(--cta)" : "var(--border)",
        background: flagged
          ? "color-mix(in oklab, var(--cta) 14%, transparent)"
          : "transparent",
        color: flagged ? "var(--cta)" : "var(--text-muted)",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill={flagged ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 21V4h13l-2 4 2 4H4" />
      </svg>
    </button>
  );
}
