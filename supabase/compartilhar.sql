-- Papirus: compartilhar um universo com outras pessoas.
-- Rode DEPOIS de supabase/contas.sql, no SQL Editor do mesmo projeto, e clique em "Run". Pode rodar de novo.
--
-- Quem pode o quê (garantido aqui no servidor, não só na tela):
-- - o dono convida por e-mail com "pode ver" ou "pode editar", troca o papel e tira o acesso quando quiser;
-- - quem pode editar lê e altera o universo do dono (não apaga, não convida);
-- - quem só pode ver lê apenas a cópia de leitura, que o Papirus do dono prepara
--   (sem trechos e fichas secretas, se o dono escolher assim);
-- - o link de leitura abre essa mesma cópia sem conta, e para de funcionar quando o dono desliga.
-- O convite só vale para quem confirmou o e-mail na conta.

create table if not exists public.papirus_shares (
  owner_id uuid not null default auth.uid(),
  universe_id uuid not null,
  name text not null default '',
  owner_email text not null default '',
  -- Quem só lê também vê trechos [segredo] e fichas secretas?
  show_secrets boolean not null default false,
  -- Link de leitura sem conta. `null` = desligado.
  link_token text unique,
  -- Cópia para leitura, preparada pelo Papirus de quem edita.
  data jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, universe_id),
  foreign key (owner_id, universe_id) references public.papirus_universes (user_id, id) on delete cascade
);

create table if not exists public.papirus_members (
  owner_id uuid not null default auth.uid(),
  universe_id uuid not null,
  email text not null check (email = lower(email)),
  role text not null check (role in ('ver', 'editar')),
  created_at timestamptz not null default now(),
  primary key (owner_id, universe_id, email),
  foreign key (owner_id, universe_id) references public.papirus_shares (owner_id, universe_id) on delete cascade
);

-- E-mail confirmado de quem está chamando (ou nada).
create or replace function public.papirus_my_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null
$$;

-- Papel de quem está chamando num universo de outra pessoa: 'ver', 'editar' ou nada.
create or replace function public.papirus_role(o uuid, u uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.papirus_members m
  where m.owner_id = o and m.universe_id = u and m.email = public.papirus_my_email()
$$;

alter table public.papirus_shares enable row level security;
alter table public.papirus_members enable row level security;

drop policy if exists "dono cuida" on public.papirus_shares;
drop policy if exists "convidado lê" on public.papirus_shares;
create policy "dono cuida" on public.papirus_shares for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "convidado lê" on public.papirus_shares for select to authenticated using (public.papirus_role(owner_id, universe_id) is not null);

drop policy if exists "dono cuida" on public.papirus_members;
drop policy if exists "convidado vê o convite" on public.papirus_members;
drop policy if exists "convidado sai" on public.papirus_members;
create policy "dono cuida" on public.papirus_members for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "convidado vê o convite" on public.papirus_members for select to authenticated using (email = public.papirus_my_email());
create policy "convidado sai" on public.papirus_members for delete to authenticated using (email = public.papirus_my_email());

-- Quem pode editar lê e altera o universo do dono, mas não apaga.
drop policy if exists "editor lê" on public.papirus_universes;
drop policy if exists "editor altera" on public.papirus_universes;
create policy "editor lê" on public.papirus_universes for select to authenticated using (public.papirus_role(user_id, id) = 'editar');
create policy "editor altera" on public.papirus_universes for update to authenticated
  using (public.papirus_role(user_id, id) = 'editar')
  with check (public.papirus_role(user_id, id) = 'editar' and deleted = false);

-- Atualiza a cópia de leitura (dono ou quem pode editar).
create or replace function public.papirus_share_data(o uuid, u uuid, d jsonb, n text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (o = auth.uid() or public.papirus_role(o, u) = 'editar') then
    raise exception 'sem permissão';
  end if;
  if octet_length(d::text) > 16000000 then
    raise exception 'universo grande demais';
  end if;
  update public.papirus_shares set data = d, name = n, updated_at = now() where owner_id = o and universe_id = u;
end
$$;

-- Link de leitura: devolve a cópia de leitura de quem tem o token, sem conta.
create or replace function public.papirus_link_get(token text) returns table (universe_id uuid, name text, owner_email text, data jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.universe_id, s.name, s.owner_email, s.data, s.updated_at from public.papirus_shares s
  where token is not null and length(token) >= 32 and s.link_token = token
$$;

revoke all on public.papirus_shares, public.papirus_members from anon;
grant select, insert, update, delete on public.papirus_shares, public.papirus_members to authenticated;
revoke all on function public.papirus_my_email(), public.papirus_role(uuid, uuid), public.papirus_share_data(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.papirus_my_email(), public.papirus_role(uuid, uuid), public.papirus_share_data(uuid, uuid, jsonb, text) to authenticated;
revoke all on function public.papirus_link_get(text) from public;
grant execute on function public.papirus_link_get(text) to anon, authenticated;
