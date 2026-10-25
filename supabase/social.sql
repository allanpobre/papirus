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

-- Quando o livro entrou na estante (os avisos mostram livros novos de amigos, não cada edição).
alter table public.papirus_shelf add column if not exists created_at timestamptz not null default now();

-- ─── "Quero ler" e comentários nos livros da estante ─────────────────
-- Quem consegue ver o livro (dono, amigos se for "amigos", todos se for "público") vê e participa.
-- O dono do livro pode apagar qualquer comentário no livro dele; cada um apaga o seu.

create table if not exists public.papirus_shelf_reactions (
  owner uuid not null,
  book_id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, book_id, user_id),
  foreign key (owner, book_id) references public.papirus_shelf (owner, id) on delete cascade
);

create table if not exists public.papirus_shelf_comments (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null,
  book_id text not null,
  author uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  foreign key (owner, book_id) references public.papirus_shelf (owner, id) on delete cascade
);
create index if not exists papirus_shelf_comments_book on public.papirus_shelf_comments (owner, book_id, created_at);

-- O livro está visível para quem pergunta? (as regras da estante valem aqui dentro)
create or replace function public.papirus_book_visible(o uuid, b text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.papirus_shelf s where s.owner = o and s.id = b)
$$;

alter table public.papirus_shelf_reactions enable row level security;
alter table public.papirus_shelf_comments enable row level security;

drop policy if exists "ver quem quer ler" on public.papirus_shelf_reactions;
drop policy if exists "marcar quero ler" on public.papirus_shelf_reactions;
drop policy if exists "desmarcar quero ler" on public.papirus_shelf_reactions;
create policy "ver quem quer ler" on public.papirus_shelf_reactions for select to authenticated, anon using (public.papirus_book_visible(owner, book_id));
create policy "marcar quero ler" on public.papirus_shelf_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.papirus_book_visible(owner, book_id));
create policy "desmarcar quero ler" on public.papirus_shelf_reactions for delete to authenticated using (user_id = auth.uid());

drop policy if exists "ver comentários" on public.papirus_shelf_comments;
drop policy if exists "comentar" on public.papirus_shelf_comments;
drop policy if exists "apagar comentário" on public.papirus_shelf_comments;
create policy "ver comentários" on public.papirus_shelf_comments for select to authenticated, anon using (public.papirus_book_visible(owner, book_id));
create policy "comentar" on public.papirus_shelf_comments for insert to authenticated
  with check (author = auth.uid() and public.papirus_book_visible(owner, book_id));
create policy "apagar comentário" on public.papirus_shelf_comments for delete to authenticated using (author = auth.uid() or owner = auth.uid());

grant select on public.papirus_shelf_reactions, public.papirus_shelf_comments to anon;
revoke insert, update, delete on public.papirus_shelf_reactions, public.papirus_shelf_comments from anon;
grant select, insert, delete on public.papirus_shelf_reactions, public.papirus_shelf_comments to authenticated;
revoke update on public.papirus_shelf_reactions, public.papirus_shelf_comments from authenticated;
grant execute on function public.papirus_book_visible(uuid, text) to authenticated, anon;

-- ─── Desafios de escrita com amigos ──────────────────────────────────
-- Quem cria escolhe a meta diária e quantos dias dura. Amigos de quem criou veem o desafio e podem entrar.
-- O placar (palavras por dia de cada um) só aparece para quem participa. Cada um só escreve as próprias palavras.

create table if not exists public.papirus_challenges (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 80),
  daily_goal integer not null check (daily_goal between 50 and 20000),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 92)
);

