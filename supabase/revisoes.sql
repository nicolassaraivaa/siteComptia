-- Registro de cada revisão de flashcard, para o histórico por dia.
-- (progresso guarda só o estado atual de cada card; aqui fica uma linha por avaliação)
-- Rode uma vez no SQL Editor.

create table public.revisoes (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id     text not null,
  nota        smallint not null check (nota between 1 and 4), -- 1 = Errei ... 4 = Fácil
  revisada_em timestamptz not null default now()
);

create index revisoes_user_idx on public.revisoes (user_id, revisada_em);

alter table public.revisoes enable row level security;
revoke all on public.revisoes from anon;
grant select, insert on public.revisoes to authenticated;

create policy "revisoes_select_own" on public.revisoes
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "revisoes_insert_own" on public.revisoes
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Totais por dia (fuso de São Paulo). security_invoker: a view respeita o RLS de quem consulta.
create view public.revisoes_por_dia with (security_invoker = true) as
select
  user_id,
  (revisada_em at time zone 'America/Sao_Paulo')::date as dia,
  count(*)::int as cards,
  count(*) filter (where nota = 1)::int as erros
from public.revisoes
group by 1, 2;

revoke all on public.revisoes_por_dia from anon;
grant select on public.revisoes_por_dia to authenticated;
