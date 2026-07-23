# The Architect's Codex

A gamified study companion for the **Claude Certified Architect – Foundations (CCAF / CCAR-F)** exam. Practice quizzes, spaced-repetition flashcards, and grounded answer explanations — every item mapped to the official exam blueprint.

> Unofficial study tool. Not affiliated with Anthropic.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first theme — see `src/app/globals.css`)
- **Supabase** (Postgres + Auth + Row-Level Security)
- **Motion** for animation
- Live "Ask Claude" explanations via a server-side Anthropic proxy (Phase 6)

## The blueprint is the source of truth

The 5 domains, their weights, all 30 task statements (1.1–5.6), and the 6 exam
scenarios are authored verbatim from the official exam guide and live in
[`src/lib/blueprint.ts`](src/lib/blueprint.ts). The app renders directly from it,
and the seed script copies it into Postgres so questions/flashcards/progress can
join against it.

| Domain | Weight |
|---|---|
| 1 · Agentic Architecture & Orchestration | 27% |
| 2 · Tool Design & MCP Integration | 18% |
| 3 · Claude Code Configuration & Workflows | 20% |
| 4 · Prompt Engineering & Structured Output | 20% |
| 5 · Context Management & Reliability | 15% |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase keys
npm run dev
```

### Database

Apply the migrations in [`supabase/migrations`](supabase/migrations) to your
Supabase project (SQL editor or `supabase db push`), then run the seed:

```bash
npm run seed   # loads the blueprint + question/flashcard content
```

## Features & roadmap

- [x] **Phase 0** — Scaffold, design system, Supabase wiring
- [x] **Phase 1** — Blueprint reference + schema _(content seeding in progress)_
- [ ] **Phase 2** — Quiz engine (domain/task filters, baked-in explanations)
- [ ] **Phase 3** — Flashcards with spaced repetition
- [ ] **Phase 4** — External-exam logger + progress dashboard
- [ ] **Phase 5** — Gamification (XP, streaks, badges)
- [ ] **Phase 6** — Live "Ask Claude" explanations
- [ ] **Phase 7** — Generated question/flashcard bank
- [ ] **Phase 8** — Polish + deploy

## Note on content

Raw scraped study notes (third-party prep sites) are **not** committed. Only
*derived, transformed* seed data is versioned here.
