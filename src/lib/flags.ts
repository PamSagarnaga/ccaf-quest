/** Flag/unflag questions to revisit. Stored as an id list in localStorage. */
import { pushToCloud } from "@/lib/sync";

const KEY = "ccaf_flags";

export function loadFlags(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function isFlagged(id: string): boolean {
  return loadFlags().has(id);
}

/** Toggle a flag; returns the new flagged state. */
export function toggleFlag(id: string): boolean {
  const flags = loadFlags();
  const now = !flags.has(id);
  if (now) flags.add(id);
  else flags.delete(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...flags]));
    pushToCloud(KEY);
  } catch {
    // ignore
  }
  return now;
}
