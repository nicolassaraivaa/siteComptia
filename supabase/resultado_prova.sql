-- Resultado da prova, modo treinamento e "zerar flashcards".
-- Rode uma vez no SQL Editor, depois de perfil.sql.

alter table public.perfil
  add column treino                boolean not null default false, -- estudando sem data de prova
  add column resultado             text check (resultado in ('aprovado', 'reprovado')),
  add column resultado_data        date,        -- a data_prova a que o resultado se refere
  add column flashcards_zerados_em timestamptz, -- flashcards de antes disso não aparecem mais
  add column ciclo_inicio          int not null default 1; -- volta do simulado em que recomeçar

-- O usuário grava a própria data, o modo treinamento e o resultado; o resto só pela função abaixo
grant insert (user_id, data_prova, treino, resultado, resultado_data) on public.perfil to authenticated;
grant update (user_id, data_prova, treino, resultado, resultado_data) on public.perfil to authenticated;

-- Apaga os flashcards da própria conta: progresso e histórico de revisões. As respostas do simulado
-- e o histórico de provas ficam. A próxima volta do simulado começa do zero.
create or replace function public.zerar_flashcards()
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
  delete from public.progresso where user_id = uid;
  delete from public.revisoes where user_id = uid;
  insert into public.perfil (user_id, flashcards_zerados_em, ciclo_inicio)
  values (
    uid,
    now(),
    coalesce((select max(ciclo) from public.simulado_respostas where user_id = uid), 0) + 1
  )
  on conflict (user_id) do update
    set flashcards_zerados_em = excluded.flashcards_zerados_em,
        ciclo_inicio = excluded.ciclo_inicio;
end;
$$;

revoke all on function public.zerar_flashcards() from public, anon;
grant execute on function public.zerar_flashcards() to authenticated;
