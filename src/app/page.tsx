import Link from "next/link";
import { DomainDeck } from "@/components/DomainDeck";
import { examMeta, scenarios, domains } from "@/lib/blueprint";

const navCards = [
  {
    href: "/exam",
    kicker: "The real thing",
    title: "Exam Simulation",
    body: "60 questions, 120 minutes, a scaled score out of 1,000.",
    icon: "M9 11l3 3 8-8M12 3a9 9 0 108.5 6",
  },
  {
    href: "/sudden-death",
    kicker: "3 lives",
    title: "Sudden Death",
    body: "60 seconds a question. Wrong or timeout costs a life.",
    icon: "M13 2L3 14h7l-1 8 10-12h-7z",
  },
  {
    href: "/practice",
    kicker: "Trial by fire",
    title: "Practice",
    body: "Timed quizzes filtered by domain or task. Every answer explained.",
    icon: "M12 2l2.6 6.4L21 9.2l-5 4.4 1.5 6.8L12 17l-5.5 3.4L8 13.6l-5-4.4 6.4-.8z",
  },
  {
    href: "/flashcards",
    kicker: "Sharpen recall",
    title: "Flashcards",
    body: "Spaced-repetition decks, one per domain and task statement.",
    icon: "M4 5h16v11H4zM4 19h16",
  },
  {
    href: "/log",
    kicker: "Field record",
    title: "Log an exam",
    body: "Record scores from outside mocks. Track weak domains over time.",
    icon: "M5 3h11l3 3v15H5zM9 9h6M9 13h6M9 17h4",
  },
  {
    href: "/progress",
    kicker: "The ascent",
    title: "Progress",
    body: "Mastery bars, streaks, and where to aim next.",
    icon: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
      {/* ── Masthead ── */}
      <header className="mb-14">
        <p
          className="rise mb-4 font-mono text-xs uppercase tracking-[0.35em] text-accent"
          style={{ animationDelay: "0s" }}
        >
          {examMeta.code} · Foundations
        </p>
        <h1
          className="rise font-display text-5xl font-semibold leading-[0.95] tracking-tight text-ink sm:text-7xl"
          style={{ animationDelay: "0.06s" }}
        >
          The Architect&apos;s
          <br />
          <span
            className="sheen italic"
            style={{ animation: "sheen-shift 6s linear infinite" }}
          >
            Codex
          </span>
        </h1>
        <p
          className="rise mt-6 max-w-xl text-base leading-relaxed text-dim sm:text-lg"
          style={{ animationDelay: "0.12s" }}
        >
          A gamified prep companion for the{" "}
          <span className="text-ink">{examMeta.credential}</span> exam. Grounded
          in the official blueprint — every question and card traces back to a
          task statement.
        </p>

        {/* Exam vitals */}
        <dl
          className="rise mt-8 flex flex-wrap gap-x-8 gap-y-4"
          style={{ animationDelay: "0.18s" }}
        >
          {[
            { k: "Items", v: String(examMeta.items) },
            { k: "Minutes", v: String(examMeta.timeLimitMin) },
            { k: "To pass", v: `${examMeta.passingScore}/${examMeta.scaleMax}` },
            {
              k: "Scenarios",
              v: `${examMeta.scenariosPerExam} of ${examMeta.scenarioBank}`,
            },
          ].map((s) => (
            <div key={s.k}>
              <dd className="sheen font-display text-3xl font-semibold tabular">
                {s.v}
              </dd>
              <dt className="mt-0.5 font-mono text-[0.7rem] uppercase tracking-wider text-muted">
                {s.k}
              </dt>
            </div>
          ))}
        </dl>
      </header>

      {/* ── Quick actions ── */}
      <nav className="mb-16 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {navCards.map((c, i) => (
          <Link
            key={c.href}
            href={c.href}
            className="rise codex-panel group relative flex items-start gap-4 overflow-hidden px-5 py-5 transition-colors duration-300 hover:border-[color:var(--accent)]"
            style={{ animationDelay: `${0.22 + i * 0.06}s` }}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-accent transition-colors duration-300 group-hover:border-[color:var(--border-strong)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="size-5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={c.icon} />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[0.7rem] uppercase tracking-wider text-accent/80">
                {c.kicker}
              </span>
              <span className="mt-0.5 block font-display text-lg font-medium text-ink">
                {c.title}
              </span>
              <span className="mt-1 block text-sm leading-snug text-muted">
                {c.body}
              </span>
            </span>
            <span
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: "var(--glow)" }}
            />
          </Link>
        ))}
      </nav>

      {/* ── The blueprint ── */}
      <section className="mb-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-medium text-ink sm:text-3xl">
            The Blueprint
          </h2>
          <span className="font-mono text-xs text-muted">5 domains · 30 tasks</span>
        </div>
        <div className="codex-hairline mb-6" />
        <DomainDeck />
      </section>

      {/* ── Scenario bank ── */}
      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-medium text-ink sm:text-3xl">
            Scenario Bank
          </h2>
          <span className="font-mono text-xs text-muted">
            {examMeta.scenariosPerExam} drawn per exam
          </span>
        </div>
        <div className="codex-hairline mb-6" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {scenarios.map((s) => (
            <div key={s.slug} className="codex-panel flex flex-col gap-3 px-5 py-4">
              <h3 className="font-display text-base font-medium text-ink">
                {s.name}
              </h3>
              <p className="text-sm leading-snug text-muted">{s.description}</p>
              <div className="mt-auto flex gap-1.5 pt-1">
                {s.primary_domains.map((n) => {
                  const dd = domains.find((d) => d.number === n)!;
                  return (
                    <span
                      key={n}
                      title={dd.name}
                      className="grid size-6 place-items-center rounded font-mono text-xs font-semibold tabular"
                      style={{
                        color: `var(--${dd.accent})`,
                        background: `color-mix(in oklab, var(--${dd.accent}) 16%, transparent)`,
                      }}
                    >
                      {n}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-20 border-t border-border pt-6">
        <p className="font-mono text-xs text-faint">
          Unofficial study tool · not affiliated with Anthropic · blueprint per
          exam guide v1.0
        </p>
      </footer>
    </main>
  );
}
