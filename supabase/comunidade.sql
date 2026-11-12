-- Papirus: a Comunidade (seguir, continuar lendo, quem leu até onde, bloquear, denunciar e pedir AU).
-- Rode DEPOIS de supabase/contas.sql, supabase/compartilhar.sql e supabase/social.sql, no SQL Editor do
-- mesmo projeto, e clique em "Run". Pode rodar de novo.
--
-- Quem pode o quê (garantido aqui no servidor, não só na tela):
-- - seguir: qualquer pessoa com conta segue outra (sem precisar ser amiga). Quem segue vê os capítulos
--   novos dos livros públicos de quem segue. Cada um vê quem segue e quem o segue;
-- - continuar lendo: cada leitor guarda até onde leu cada livro. Só ele vê o próprio;
-- - quem leu até onde: o autor vê quantas pessoas chegaram a cada capítulo, nunca quem;
-- - bloquear: quem foi bloqueado não comenta, não reage, não pede amizade, não segue e não pede AU.
--   Bloquear desfaz a amizade e o seguir dos dois lados;
-- - denunciar: a denúncia fica guardada para quem cuida do servidor (Table Editor › papirus_reports);
-- - pedir AU: o autor abre um mundo a pedidos no perfil; quem tem conta pede, e só o autor aceita
--   (aceitar convida a pessoa para ver o mundo com "Pode ver e criar um AU").

-- ─── Bloquear ────────────────────────────────────────────────────────
create table if not exists public.papirus_blocks (
  blocker uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

-- Um dos dois bloqueou o outro? (vê os dois lados; quem foi bloqueado não vê a lista de quem bloqueou)
create or replace function public.papirus_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.papirus_blocks x where (x.blocker = a and x.blocked = b) or (x.blocker = b and x.blocked = a))
$$;

alter table public.papirus_blocks enable row level security;
drop policy if exists "ver quem bloqueei" on public.papirus_blocks;
drop policy if exists "desbloquear" on public.papirus_blocks;
create policy "ver quem bloqueei" on public.papirus_blocks for select to authenticated using (blocker = auth.uid());
create policy "desbloquear" on public.papirus_blocks for delete to authenticated using (blocker = auth.uid());
revoke all on public.papirus_blocks from anon;
grant select, delete on public.papirus_blocks to authenticated;

-- ─── Seguir ──────────────────────────────────────────────────────────
create table if not exists public.papirus_follows (
  follower uuid not null default auth.uid() references auth.users (id) on delete cascade,
  followee uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create index if not exists papirus_follows_followee on public.papirus_follows (followee);

alter table public.papirus_follows enable row level security;
drop policy if exists "ver seguir" on public.papirus_follows;
drop policy if exists "seguir" on public.papirus_follows;
drop policy if exists "deixar de seguir" on public.papirus_follows;
create policy "ver seguir" on public.papirus_follows for select to authenticated using (auth.uid() in (follower, followee));
create policy "seguir" on public.papirus_follows for insert to authenticated
  with check (follower = auth.uid() and not public.papirus_blocked(followee, auth.uid()));
-- Quem segue deixa de seguir; quem é seguido pode tirar um seguidor.
create policy "deixar de seguir" on public.papirus_follows for delete to authenticated using (auth.uid() in (follower, followee));
revoke all on public.papirus_follows from anon;
grant select, insert, delete on public.papirus_follows to authenticated;

-- Quantos seguem e quantos a pessoa segue (só os números, para o perfil).
create or replace function public.papirus_follow_counts(u uuid) returns table (followers bigint, following bigint)
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.papirus_follows f where f.followee = u),
         (select count(*) from public.papirus_follows f where f.follower = u)
$$;

-- Quem segue vê os capítulos novos dos livros públicos de quem segue (as outras atividades seguem só para amigos).
drop policy if exists "seguidores veem capítulos públicos" on public.papirus_activity;
create policy "seguidores veem capítulos públicos" on public.papirus_activity for select to authenticated
  using (
    kind = 'capitulos' and created_at > now() - interval '60 days'
    and exists (select 1 from public.papirus_follows f where f.follower = auth.uid() and f.followee = actor)
    and exists (select 1 from public.papirus_shelf s where s.owner = actor and s.id = book_id and s.visibility = 'publico')
  );

