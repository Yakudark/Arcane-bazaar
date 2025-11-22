import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.APP_CONFIG;
let adminCheck, btnLogout;
let productsTable, usersTable;
let panelButtons, sectionListing, sectionCreate, sectionCreateCategory, sectionRecipes;
let supabase = null;

let currentSession = null;
let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let categoriesMap = {};
let elementsMap = {};
let editingProductId = null;
let productsCache = [];
let categoriesTable;
let editingCategoryId = null;


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
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, is_active')
    .order('name', { ascending: true });

  if (error) {
    console.error('Erreur chargement catégories:', error);
    categoriesList = [];
    if (categoriesTable) {
      categoriesTable.innerHTML = `<tr><td colspan="5"><span class="error">Erreur chargement catégories : ${error.message}</span></td></tr>`;
    }
    return;
  }

  categoriesMap = {};
  categoriesList = data || [];
  categoriesList.forEach(cat => { categoriesMap[cat.id] = cat.name; });

  // Remplir select de création produit
  fillSelectOptions(document.getElementById('prod-category'), categoriesList);

  // Remplir tableau des catégories si présent
  if (!categoriesTable) return;

  if (!categoriesList.length) {
    categoriesTable.innerHTML = '<tr><td colspan="5" class="muted">Aucune catégorie.</td></tr>';
    return;
  }

  const rows = categoriesList.map((cat, idx) => {
    const active = cat.is_active !== false; // par défaut true si null/undefined
    const statusLabel = active ? 'Active' : 'Masquée';
    const statusClass = active ? 'status-active' : 'status-inactive';
    const statusStyle = active
      ? 'background:rgba(60,200,60,0.13);color:#19d444;border:1px solid #1a9548;'
      : 'background:rgba(255,125,50,0.05);color:#ff9932;border:1px solid #c77b13;';

    return `<tr>
      <td>${idx + 1}</td>
      <td>${cat.name}</td>
      <td><code>${cat.slug}</code></td>
      <td>
        <button class="btn btn-cat-status ${statusClass}"
                data-id="${cat.id}"
                data-active="${active ? '1' : '0'}"
                type="button"
                style="${statusStyle}padding:4px 12px;font-weight:600;font-size:13px">
          ${statusLabel}
        </button>
      </td>
      <td>
        <button class="btn btn-edit-cat" data-id="${cat.id}" title="Modifier">✏️</button>
        <button class="btn btn-delete-cat" data-id="${cat.id}" data-name="${cat.name}" title="Supprimer">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  categoriesTable.innerHTML = rows;

  // Toggle actif / masqué
  categoriesTable.querySelectorAll('.btn-cat-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const isActive = btn.dataset.active === '1';
      btn.disabled = true;
      btn.textContent = '...';
      btn.style.opacity = '0.7';

      const { error } = await supabase
        .from('categories')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) {
        console.error('Erreur toggle catégorie:', error);
        alert('Erreur lors de la mise à jour du statut : ' + error.message);
      }

      await fetchCategories(); // rafraîchit tableau + select
    });
  });

  // Édition
  categoriesTable.querySelectorAll('.btn-edit-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const cat = categoriesList.find(c => c.id === id);
      if (!cat) {
        alert('Catégorie introuvable pour modification.');
        return;
      }
      setCategoryFormToEditMode(cat);

      // montrer le panneau catégories
      sectionCreateCategory.classList.remove('hidden');
      sectionListing.classList.add('hidden');
      sectionCreate.classList.add('hidden');
      document.querySelectorAll('.sidebar-link').forEach(b => b.classList.remove('current'));
      document.querySelector('[data-panel="create-category"]')?.classList.add('current');
    });
  });

  // Suppression
  categoriesTable.querySelectorAll('.btn-delete-cat').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const name = btn.dataset.name || 'cette catégorie';

      if (!confirm(`Supprimer "${name}" ?\n\nAttention : si des produits utilisent cette catégorie, la suppression peut échouer (contrainte de clé étrangère).`)) {
        return;
      }

      btn.disabled = true;
      btn.textContent = '...';
      btn.style.opacity = '0.7';

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erreur suppression catégorie:', error);
        alert('Erreur lors de la suppression : ' + error.message);
        btn.disabled = false;
        btn.textContent = '🗑️';
        btn.style.opacity = '1';
        return;
      }

      await fetchCategories();
    });
  });
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
        let error = null;

        if (!editingCategoryId) {
          // Création
          ({ error } = await supabase
            .from('categories')
            .insert([{ name, slug }]));
        } else {
          // Modification
          ({ error } = await supabase
            .from('categories')
            .update({ name, slug })
            .eq('id', editingCategoryId));
        }

        if (error) {
          if (error.code === '23505') {
            catAddMsg.textContent = "Ce slug existe déjà, choisis-en un autre.";
          } else {
            catAddMsg.textContent = "Erreur : " + error.message;
          }
        } else {
          catAddMsg.textContent = editingCategoryId
            ? "Catégorie modifiée."
            : "Catégorie ajoutée !";

          // Rafraîchir le select + le tableau
          await fetchCategories();

          // Retour au mode création
          setCategoryFormToCreateMode();
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

  panelButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      panelButtons.forEach(b => b.classList.remove("current"));
      btn.classList.add("current");
      const panel = btn.dataset.panel;

      if (panel === "listing") {
        sectionListing.classList.remove("hidden");
        sectionCreate.classList.add("hidden");
        sectionCreateCategory.classList.add("hidden");
        sectionRecipes?.classList?.add("hidden");

      } else if (panel === "create") {
        setFormToCreateMode();
        sectionCreate.classList.remove("hidden");
        sectionListing.classList.add("hidden");
        sectionCreateCategory.classList.add("hidden");
        sectionRecipes?.classList?.add("hidden");

      } else if (panel === "create-category") {
        sectionCreateCategory.classList.remove("hidden");
        sectionListing.classList.add("hidden");
        sectionCreate.classList.add("hidden");
        sectionRecipes?.classList?.add("hidden");

      } else if (panel === "recipes") {
        sectionListing.classList.add("hidden");
        sectionCreate.classList.add("hidden");
        sectionCreateCategory.classList.add("hidden");
        sectionRecipes.classList.remove("hidden");

        loadRecipeProducts();

        // Reset interface
        ingredientsContainer.innerHTML = "";
        stepsContainer.innerHTML = "";
        recipeTitle.value = "";
        recipeVolume.value = "";
        recipeWarning.value = "";
        recipeMsg.textContent = "";
      }

    });
  });


  // ========== PANEL RECETTES ==========
  const recipePanel = document.getElementById('dashboard-recipes');
  const recipeSelect = document.getElementById('recipe-product');
  const recipeTitle = document.getElementById('recipe-title');
  const recipeVolume = document.getElementById('recipe-volume');
  const recipeWarning = document.getElementById('recipe-warning');
  const ingredientsContainer = document.getElementById('ingredients-container');
  const addIngredientBtn = document.getElementById('add-ingredient');
  const stepsContainer = document.getElementById('steps-container');
  const addStepBtn = document.getElementById('add-step');
  const saveRecipeBtn = document.getElementById('save-recipe');
  const recipeMsg = document.getElementById('recipe-msg');

  let currentRecipe = null;

  // Charger les produits dans la liste
  async function loadRecipeProducts() {
    const { data } = await supabase.from('products')
      .select('id, name')
      .order('name', { ascending: true });

    recipeSelect.innerHTML = data
      .map(p => `<option value="${p.id}">${p.name}</option>`)
      .join('');
  }

  // Ajouter un ingrédient
  function addIngredientRow(ingredient = {}) {
    const row = document.createElement('div');
    row.classList.add('ingredient-row');
    row.innerHTML = `
        <div class="field-row">
            <input type="text" placeholder="Nom" value="${ingredient.name || ''}" class="ing-name"/>
            <input type="text" placeholder="Quantité" value="${ingredient.quantity || ''}" class="ing-qty"/>
            <input type="text" placeholder="Rôle" value="${ingredient.role || ''}" class="ing-role"/>
            <button class="btn btn-delete small remove-ing">🗑️</button>
        </div>
    `;
    row.querySelector('.remove-ing').addEventListener('click', () => row.remove());
    ingredientsContainer.appendChild(row);
  }

  // Ajouter une étape
  function addStepRow(step = {}) {
    const row = document.createElement('div');
    row.classList.add('step-row');
    row.innerHTML = `
        <div class="field-row">
            <textarea rows="2" class="step-desc">${step.description || ''}</textarea>
            <button class="btn btn-delete small remove-step">🗑️</button>
        </div>
    `;
    row.querySelector('.remove-step').addEventListener('click', () => row.remove());
    stepsContainer.appendChild(row);
  }

  addIngredientBtn.addEventListener('click', () => addIngredientRow());
  addStepBtn.addEventListener('click', () => addStepRow());

  // Enregistrer recette
  saveRecipeBtn.addEventListener('click', async () => {
    recipeMsg.textContent = "";

    const product_id = recipeSelect.value;
    const title = recipeTitle.value;
    const base_volume_ml = recipeVolume.value;
    const warning = recipeWarning.value;

    // 1) Vérifier si une recette existe déjà
    const { data: existing } = await supabase
      .from('recipes')
      .select('*')
      .eq('product_id', product_id)
      .maybeSingle();

    let recipe;

    if (!existing) {
      // créer
      const { data: created } = await supabase
        .from('recipes')
        .insert([{ product_id, title, base_volume_ml, warning }])
        .select()
        .single();
      recipe = created;
    } else {
      // update
      const { data: updated } = await supabase
        .from('recipes')
        .update({ title, base_volume_ml, warning })
        .eq('id', existing.id)
        .select()
        .single();
      recipe = updated;

      // supprimer anciens ingrédients & étapes
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipe.id);
      await supabase.from('recipe_steps').delete().eq('recipe_id', recipe.id);
    }

    // 2) Sauvegarder ingrédients
    const ingredients = [...ingredientsContainer.querySelectorAll('.ingredient-row')].map(row => ({
      recipe_id: recipe.id,
      name: row.querySelector('.ing-name').value,
      quantity: row.querySelector('.ing-qty').value,
      role: row.querySelector('.ing-role').value
    }));

    if (ingredients.length)
      await supabase.from('recipe_ingredients').insert(ingredients);

    // 3) Sauvegarder étapes
    const steps = [...stepsContainer.querySelectorAll('.step-row')].map((row, idx) => ({
      recipe_id: recipe.id,
      step_number: idx + 1,
      description: row.querySelector('.step-desc').value
    }));

    if (steps.length)
      await supabase.from('recipe_steps').insert(steps);

    recipeMsg.textContent = "✓ Recette enregistrée !";
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

function setCategoryFormToCreateMode() {
  const form = document.getElementById('add-category-form');
  if (!form) return;

  const title = document.querySelector('#dashboard-create-category h3');
  if (title) title.textContent = 'Gérer les catégories';

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Ajouter';

  form.reset();
  editingCategoryId = null;

  const msg = document.getElementById('cat-add-msg');
  if (msg) msg.textContent = '';
}

function setCategoryFormToEditMode(cat) {
  const form = document.getElementById('add-category-form');
  if (!form || !cat) return;

  const title = document.querySelector('#dashboard-create-category h3');
  if (title) title.textContent = `Modifier la catégorie`;

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Enregistrer';

  form['name'].value = cat.name || '';
  form['slug'].value = cat.slug || '';

  const msg = document.getElementById('cat-add-msg');
  if (msg) msg.textContent = '';

  editingCategoryId = cat.id;
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
  sectionRecipes = document.getElementById("dashboard-recipes");
  categoriesTable = document.getElementById("categories-table")?.querySelector("tbody"); // 🔹
  init();
});


