-- Supabase Auth + Rôles (admin / visitor)
-- Exécutez ce script dans l'onglet SQL de votre projet Supabase, après seeds.sql

-- =============================================
-- Table profils liée à auth.users
-- =============================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'visitor' check (role in ('visitor','admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Créer automatiquement une ligne de profile à la création d'un utilisateur
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: savoir si l'utilisateur courant est admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- =============================================
-- RLS
-- =============================================
alter table public.profiles enable row level security;

-- Lecture: propriétaire ou admin
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Admin read profiles" on public.profiles;
create policy "Admin read profiles" on public.profiles
for select
using (public.is_admin());

-- Mise à jour: uniquement admin (les visiteurs ne modifient pas leur profil ici)
drop policy if exists "Admin update profiles" on public.profiles;
create policy "Admin update profiles" on public.profiles
for update
using (public.is_admin())
with check (public.is_admin());

-- (Optionnel) GRANT. Supabase gère souvent ces droits par défaut.
grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;

-- Produits: laisser les visiteurs lire les publiés (déjà dans seeds.sql),
-- et permettre aux admins de tout lire/éditer
alter table public.products enable row level security;

drop policy if exists "Admin read all products" on public.products;
create policy "Admin read all products" on public.products
for select
using (public.is_admin());

drop policy if exists "Admin insert products" on public.products;
create policy "Admin insert products" on public.products
for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admin update products" on public.products;
create policy "Admin update products" on public.products
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admin delete products" on public.products;
create policy "Admin delete products" on public.products
for delete to authenticated
using (public.is_admin());

-- Catégories/Éléments/Images: lecture publique conservée (déjà définie dans seeds.sql)

-- Product Images: permettre aux admins d'insérer/modifier/supprimer
alter table public.product_images enable row level security;

drop policy if exists "Admin insert product images" on public.product_images;
create policy "Admin insert product images" on public.product_images
for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admin update product images" on public.product_images;
create policy "Admin update product images" on public.product_images
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admin delete product images" on public.product_images;
create policy "Admin delete product images" on public.product_images
for delete to authenticated
using (public.is_admin());