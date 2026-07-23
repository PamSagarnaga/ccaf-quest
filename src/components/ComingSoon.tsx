import Link from "next/link";

export function ComingSoon({
  kicker,
  title,
  body,
  phase,
}: {
  kicker: string;
  title: string;
  body: string;
  phase: string;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-5 text-center">
      <p className="rise font-mono text-xs uppercase tracking-[0.3em] text-accent">
        {kicker}
      </p>
      <h1
        className="rise mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
        style={{ animationDelay: "0.05s" }}
      >
        {title}
      </h1>
      <p
        className="rise mt-4 max-w-md text-dim"
        style={{ animationDelay: "0.1s" }}
      >
        {body}
      </p>
      <span
        className="rise mt-6 rounded-full border border-border px-3 py-1 font-mono text-xs text-muted"
        style={{ animationDelay: "0.15s" }}
      >
        {phase}
      </span>
      <Link
        href="/"
        className="rise mt-8 font-mono text-sm text-accent hover:underline"
        style={{ animationDelay: "0.2s" }}
      >
        ← Back to the Codex
      </Link>
    </main>
  );
}
