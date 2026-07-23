import Link from "next/link";
import { examMeta } from "@/lib/blueprint";

export const metadata = { title: "Exam Simulation — The Architect's Codex" };

const conditions = [
  { k: "60", v: "questions, blueprint-weighted across the 5 domains" },
  { k: "120", v: "minutes, one countdown — it auto-submits at zero" },
  { k: "0", v: "feedback until you submit, just like the real thing" },
  { k: "720", v: "scaled-score cut line (out of 1,000) to pass" },
];

export default function ExamLandingPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
      <p className="rise mb-3 font-mono text-xs uppercase tracking-[0.3em] text-cta">
        The real thing
      </p>
      <h1
        className="rise font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
        style={{ animationDelay: "0.05s" }}
      >
        Exam <span className="sheen italic">simulation</span>
      </h1>
      <p className="rise mt-4 text-dim" style={{ animationDelay: "0.1s" }}>
        Full {examMeta.code} conditions. Flag questions to revisit, set your
        confidence as you go, and get a scaled score with a per-domain
        breakdown — graded the way the real report is.
      </p>

      <div
        className="rise codex-panel mt-8 flex flex-col divide-y divide-[color:var(--border)]"
        style={{ animationDelay: "0.15s" }}
      >
        {conditions.map((c) => (
          <div key={c.v} className="flex items-center gap-4 px-6 py-4">
            <span className="sheen w-14 shrink-0 font-display text-3xl font-semibold tabular">
              {c.k}
            </span>
            <span className="text-sm text-dim">{c.v}</span>
          </div>
        ))}
      </div>

      <p
        className="rise mt-4 font-mono text-[0.7rem] text-faint"
        style={{ animationDelay: "0.2s" }}
      >
        Note: the official raw→scaled conversion is equated per form and not
        published. Your scaled score here is an estimate (correct ÷ 60 × 1000),
        matching common mock-platform scoring.
      </p>

      <Link
        href="/exam/run"
        className="rise mt-8 block rounded-lg px-6 py-3.5 text-center font-mono text-sm font-semibold text-[color:var(--bg)]"
        style={{ background: "var(--cta)", animationDelay: "0.25s" }}
      >
        Begin the 120-minute exam →
      </Link>
    </main>
  );
}
