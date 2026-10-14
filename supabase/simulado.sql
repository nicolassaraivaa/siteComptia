-- Simulado: questões do PDF (somente leitura para usuários logados) e respostas de cada usuário.
-- Rode este arquivo uma vez no SQL Editor, depois os arquivos questoes-1..4.sql gerados pelo importador.

create table public.questoes (
  numero                      int primary key,            -- número da questão no PDF
  tipo                        text not null check (tipo in ('unica', 'multipla', 'simulacao')),
  escolha                     int not null,               -- quantas alternativas marcar
  dominio                     text not null check (dominio in ('1.0', '2.0', '3.0', '4.0', '5.0')),
  enunciado_pt                text not null,
  enunciado_en                text not null,
  alternativas                jsonb not null,             -- [{letra, pt, en, imagem?}]
  resposta                    text[] not null,            -- letras corretas ({} nas simulações)
  explicacao                  text not null default '',
  links                       text not null default '',
  nota                        text,                       -- "⚠ Nota" do tradutor
  imagens_enunciado           text[] not null default '{}',
  imagens_simulacao_enunciado text[] not null default '{}',
  imagens_simulacao_resposta  text[] not null default '{}'
);

alter table public.questoes enable row level security;
revoke all on public.questoes from anon;
grant select on public.questoes to authenticated;

create policy "questoes_select_logado" on public.questoes
  for select to authenticated using (true);


create table public.simulado_respostas (
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao       int not null references public.questoes(numero),
  ciclo         int not null,                 -- volta completa pelas 656 questões
  simulado_id   uuid not null,                -- agrupa as respostas de um mesmo simulado
  marcadas      text[] not null default '{}',
  resultado     text not null check (resultado in ('certa', 'errada', 'parcial', 'pendente')),
  respondida_em timestamptz not null default now(),
  primary key (user_id, questao, ciclo)
);

create index simulado_respostas_user_ciclo_idx on public.simulado_respostas (user_id, ciclo);

alter table public.simulado_respostas enable row level security;
revoke all on public.simulado_respostas from anon;
grant select, insert, update on public.simulado_respostas to authenticated;

create policy "simulado_respostas_select_own" on public.simulado_respostas
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "simulado_respostas_insert_own" on public.simulado_respostas
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "simulado_respostas_update_own" on public.simulado_respostas
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- Imagens das questões: bucket privado, leitura só para usuários logados
insert into storage.buckets (id, name, public)
values ('questoes', 'questoes', false)
on conflict (id) do nothing;

create policy "questoes_imagens_select_logado" on storage.objects
  for select to authenticated using (bucket_id = 'questoes');
