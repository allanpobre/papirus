-- Papirus: Codex ao vivo para as mesas de RPG.
-- Cole tudo no SQL Editor do seu projeto Supabase e clique em "Run". Pode rodar de novo sem problema.
--
-- Como funciona: cada Codex compartilhado tem um id público (vai no link dos jogadores)
-- e uma chave secreta que só o Papirus do mestre conhece. A tabela não tem nenhuma
-- permissão direta: ninguém lista nem lê nada. Tudo passa por três funções:
--   codex_get(id)              qualquer um com o link lê aquele Codex
--   codex_put(id, chave, dados) só quem tem a chave cria ou atualiza
--   codex_delete(id, chave)    só quem tem a chave apaga

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.papirus_codex (
  id uuid primary key,
  key_hash text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.papirus_codex enable row level security;
revoke all on public.papirus_codex from anon, authenticated;

create or replace function public.codex_get(codex_id uuid)
returns table (data jsonb, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select c.data, c.updated_at from public.papirus_codex c where c.id = codex_id;
$$;

create or replace function public.codex_put(codex_id uuid, codex_key text, codex_data jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  existing text;
  stamp timestamptz := now();
begin
  if length(codex_key) < 32 then
    raise exception 'chave curta demais';
  end if;
  if octet_length(codex_data::text) > 8 * 1024 * 1024 then
    raise exception 'Codex grande demais (máximo 8 MB; mapas pesados contam)';
  end if;
  select key_hash into existing from public.papirus_codex where id = codex_id;
  if existing is null then
    insert into public.papirus_codex (id, key_hash, data, updated_at)
    values (codex_id, crypt(codex_key, gen_salt('bf')), codex_data, stamp);
  elsif existing = crypt(codex_key, existing) then
    update public.papirus_codex set data = codex_data, updated_at = stamp where id = codex_id;
  else
    raise exception 'chave errada';
  end if;
  return stamp;
end;
$$;

create or replace function public.codex_delete(codex_id uuid, codex_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.papirus_codex
  where id = codex_id and key_hash = crypt(codex_key, key_hash);
end;
$$;

revoke all on function public.codex_get(uuid) from public;
revoke all on function public.codex_put(uuid, text, jsonb) from public;
revoke all on function public.codex_delete(uuid, text) from public;
grant execute on function public.codex_get(uuid) to anon, authenticated;
grant execute on function public.codex_put(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.codex_delete(uuid, text) to anon, authenticated;
