-- =====================================================
-- EXTENSION (UUID)
-- =====================================================
create extension if not exists pgcrypto;

-- =====================================================
-- SCHEMA
-- =====================================================

create table if not exists elements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  short_description text,
  long_description text,
  price_gils integer not null default 0,
  rarity text not null default 'Rare',
  type text not null default 'elixir',
  element_id uuid references elements(id),
  category_id uuid references categories(id),
  power integer not null default 3,
  finesse integer not null default 3,
  is_published boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  url text not null,
  is_main boolean not null default false
);

-- =====================================================
-- RLS
-- =====================================================

alter table elements enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table product_images enable row level security;

-- On supprime les policies si elles existent, puis on les recrée
drop policy if exists "Public read elements" on elements;
create policy "Public read elements"
  on elements
  for select
  using (true);

drop policy if exists "Public read categories" on categories;
create policy "Public read categories"
  on categories
  for select
  using (true);

drop policy if exists "Public read product images" on product_images;
create policy "Public read product images"
  on product_images
  for select
  using (true);

drop policy if exists "Public read published products" on products;
create policy "Public read published products"
  on products
  for select
  using (is_published = true);

-- =====================================================
-- DONNÉES DE RÉFÉRENCE
-- =====================================================

insert into elements (name, icon) values
  ('Feu', '🔥'),
  ('Glace', '❄️'),
  ('Terre', '🪨'),
  ('Foudre', '⚡'),
  ('Ombre', '💀'),
  ('Vent', '💨'),
  ('Eau', '🌊'),
  ('Lumière', '✨')
on conflict do nothing;

insert into categories (name, slug) values
  ('Boissons', 'boissons'),
  ('Cosmétiques', 'cosmetiques')
on conflict do nothing;

-- =====================================================
-- PRODUITS (avec CTE pour récupérer les IDs)
-- =====================================================

with ids as (
  select 
    (select id from categories where slug = 'boissons' limit 1)   as cat_boissons,
    (select id from categories where slug = 'cosmetiques' limit 1) as cat_cosm,
    (select id from elements where name = 'Feu' limit 1)          as elt_feu,
    (select id from elements where name = 'Glace' limit 1)        as elt_glace,
    (select id from elements where name = 'Terre' limit 1)        as elt_terre,
    (select id from elements where name = 'Foudre' limit 1)       as elt_foudre,
    (select id from elements where name = 'Ombre' limit 1)        as elt_ombre,
    (select id from elements where name = 'Vent' limit 1)         as elt_vent,
    (select id from elements where name = 'Eau' limit 1)          as elt_eau,
    (select id from elements where name = 'Lumière' limit 1)      as elt_lumiere
)
insert into products (
  name, slug, short_description, long_description,
  price_gils, rarity, type, element_id, category_id,
  power, finesse, is_published
)
select * from (
  values
    (
      'Élixir du Dragon',
      'elixir-du-dragon',
      'Flammes liquides, éveille la rage draconique.',
      'Distillé dans les entrailles d''un volcan ancien, cet élixir embrase l''âme et renforce la vigueur du porteur.',
      320,
      'Légendaire',
      'elixir',
      (select elt_feu from ids),
      (select cat_boissons from ids),
      9,
      4,
      true
    ),
    (
      'Givre éternel',
      'givre-eternel',
      'Fraîcheur abyssale, ralentit le temps.',
      'Une essence cristalline née au coeur d''un glacier éternel. Elle calme les tempêtes intérieures et affûte l''esprit.',
      180,
      'Épique',
      'elixir',
      (select elt_glace from ids),
      (select cat_boissons from ids),
      6,
      8,
      true
    ),
    (
      'Baume sylvestre',
      'baume-sylvestre',
      'Sève protectrice des forêts anciennes.',
      'Baume onctueux préparé par les druides, renforce la peau et cicatrise les blessures mineures.',
      95,
      'Rare',
      'baume',
      (select elt_terre from ids),
      (select cat_cosm from ids),
      4,
      7,
      true
    ),
    (
      'Tonique d''orage',
      'tonique-d-orage',
      'Fulgurance en fiole, l''éclair domestiqué.',
      'Un breuvage qui donne au sang la rapidité de l''éclair. À consommer avec sagesse.',
      140,
      'Rare',
      'elixir',
      (select elt_foudre from ids),
      (select cat_boissons from ids),
      7,
      6,
      true
    ),
    (
      'Huile d''ombre',
      'huile-d-ombre',
      'Voile obscur pour pas feutrés.',
      'Huile légère qui s''estompe à la lumière, idéale pour les ombres silencieuses.',
      160,
      'Épique',
      'cosmetique',
      (select elt_ombre from ids),
      (select cat_cosm from ids),
      5,
      9,
      true
    ),
    (
      'Brume des alizés',
      'brume-des-alizes',
      'Souffle léger, esprit clair.',
      'Une brume vivifiante capturant la liberté du vent. Apaise et recentre.',
      80,
      'Commun',
      'elixir',
      (select elt_vent from ids),
      (select cat_boissons from ids),
      3,
      5,
      true
    ),
    (
      'Mousse océane',
      'mousse-oceane',
      'Écume de marée, peau nacrée.',
      'Préparation cosmétique tirée des mines de sel et des algues rares, adoucit et protège.',
      110,
      'Rare',
      'cosmetique',
      (select elt_eau from ids),
      (select cat_cosm from ids),
      4,
      6,
      true
    ),
    (
      'Lueur sacrée',
      'lueur-sacree',
      'Éclat divin en fiole.',
      'Concentré de prière et de lumière. Écarte les ténèbres et insuffle courage.',
      260,
      'Épique',
      'elixir',
      (select elt_lumiere from ids),
      (select cat_boissons from ids),
      8,
      7,
      true
    )
) as t(
  name, slug, short_description, long_description,
  price_gils, rarity, type, element_id, category_id,
  power, finesse, is_published
)
on conflict (slug) do nothing;

-- =====================================================
-- IMAGES PRODUITS
-- =====================================================

insert into product_images (product_id, url, is_main)
select p.id, i.url, i.is_main
from (
  values
    ('elixir-du-dragon', 'https://images.unsplash.com/photo-1474631245212-32dc3c8310c6?q=80&w=1200&auto=format&fit=crop', true),
    ('elixir-du-dragon', 'https://images.unsplash.com/photo-1561214124-6a6b91be3a18?q=80&w=1200&auto=format&fit=crop', false),

    ('givre-eternel', 'https://images.unsplash.com/photo-1541643600914-78b084683601?q=80&w=1200&auto=format&fit=crop', true),

    ('baume-sylvestre', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=1200&auto=format&fit=crop', true),

    ('tonique-d-orage', 'https://images.unsplash.com/photo-1504805572947-34fad45aed93?q=80&w=1200&auto=format&fit=crop', true),

    ('huile-d-ombre', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200&auto=format&fit=crop', true),

    ('brume-des-alizes', 'https://images.unsplash.com/photo-1458530970867-aaa3700e966d?q=80&w=1200&auto=format&fit=crop', true),

    ('mousse-oceane', 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?q=80&w=1200&auto=format&fit=crop', true),

    ('lueur-sacree', 'https://images.unsplash.com/photo-1508747703725-719777637510?q=80&w=1200&auto=format&fit=crop', true)
) as i(slug, url, is_main)
join products p on p.slug = i.slug
on conflict do nothing;
