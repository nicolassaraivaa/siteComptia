-- Várias certificações no mesmo app.
-- Rode uma vez no SQL Editor, logo antes de publicar o código novo: depois desta migração o código
-- antigo não consegue mais salvar respostas do simulado nem progresso (as chaves mudam).
-- Nada é apagado: tudo o que já existe passa a ser da Security+ ('secplus').

begin;

-- 1. Cada dado pertence a uma certificação ---------------------------------------------------------
alter table public.questoes           add column certificacao text not null default 'secplus';
alter table public.simulado_respostas add column certificacao text not null default 'secplus';
alter table public.progresso          add column certificacao text not null default 'secplus';
alter table public.revisoes           add column certificacao text not null default 'secplus';
alter table public.provas             add column certificacao text not null default 'secplus';
alter table public.simulado_tempos    add column certificacao text not null default 'secplus';

-- 2. Chaves: o número da questão e o id do card só são únicos dentro da certificação ---------------
do $$
declare
  r record;
begin
  -- FKs de simulado_respostas -> questoes e as PKs que vão mudar (nomes procurados, não supostos)
  for r in
    select conrelid::regclass as tabela, conname
    from pg_constraint
    where connamespace = 'public'::regnamespace
      and (
        (conrelid = 'public.simulado_respostas'::regclass and contype = 'f' and confrelid = 'public.questoes'::regclass)
      )
  loop
    execute format('alter table %s drop constraint %I', r.tabela, r.conname);
  end loop;
  for r in
    select conrelid::regclass as tabela, conname
    from pg_constraint
    where connamespace = 'public'::regnamespace and contype = 'p'
      and conrelid in ('public.questoes'::regclass, 'public.simulado_respostas'::regclass, 'public.progresso'::regclass)
  loop
    execute format('alter table %s drop constraint %I', r.tabela, r.conname);
  end loop;
end $$;

alter table public.questoes           add primary key (certificacao, numero);
alter table public.simulado_respostas add primary key (user_id, certificacao, questao, ciclo);
alter table public.simulado_respostas
  add foreign key (certificacao, questao) references public.questoes (certificacao, numero);
alter table public.progresso          add primary key (user_id, certificacao, card_id);

drop index if exists public.simulado_respostas_user_ciclo_idx;
create index simulado_respostas_user_cert_idx on public.simulado_respostas (user_id, certificacao, ciclo);
drop index if exists public.progresso_user_due_idx;
create index progresso_user_cert_due_idx on public.progresso (user_id, certificacao, due);
create index revisoes_user_cert_idx on public.revisoes (user_id, certificacao, revisada_em);
create index provas_user_cert_idx on public.provas (user_id, certificacao, finalizada_em desc);

-- Totais de revisões por dia, agora por certificação
drop view if exists public.revisoes_por_dia;
create view public.revisoes_por_dia with (security_invoker = true) as
select
  user_id,
  certificacao,
  (revisada_em at time zone 'America/Sao_Paulo')::date as dia,
  count(*)::int as cards,
  count(*) filter (where nota = 1)::int as erros
from public.revisoes
group by 1, 2, 3;
revoke all on public.revisoes_por_dia from anon;
grant select on public.revisoes_por_dia to authenticated;

-- 3. Perfil por certificação: data da prova, treino, resultado, flashcards zerados -------------------
create table public.perfil_certificacao (
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  certificacao          text not null,
  data_prova            date,
  treino                boolean not null default false,
  resultado             text check (resultado in ('aprovado', 'reprovado')),
  resultado_data        date,
  flashcards_zerados_em timestamptz,
  ciclo_inicio          int not null default 1,
  criado_em             timestamptz not null default now(),
  primary key (user_id, certificacao)
);

alter table public.perfil_certificacao enable row level security;
revoke all on public.perfil_certificacao from anon, authenticated;
grant select on public.perfil_certificacao to authenticated;
-- flashcards_zerados_em e ciclo_inicio só mudam pela função zerar_flashcards
grant insert (user_id, certificacao, data_prova, treino, resultado, resultado_data) on public.perfil_certificacao to authenticated;
-- (o upsert regrava também as colunas da chave, por isso user_id e certificacao entram no update)
grant update (user_id, certificacao, data_prova, treino, resultado, resultado_data) on public.perfil_certificacao to authenticated;