create table if not exists public.papirus_challenge_members (
  challenge_id uuid not null references public.papirus_challenges (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create table if not exists public.papirus_challenge_days (
  challenge_id uuid not null,
  user_id uuid not null default auth.uid(),
  day date not null,
  words integer not null default 0 check (words between 0 and 200000),
  primary key (challenge_id, user_id, day),
  foreign key (challenge_id, user_id) references public.papirus_challenge_members (challenge_id, user_id) on delete cascade
);

-- Participa? (security definer: a regra de quem vê os membros usa esta função sem cair em laço)
create or replace function public.papirus_in_challenge(c uuid, u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.papirus_challenge_members m where m.challenge_id = c and m.user_id = u)
$$;

alter table public.papirus_challenges enable row level security;
alter table public.papirus_challenge_members enable row level security;
alter table public.papirus_challenge_days enable row level security;

drop policy if exists "ver desafios" on public.papirus_challenges;
drop policy if exists "criar desafio" on public.papirus_challenges;
drop policy if exists "mudar desafio" on public.papirus_challenges;
drop policy if exists "apagar desafio" on public.papirus_challenges;
create policy "ver desafios" on public.papirus_challenges for select to authenticated
  using (owner = auth.uid() or public.papirus_are_friends(owner, auth.uid()) or public.papirus_in_challenge(id, auth.uid()));
create policy "criar desafio" on public.papirus_challenges for insert to authenticated with check (owner = auth.uid());
create policy "mudar desafio" on public.papirus_challenges for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "apagar desafio" on public.papirus_challenges for delete to authenticated using (owner = auth.uid());

drop policy if exists "ver participantes" on public.papirus_challenge_members;
drop policy if exists "entrar no desafio" on public.papirus_challenge_members;
drop policy if exists "sair do desafio" on public.papirus_challenge_members;
create policy "ver participantes" on public.papirus_challenge_members for select to authenticated
  using (exists (select 1 from public.papirus_challenges c where c.id = challenge_id));
create policy "entrar no desafio" on public.papirus_challenge_members for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.papirus_challenges c where c.id = challenge_id));
create policy "sair do desafio" on public.papirus_challenge_members for delete to authenticated using (user_id = auth.uid());

drop policy if exists "ver placar" on public.papirus_challenge_days;
drop policy if exists "marcar palavras" on public.papirus_challenge_days;
drop policy if exists "corrigir palavras" on public.papirus_challenge_days;
create policy "ver placar" on public.papirus_challenge_days for select to authenticated using (public.papirus_in_challenge(challenge_id, auth.uid()));
create policy "marcar palavras" on public.papirus_challenge_days for insert to authenticated
  with check (user_id = auth.uid() and public.papirus_in_challenge(challenge_id, auth.uid()));
create policy "corrigir palavras" on public.papirus_challenge_days for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.papirus_challenges, public.papirus_challenge_members, public.papirus_challenge_days from anon;
grant select, insert, update, delete on public.papirus_challenges to authenticated;
grant select, insert, delete on public.papirus_challenge_members to authenticated;
grant select, insert on public.papirus_challenge_days to authenticated;
revoke update on public.papirus_challenge_days from authenticated;
grant update (words) on public.papirus_challenge_days to authenticated;
revoke all on function public.papirus_in_challenge(uuid, uuid) from public, anon;
grant execute on function public.papirus_in_challenge(uuid, uuid) to authenticated;

-- ─── Ler direto da estante ───────────────────────────────────────────
-- Quando a pessoa deixa, o texto do livro (sem o que é secreto) vai junto da vitrine.
-- Quem vê o livro na estante pode ler; só quem é dono escreve. Sair da estante apaga o texto.

create table if not exists public.papirus_shelf_text (
  owner uuid not null default auth.uid(),
  book_id text not null,
  data jsonb not null check (octet_length(data::text) <= 6000000),
  updated_at timestamptz not null default now(),
  primary key (owner, book_id),
  foreign key (owner, book_id) references public.papirus_shelf (owner, id) on delete cascade
);

