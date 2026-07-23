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
