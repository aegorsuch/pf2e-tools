create table characters (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  updated_at bigint not null,
  body jsonb not null
);
create table content (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  updated_at bigint not null,
  body jsonb not null
);
alter table characters enable row level security;
alter table content enable row level security;
create policy "own characters" on characters for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own content" on content for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
