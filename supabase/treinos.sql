-- Papirus: treinos de escrita (sprint com tempo e mínimo de palavras ou caracteres) e o placar.
-- Rode DEPOIS de supabase/contas.sql e supabase/social.sql, no SQL Editor do mesmo projeto, e clique em "Run".
-- Pode rodar de novo.
--
-- Cada tentativa fica guardada com o texto, para ver o progresso e refazer o desafio depois.
-- Só a própria pessoa vê, cria e apaga os seus treinos. Uma tentativa terminada não muda.
--
-- Placar (entre amigos e de todo mundo): só números, nunca o texto.
-- - pontos = minutos de treino com o mínimo batido, até 60 por dia (vale a constância, não colar texto);
-- - o servidor reconta palavras e caracteres a partir do texto e só aceita no placar o que parece escrito
--   ali: pelo menos um minuto, dentro do tempo do treino, a até 150 palavras por minuto, feito nos últimos dias;
-- - cada pessoa escolhe quem vê os pontos dela: ninguém, amigos (o padrão) ou todo mundo.

create table if not exists public.papirus_treinos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  day date not null,
  prompt text not null check (char_length(prompt) between 1 and 1000),
  daily boolean not null default false,
  minutes integer not null default 0 check (minutes between 0 and 240),
  target integer not null default 0 check (target between 0 and 100000),
  unit text not null default 'palavras' check (unit in ('palavras', 'caracteres')),
  words integer not null default 0 check (words between 0 and 100000),
  chars integer not null default 0 check (chars between 0 and 1000000),
  seconds integer not null default 0 check (seconds between 0 and 86400),
  done boolean not null default false,
  text text not null default '' check (char_length(text) <= 60000),
  at timestamptz not null default now(),
  -- Conferido pelo servidor: entra no placar.
  ranked boolean not null default false,
  primary key (user_id, id)
);
alter table public.papirus_treinos add column if not exists ranked boolean not null default false;

create index if not exists papirus_treinos_recentes on public.papirus_treinos (user_id, at desc);

alter table public.papirus_treinos enable row level security;

drop policy if exists "ver os meus treinos" on public.papirus_treinos;
drop policy if exists "guardar um treino" on public.papirus_treinos;
drop policy if exists "apagar um treino" on public.papirus_treinos;
create policy "ver os meus treinos" on public.papirus_treinos for select to authenticated using (user_id = auth.uid());
create policy "guardar um treino" on public.papirus_treinos for insert to authenticated with check (user_id = auth.uid());
create policy "apagar um treino" on public.papirus_treinos for delete to authenticated using (user_id = auth.uid());

revoke all on public.papirus_treinos from anon;
revoke all on public.papirus_treinos from authenticated;
grant select, insert, delete on public.papirus_treinos to authenticated;

-- O servidor confere cada treino que chega: as contas vêm do texto, não do aparelho.
create or replace function public.papirus_treino_conferir() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.text := btrim(new.text, E' \t\r\n');
  new.words := (select count(*) from regexp_matches(new.text, '[[:alnum:]]+([''’-][[:alnum:]]+)*', 'g'))::int;
  new.chars := char_length(new.text);
  new.done := new.target = 0 or (case when new.unit = 'palavras' then new.words else new.chars end) >= new.target;
  new.ranked := new.done
    and new.seconds >= 60
    and new.words * 60 <= new.seconds * 150
    and (new.minutes = 0 or new.seconds <= new.minutes * 60 + 5)
    and new.day between current_date - 2 and current_date + 1;
  return new;
end
$$;
drop trigger if exists papirus_treino_conferir on public.papirus_treinos;
create trigger papirus_treino_conferir before insert on public.papirus_treinos
  for each row execute function public.papirus_treino_conferir();

-- Quem vê os pontos de cada um no placar.
alter table public.papirus_profiles add column if not exists placar text not null default 'amigos'
  check (placar in ('ninguem', 'amigos', 'todos'));

-- O placar desde uma data (começo da semana ou do mês): amigos ou todo mundo, até o 100º lugar,
-- e sempre a própria linha. Só números e o @; nada do texto.
create or replace function public.papirus_placar_treinos(escopo text, desde date)
returns table (posicao integer, user_id uuid, handle text, name text, pontos integer, dias integer, treinos integer, palavras integer)
language sql stable security definer set search_path = '' as $$
  with por_dia as (
    select t.user_id, t.day,
      least(60, sum(case when t.minutes > 0 then t.minutes else t.seconds / 60 end))::int as pontos,
      sum(t.words)::int as palavras,
      count(*)::int as n
    from public.papirus_treinos t
    where t.ranked and t.day >= desde
    group by t.user_id, t.day
  ),
  soma as (
    select d.user_id, sum(d.pontos)::int as pontos, count(*)::int as dias, sum(d.n)::int as treinos, sum(d.palavras)::int as palavras
    from por_dia d
    group by d.user_id
  ),
  visiveis as (
    select s.user_id, s.pontos, s.dias, s.treinos, s.palavras, p.handle, p.name
    from soma s
    join public.papirus_profiles p on p.user_id = s.user_id
    where s.user_id = auth.uid()
      or (escopo = 'amigos' and p.placar in ('amigos', 'todos') and public.papirus_are_friends(s.user_id, auth.uid()))
      or (escopo = 'todos' and p.placar = 'todos')
  ),
  ordem as (
    select (rank() over (order by v.pontos desc, v.dias desc))::int as posicao, v.*
    from visiveis v
  )
  select o.posicao, o.user_id, o.handle, o.name, o.pontos, o.dias, o.treinos, o.palavras
  from ordem o
  where auth.uid() is not null and (o.posicao <= 100 or o.user_id = auth.uid())
  order by o.posicao, o.palavras desc
$$;

revoke all on function public.papirus_treino_conferir() from public, anon, authenticated;
revoke all on function public.papirus_placar_treinos(text, date) from public, anon;
grant execute on function public.papirus_placar_treinos(text, date) to authenticated;
