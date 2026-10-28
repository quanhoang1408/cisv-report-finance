-- =====================================================================
-- CISV Delegation Finance – Supabase schema (chạy 1 lần trong SQL Editor)
-- Mô hình: Leader xuất bản SNAPSHOT JSON của đoàn; phụ huynh đọc qua RPC có PIN.
-- =====================================================================

-- Supabase cài sẵn pgcrypto trong schema "extensions" (không phải public)
create extension if not exists pgcrypto with schema extensions;

-- ---------- Bảng snapshot đã xuất bản ----------
create table if not exists public.published_delegations (
  id          text primary key,                       -- = delegation.id trên máy Leader
  owner       uuid not null references auth.users(id) on delete cascade,
  slug        text not null unique,
  pin_hash    text not null,                          -- sha256(slug || ':' || pin) dạng hex
  data        jsonb not null,                         -- Snapshot (không chứa PIN)
  updated_at  timestamptz not null default now()
);

create index if not exists published_delegations_owner_idx on public.published_delegations(owner);

alter table public.published_delegations enable row level security;

-- Leader (đã đăng nhập) toàn quyền với đoàn của mình
drop policy if exists "owner full access" on public.published_delegations;
create policy "owner full access" on public.published_delegations
  for all
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- Không có policy cho anon → phụ huynh không đọc trực tiếp được bảng, chỉ qua RPC dưới đây.

-- ---------- RPC cho phụ huynh: trả snapshot nếu đúng PIN ----------
create or replace function public.get_published_delegation(p_slug text, p_pin text)
returns jsonb
language sql
security definer
set search_path = public, extensions
stable
as $$
  select data
  from public.published_delegations
  where slug = p_slug
    and pin_hash = encode(digest(p_slug || ':' || p_pin, 'sha256'), 'hex')
  limit 1;
$$;

revoke all on function public.get_published_delegation(text, text) from public;
grant execute on function public.get_published_delegation(text, text) to anon, authenticated;

-- ---------- Storage: bucket ảnh hoá đơn ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152;

-- Ai cũng đọc được ảnh (URL ngẫu nhiên, chỉ ai có link snapshot mới biết)
drop policy if exists "receipts public read" on storage.objects;
create policy "receipts public read" on storage.objects
  for select to public
  using (bucket_id = 'receipts');

-- Leader chỉ ghi/sửa/xoá trong thư mục {uid}/...
drop policy if exists "receipts owner insert" on storage.objects;
create policy "receipts owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts owner update" on storage.objects;
create policy "receipts owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts owner delete" on storage.objects;
create policy "receipts owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
