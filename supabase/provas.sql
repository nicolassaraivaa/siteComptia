-- Histórico do "Simulado de prova" (90 questões, 1h30).
-- O placar de cada prova vem de simulado_respostas (mesmo simulado_id = id da prova).
-- Rode uma vez no SQL Editor.

create table public.provas (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  iniciada_em   timestamptz not null,
  finalizada_em timestamptz not null default now(),
  tempo_usado_s int not null,
  total         int not null,
  em_branco     int not null
);

create index provas_user_idx on public.provas (user_id, finalizada_em desc);

alter table public.provas enable row level security;
revoke all on public.provas from anon;
grant select, insert, update on public.provas to authenticated;

create policy "provas_select_own" on public.provas
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "provas_insert_own" on public.provas
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "provas_update_own" on public.provas
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
