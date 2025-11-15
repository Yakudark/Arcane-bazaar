import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.APP_CONFIG;
const setupEl = document.getElementById("setup");
const featuredGrid = document.getElementById("featured-grid");
const featuredEmpty = document.getElementById("featured-empty");
const catalogueGrid = document.getElementById("catalogue-grid");
const catalogueEmpty = document.getElementById("catalogue-empty");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const catSelect = document.getElementById("filter-category");
const eltSelect = document.getElementById("filter-element");
const sortSelect = document.getElementById("sort-select");
const refreshBtn = document.getElementById("refresh-btn");

const modal = document.getElementById("product-modal");
const modalImage = document.getElementById("modal-image");
const modalTitle = document.getElementById("modal-title");
const modalRarity = document.getElementById("modal-rarity");
const modalElement = document.getElementById("modal-element");
const modalShort = document.getElementById("modal-short");
const modalLong = document.getElementById("modal-long");
const barPower = document.getElementById("bar-power");
const barFinesse = document.getElementById("bar-finesse");
const modalPrice = document.getElementById("modal-price");
const modalAction = document.getElementById("modal-action");
// Flavor section
const flavorSection = document.getElementById("flavor-section");
const modalFlavorType = document.getElementById("modal-flavor-type");
const modalFlavorProfile = document.getElementById("modal-flavor-profile");
const modalTastingNotes = document.getElementById("modal-tasting-notes");
const modalColor = document.getElementById("modal-color");
const modalFoodPairing = document.getElementById("modal-food-pairing");
const modalSignatureCocktail = document.getElementById("modal-signature-cocktail");
// Auth controls
const btnLogin = document.getElementById("btn-login");
const userInfo = document.getElementById("user-info");
const userEmail = document.getElementById("user-email");
const userRole = document.getElementById("user-role");
const btnLogout = document.getElementById("btn-logout");
const navDashboard = document.getElementById("nav-dashboard");
const authModal = document.getElementById("auth-modal");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmit = document.getElementById("auth-submit");
const authToggle = document.getElementById("auth-toggle");
const authError = document.getElementById("auth-error");
const authTitle = document.getElementById("auth-title");
const authPassword2Field = document.getElementById("auth-password2-field");
const authPassword2 = document.getElementById("auth-password2");
const dashboardSection = document.getElementById("dashboard"); // Ajout

let supabase = null;
let categories = [];
let elements = [];
let productCache = [];
let currentSession = null;
let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let authMode = 'signin';

function showSetup() {
  setupEl?.classList.remove("hidden");
}
function hideSetup() {
  setupEl?.classList.add("hidden");
}

function setLoading(v) {
  loadingEl.classList.toggle("hidden", !v);
}
function setError(msg) {
  if (!msg) { errorEl.classList.add("hidden"); errorEl.textContent = ""; return; }
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}

function setAuthError(msg) {
  if (!authError) return;
  if (!msg) { authError.classList.add('hidden'); authError.textContent = ''; return; }
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

function rarityToClass(r) {
  if (!r) return "rarity-rare";
  const s = r
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s.includes("commun") || s.includes("common")) return "rarity-common";
  if (s.includes("legendaire") || s.includes("legend")) return "rarity-legendary";
  if (s.includes("epique") || s.includes("epic")) return "rarity-epic";
  return "rarity-rare";
}

function rarityRank(r) {
  const s = (r||"")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s.includes("commun") || s.includes("common")) return 0;
  if (s.includes("legendaire") || s.includes("legend")) return 3;
  if (s.includes("epique") || s.includes("epic")) return 2;
  if (s.includes("rare")) return 1;
  return 1;
}

function gils(n) { return new Intl.NumberFormat('fr-FR').format(n) + " ⚙︎"; }

function pickMainImage(imgs) {
  if (!Array.isArray(imgs) || imgs.length === 0) return "assets/placeholder.svg";
  const main = imgs.find(i => i.is_main) || imgs[0];
  return main.url || "assets/placeholder.svg";
}

