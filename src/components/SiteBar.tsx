import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { SignOutButton } from "./SignOutButton";

export function SiteBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-[color:var(--bg)]/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <span
            className="grid size-7 place-items-center rounded-md text-[color:var(--bg)]"
            style={{
              background:
                "linear-gradient(135deg, var(--accent), var(--accent-strong))",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M4 5h11l5 5v9H4zM15 5v5h5" />
            </svg>
          </span>
          <span className="font-display text-sm font-semibold tracking-tight text-ink">
            The Codex
          </span>
        </Link>
        <div className="flex items-center gap-2.5">
          <SignOutButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
