-- Perfil de cada usuário: data da prova e se a conta vê os cards escritos à mão (cards.json).
-- Rode uma vez no SQL Editor. Depois rode o bloco "DONO" no fim, trocando o email.

create table public.perfil (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data_prova     date,                              -- null = ainda não marcou
  cards_pessoais boolean not null default false,    -- só o dono do app vê os cards de cards.json
  criado_em      timestamptz not null default now()
);

alter table public.perfil enable row level security;

revoke all on public.perfil from anon, authenticated;
grant select on public.perfil to authenticated;
-- o usuário só pode gravar a própria data da prova; cards_pessoais só muda pelo SQL Editor
grant insert (user_id, data_prova) on public.perfil to authenticated;
grant update (user_id, data_prova) on public.perfil to authenticated;

create policy "perfil_select_own" on public.perfil
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "perfil_insert_own" on public.perfil
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "perfil_update_own" on public.perfil
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- DONO: libera os cards pessoais e mantém a data da prova na sua conta.
-- Troque o email pelo da sua conta antes de rodar.
insert into public.perfil (user_id, data_prova, cards_pessoais)
select id, '2026-11-21', true from auth.users where email = 'SEU_EMAIL_AQUI'
on conflict (user_id) do update set cards_pessoais = true, data_prova = excluded.data_prova;

-- Conferência: deve aparecer uma linha com cards_pessoais = true
select u.email, p.data_prova, p.cards_pessoais
from public.perfil p join auth.users u on u.id = p.user_id;
