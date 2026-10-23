-- Papirus: contas e universos na nuvem.
-- Cole no SQL Editor do mesmo projeto do Codex ao vivo e clique em "Run". Pode rodar de novo.
--
-- O login usa o Supabase Auth (e-mail e senha, ou link por e-mail). Cada pessoa só vê,
-- cria, altera e apaga os próprios universos: quem garante é o RLS abaixo, no servidor.
-- Em Authentication → URL Configuration, coloque o endereço público do Papirus
-- (ex.: https://allanpobre.github.io/papirus/) em "Site URL" e em "Redirect URLs".

create table if not exists public.papirus_universes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  name text not null default '',
  words integer not null default 0,
  data jsonb,
  -- Hora da última mudança no universo (vem do Papirus, não do servidor).
  updated_at timestamptz not null,
  -- Apagado num aparelho: os outros aparelhos ficam sabendo e o conteúdo some.
  deleted boolean not null default false,
  primary key (user_id, id)
);

alter table public.papirus_universes enable row level security;

drop policy if exists "dono lê" on public.papirus_universes;
drop policy if exists "dono cria" on public.papirus_universes;
drop policy if exists "dono altera" on public.papirus_universes;
drop policy if exists "dono apaga" on public.papirus_universes;
create policy "dono lê" on public.papirus_universes for select to authenticated using (user_id = auth.uid());
create policy "dono cria" on public.papirus_universes for insert to authenticated with check (user_id = auth.uid());
create policy "dono altera" on public.papirus_universes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "dono apaga" on public.papirus_universes for delete to authenticated using (user_id = auth.uid());

revoke all on public.papirus_universes from anon;
grant select, insert, update, delete on public.papirus_universes to authenticated;
