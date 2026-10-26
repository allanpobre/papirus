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

-- ─── Leitores beta: comentários em trechos do texto ──────────────────
-- Quem lê pelo link (ou foi convidado, ou lê pela estante) seleciona um trecho e comenta. Só quem é
-- dono do universo lê os comentários, marca como resolvido ou apaga. Desligar o compartilhamento apaga
-- os que vieram pelo link; os da estante ficam (a função de comentar pela estante está em social.sql).

create table if not exists public.papirus_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  universe_id uuid not null,
  scene_id text not null check (length(scene_id) <= 64),
  quote text not null default '' check (length(quote) <= 600),
  body text not null check (length(trim(body)) between 1 and 2000),
  author_name text not null default '' check (length(author_name) <= 60),
  author_id uuid,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  via text not null default 'link' check (via in ('link', 'estante')),
  foreign key (owner_id) references auth.users (id) on delete cascade
);
create index if not exists papirus_feedback_universe on public.papirus_feedback (owner_id, universe_id, created_at);

-- Versões antigas deste script prendiam cada comentário a um compartilhamento; agora pode vir da estante.
alter table public.papirus_feedback add column if not exists via text not null default 'link';
alter table public.papirus_feedback drop constraint if exists papirus_feedback_owner_id_universe_id_fkey;
alter table public.papirus_feedback drop constraint if exists papirus_feedback_via_check;
alter table public.papirus_feedback add constraint papirus_feedback_via_check check (via in ('link', 'estante'));
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'papirus_feedback_owner_id_fkey') then
    alter table public.papirus_feedback add constraint papirus_feedback_owner_id_fkey foreign key (owner_id) references auth.users (id) on delete cascade;
  end if;
end $$;

-- Desligar o compartilhamento apaga os comentários que vieram por ele.
create or replace function public.papirus_feedback_share_gone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.papirus_feedback f where f.owner_id = old.owner_id and f.universe_id = old.universe_id and f.via = 'link';
  return old;
end
$$;
drop trigger if exists papirus_feedback_share_gone on public.papirus_shares;
create trigger papirus_feedback_share_gone after delete on public.papirus_shares for each row execute function public.papirus_feedback_share_gone();

alter table public.papirus_feedback enable row level security;
drop policy if exists "dono lê os comentários" on public.papirus_feedback;
drop policy if exists "dono resolve" on public.papirus_feedback;
drop policy if exists "dono apaga" on public.papirus_feedback;
create policy "dono lê os comentários" on public.papirus_feedback for select to authenticated using (owner_id = auth.uid());
create policy "dono resolve" on public.papirus_feedback for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dono apaga" on public.papirus_feedback for delete to authenticated using (owner_id = auth.uid());

-- Comentar: pelo link de leitura (token), ou como convidado do universo. Ninguém escreve direto na tabela.
create or replace function public.papirus_feedback_add(token text, o uuid, u uuid, scene text, q text, b text, n text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  so uuid;
  su uuid;
  new_id uuid;
begin
  if token is not null and length(token) >= 32 then
    select s.owner_id, s.universe_id into so, su from public.papirus_shares s where s.link_token = token;
  elsif o is not null and u is not null and public.papirus_role(o, u) is not null then
    so := o;
    su := u;
  end if;
  if so is null then
    raise exception 'sem permissão para comentar';
  end if;
  if (select count(*) from public.papirus_feedback f where f.owner_id = so and f.universe_id = su) >= 3000 then
    raise exception 'este livro já recebeu comentários demais';
  end if;
  insert into public.papirus_feedback (owner_id, universe_id, scene_id, quote, body, author_name, author_id)
  values (so, su, left(scene, 64), left(coalesce(q, ''), 600), left(b, 2000), left(coalesce(n, ''), 60), auth.uid())
  returning id into new_id;
  return new_id;
end
$$;

revoke all on public.papirus_feedback from anon;
grant select, delete on public.papirus_feedback to authenticated;
revoke update on public.papirus_feedback from authenticated;
grant update (resolved) on public.papirus_feedback to authenticated;
revoke all on function public.papirus_feedback_add(text, uuid, uuid, text, text, text, text) from public;
grant execute on function public.papirus_feedback_add(text, uuid, uuid, text, text, text, text) to anon, authenticated;
