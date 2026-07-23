"use client";

import { useEffect, useState } from "react";
import { hydrateFromCloud } from "@/lib/sync";

/**
 * Pulls cloud-stored progress into localStorage before rendering children,
 * so pages that read localStorage on mount never see a stale/empty cache.
 * No-op (resolves immediately) when there's no active session.
 */
export function CloudSync({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hydrateFromCloud().finally(() => {
      if (!cancelled) setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-dim">
        <span className="text-sm">Loading your progress…</span>
      </div>
    );
  }

  return <>{children}</>;
}
