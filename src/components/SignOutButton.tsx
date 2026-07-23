"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    location.href = "/login";
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-dim transition-colors duration-300 hover:border-[color:var(--border-strong)] hover:text-ink"
    >
      Sign out
    </button>
  );
}
