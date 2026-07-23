"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [emailAddress, setEmailAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: emailAddress,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-5">
      <div className="codex-panel w-full max-w-sm rounded-2xl p-8">
        <div className="sheen mb-6 h-1 w-16 rounded-full" />
        <h1 className="font-display text-xl font-semibold text-ink">
          The Architect&apos;s Codex
        </h1>
        <p className="mt-1.5 text-sm text-dim">
          Sign in with a magic link — no password needed.
        </p>

        {status === "sent" ? (
          <p className="mt-6 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-ink">
            Check <span className="font-medium">{emailAddress}</span> for the
            link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-[color:var(--accent)]"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-lg bg-cta px-3 py-2 text-sm font-medium text-white transition-colors duration-300 hover:bg-[color:var(--cta-hover)] disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {status === "error" && (
              <p className="text-sm text-wrong">
                Couldn&apos;t send the link. Try again in a moment.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
