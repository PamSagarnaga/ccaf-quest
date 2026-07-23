"use client";
import { createClient } from "@/lib/supabase/client";

const PROGRESS_STORAGE_KEYS = [
  "ccaf_attempts",
  "ccaf_srs",
  "ccaf_exam_logs",
  "ccaf_activity",
  "ccaf_xp",
  "ccaf_calibration",
  "ccaf_flags",
  "ccaf_seen",
] as const;

/** Fire-and-forget: mirror one localStorage key to the cloud for the current user. */
export async function pushToCloud(storageKey: string) {
  try {
    const rawValue = localStorage.getItem(storageKey);
    if (rawValue == null) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_state").upsert(
      {
        user_id: user.id,
        key: storageKey,
        value: JSON.parse(rawValue),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" }
    );
  } catch {
    // ignore — local write already succeeded
  }
}

/** On login/cold-load: pull all cloud state into localStorage. Returns when done. */
export async function hydrateFromCloud(): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("user_state")
      .select("key,value")
      .eq("user_id", user.id);
    for (const row of data ?? []) {
      if ((PROGRESS_STORAGE_KEYS as readonly string[]).includes(row.key)) {
        localStorage.setItem(row.key, JSON.stringify(row.value));
      }
    }
  } catch {
    // offline / not-logged-in: fall back to whatever localStorage has
  }
}