function setFlavorRow(ddEl, value) {
  const has = !!(value && value.toString().trim());
  if (!ddEl) return has;
  const dtEl = ddEl.previousElementSibling;
  if (has) {
    ddEl.textContent = value;
    if (dtEl) dtEl.style.display = '';
    ddEl.style.display = '';
  } else {
    ddEl.textContent = '';
    if (dtEl) dtEl.style.display = 'none';
    ddEl.style.display = 'none';
  }
  return has;
}

function productCard(p) {
  const img = pickMainImage(p.product_images);
  // Debug: vérifier les images du produit
  if (!p.product_images || p.product_images.length === 0) {
    console.log('Produit sans images:', p.name, p.id);
  } else {
    console.log('Produit avec images:', p.name, p.product_images);
  }
  const cat = categories.find(c => c.id === p.category_id);
  const elt = elements.find(e => e.id === p.element_id);
  const rarityCls = rarityToClass(p.rarity);
  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <div class="card-media"><img loading="lazy" src="${img}" alt="${p.name}" onerror="console.error('Erreur chargement image:', '${img}')" /></div>
    <div class="card-body">
      <div class="card-row">
        <div>
          <div class="card-title">${p.name}</div>
          <div class="card-sub">${cat?.name ?? ''} · ${elt?.icon ?? ''} ${elt?.name ?? ''}</div>
        </div>
        <div class="badges">
          <span class="badge ${rarityCls}">${p.rarity}</span>
        </div>
      </div>
      <div class="card-row">
        <div class="muted">${p.flavor_profile ?? ''}</div>
      </div>
      <div class="card-row">
        <div class="price">${gils(p.price_gils)} gils</div>
        <div class="btn-row">
          <button class="btn btn-primary" data-open="${p.id}">Voir</button>
        </div>
      </div>
    </div>
  `;
  el.querySelector('[data-open]')?.addEventListener('click', () => openModal(p));
  return el;
}

function clearEl(el) { while (el.firstChild) el.removeChild(el.firstChild); }

async function fetchMeta() {
  const [cats, elts] = await Promise.all([
    supabase.from('categories').select('*').order('name', { ascending: true }),
    supabase.from('elements').select('*').order('name', { ascending: true }),
  ]);
  if (cats.error) throw cats.error;
  if (elts.error) throw elts.error;
  categories = cats.data || [];
  elements = elts.data || [];

  // Build filters
  clearEl(catSelect);
  const optAllC = document.createElement('option'); optAllC.value = 'all'; optAllC.textContent = 'Toutes';
  catSelect.appendChild(optAllC);
  for (const c of categories) {
    const o = document.createElement('option'); o.value = c.slug; o.textContent = c.name; catSelect.appendChild(o);
  }

  clearEl(eltSelect);
  const optAllE = document.createElement('option'); optAllE.value = 'all'; optAllE.textContent = 'Tous';
  eltSelect.appendChild(optAllE);
  for (const e of elements) {
    const o = document.createElement('option'); o.value = e.id; o.textContent = `${e.icon} ${e.name}`; eltSelect.appendChild(o);
  }
}

async function fetchFeatured() {
  let q = supabase
    .from('products')
    .select('*, product_images(url,is_main)')
    .order('created_at', { ascending: false })
    .limit(8);
  q = q.eq('is_published', true); // Toujours filtrer, même pour les admins
  const { data, error } = await q;
  if (error) throw error;

  clearEl(featuredGrid);
  if (!data || data.length === 0) {
    featuredEmpty.classList.remove('hidden');
  } else {
    featuredEmpty.classList.add('hidden');
    data.forEach(p => featuredGrid.appendChild(productCard(p)));
  }
}

async function fetchProducts() {
  setLoading(true); setError("");
  const selectedCatSlug = catSelect.value;
  const selectedEltId = eltSelect.value;
  const sort = sortSelect.value;

  let q = supabase
    .from('products')
    .select('*, product_images(url,is_main)')
    .limit(100);
  q = q.eq('is_published', true); // Toujours filtrer, même pour les admins

  if (selectedCatSlug && selectedCatSlug !== 'all') {
    const cat = categories.find(c => c.slug === selectedCatSlug);
    if (cat) q = q.eq('category_id', cat.id);
  }
  if (selectedEltId && selectedEltId !== 'all') {
    q = q.eq('element_id', selectedEltId);
  }

  // Base server sorting for price where possible, rarity will be client-side
  if (sort === 'price-asc') q = q.order('price_gils', { ascending: true });
  if (sort === 'price-desc') q = q.order('price_gils', { ascending: false });
  // ensure deterministic order
  q = q.order('created_at', { ascending: false, nullsFirst: false });

  const { data, error } = await q;
  setLoading(false);
  if (error) { setError(error.message); return; }
  productCache = data || [];

  let items = [...productCache];
  if (sort === 'rarity-asc') items.sort((a,b) => rarityRank(a.rarity) - rarityRank(b.rarity));
  if (sort === 'rarity-desc') items.sort((a,b) => rarityRank(b.rarity) - rarityRank(a.rarity));

  clearEl(catalogueGrid);
  if (items.length === 0) {
    catalogueEmpty.classList.remove('hidden');
  } else {
    catalogueEmpty.classList.add('hidden');
    items.forEach(p => catalogueGrid.appendChild(productCard(p)));
  }
}

async function openModal(p) {
  try {
    const { data: imgs } = await supabase.from('product_images').select('url,is_main').eq('product_id', p.id).order('is_main', { ascending: false });
    const main = pickMainImage(imgs || p.product_images);
    const elt = elements.find(e => e.id === p.element_id);

    modalImage.src = main;
    modalTitle.textContent = p.name;
    modalRarity.textContent = p.rarity;
    modalRarity.className = `badge ${rarityToClass(p.rarity)}`;
    modalElement.textContent = `${elt?.icon ?? ''} ${elt?.name ?? ''}`;
    modalElement.className = 'badge';
    modalShort.textContent = p.short_description || '';
    modalLong.textContent = p.long_description || '';
    modalPrice.textContent = `${gils(p.price_gils)} gils`;
    barPower.style.width = `${Math.max(0, Math.min(10, p.power)) * 10}%`;
    barFinesse.style.width = `${Math.max(0, Math.min(10, p.finesse)) * 10}%`;
    modalAction.textContent = (p.category_id && categories.find(c => c.id === p.category_id)?.slug === 'boissons') ? 'Concocter cet élixir' : 'Ajouter au sac';

    // Flavor fields
    const has1 = setFlavorRow(modalFlavorType, p.flavor_type);
    const has2 = setFlavorRow(modalFlavorProfile, p.flavor_profile);
    const has3 = setFlavorRow(modalTastingNotes, p.tasting_notes);
    const has4 = setFlavorRow(modalColor, p.color);
    const has5 = setFlavorRow(modalFoodPairing, p.food_pairing);
    const has6 = setFlavorRow(modalSignatureCocktail, p.signature_cocktail);
    const showFlavor = has1 || has2 || has3 || has4 || has5 || has6;
    if (flavorSection) flavorSection.classList.toggle('hidden', !showFlavor);

    modal.classList.remove('hidden');
  } catch (e) {
    console.error(e);
  }
}

function closeModal() { modal.classList.add('hidden'); }
modal.addEventListener('click', (e) => { if (e.target?.dataset?.close === 'modal') closeModal(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
modal.querySelector('.modal-close')?.addEventListener('click', closeModal);

function openAuth() {
  if (!authModal) return;
  setAuthError('');
  authModal.classList.remove('hidden');
}
function closeAuth() { authModal?.classList.add('hidden'); }
authModal?.addEventListener('click', (e) => { if (e.target?.dataset?.close === 'auth') closeAuth(); });
authModal?.querySelector('.modal-close')?.addEventListener('click', closeAuth);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAuth(); });

function setAuthModeUI(mode) {
  authMode = mode;
  if (authTitle) authTitle.textContent = mode === 'signin' ? 'Connexion' : 'Créer un compte';
  if (authToggle) authToggle.textContent = mode === 'signin' ? 'Créer un compte' : 'J\u2019ai déjà un compte';
  if (authSubmit) authSubmit.textContent = mode === 'signin' ? 'Se connecter' : 'Créer un compte';
  if (authPassword2Field) authPassword2Field.classList.toggle('hidden', mode === 'signin');
  if (authPassword) authPassword.setAttribute('autocomplete', mode === 'signin' ? 'current-password' : 'new-password');
  if (authPassword2) authPassword2.value = '';
  setAuthError('');
}

async function signIn(email, password) {
  setAuthError('');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function signUp(email, password) {
  setAuthError('');
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

function updateUserUI() {
  const logged = !!currentUser;
  btnLogin?.classList.toggle('hidden', logged);
  userInfo?.classList.toggle('hidden', !logged);
  if (logged) {
    userEmail && (userEmail.textContent = currentUser.email || '');
    userRole && (userRole.textContent = isAdmin ? 'Admin' : 'Visiteur');
  }
  navDashboard?.classList.toggle('hidden', !isAdmin);
  // Dashboard visible uniquement pour admin
  if (dashboardSection) dashboardSection.classList.toggle('hidden', !isAdmin);
}

async function loadProfile() {
  if (!currentUser) { currentProfile = null; isAdmin = false; updateUserUI(); return; }
  const { data } = await supabase.from('profiles').select('role,email').eq('id', currentUser.id).maybeSingle();
  currentProfile = data || null;
  isAdmin = (currentProfile?.role || '').toLowerCase() === 'admin';
  updateUserUI();
}

function applySession(session) {
  currentSession = session || null;
  currentUser = session?.user || null;
}

async function init() {
  if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) { showSetup(); return; }
  hideSetup();
  supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    applySession(sessionData.session);
    await loadProfile();
    await fetchMeta();
    await fetchFeatured();
    await fetchProducts();
  } catch (e) {
    setError(e.message || 'Erreur de chargement');
  }

  catSelect.addEventListener('change', fetchProducts);
  eltSelect.addEventListener('change', fetchProducts);
  sortSelect.addEventListener('change', fetchProducts);
  refreshBtn.addEventListener('click', fetchProducts);

  btnLogin?.addEventListener('click', () => { setAuthModeUI('signin'); openAuth(); });
  btnLogout?.addEventListener('click', async () => { await supabase.auth.signOut(); });
  authToggle?.addEventListener('click', () => { setAuthModeUI(authMode === 'signin' ? 'signup' : 'signin'); });
  authSubmit?.addEventListener('click', async () => {
    const email = authEmail?.value?.trim();
    const password = authPassword?.value || '';
    const password2 = authPassword2?.value || '';
    if (!email || !password) { setAuthError('Email et mot de passe requis.'); return; }
    if (authMode === 'signup') {
      if (!password2) { setAuthError('Merci de confirmer votre mot de passe.'); return; }
      if (password !== password2) { setAuthError('Les mots de passe ne correspondent pas.'); return; }
    }
    try {
      if (authMode === 'signin') await signIn(email, password); else await signUp(email, password);
      closeAuth();
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (authMode === 'signup' && (msg.includes('disable') || msg.includes('not allowed') || msg.includes('signup'))) {
        setAuthError("Les inscriptions par email sont désactivées sur ce projet. Demandez une invitation admin ou activez-les dans Supabase (Auth → Settings → Email).");
      } else if (authMode === 'signin' && msg.includes('email not confirmed')) {
        setAuthError("Votre email n'est pas confirmé. Confirmez l'email reçu, désactivez la confirmation en dev, ou demandez la confirmation admin.");
      } else {
        setAuthError(err.message || "Échec de l'opération");
      }
    }
  });

  supabase.auth.onAuthStateChange(async (_event, session) => {
    applySession(session);
    await loadProfile();
    await fetchFeatured();
    await fetchProducts();
    if (session) closeAuth();
  });
}

window.addEventListener('DOMContentLoaded', init);
window.addEventListener('storage', (event) => {
  if (event.key === 'refresh-shop-catalogue') {
    // Rafraîchir le catalogue sans forcer reload de toute la page :
    // Pour effet instantané (meilleur UX) mais garde l'état scroll :
    fetchProducts && fetchProducts();
    fetchFeatured && fetchFeatured();
  }
});
