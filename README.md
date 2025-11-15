# Arcane Bazaar

Demo e-commerce fantasy (MMORPG) — HTML/CSS/JS + Supabase. Aucune authentification. Catalogue filtrable, tri par prix/rareté, fiche produit en modal.

## Démarrage rapide

1. Créez un projet Supabase.
2. Ouvrez l'onglet SQL et exécutez `seeds.sql` (schéma + données + RLS). Attendez la fin.
3. Dans Supabase → Settings → API, copiez l'URL du projet et l'anon key.
4. Copiez `config.example.js` en `config.js` et remplissez vos valeurs.
5. Ouvrez `index.html` dans un navigateur, ou servez le dossier via votre serveur local (WAMP/Apache):
   - Exemple Wamp: placer ce dossier dans `www` et visiter `http://localhost/Darjah/arcane-bazaar/`.

## Fonctionnalités

- Accueil: hero taverne + produits mis en avant (derniers publiés)
- Catalogue: filtres par catégorie et élément, tri par prix/rareté
- Fiche produit: modal avec image, rareté, élément, stats (Puissance/Finesse) et descriptions
- Thème sombre fantasy avec accents dorés/cuivrés

## Variables et tables

- Tables: `elements`, `categories`, `products`, `product_images`
- Les images sont des URLs publiques (Unsplash). Vous pouvez remplacer par vos propres URLs ou du Storage Supabase.

## Sécurité RLS

Le script `seeds.sql` active des politiques RLS minimalistes:
- Lecture publique sur `elements`, `categories`, `product_images`
- Lecture publique des `products` où `is_published = true`

N'utilisez jamais la service_role key côté client.

## Personnalisation

- Palette et styles: `styles.css`
- Logique et requêtes Supabase: `app.js`
- Configuration projet: `config.js`

## Déploiement statique

Ce site est 100% statique. Vous pouvez l'héberger sur Netlify, Vercel ou GitHub Pages. Ajoutez simplement `config.js` au build (ne commitez pas de clés sensibles en public).
