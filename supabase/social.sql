-- Papirus: perfil, amigos e estante.
-- Rode DEPOIS de supabase/contas.sql, no SQL Editor do mesmo projeto, e clique em "Run". Pode rodar de novo.
--
-- Quem vê o quê (garantido aqui no servidor, não só na tela):
-- - perfil (@nome, nome, bio, foto): qualquer pessoa com conta, para poder achar e adicionar amigos;
-- - livros da estante: o dono escolhe em cada livro "privado", "amigos" ou "público";
--   "amigos" só aparece para quem tem amizade aceita; "público" aparece até sem conta;
-- - pedidos de amizade: só quem pediu e quem recebeu veem; só quem recebeu aceita.
-- Na estante vai só a vitrine do livro (capa, título, sinopse, números). O texto não.

create table if not exists public.papirus_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_.]{3,24}$'),
  name text not null default '' check (length(name) <= 80),
  bio text not null default '' check (length(bio) <= 600),
  -- Foto pequena (data URL).
  avatar text check (avatar is null or octet_length(avatar) <= 300000),
  created_at timestamptz not null default now()
);

create table if not exists public.papirus_friendships (
  requester uuid not null default auth.uid() references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aceita')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- Um pedido só por par de pessoas (A→B e B→A seriam o mesmo).
create unique index if not exists papirus_friendships_pair on public.papirus_friendships (least(requester, addressee), greatest(requester, addressee));

create table if not exists public.papirus_shelf (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  title text not null default '' check (length(title) <= 200),
  author text not null default '' check (length(author) <= 120),
  blurb text not null default '' check (length(blurb) <= 2000),
  cover text check (cover is null or octet_length(cover) <= 1500000),
  chapters integer not null default 0,
  words integer not null default 0,
  universe_name text not null default '',
  visibility text not null default 'amigos' check (visibility in ('amigos', 'publico')),
  -- Link de leitura (como livro), se o dono quiser deixar ler.
  read_link text check (read_link is null or length(read_link) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);

-- São amigos? (amizade aceita, em qualquer direção)
create or replace function public.papirus_are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.papirus_friendships f
    where f.status = 'aceita' and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  )
$$;

alter table public.papirus_profiles enable row level security;
alter table public.papirus_friendships enable row level security;
alter table public.papirus_shelf enable row level security;

drop policy if exists "perfis visíveis" on public.papirus_profiles;
drop policy if exists "perfis de quem tem estante pública" on public.papirus_profiles;
drop policy if exists "dono cria o perfil" on public.papirus_profiles;
drop policy if exists "dono altera o perfil" on public.papirus_profiles;
drop policy if exists "dono apaga o perfil" on public.papirus_profiles;
create policy "perfis visíveis" on public.papirus_profiles for select to authenticated using (true);
create policy "perfis de quem tem estante pública" on public.papirus_profiles for select to anon
  using (exists (select 1 from public.papirus_shelf s where s.owner = user_id and s.visibility = 'publico'));
create policy "dono cria o perfil" on public.papirus_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "dono altera o perfil" on public.papirus_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "dono apaga o perfil" on public.papirus_profiles for delete to authenticated using (user_id = auth.uid());

drop policy if exists "os dois veem" on public.papirus_friendships;
drop policy if exists "pedir amizade" on public.papirus_friendships;
drop policy if exists "aceitar amizade" on public.papirus_friendships;
drop policy if exists "desfazer amizade" on public.papirus_friendships;
create policy "os dois veem" on public.papirus_friendships for select to authenticated using (auth.uid() in (requester, addressee));
create policy "pedir amizade" on public.papirus_friendships for insert to authenticated with check (requester = auth.uid() and status = 'pendente');
create policy "aceitar amizade" on public.papirus_friendships for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid());
create policy "desfazer amizade" on public.papirus_friendships for delete to authenticated using (auth.uid() in (requester, addressee));

drop policy if exists "estante visível" on public.papirus_shelf;
drop policy if exists "estante pública" on public.papirus_shelf;
drop policy if exists "dono põe na estante" on public.papirus_shelf;
drop policy if exists "dono altera a estante" on public.papirus_shelf;
drop policy if exists "dono tira da estante" on public.papirus_shelf;
create policy "estante visível" on public.papirus_shelf for select to authenticated
  using (owner = auth.uid() or visibility = 'publico' or (visibility = 'amigos' and public.papirus_are_friends(owner, auth.uid())));
create policy "estante pública" on public.papirus_shelf for select to anon using (visibility = 'publico');
create policy "dono põe na estante" on public.papirus_shelf for insert to authenticated with check (owner = auth.uid());
create policy "dono altera a estante" on public.papirus_shelf for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "dono tira da estante" on public.papirus_shelf for delete to authenticated using (owner = auth.uid());

grant select on public.papirus_profiles, public.papirus_shelf to anon;
revoke insert, update, delete on public.papirus_profiles, public.papirus_shelf, public.papirus_friendships from anon;
revoke all on public.papirus_friendships from anon;
grant select, insert, update, delete on public.papirus_profiles, public.papirus_shelf to authenticated;
-- Amizade: quem recebe só pode mudar o status (aceitar), nunca trocar quem pediu.
revoke update on public.papirus_friendships from authenticated;
grant select, insert, delete on public.papirus_friendships to authenticated;
grant update (status) on public.papirus_friendships to authenticated;
revoke all on function public.papirus_are_friends(uuid, uuid) from public, anon;
grant execute on function public.papirus_are_friends(uuid, uuid) to authenticated;
