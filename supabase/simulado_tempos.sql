-- Tempo de cada simulado normal, do início até finalizar.
-- (o simulado de prova guarda o tempo na tabela provas)
-- O id é o mesmo simulado_id das respostas. Rode uma vez no SQL Editor.

create table public.simulado_tempos (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  iniciado_em   timestamptz not null,
  finalizado_em timestamptz not null default now(),
  tempo_s       int not null check (tempo_s >= 0)
);

create index simulado_tempos_user_idx on public.simulado_tempos (user_id);

alter table public.simulado_tempos enable row level security;
revoke all on public.simulado_tempos from anon;
grant select, insert, update on public.simulado_tempos to authenticated;

create policy "simulado_tempos_select_own" on public.simulado_tempos
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "simulado_tempos_insert_own" on public.simulado_tempos
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "simulado_tempos_update_own" on public.simulado_tempos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
