import Link from "next/link";

export const metadata = { title: "Sudden Death — The Architect's Codex" };

const modes = [
  {
    href: "/sudden-death/run?mode=easy",
    name: "Easy",
    icon: "🤖",
    desc: "Recall & applied questions. Warm up your reflexes.",
    color: "var(--accent)",
  },
  {
    href: "/sudden-death/run?mode=hard",
    name: "Hard",
    icon: "🤖",
    desc: "Full exam-style scenarios. No mercy.",
    color: "var(--wrong)",
  },
];

export default function SuddenDeathPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
      <p className="rise mb-3 font-mono text-xs uppercase tracking-[0.3em] text-wrong">
        Sudden death
      </p>
      <h1
        className="rise font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
        style={{ animationDelay: "0.05s" }}
      >
        Three lives. <span className="sheen italic">Sixty seconds.</span>
      </h1>
      <p className="rise mt-4 text-dim" style={{ animationDelay: "0.1s" }}>
        Up to 10 questions, 60 seconds each. A wrong answer{" "}
        <em>or</em> a timeout costs a life 🤖. Build a combo, survive all ten.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {modes.map((m, i) => (
          <Link
            key={m.name}
            href={m.href}
            className="rise codex-panel group flex flex-col gap-3 px-6 py-6 transition-colors"
            style={{
              animationDelay: `${0.15 + i * 0.06}s`,
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{m.icon}🤖🤖</span>
            </div>
            <div
              className="font-display text-2xl font-semibold"
              style={{ color: m.color }}
            >
              {m.name}
            </div>
            <p className="text-sm text-muted">{m.desc}</p>
            <span
              className="mt-1 font-mono text-xs font-semibold"
              style={{ color: m.color }}
            >
              Start →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