-- ─── Continuar lendo e quem leu até onde ─────────────────────────────
create table if not exists public.papirus_reading (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  owner uuid not null,
  book_id text not null,
  -- Onde parou (o índice do capítulo) e o mais longe que chegou.
  chapter_index integer not null default 0 check (chapter_index between 0 and 100000),
  furthest integer not null default 0 check (furthest between 0 and 100000),
  -- Quantos capítulos o livro tinha na última leitura (para avisar dos novos).
  chapters_seen integer not null default 0 check (chapters_seen between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, owner, book_id),
  foreign key (owner, book_id) references public.papirus_shelf (owner, id) on delete cascade
);
create index if not exists papirus_reading_book on public.papirus_reading (owner, book_id);

alter table public.papirus_reading enable row level security;
drop policy if exists "ver a minha leitura" on public.papirus_reading;
drop policy if exists "guardar a minha leitura" on public.papirus_reading;
drop policy if exists "atualizar a minha leitura" on public.papirus_reading;
drop policy if exists "apagar a minha leitura" on public.papirus_reading;
create policy "ver a minha leitura" on public.papirus_reading for select to authenticated using (user_id = auth.uid());
create policy "guardar a minha leitura" on public.papirus_reading for insert to authenticated
  with check (user_id = auth.uid() and public.papirus_book_visible(owner, book_id));
create policy "atualizar a minha leitura" on public.papirus_reading for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.papirus_book_visible(owner, book_id));
create policy "apagar a minha leitura" on public.papirus_reading for delete to authenticated using (user_id = auth.uid());
revoke all on public.papirus_reading from anon;
grant select, insert, update, delete on public.papirus_reading to authenticated;

-- Para o autor: quantas pessoas chegaram até cada capítulo (sem dizer quem). Só o dono do livro.
create or replace function public.papirus_reading_stats(b text) returns table (furthest integer, readers bigint)
language sql stable security definer set search_path = '' as $$
  select r.furthest, count(*) from public.papirus_reading r
  where r.owner = auth.uid() and r.book_id = b and r.user_id <> auth.uid()
  group by r.furthest order by r.furthest
$$;

