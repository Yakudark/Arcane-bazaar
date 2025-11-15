-- =====================================================
-- POLITIQUES STORAGE (bucket Images)
-- =====================================================
-- Exécutez ce script dans l'onglet SQL de votre projet Supabase
-- Après avoir créé le bucket "Images" dans Storage

-- Activer RLS sur storage.objects
alter table storage.objects enable row level security;

-- Politique 1 : Les admins peuvent uploader des images
drop policy if exists "Admin can upload images" on storage.objects;
create policy "Admin can upload images" on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'Images' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Politique 2 : Les admins peuvent supprimer des images
drop policy if exists "Admin can delete images" on storage.objects;
create policy "Admin can delete images" on storage.objects
for delete
to authenticated
using (
  bucket_id = 'Images' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Politique 3 : Lecture publique des images (tout le monde peut voir les images)
drop policy if exists "Public can read images" on storage.objects;
create policy "Public can read images" on storage.objects
for select
to public
using (bucket_id = 'Images');

-- Politique 4 : Les admins peuvent mettre à jour des images
drop policy if exists "Admin can update images" on storage.objects;
create policy "Admin can update images" on storage.objects
for update
to authenticated
using (
  bucket_id = 'Images' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
with check (
  bucket_id = 'Images' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