create policy "perfil_cert_select_own" on public.perfil_certificacao
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "perfil_cert_insert_own" on public.perfil_certificacao
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "perfil_cert_update_own" on public.perfil_certificacao
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- O que estava no perfil vira o perfil da Security+
insert into public.perfil_certificacao
  (user_id, certificacao, data_prova, treino, resultado, resultado_data, flashcards_zerados_em, ciclo_inicio, criado_em)
select user_id, 'secplus', data_prova, treino, resultado, resultado_data, flashcards_zerados_em, ciclo_inicio, criado_em
from public.perfil;

-- Última certificação treinada (destaque na tela de entrada, em qualquer aparelho)
alter table public.perfil add column ultima_certificacao text;
grant insert (user_id, ultima_certificacao) on public.perfil to authenticated;
grant update (ultima_certificacao) on public.perfil to authenticated;

-- 4. Apagar os flashcards de UMA certificação --------------------------------------------------------
drop function if exists public.zerar_flashcards();
create or replace function public.zerar_flashcards(p_certificacao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'não autenticado';
  end if;
  delete from public.progresso where user_id = uid and certificacao = p_certificacao;
  delete from public.revisoes where user_id = uid and certificacao = p_certificacao;
  insert into public.perfil_certificacao (user_id, certificacao, flashcards_zerados_em, ciclo_inicio)
  values (
    uid,
    p_certificacao,
    now(),
    coalesce((select max(ciclo) from public.simulado_respostas where user_id = uid and certificacao = p_certificacao), 0) + 1
  )
  on conflict (user_id, certificacao) do update
    set flashcards_zerados_em = excluded.flashcards_zerados_em,
        ciclo_inicio = excluded.ciclo_inicio;
end;
$$;
revoke all on function public.zerar_flashcards(text) from public, anon;
grant execute on function public.zerar_flashcards(text) to authenticated;

-- 5. Minha trilha: certificações conquistadas e metas ------------------------------------------------
create table public.trilha (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status         text not null check (status in ('conquistada', 'meta')),
  certificacao   text,          -- id do catálogo do app, quando é uma das certificações daqui
  nome           text not null,
  emissor        text,
  data           date,          -- conquistada: quando passou; meta: quando pretende fazer
  expira_em      date,          -- conquistada: validade (null = não expira)
  credencial_url text,          -- link de verificação (Credly)
  criado_em      timestamptz not null default now()
);
create index trilha_user_idx on public.trilha (user_id, status, data);

alter table public.trilha enable row level security;
revoke all on public.trilha from anon;
grant select, insert, update, delete on public.trilha to authenticated;

create policy "trilha_select_own" on public.trilha
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "trilha_insert_own" on public.trilha
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "trilha_update_own" on public.trilha
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "trilha_delete_own" on public.trilha
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Quem já marcou "Aprovado" na Security+ ganha a conquista (validade de 3 anos)
insert into public.trilha (user_id, status, certificacao, nome, emissor, data, expira_em)
select user_id, 'conquistada', 'secplus', 'CompTIA Security+', 'CompTIA', resultado_data,
       (resultado_data + interval '3 years')::date
from public.perfil
where resultado = 'aprovado' and resultado_data is not null;

-- 6. Ofensiva única: completa a tabela atividade com todo dia de estudo já registrado ---------------
-- (a tela de entrada mostra a ofensiva de todas as certificações juntas, lendo só esta tabela)
insert into public.atividade (user_id, dia)
select user_id, (revisada_em at time zone 'America/Sao_Paulo')::date from public.revisoes
union
select user_id, (respondida_em at time zone 'America/Sao_Paulo')::date from public.simulado_respostas
union
select user_id, (created_at at time zone 'America/Sao_Paulo')::date from public.progresso
union
select user_id, (updated_at at time zone 'America/Sao_Paulo')::date from public.progresso
on conflict do nothing;

commit;

-- Conferência: a Security+ deve ter as mesmas contagens de antes
select certificacao, count(*) from public.simulado_respostas group by 1;
select certificacao, count(*) from public.progresso group by 1;
select user_id, certificacao, data_prova, resultado from public.perfil_certificacao;