-- ─── Denunciar ───────────────────────────────────────────────────────
create table if not exists public.papirus_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target uuid not null,
  comment_id uuid,
  book_owner uuid,
  book_id text check (book_id is null or length(book_id) <= 200),
  -- O que foi denunciado, como estava (o comentário pode ser apagado depois).
  body text not null default '' check (length(body) <= 1000),
  reason text not null check (length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.papirus_reports enable row level security;
drop policy if exists "denunciar" on public.papirus_reports;
drop policy if exists "ver as minhas denúncias" on public.papirus_reports;
create policy "denunciar" on public.papirus_reports for insert to authenticated with check (reporter = auth.uid() and target <> auth.uid());
create policy "ver as minhas denúncias" on public.papirus_reports for select to authenticated using (reporter = auth.uid());
revoke all on public.papirus_reports from anon;
grant select, insert on public.papirus_reports to authenticated;

-- ─── Mundos abertos a AU e os pedidos ────────────────────────────────
create table if not exists public.papirus_open_worlds (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  universe_id uuid not null,
  name text not null default '' check (length(name) <= 200),
  blurb text not null default '' check (length(blurb) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (owner, universe_id)
);

alter table public.papirus_open_worlds enable row level security;
drop policy if exists "ver mundos abertos" on public.papirus_open_worlds;
drop policy if exists "dono abre o mundo" on public.papirus_open_worlds;
drop policy if exists "dono muda o mundo aberto" on public.papirus_open_worlds;
drop policy if exists "dono fecha o mundo" on public.papirus_open_worlds;
create policy "ver mundos abertos" on public.papirus_open_worlds for select to authenticated using (not public.papirus_blocked(owner, auth.uid()));
create policy "dono abre o mundo" on public.papirus_open_worlds for insert to authenticated with check (owner = auth.uid());
create policy "dono muda o mundo aberto" on public.papirus_open_worlds for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "dono fecha o mundo" on public.papirus_open_worlds for delete to authenticated using (owner = auth.uid());
revoke all on public.papirus_open_worlds from anon;
grant select, insert, update, delete on public.papirus_open_worlds to authenticated;

create table if not exists public.papirus_au_requests (
  owner uuid not null,
  universe_id uuid not null,
  requester uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- O e-mail de quem pede (o servidor preenche e confere): o autor convida por ele ao aceitar.
  requester_email text not null default public.papirus_my_email(),
  message text not null default '' check (length(message) <= 500),
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado')),
  created_at timestamptz not null default now(),
  primary key (owner, universe_id, requester),
  foreign key (owner, universe_id) references public.papirus_open_worlds (owner, universe_id) on delete cascade
);

alter table public.papirus_au_requests enable row level security;
drop policy if exists "ver pedidos de AU" on public.papirus_au_requests;
drop policy if exists "pedir AU" on public.papirus_au_requests;
drop policy if exists "responder pedido de AU" on public.papirus_au_requests;
drop policy if exists "apagar pedido de AU" on public.papirus_au_requests;
create policy "ver pedidos de AU" on public.papirus_au_requests for select to authenticated using (auth.uid() in (owner, requester));
create policy "pedir AU" on public.papirus_au_requests for insert to authenticated
  with check (
    requester = auth.uid() and owner <> auth.uid() and status = 'pendente'
    and requester_email = public.papirus_my_email() and not public.papirus_blocked(owner, auth.uid())
  );
create policy "responder pedido de AU" on public.papirus_au_requests for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "apagar pedido de AU" on public.papirus_au_requests for delete to authenticated using (auth.uid() in (owner, requester));
revoke all on public.papirus_au_requests from anon;
grant select, insert, update, delete on public.papirus_au_requests to authenticated;

-- ─── Quem foi bloqueado não comenta, não reage nem pede amizade ──────
drop policy if exists "bloqueado não comenta" on public.papirus_shelf_comments;
create policy "bloqueado não comenta" on public.papirus_shelf_comments as restrictive for insert to authenticated
  with check (not public.papirus_blocked(owner, auth.uid()));
drop policy if exists "bloqueado não marca quero ler" on public.papirus_shelf_reactions;
create policy "bloqueado não marca quero ler" on public.papirus_shelf_reactions as restrictive for insert to authenticated
  with check (not public.papirus_blocked(owner, auth.uid()));
drop policy if exists "bloqueado não reage" on public.papirus_chapter_reactions;
create policy "bloqueado não reage" on public.papirus_chapter_reactions as restrictive for insert to authenticated
  with check (not public.papirus_blocked(owner, auth.uid()));
drop policy if exists "bloqueado não pede amizade" on public.papirus_friendships;
create policy "bloqueado não pede amizade" on public.papirus_friendships as restrictive for insert to authenticated
  with check (not public.papirus_blocked(addressee, auth.uid()));

-- Bloquear: guarda o bloqueio e desfaz amizade, seguir e pedidos de AU dos dois lados.
create or replace function public.papirus_block(u uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or u is null or u = auth.uid() then raise exception 'não dá para bloquear'; end if;
  insert into public.papirus_blocks (blocker, blocked) values (auth.uid(), u) on conflict do nothing;
  delete from public.papirus_friendships where (requester = auth.uid() and addressee = u) or (requester = u and addressee = auth.uid());
  delete from public.papirus_follows where (follower = auth.uid() and followee = u) or (follower = u and followee = auth.uid());
  delete from public.papirus_au_requests where (owner = auth.uid() and requester = u) or (owner = u and requester = auth.uid());
end;
$$;

revoke all on function public.papirus_blocked(uuid, uuid), public.papirus_block(uuid), public.papirus_reading_stats(text), public.papirus_follow_counts(uuid) from public;
grant execute on function public.papirus_blocked(uuid, uuid), public.papirus_block(uuid), public.papirus_reading_stats(text) to authenticated;
grant execute on function public.papirus_follow_counts(uuid) to anon, authenticated;