alter table public.papirus_shelf_text enable row level security;
drop policy if exists "ler o livro" on public.papirus_shelf_text;
drop policy if exists "dono põe o texto" on public.papirus_shelf_text;
drop policy if exists "dono muda o texto" on public.papirus_shelf_text;
drop policy if exists "dono tira o texto" on public.papirus_shelf_text;
create policy "ler o livro" on public.papirus_shelf_text for select to authenticated, anon using (public.papirus_book_visible(owner, book_id));
create policy "dono põe o texto" on public.papirus_shelf_text for insert to authenticated with check (owner = auth.uid());
create policy "dono muda o texto" on public.papirus_shelf_text for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "dono tira o texto" on public.papirus_shelf_text for delete to authenticated using (owner = auth.uid());
grant select on public.papirus_shelf_text to anon;
revoke insert, update, delete on public.papirus_shelf_text from anon;
grant select, insert, update, delete on public.papirus_shelf_text to authenticated;

-- ─── Reações por capítulo ────────────────────────────────────────────
-- Quem lê deixa uma reação no fim de cada capítulo (uma por pessoa; dá para trocar ou tirar).

create table if not exists public.papirus_chapter_reactions (
  owner uuid not null,
  book_id text not null,
  scene_id text not null check (length(scene_id) <= 64),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😮', '😂', '😢', '🔥')),
  created_at timestamptz not null default now(),
  primary key (owner, book_id, scene_id, user_id),
  foreign key (owner, book_id) references public.papirus_shelf (owner, id) on delete cascade
);
create index if not exists papirus_chapter_reactions_book on public.papirus_chapter_reactions (owner, book_id);

alter table public.papirus_chapter_reactions enable row level security;
drop policy if exists "ver reações" on public.papirus_chapter_reactions;
drop policy if exists "reagir" on public.papirus_chapter_reactions;
drop policy if exists "trocar reação" on public.papirus_chapter_reactions;
drop policy if exists "tirar reação" on public.papirus_chapter_reactions;
create policy "ver reações" on public.papirus_chapter_reactions for select to authenticated, anon using (public.papirus_book_visible(owner, book_id));
create policy "reagir" on public.papirus_chapter_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.papirus_book_visible(owner, book_id));
create policy "trocar reação" on public.papirus_chapter_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.papirus_book_visible(owner, book_id));
create policy "tirar reação" on public.papirus_chapter_reactions for delete to authenticated using (user_id = auth.uid());
grant select on public.papirus_chapter_reactions to anon;
revoke insert, update, delete on public.papirus_chapter_reactions from anon;
grant select, insert, update, delete on public.papirus_chapter_reactions to authenticated;

-- ─── O que os amigos andam fazendo ───────────────────────────────────
-- Cada um registra o próprio: capítulos novos, meta do dia batida, dias seguidos escrevendo.
-- Só os amigos (e a própria pessoa) veem. Some sozinho depois de 60 dias.

create table if not exists public.papirus_activity (
  id uuid primary key default gen_random_uuid(),
  actor uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('capitulos', 'meta', 'sequencia')),
  book_id text check (length(book_id) <= 200),
  title text not null default '' check (length(title) <= 200),
  n integer not null default 0 check (n between 0 and 100000),
  created_at timestamptz not null default now()
);
create index if not exists papirus_activity_actor on public.papirus_activity (actor, created_at desc);

alter table public.papirus_activity enable row level security;
drop policy if exists "amigos veem a atividade" on public.papirus_activity;
drop policy if exists "registrar a própria atividade" on public.papirus_activity;
drop policy if exists "apagar a própria atividade" on public.papirus_activity;
create policy "amigos veem a atividade" on public.papirus_activity for select to authenticated
  using ((actor = auth.uid() or public.papirus_are_friends(actor, auth.uid())) and created_at > now() - interval '60 days');
create policy "registrar a própria atividade" on public.papirus_activity for insert to authenticated
  with check (actor = auth.uid() and created_at > now() - interval '1 minute');
create policy "apagar a própria atividade" on public.papirus_activity for delete to authenticated using (actor = auth.uid());
revoke all on public.papirus_activity from anon;
grant select, insert, delete on public.papirus_activity to authenticated;
