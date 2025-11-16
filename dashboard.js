import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.APP_CONFIG;
let adminCheck, btnLogout;
let productsTable, usersTable;
let panelButtons, sectionListing, sectionCreate, sectionCreateCategory;
let supabase = null;
let currentSession = null;
let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let categoriesMap = {};
let elementsMap = {};
let editingProductId = null;
let productsCache = [];


function showError(msg) {
  adminCheck.textContent = msg;
  adminCheck.classList.remove("hidden");
  sectionListing.classList.add("hidden");
  sectionCreate?.classList.add("hidden");
  sectionCreateCategory?.classList.add("hidden");
}


async function loadProfile() {
  if (!currentUser) { currentProfile = null; isAdmin = false; return; }
  const { data } = await supabase.from('profiles').select('role,email').eq('id', currentUser.id).maybeSingle();
  currentProfile = data || null;
  isAdmin = (currentProfile?.role || '').toLowerCase() === 'admin';
}

function applySession(session) {
  currentSession = session || null;
  currentUser = session?.user || null;
}

function fillSelectOptions(selectEl, list, opts = {}) {
  if (!selectEl) return;
  const val = selectEl.value;
  selectEl.innerHTML = '';
  list.forEach(item => {
    const o = document.createElement('option');
    o.value = item.id;
    o.textContent = opts.showIcon && item.icon ? `${item.icon} ${item.name}` : item.name;
    selectEl.appendChild(o);
  });
  // Restaure la sélection si existait
  if (val) selectEl.value = val;
}

let categoriesList = [], elementsList = [];

async function fetchCategories() {
  const { data, error } = await supabase.from('categories').select('id,name');
  if (error) { console.error('Erreur chargement catégories:', error); return; }
  categoriesMap = {};
  categoriesList = data || [];
  categoriesList.forEach(cat => { categoriesMap[cat.id] = cat.name; });
  // Remplir select création
  fillSelectOptions(document.getElementById('prod-category'), categoriesList);
}
async function fetchElements() {
  const { data, error } = await supabase.from('elements').select('id,name,icon');
  if (error) { console.error('Erreur éléments:', error); return; }
  elementsMap = {};
  elementsList = data || [];
  elementsList.forEach(e => { elementsMap[e.id] = { name: e.name, icon: e.icon }; });
  // Remplir select création
  fillSelectOptions(document.getElementById('prod-element'), elementsList, { showIcon: true });
}

function badgeRarity(r) {
  if (!r) return '<span class="badge">?</span>';
  const s = r.toLowerCase();
  let cls = 'rarity-rare';
  if (s.includes('commun') || s.includes('common')) cls = 'rarity-common';
  else if (s.includes('legendaire') || s.includes('legend')) cls = 'rarity-legendary';
  else if (s.includes('epique') || s.includes('epic')) cls = 'rarity-epic';
  return `<span class="badge ${cls}">${r}</span>`;
}

function statusToggleBtn(prod) {
  const published = !!prod.is_published;
  const color = published ? 'background:rgba(60,200,60,0.13);color:#19d444;border:1px solid #1a9548;' : 'background:rgba(255,125,50,0.05);color:#ff9932;border:1px solid #c77b13;';
  const txt = published ? 'Publié' : 'Offline';
  return `<button class="btn btn-status" data-publish="${published ? '1' : '0'}" data-id="${prod.id}" type="button" style="${color}padding:4px 15px;font-weight:600;font-size:14px">${txt}</button>`;
}

