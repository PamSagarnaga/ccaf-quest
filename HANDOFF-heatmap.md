# Handover — Mastery heatmap, no-repeat, bank growth (2026-07-24)

Self-contained context for the next agent picking up **ccaf-quest** (Pam's CCAF
exam-prep app). Read this alongside the project memory (`ccaf-quest-app.md`) and
`AGENTS.md` (Next.js 16 has breaking changes — read `node_modules/next/dist/docs/`
before writing framework code).

## Current state (all shipped)
- **Live:** https://ccaf-quest.vercel.app — commit `d521a25` on `main`, Vercel
  deploy green, `/heatmap` returns 200.
- **Repo:** github.com/PamSagarnaga/ccaf-quest (private, `main`, gh authed as PamSagarnaga). Auto-deploys on push to `main`.
- **DB:** Supabase project `duacrphxgpadpprddyni` (live). **163 questions / 652
  options / 30 flashcards** seeded. Reseed with `npm run seed` (reads all
  `scripts/seed/generated/questions*.json` + `flashcards*.json`, upserts by id,
  additive). Build check: `npm run build` (NOT just `tsc` — tsc misses the
  client/server bundle boundary that broke a prior deploy).

## What this change added
**Part A — per-question mastery tracking + `/heatmap`**
- `src/lib/itemStats.ts` — `ccaf_item_stats` KV (added to `PROGRESS_STORAGE_KEYS`
  in `src/lib/sync.ts`, so it cloud-syncs). `recordItemResults(ItemResult[])`
  tallies correct/wrong per question id, tagged domain/task/scenario. Aggregators
  `aggregate("domain"|"task"|"scenario")` and `distinctSeen()`.
- Recording is wired into all three runners at grade time:
  - `QuizRunner.tsx` — `Answer` interface gained `task`+`scenario`; records in the
    results `useEffect` next to `saveAttempt`.
  - `ExamRunner.tsx` — records answered items (skips skipped) in `ExamResults`.
  - `SuddenDeathRunner.tsx` — `recordItem()` on each answer and on timeout.
- `src/app/heatmap/page.tsx` (server, fetches bank total) → `HeatmapView.tsx`
  (client, reads localStorage): domain×task accuracy grid (red→green via
  `color-mix` on accuracy), scenario breakdown, coverage banner. Linked from
  `ProgressDashboard.tsx`.

**Part B — reinforced no-repeat**
- `src/lib/seen.ts` — added a global `__recent` bucket (cap 40) that de-prioritizes
  recently-served questions across ALL buckets, so an item seen in a quiz sinks in
  the next exam draw. Per-bucket cycling unchanged. No API change for callers.
- `CoverageBadge.tsx` — "seen X of 163" on `/practice` and `/exam` start screens.

**Part C — bank 118 → 163**
- New files `scripts/seed/generated/questions-cov-{d1c,d2b,d3-3,d4b,d5b}.json`,
  ids prefixed `f1..f5`. Per-domain now: D1 39 / D2 31 / D3 33 / D4 31 / D5 29
  (every domain ≥2.4× its exam quota; D4 was the bottleneck at 19).

## Content authoring rules (enforce for any new questions)
- Correct option stored FIRST (`sort 0`); serve-time shuffle in `queries.ts`
  (`shuffleOpts`) relabels A–D, so never reference option letters in body text.
- Exactly one `is_correct: true`; every option has a `rationale`.
- **Length parity is the anti-cheat:** no distractor ≥25 chars shorter than the
  correct answer, and correct should NOT be the systematically longest (bank-wide
  correct-is-longest is currently 7%). Validate before seeding — reuse the node
  check that reports hard fails + correct-is-longest %.
- Fresh unique UUID ids; valid `task_code` (blueprint.ts) + valid scenario slug.

## Known caveat (not a prod bug)
React **dev-only StrictMode** double-invokes the `useState(() => pickUnseen(...))`
initializer (inflates `ccaf_seen`) and the results `useEffect` (double-counts
itemStats AND the pre-existing `saveAttempt`). **Production builds fire once** —
verified. If a future change must be exact in dev too, guard with a
`useRef`-based run-once latch; otherwise leave it consistent with existing code.

## Notes / open items
- Heatmap only fills from the user's NEXT attempt forward — old `ccaf_attempts`
  stored per-domain totals only, so there is no per-question backfill. Expected.
- All progress is still localStorage + cloud KV mirror (single-user). Auth/multi-user
  plan is in `AUTH-HANDOFF.md` (magic-link, gate everything, start fresh, additive
  migration — never touch existing public-read RLS or content tables).
- Phase 6 live "Ask Claude" explanations remains PARKED.
- `.env.local` (service-role key, DB password, anon key) is gitignored — never
  commit it or paste secret values. Only `NEXT_PUBLIC_*` are runtime/Vercel vars.
- Commit/push only when Pam asks.
