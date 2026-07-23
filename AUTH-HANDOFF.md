# Handoff — Add magic-link auth + cross-device progress

**For:** the next agent implementing user management on this app.
**Why this doc:** save tokens; you should be able to execute without re-deriving context.

---

## 0. TL;DR of the task

Right now **all user progress lives in browser `localStorage`** (per-origin), so it does NOT follow the user across laptops. Goal: **passwordless magic-link auth (Supabase Auth)** with progress persisted **per-user in Supabase**, so signing in on any device restores everything.

**Decisions already made with the user (do not re-litigate):**
- Auth = **magic link** (email OTP, passwordless).
- **Login is REQUIRED** — gate the entire app behind auth.
- **Start fresh** — do NOT migrate existing `localStorage` data into the account.
- Single user in practice (it's Pam's study tool) but schema must be user-scoped with RLS.

**The user is very cautious about Supabase changes** (a past DB-password/keychain issue locked her out for hours). Reassure & respect:
- App auth is SEPARATE from her Supabase *console* login — this work **cannot** lock her out of supabase.com.
- Keep the DB migration **additive only**. Never `DROP`/`ALTER`/disable RLS on existing tables.
- **Do not deploy the login gate to production until the magic-link flow is tested working end-to-end.** A broken gate would lock her out of her own *app* (recoverable in seconds by editing one file, but avoid it).

---

## 1. What the app is (current state)

"The Architect's Codex" — gamified study app for the **Claude Certified Architect – Foundations (CCAF)** exam.

