-- Papirus: treinos de escrita (sprint com tempo e mínimo de palavras ou caracteres).
-- Rode DEPOIS de supabase/contas.sql, no SQL Editor do mesmo projeto, e clique em "Run". Pode rodar de novo.
--
-- Cada tentativa fica guardada com o texto, para ver o progresso e refazer o desafio depois.
-- Só a própria pessoa vê, cria e apaga os seus treinos. Uma tentativa terminada não muda.

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
  primary key (user_id, id)
);

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