async function fetchProductsAdmin() {
  if (!supabase) return;
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  productsCache = data || [];

  if (error) {
    productsTable.innerHTML = `<tr><td colspan=\"10\"><span class='error'>Erreur chargement : ${error.message}</span></td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    productsTable.innerHTML = '<tr><td colspan=\"10\" class="muted">Aucun produit existant.</td></tr>';
    return;
  }
  productsTable.innerHTML = productsCache.map((prod, idx) => {
    const element = elementsMap[prod.element_id];
    return `<tr>
      <td>${idx + 1}</td>
      <td>${prod.name}</td>
      <td>${categoriesMap[prod.category_id] ?? '(inconnu)'}</td>
      <td>${element ? (element.icon + ' ' + element.name) : ''}</td>
      <td style="text-align:right">${prod.price_gils ?? ''}</td>
      <td>${badgeRarity(prod.rarity)}</td>
      <td style="text-align:center">${prod.power ?? ''}</td>
      <td style="text-align:center">${prod.finesse ?? ''}</td>
      <td>${statusToggleBtn(prod)}</td>
      <td>
        <button class="btn btn-edit" data-id="${prod.id}" title="Modifier">✏️</button>
        <button class="btn btn-delete" data-delete="${prod.id}" data-name="${prod.name}" title="Supprimer">🗑️</button>
      </td>
    </tr>`;
  }).join('');
  // Handler bouton édition
  productsTable.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const product = productsCache.find(p => p.id === id);
      if (!product) {
        alert('Produit introuvable pour modification.');
        return;
      }

      // Remplir le formulaire avec les données du produit
      setFormToEditMode(product);

      // On empêche l'auto-modification du slug quand on modifie le nom pendant l'édition
      const prodSlugInput = document.getElementById('prod-slug');
      if (prodSlugInput) {
        prodSlugInput.dispatchEvent(new Event('input'));
      }

      // Afficher le panneau "Créer/Modifier" et sélectionner l’onglet
      sectionCreate.classList.remove('hidden');
      sectionListing.classList.add('hidden');

      document.querySelectorAll('.sidebar-link').forEach(b => b.classList.remove('current'));
      document.querySelector('[data-panel="create"]')?.classList.add('current');
    });
  });


  // Appliquer le handler bouton statut toggle
  productsTable.querySelectorAll('.btn-status').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      const toPub = btn.dataset.publish === '0';
      btn.disabled = true;
      btn.textContent = '...';
      btn.style.opacity = '0.7';
      // Mise à jour coté BDD
      const { error } = await supabase.from('products').update({ is_published: toPub }).eq('id', id);
      if (error) {
        btn.textContent = 'Erreur';
        btn.style.background = 'rgba(200,0,0,0.15)';
        btn.style.color = '#fff';
        setTimeout(() => fetchProductsAdmin(), 1200);
        return;
      }
      // SIGNAL pour la boutique => déclenche le refresh catalogue dans l'autre onglet
      localStorage.setItem('refresh-shop-catalogue', Date.now().toString());
      fetchProductsAdmin(); // Recharge le tableau admin
    });
  });

  // Appliquer le handler bouton suppression
  productsTable.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const productId = btn.dataset.delete;
      const productName = btn.dataset.name || 'ce produit';

      // Confirmation
      if (!confirm(`Êtes-vous sûr de vouloir supprimer "${productName}" ?\n\nCette action est irréversible et supprimera également toutes les images associées.`)) {
        return;
      }

      btn.disabled = true;
      btn.textContent = '...';
      btn.style.opacity = '0.7';

      try {
        // Récupérer les images AVANT suppression (pour nettoyer le Storage)
        const { data: images } = await supabase.from('product_images').select('url').eq('product_id', productId);

        // Supprimer le produit (les images de la table seront supprimées automatiquement par cascade)
        const { error } = await supabase.from('products').delete().eq('id', productId);

        if (error) {
          console.error('Erreur suppression produit:', error);
          alert('Erreur lors de la suppression : ' + error.message);
          btn.disabled = false;
          btn.textContent = '🗑️';
          btn.style.opacity = '1';
          return;
        }

        // Supprimer les fichiers du Storage (nettoyage)
        if (images && images.length > 0) {
          // Extraire les chemins depuis les URLs
          const filePaths = images.map(img => {
            const url = img.url;
            // Extraire le chemin : products/filename.jpg depuis l'URL complète
            const match = url.match(/\/Images\/(.+)$/);
            return match ? match[1] : null;
          }).filter(Boolean);

          // Supprimer les fichiers du Storage
          if (filePaths.length > 0) {
            const { error: storageError } = await supabase.storage
              .from('Images')
              .remove(filePaths);
            if (storageError) {
              console.error('Erreur suppression images Storage:', storageError);
              // On continue même si l'erreur Storage (le produit est déjà supprimé)
            } else {
              console.log('Images Storage supprimées:', filePaths);
            }
          }
        }

        // SIGNAL pour la boutique => déclenche le refresh catalogue
        localStorage.setItem('refresh-shop-catalogue', Date.now().toString());

        // Rafraîchir la liste
        await fetchProductsAdmin();

      } catch (err) {
        console.error('Erreur suppression:', err);
        alert('Erreur lors de la suppression : ' + (err.message || 'Erreur inconnue'));
        btn.disabled = false;
        btn.textContent = '🗑️';
        btn.style.opacity = '1';
      }
    });
  });
}

async function init() {
  if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    showError("Configuration Supabase manquante.");
    return;
  }
  supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const { data: sessionData } = await supabase.auth.getSession();
  applySession(sessionData.session);
  if (!currentUser) {
    showError("Vous devez être connecté.");
    return;
  }
  await loadProfile();
  if (!isAdmin) {
    showError("Accès réservé aux administrateurs.");
    return;
  }
  await fetchCategories();
  await fetchElements();
  adminCheck.classList.add("hidden");
  sectionListing.classList.remove("hidden");
  await fetchProductsAdmin();

  // --- Formulaire d'ajout de catégorie ---
  const addCatForm = document.getElementById('add-category-form');
  const catAddMsg = document.getElementById('cat-add-msg');
  const catNameInput = document.getElementById('cat-name');
  const catSlugInput = document.getElementById('cat-slug');

  // Auto-slug pour la catégorie
  if (catNameInput && catSlugInput) {
    let catSlugManualEdit = false;

    catNameInput.addEventListener('input', () => {
      if (!catSlugManualEdit) {
        const slug = catNameInput.value.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        catSlugInput.value = slug;
      }
    });

    catSlugInput.addEventListener('input', () => {
      catSlugManualEdit = catSlugInput.value.length > 0;
    });
  }

  if (addCatForm && catAddMsg) {
    addCatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      catAddMsg.textContent = '';

      const name = addCatForm['name'].value.trim();
      const slug = addCatForm['slug'].value.trim();

      if (!name || !slug) {
        catAddMsg.textContent = "Nom et slug requis.";
        return;
      }

      try {
        const { error } = await supabase
          .from('categories')
          .insert([{ name, slug }]);

        if (error) {
          if (error.code === '23505') {
            // unique_violation sur slug
            catAddMsg.textContent = "Ce slug existe déjà, choisis-en un autre.";
          } else {
            catAddMsg.textContent = "Erreur : " + error.message;
          }
        } else {
          catAddMsg.textContent = "Catégorie ajoutée !";

          // On rafraîchit la liste des catégories pour le <select> produit
          await fetchCategories();

          // Reset du formulaire
          addCatForm.reset();
          if (catSlugInput) catSlugInput.value = '';
        }
      } catch (err) {
        catAddMsg.textContent = "Erreur : " + (err.message || err);
      }
    });
  }


  // Génération automatique du slug depuis le nom
  const prodNameInput = document.getElementById('prod-name');
  const prodSlugInput = document.getElementById('prod-slug');
  let slugManualEdit = false;
  if (prodNameInput && prodSlugInput) {
    prodNameInput.addEventListener('input', () => {
      if (!slugManualEdit) {
        const slug = prodNameInput.value.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        prodSlugInput.value = slug;
      }
    });
    prodSlugInput.addEventListener('input', () => {
      slugManualEdit = prodSlugInput.value.length > 0;
    });
  }

  // Preview image uploadée
  const prodImageInput = document.getElementById('prod-image');
  const prodImagePreview = document.getElementById('prod-image-preview');
  if (prodImageInput && prodImagePreview) {
    prodImageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          alert('L\'image est trop grande (max 5MB)');
          prodImageInput.value = '';
          prodImagePreview.classList.add('hidden');
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          prodImagePreview.innerHTML = `<img src="${event.target.result}" alt="Preview" />`;
          prodImagePreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      } else {
        prodImagePreview.classList.add('hidden');
      }
    });
  }

  // Handler soumission formulaire création / édition produit
  const createForm = document.getElementById('create-product-form');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(createForm);
      const submitBtn = createForm.querySelector('button[type=submit]');
      const originalText = submitBtn.textContent;

      submitBtn.disabled = true;
      submitBtn.textContent = editingProductId ? 'Enregistrement...' : 'Création...';

      try {
        // Préparer les données produit
        const toInt = (v) => {
          const n = parseInt(v, 10);
          return Number.isNaN(n) ? null : n;
        };

        const productData = {
          name: formData.get('name'),
          slug: formData.get('slug'),
          short_description: formData.get('short_description') || null,
          long_description: formData.get('long_description') || null,
          price_gils: toInt(formData.get('price_gils')),
          rarity: formData.get('rarity'),
          type: formData.get('type'),
          category_id: formData.get('category_id'),
          element_id: formData.get('element_id') || null,
          power: toInt(formData.get('power')),
          finesse: toInt(formData.get('finesse')),
          is_published: formData.get('is_published') === 'on',
          flavor_type: formData.get('flavor_type') || null,
          flavor_profile: formData.get('flavor_profile') || null,
          tasting_notes: formData.get('tasting_notes') || null,
          color: formData.get('color') || null,
          food_pairing: formData.get('food_pairing') || null,
          signature_cocktail: formData.get('signature_cocktail') || null,
        };

        let product = null;

        if (!editingProductId) {
          // --- CRÉATION ---
          const { data: newProduct, error: productError } = await supabase
            .from('products')
            .insert(productData)
            .select()
            .single();

          if (productError) throw productError;
          product = newProduct;
        } else {
          // --- MODIFICATION ---
          const { data: updatedProduct, error: updateError } = await supabase
            .from('products')
            .update(productData)
            .eq('id', editingProductId)
            .select()
            .single();

          if (updateError) throw updateError;
          product = updatedProduct;
        }

        // Upload image si fournie (même logique pour création & édition)
        const imageFile = formData.get('image');
        if (imageFile && imageFile.size > 0) {
          console.log('Début upload image:', imageFile.name, imageFile.size);
          const fileExt = imageFile.name.split('.').pop();
          const fileName = `${product.id}-${Date.now()}.${fileExt}`;
          const filePath = `products/${fileName}`;

          const bucketName = 'Images'; // vérifier le nom exact du bucket

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, imageFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('Erreur upload image:', uploadError);
            alert('Erreur lors de l\'upload de l\'image :\n' + uploadError.message);
          } else {
            const { data: urlData } = supabase.storage
              .from(bucketName)
              .getPublicUrl(filePath);

            const imageUrl = urlData?.publicUrl;

            if (imageUrl) {
              const { error: imgError } = await supabase
                .from('product_images')
                .insert({
                  product_id: product.id,
                  url: imageUrl,
                  is_main: true
                });

              if (imgError) {
                console.error('Erreur insertion product_images:', imgError);
                alert('Erreur lors de l\'enregistrement de l\'image : ' + imgError.message);
              }
            }
          }
        }

        // Rafraîchir la liste des produits
        await fetchProductsAdmin();
        // Signal pour la boutique
        localStorage.setItem('refresh-shop-catalogue', Date.now().toString());

        // Remettre en mode création
        setFormToCreateMode();
        slugManualEdit = false;

        // Retourner au listing
        document.querySelector('[data-panel="listing"]')?.click();

        submitBtn.textContent = editingProductId ? '✓ Modifié !' : '✓ Créé !';
        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }, 2000);

      } catch (error) {
        console.error('Erreur création/modification produit:', error);
        alert('Erreur : ' + (error.message || 'Impossible d\'enregistrer le produit'));
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // Sidebar navigation
  panelButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      panelButtons.forEach(b => b.classList.remove("current"));
      btn.classList.add("current");

      const panel = btn.dataset.panel;

      if (panel === "listing") {
        sectionListing.classList.remove("hidden");
        sectionCreate.classList.add("hidden");
        sectionCreateCategory.classList.add("hidden");
      } else if (panel === "create") {
        setFormToCreateMode(); // reset form produit
        sectionCreate.classList.remove("hidden");
        sectionListing.classList.add("hidden");
        sectionCreateCategory.classList.add("hidden");
      } else if (panel === "create-category") {
        sectionCreateCategory.classList.remove("hidden");
        sectionListing.classList.add("hidden");
        sectionCreate.classList.add("hidden");
      }
    });
  });

  // Logout handler
  btnLogout?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
  });
}

function setFormToCreateMode() {
  const createForm = document.getElementById('create-product-form');
  if (!createForm) return;

  const titleEl = document.querySelector('#dashboard-create h2');
  if (titleEl) titleEl.textContent = 'Créer un produit';

  const submitBtn = createForm.querySelector('button[type=submit]');
  if (submitBtn) submitBtn.textContent = 'Créer';

  createForm.reset();

  const prodImagePreview = document.getElementById('prod-image-preview');
  if (prodImagePreview) {
    prodImagePreview.classList.add('hidden');
    prodImagePreview.innerHTML = '';
  }

  editingProductId = null;
}

function setFormToEditMode(product) {
  const createForm = document.getElementById('create-product-form');
  if (!createForm || !product) return;

  const titleEl = document.querySelector('#dashboard-create h2');
  if (titleEl) titleEl.textContent = `Modifier un produit`;

  const submitBtn = createForm.querySelector('button[type=submit]');
  if (submitBtn) submitBtn.textContent = 'Enregistrer les modifications';

  // Remplissage des champs
  document.getElementById('prod-name').value = product.name || '';
  document.getElementById('prod-slug').value = product.slug || '';
  document.getElementById('prod-price').value = product.price_gils ?? '';

  document.getElementById('prod-type').value = product.type || 'elixir';
  document.getElementById('prod-category').value = product.category_id || '';
  document.getElementById('prod-element').value = product.element_id || '';

  document.getElementById('prod-rarete').value = product.rarity || 'Rare';
  document.getElementById('prod-power').value = product.power ?? 3;
  document.getElementById('prod-finesse').value = product.finesse ?? 3;

  document.getElementById('prod-short').value = product.short_description || '';
  document.getElementById('prod-long').value = product.long_description || '';

  document.getElementById('prod-flavor-type').value = product.flavor_type || '';
  document.getElementById('prod-flavor-profile').value = product.flavor_profile || '';
  document.getElementById('prod-color').value = product.color || '';
  document.getElementById('prod-tasting-notes').value = product.tasting_notes || '';
  document.getElementById('prod-food-pairing').value = product.food_pairing || '';
  document.getElementById('prod-signature-cocktail').value = product.signature_cocktail || '';

  const publishedCheckbox = document.getElementById('prod-published');
  if (publishedCheckbox) {
    publishedCheckbox.checked = !!product.is_published;
  }

  // On passe en mode édition
  editingProductId = product.id;
  if (typeof slugManualEdit !== 'undefined') {
    slugManualEdit = true; // empêche l’auto-slug pendant l’édition
  }
}


window.addEventListener('DOMContentLoaded', () => {
  adminCheck = document.getElementById("admin-check");
  btnLogout = document.getElementById("btn-logout");
  productsTable = document.getElementById("products-table")?.querySelector("tbody");
  usersTable = document.getElementById("users-table")?.querySelector("tbody");
  panelButtons = document.querySelectorAll(".sidebar-link");
  sectionListing = document.getElementById("dashboard-listing");
  sectionCreate = document.getElementById("dashboard-create");
  sectionCreateCategory = document.getElementById("dashboard-create-category"); 
  init();
});

