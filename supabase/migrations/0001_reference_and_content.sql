-- ============================================================
--  CCAF Quest — Migration 0001
--  Reference blueprint (source of truth = official exam guide)
--  + content (questions, options, flashcards)
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Domains ────────────────────────────────────────────────
-- The 5 official exam domains with their confirmed weights.
create table if not exists domains (
  number  smallint primary key check (number between 1 and 5),
  name    text     not null,
  weight  smallint not null,             -- percent of exam
  blurb   text,
  accent  text                           -- css token: 'd1'..'d5'
);

-- ── Task statements (1.1 .. 5.6) ───────────────────────────
-- Exam items are written against these objectives.
create table if not exists tasks (
  code       text     primary key,       -- '1.1'
  domain     smallint not null references domains(number) on delete cascade,
  statement  text     not null,
  video_ref  text,                        -- matching study note, e.g. '02-master-agentic-loops'
  sort       integer  not null
);

-- ── Scenarios (bank of 6; 4 appear per exam) ───────────────
create table if not exists scenarios (
  slug            text     primary key,
  name            text     not null,
  description     text     not null,
  primary_domains smallint[] not null
);

-- ── Questions ──────────────────────────────────────────────
do $$ begin
  create type question_type as enum ('single', 'multi');
exception when duplicate_object then null; end $$;

do $$ begin
  create type question_source as enum (
    'official-sample',
    'mock-cyberskill',
    'mock-cosx',
    'mock-ccg',
    'generated'
  );
exception when duplicate_object then null; end $$;

create table if not exists questions (
  id          uuid primary key default gen_random_uuid(),
  task_code   text references tasks(code) on delete set null,
  domain      smallint not null references domains(number) on delete cascade,
  scenario    text references scenarios(slug) on delete set null,
  stem        text not null,
  type        question_type   not null default 'single',
  source      question_source not null,
  difficulty  smallint default 2 check (difficulty between 1 and 3),
  explanation text,                        -- optional overall explanation
  created_at  timestamptz default now()
);

create table if not exists question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  label       text not null,               -- 'A'..'E'
  body        text not null,
  is_correct  boolean not null default false,
  rationale   text,                        -- why this option is right/wrong
  sort        integer not null
);

create index if not exists idx_options_question on question_options(question_id);
create index if not exists idx_questions_domain on questions(domain);
create index if not exists idx_questions_task   on questions(task_code);

-- ── Flashcards ─────────────────────────────────────────────
create table if not exists flashcards (
  id         uuid primary key default gen_random_uuid(),
  task_code  text references tasks(code) on delete set null,
  domain     smallint not null references domains(number) on delete cascade,
  front      text not null,
  back       text not null,
  source_ref text,
  created_at timestamptz default now()
);

create index if not exists idx_flashcards_domain on flashcards(domain);
create index if not exists idx_flashcards_task   on flashcards(task_code);

-- ── Row-Level Security ─────────────────────────────────────
-- Reference + content is world-readable. Writes happen only via the
-- service-role key in the seed script (which bypasses RLS).
alter table domains          enable row level security;
alter table tasks            enable row level security;
alter table scenarios        enable row level security;
alter table questions        enable row level security;
alter table question_options enable row level security;
alter table flashcards       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['domains','tasks','scenarios','questions','question_options','flashcards']
  loop
    execute format(
      'drop policy if exists "public read" on %I; create policy "public read" on %I for select using (true);',
      t, t
    );
  end loop;
end $$;
