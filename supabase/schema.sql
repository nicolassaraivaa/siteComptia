create table public.progresso (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id    text not null,
  estado     jsonb not null,               -- objeto Card do ts-fsrs serializado
  due        timestamptz not null,         -- próxima revisão
  created_at timestamptz not null default now(), -- data da primeira revisão do card
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create index progresso_user_due_idx on public.progresso (user_id, due);

alter table public.progresso enable row level security;

revoke all on public.progresso from anon;
grant select, insert, update, delete on public.progresso to authenticated;

create policy "progresso_select_own" on public.progresso
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "progresso_insert_own" on public.progresso
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "progresso_update_own" on public.progresso
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "progresso_delete_own" on public.progresso
  for delete to authenticated using ((select auth.uid()) = user_id);
