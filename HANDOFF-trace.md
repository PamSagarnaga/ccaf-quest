# Handoff — performance trace & the answer log

Written 2026-07-29. Supersedes `HANDOFF-heatmap.md`, which describes a page that
no longer exists.

State: shipped and pushed. `main` at `f5d3390`, live on Vercel.

---

## 1. Read this before touching stats code

The app used to derive its numbers from **two stores that could not be
reconciled**:

- `ccaf_item_stats` — a running **tally** per question (`correct: 9, wrong: 0`).
  No dates. No history.
- `ccaf_calibration` — an **event log** of confidence ratings, one row per
  answer, with a timestamp.

They were switched on a day apart and counted different populations
(calibration includes flashcards; the tally doesn't; the exam's confidence tap
is optional so some answers reach the tally and never the log). So they
disagreed — and when they did, **there was no way to find the answer
responsible**, because the tally had already discarded it.

The symptom the user hit: task **5.6** rendered `100% right` beside a red
blind-spot segment in the same row. Both numbers were correct. The page was
wrong for showing them side by side unlabelled.

**The rule that came out of it, and the reason `answers.ts` exists:**

> Accuracy and confidence must be derived from the same rows, or they drift.

Do not reintroduce a second store that feeds a rate. If you need a new metric,
derive it from the answer log.

---

## 2. What exists now

### `src/lib/answers.ts` — the answer log

`ccaf_answers` in localStorage, mirrored to Supabase (`sync.ts` key list).
Append-only. One row per graded answer:

```ts
{ ts, itemId, mode: "quiz"|"exam"|"sudden"|"card",
  domain, task, scenario, correct, confidence: Confidence | null }
```

`confidence: null` means it wasn't captured — sudden death has no prompt, and
the exam's tap is optional. Those rows count toward **accuracy** but never
toward the **cold rate**. That asymmetry is intentional and is stated on the
page; don't "fix" it by defaulting a confidence.

**Idempotent appends.** `logAnswers(events, batchKey)` is a no-op if `batchKey`
matches the previous batch. React StrictMode double-invokes the effect that
flushes an exam, and without this an entire 60-item sitting lands twice.

**The batch key must not be the question-id list.** `ExamRunner` uses a
per-sitting `useRef`, because a ref survives StrictMode's double-invoke (same
instance) while a genuine retake of the same questions gets a fresh one. Keying
on the id list silently discards an immediate retake. Tests cover this.

`logAnswer(e)` (singular) omits the key — those fire from event handlers, which
run once.

Cap: 5000 rows, oldest dropped (~40 exam sittings).

### `src/lib/trace.ts` — derivation, pure

`buildTrace(taskBankCounts, events, legacyRatings, priorSeen)`. All four
injectable, which is how the tests run headless. Produces per-task and
per-domain rows plus:

- `blindSpots` — `confidence === "certain" && !correct`, each carrying `itemId`,
  so the UI opens it to the actual question. **This is the feature the user
  asked for repeatedly and the old schema could not provide.**
- `priorities` — ranked by *expected exam damage*:
  `expectedExamItems(task) × (1 − mastery)`, blueprint-weighted.
  `mastery` = half accuracy, half solid-rate.
- `legacy` — pre-log calibration ratings rolled up by task, **trimmed to before
  the log's first event** so nothing is counted twice.

### `src/components/TraceView.tsx` — the page, route `/heatmap`

Route kept deliberately; `/progress` links to it. `HeatmapView.tsx` is deleted.

Order: Blind spots → summary tiles → Study next → domain/task rows (expandable
to questions) → legend → scenarios → History (collapsed).

---

## 3. What the user cares about, in her words

- **"I want a list of the tasks that are the blind spots."** Traceability from a
  blind spot to the actual question is the whole point. Anything that breaks
  that link is a regression.
- She tests **only on the live Vercel site**, never locally.
- She reacts badly to plans and options when she asked a direct question.
  Answer the question, then propose.
- She called an earlier explanation "impossible to understand." Short sentences,
  concrete numbers, no layered caveats.
- She asked for the 377 legacy ratings to be preserved as history and said
  **"I WILL ASK FOR THIS LATER."** They're in the History panel. Don't drop them.

---

## 4. Known limits — state these, don't paper over them

- **No backfill.** The 377 pre-log calibration ratings have no question id. Four
  historical blind spots (3.5, 5.6, 1.2, 3.1) are known at task level only and
  can never be opened to a question.
- **Live numbers start near-empty** and fill as she practises. Expected, not a
  broken deploy. She has been told.
- **`itemStats` and `calibration` are still written.** Deliberate: rollback
  safety, and `itemStats` supplies the coverage key set. Neither feeds a rate.
  If you retire them, coverage needs a new source first.
- **Lint:** ~24 `react-hooks/set-state-in-effect` errors repo-wide, pre-existing,
  the hydrate-on-mount idiom used by every client component here. New code
  matches it rather than diverging.
- **Browser preview pane** returns `Viewport: 0x0` and an empty a11y tree on this
  machine. `read_page` / `find` / ref-based clicks don't work. `get_page_text`,
  `computer` screenshots and **coordinate** clicks do — note screenshot space is
  half the apparent image (800×450), so halve coordinates read off the image.

---

## 5. Verification already done

Two headless suites, run against the real backed-up state. Re-create them from
this spec if you change the schema; they are not committed.

**Derivation, 19 assertions:** empty log keeps all 377 legacy ratings and
coverage still reads from the old tally; a logged sitting drives accuracy from
all answers while cold-rate counts only rated ones; blind spot carries its
question id; legacy trimmed on overlap; thin tasks (<3 answers) flagged and
excluded from priorities.

**Storage, 10 assertions:** duplicate batch ignored; different batch appends;
corrupt and unversioned payloads ignored rather than thrown; cap holds at 5000
keeping the newest.

**End-to-end in browser:** started a D1 quiz, answered wrong while tapping
*Certain*, confirmed `ccaf_answers` recorded `certain` / `correct: false` / real
`itemId`, then confirmed the trace page rendered it under Blind spots with the
question text. Confirmed no `ccaf_answers` row reached Supabase (dev browser had
no authenticated session), so her cloud data stayed clean.

`npx tsc --noEmit` passes.

---

## 6. Rollback

- `git reset --hard pre-eventlog` — tag is pushed, sits at `32aa0a1`.
- Full state backup: `Code/CodeStudyLLM/backups/ccaf-user-state-2026-07-28.json`
  (all 8 keys, 377 ratings, 199 tallies). Outside the repo on purpose — it's
  personal data and the repo may go public.

---

## 7. Open threads, none started

- **`ccaf_item_stats` retirement** once the log has enough coverage history.
- **Bank gaps:** tasks 5.4 and 5.5 have ~4 questions each; tier-1 recall is ~8%
  of the bank against a 20% target; D1 and D4 have near-zero headroom for the
  two-sitting exam lockout (D1: 48 in bank, 16 per exam, 32 locked).
- **D3 is the real weakness** — 87% accuracy but only ~42% "cold" in her legacy
  data, 26 lucky vs 25 solid. Volume of *lucky* answers, not blind spots, is her
  actual risk. Blind spots ran ~1% of ratings, so expect roughly one per two
  exams; an empty Blind spots panel is a genuine result, not a bug.
