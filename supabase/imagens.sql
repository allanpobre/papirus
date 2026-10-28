-- Papirus: imagens (capa do universo, retratos das fichas, mapas, imagens nas cenas).
-- Rode DEPOIS de supabase/contas.sql, no SQL Editor do mesmo projeto, e clique em "Run". Pode rodar de novo.
--
-- Como funciona:
-- - cada imagem é encolhida no aparelho (WebP, ~100–200 KB) antes de vir para cá;
-- - o nome do arquivo é o resumo (SHA-256) do conteúdo: impossível de adivinhar sem ter a imagem;
-- - a pasta é pública para leitura (quem tem o universo, inclusive pelo link de leitura, vê as imagens);
-- - só quem tem conta envia, cada um até 100 MB, e cada um só apaga as próprias.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('papirus-imagens', 'papirus-imagens', true, 3145728, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Quanto a conta já usa, em bytes.
create or replace function public.papirus_image_usage()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
  from storage.objects o
  where o.bucket_id = 'papirus-imagens' and o.owner_id = auth.uid()::text
$$;

revoke all on function public.papirus_image_usage() from public, anon;
grant execute on function public.papirus_image_usage() to authenticated;

drop policy if exists "papirus imagens: enviar" on storage.objects;
create policy "papirus imagens: enviar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'papirus-imagens'
    and name ~ '^[0-9a-f]{32}$'
    and public.papirus_image_usage() < 100 * 1024 * 1024
  );

-- Ver (listar) e apagar: só as próprias. Mostrar as imagens não depende disto (a pasta é pública).
drop policy if exists "papirus imagens: ver as minhas" on storage.objects;
create policy "papirus imagens: ver as minhas" on storage.objects
  for select to authenticated
  using (bucket_id = 'papirus-imagens' and owner_id = auth.uid()::text);

drop policy if exists "papirus imagens: apagar as minhas" on storage.objects;
create policy "papirus imagens: apagar as minhas" on storage.objects
  for delete to authenticated
  using (bucket_id = 'papirus-imagens' and owner_id = auth.uid()::text);