- **Stack:** Next.js **16** (App Router, Turbopack) · React 19 · TypeScript · Tailwind **v4** (CSS-first) · Supabase (Postgres + Auth) · Motion. `@supabase/ssr` and `@supabase/supabase-js` already installed.
- **Repo:** `github.com/PamSagarnaga/ccaf-quest` (private, branch `main`). Local: `/Users/pam/Claude/Output/Code/CodeStudyLLM/ccaf-quest`.
- **Live:** https://ccaf-quest.vercel.app/ (Vercel, auto-deploys on push to `main`).
- **Supabase project ref:** `duacrphxgpadpprddyni` (URL https://duacrphxgpadpprddyni.supabase.co). Linked via CLI (`supabase` in PATH, logged in). `gh` CLI authed as PamSagarnaga.
- **Env:** `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD` (last two are local-only, for seeding). Same 2 `NEXT_PUBLIC_*` vars are set on Vercel. **No new env needed for magic link.**

**DB already contains** (do not touch): `domains`, `tasks`, `scenarios`, `questions`, `question_options`, `flashcards` — all with a `public read` RLS policy (`using(true)`). 118 questions, 30 flashcards seeded. `public read` covers authenticated users too, so gating won't break content reads.

**Migrations:** `supabase/migrations/0001_reference_and_content.sql` applied. Push flow: `npm run db:push` (safe, additive), `npm run seed`, `npm run gen:types`.

### Progress data (what must move to the cloud)
All in `localStorage`, all client-side. Seven keys:
| Key | Shape | Written by |
|---|---|---|
| `ccaf_attempts` | `QuizAttempt[]` | `QuizRunner` + `ExamRunner` (inline `localStorage.setItem`) |
| `ccaf_srs` | `Record<cardId, CardState>` | `src/lib/srs.ts` `saveCardState()` |
| `ccaf_exam_logs` | `ExamLog[]` | `src/lib/progress.ts` `saveLog()/deleteLog()` |
| `ccaf_activity` | `string[]` (YYYY-MM-DD) | `src/lib/progress.ts` `markActivity()` |
| `ccaf_xp` | `{total, events[]}` | `src/lib/gamification.ts` `awardXp()` |
| `ccaf_calibration` | `CalibrationEvent[]` | `src/lib/calibration.ts` `logCalibration()` |
| `ccaf_flags` | `string[]` (question ids) | `src/lib/flags.ts` `toggleFlag()` |

Reads happen in `ProgressDashboard`, `QuizRunner`, `FlashcardReviewer`/`FlashcardsHome`, `ExamLogger`, `FlaggedReview`, `SuddenDeathRunner` — mostly in `useEffect` on mount.

---

## 2. Next 16 gotchas (READ THIS or you'll waste time)

The repo's `AGENTS.md` says: **read `node_modules/next/dist/docs/` before writing Next code.** Key breaking changes:
- **Middleware is renamed `proxy`.** Use `proxy.ts` at project root (or `src/`), exporting `proxy(request)` (or default). Same functionality. See `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`. Docs also warn: proxy is for *optimistic* auth checks, not full session management — do session refresh there, but keep authorization checks in pages/layouts too.
- `cookies()` is **async** (`await cookies()`), and route `params`/`searchParams` are **Promises** (`await` them). Existing `src/lib/supabase/server.ts` already does the async cookie pattern — mirror it.
- Tailwind **v4** CSS-first; design tokens live in `src/app/globals.css` (semantic vars: `--bg/--surface/--text/--ink/--dim/--muted/--faint/--accent/--cta/--correct/--wrong/--d1..d5`; utilities `text-ink/dim/muted/faint`, `text-accent`, `text-cta`, `text-wrong`, `bg-surface`, `bg-surface-2`, `border-border`, `.sheen`, `.codex-panel`, `.rise`). Reuse these so new pages match.
- **Working directory drifts** between bash calls — always `cd /Users/pam/Claude/Output/Code/CodeStudyLLM/ccaf-quest` first (or use absolute paths). `npm run build` from the wrong dir fails with ENOENT.
- Quiz/flashcard components use Motion `AnimatePresence mode="wait"` — if you browser-test, wait ~1s between select→check→next clicks or they land mid-transition.

---

## 3. Recommended architecture — KV-JSONB + sync layer (LOWEST RISK)

Do NOT rewrite every component to be async. Instead, mirror `localStorage` to one cloud table and keep the existing synchronous helpers.

**Why:** the app has ~7 sync data helpers used across ~7 components. A normalized 6-table rewrite touches every call site (high churn, high risk). A key-value JSONB store mirrors `localStorage` 1:1, needs a single table, and leaves component code almost untouched. For a single-user study app, normalized analytics aren't needed.

### 3a. Migration (ADDITIVE — show the user, then `npm run db:push`)
Create `supabase/migrations/0002_user_state.sql`:
```sql
-- Additive only. Does NOT touch existing tables or their policies.
create table if not exists user_state (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table user_state enable row level security;

drop policy if exists "own state select" on user_state;
drop policy if exists "own state insert" on user_state;
drop policy if exists "own state update" on user_state;
drop policy if exists "own state delete" on user_state;

create policy "own state select" on user_state for select using (auth.uid() = user_id);
create policy "own state insert" on user_state for insert with check (auth.uid() = user_id);
create policy "own state update" on user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own state delete" on user_state for delete using (auth.uid() = user_id);
```
Apply: `cd .../ccaf-quest && printf 'Y\n' | supabase db push` (env auto-loaded; if it complains about access token, that's the macOS Keychain prompt — user clicks "Always Allow"). Verify with `supabase migration list` (remote should show 0002).

### 3b. Sync layer — `src/lib/sync.ts`
```ts
"use client";
import { createClient } from "@/lib/supabase/client";

const KEYS = ["ccaf_attempts","ccaf_srs","ccaf_exam_logs","ccaf_activity","ccaf_xp","ccaf_calibration","ccaf_flags"] as const;

/** Fire-and-forget: mirror one localStorage key to the cloud for the current user. */
export async function pushToCloud(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_state").upsert(
      { user_id: user.id, key, value: JSON.parse(raw), updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );
  } catch { /* ignore — local write already succeeded */ }
}

/** On login/cold-load: pull all cloud state into localStorage. Returns when done. */
export async function hydrateFromCloud(): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("user_state").select("key,value").eq("user_id", user.id);
    for (const row of data ?? []) {
      if ((KEYS as readonly string[]).includes(row.key)) {
        localStorage.setItem(row.key, JSON.stringify(row.value));
      }
    }
  } catch { /* offline / not-logged-in: fall back to whatever localStorage has */ }
}
```
Add `user_state` to `src/lib/database.types.ts` (hand-maintained) so the typed client is happy — or cast. Optionally `npm run gen:types` after the migration to regenerate.

### 3c. Wire `pushToCloud` into the existing write functions (one line each)
After each `localStorage.setItem(...)`:
- `gamification.ts awardXp()` → `pushToCloud("ccaf_xp")`
- `progress.ts saveLog()/deleteLog()` → `pushToCloud("ccaf_exam_logs")`; `markActivity()` → `pushToCloud("ccaf_activity")`
- `srs.ts saveCardState()` → `pushToCloud("ccaf_srs")`
- `calibration.ts logCalibration()` → `pushToCloud("ccaf_calibration")`
- `flags.ts toggleFlag()` → `pushToCloud("ccaf_flags")`
- **`ccaf_attempts`:** currently written inline in `QuizRunner` (Results `useEffect`) and `ExamRunner` (`ExamResults` `useEffect`). Add a `saveAttempt(attempt)` helper to `progress.ts` that does `setItem` + `pushToCloud("ccaf_attempts")`, and call it from both. (Watch imports: `progress.ts`/`srs.ts`/etc. are client-only already; importing `sync.ts` which imports the browser client is fine. Do NOT import server-only code.)

### 3d. Hydration gate — `src/components/CloudSync.tsx`
Client provider wrapping app content in `layout.tsx`. On mount: if a session exists, `await hydrateFromCloud()` then render children; show a minimal loader meanwhile (avoids the race where a page reads empty `localStorage` before hydration). Pages already read `localStorage` in `useEffect`, so hydrate-before-render is enough on cold load.

---

## 4. Auth wiring

Browser client exists: `src/lib/supabase/client.ts` (`createClient()` → `createBrowserClient`). Server client exists: `src/lib/supabase/server.ts` (async cookies). Add:

### 4a. `src/lib/supabase/proxy.ts` — session refresh helper
`updateSession(request)`: build a `createServerClient` with request/response cookie plumbing, call `await supabase.auth.getUser()`, and if no user AND path isn't public (`/login`, `/auth`, `/_next`, static, favicon) → `NextResponse.redirect('/login')`. Return the response (with refreshed cookies). Follow the official `@supabase/ssr` Next.js middleware pattern but adapt cookie API to Next 16.

### 4b. `proxy.ts` (project root, NOT `middleware.ts`)
```ts
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
export async function proxy(request: NextRequest) { return updateSession(request); }
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

### 4c. `src/app/login/page.tsx` (client)
Email input → `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: \`${window.location.origin}/auth/callback\` } })`. Show "Check your email for the link." Style with existing tokens (`.codex-panel`, `.sheen`, etc.). This is the ONLY public page besides the callback.

### 4d. `src/app/auth/callback/route.ts` (route handler)
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```
(Confirm the magic-link token flow: default Supabase magic link uses the `code`/PKCE exchange above. If the project is configured for `token_hash` instead, use `verifyOtp({ type: "email", token_hash })` — check what the email link actually contains during testing.)

### 4e. Sign-out
Add a button to `src/components/SiteBar.tsx` (client bit): `await createClient().auth.signOut(); location.href = "/login";`.

---

## 5. Supabase dashboard config (USER does this — guide precisely; needed before testing)

In Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://ccaf-quest.vercel.app`
- **Redirect URLs (add both):** `https://ccaf-quest.vercel.app/**` and `http://localhost:3000/**`

Email auth is on by default; the built-in email sender handles magic links (rate-limited to a few/hour on free tier — fine for one user). No SMTP needed now. **If magic links never arrive, that's the rate limit or the redirect allowlist — not a code bug.**

---

## 6. Rollout order (this is how you avoid locking her out)

1. Write migration → **show the SQL to the user** → `supabase db push`. (Additive; safe.)
2. Build sync layer + auth code + wire writes. `npm run build` must pass.
3. User sets the Supabase redirect URLs (step 5).
4. **Test locally first** (localhost is in the allowlist): `npm run dev`, hit `/`, get redirected to `/login`, request a link, click it (arrives in email), land logged-in, take a quiz, confirm a `user_state` row appears (check Supabase table editor). Sign out, sign back in on a different browser/profile, confirm progress restored.
5. Only after local login works: `git commit && git push` (auto-deploys). Then repeat the test on `https://ccaf-quest.vercel.app/`.
6. If anything breaks the gate: the kill-switch is `proxy.ts` — comment out the redirect (or widen the matcher) to un-gate, push. Data is safe in Supabase regardless.

---

## 7. Definition of done
- Visiting any route while logged out → redirected to `/login`.
- Magic link arrives, click → logged in, app usable.
- Progress (XP, streak, quiz/exam attempts, flashcard schedule, calibration, flags) writes to `user_state` and restores after signing in on a second browser/device.
- Existing content still loads (blueprint, 118 questions) — public-read RLS untouched.
- `npm run build` green; deployed and re-tested on the Vercel URL.

## 8. Explicitly OUT of scope
- Migrating current `localStorage` data into the account (user chose **start fresh**).
- Multi-user/social features. Phase 6 "Ask Claude" (Anthropic proxy route) — still parked.
