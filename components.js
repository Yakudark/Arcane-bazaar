// Composants réutilisables pour le header et les modaux
// Ce fichier doit être chargé AVANT app.js

// Header HTML
const headerHTML = `
  <header class="site-header">
    <div class="container header-inner">
      <div class="brand">
        <img class="brand-mark" src="./assets/logo.png" alt="Arcane Bazaar" />
        <span class="brand-name">Arcane Bazaar</span>
      </div>
      <nav class="nav">
        <a href="index.html" class="nav-link">Accueil</a>
        <a href="catalogue.html" class="nav-link">Catalogue</a>
        <a href="#footer" class="nav-link">Crédits</a>
        <a href="dashboard.html" id="nav-dashboard" class="nav-link hidden">Dashboard</a>
      </nav>
      <div class="auth-ctrls">
        <button id="btn-login" class="btn btn-ghost">Se connecter</button>
        <div id="user-info" class="user-info hidden">
          <span id="user-email"></span>
          <span id="user-role" class="badge"></span>
          <button id="btn-logout" class="btn btn-ghost">Se déconnecter</button>
        </div>
      </div>
    </div>
  </header>
`;

// Modal d'authentification
const authModalHTML = `
  <div id="auth-modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="auth-title">
    <div class="modal-backdrop" data-close="auth"></div>
    <div class="modal-card">
      <button class="modal-close" data-close="auth" aria-label="Fermer">✕</button>
      <div class="modal-body auth-grid">
        <div class="auth-form-col">
          <h3 id="auth-title">Connexion</h3>
          <div id="auth-error" class="error hidden"></div>
          <div class="field">
            <label for="auth-email">Email</label>
            <input id="auth-email" type="email" placeholder="vous@royaume.co" autocomplete="email" />
          </div>
          <div class="field">
            <label for="auth-password">Mot de passe</label>
            <input id="auth-password" type="password" placeholder="••••••••" autocomplete="current-password" />
          </div>
          <div class="field" id="auth-password2-field">
            <label for="auth-password2">Confirmer le mot de passe</label>
            <input id="auth-password2" type="password" placeholder="••••••••" autocomplete="new-password" />
          </div>
          <div class="btn-row">
            <button id="auth-submit" class="btn btn-primary">Se connecter</button>
            <button id="auth-toggle" class="btn btn-ghost" data-mode="signin">Créer un compte</button>
          </div>
        </div>
        <div class="auth-image-col">
          <img src="./assets/logo.png" alt="Arcane Bazaar Logo" class="auth-logo" />
        </div>
      </div>
    </div>
  </div>
`;

// Modal de produit
const productModalHTML = `
  <div id="product-modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-backdrop" data-close="modal"></div>
    <div class="modal-card">
      <button class="modal-close" data-close="modal" aria-label="Fermer">✕</button>
      <div class="modal-media">
        <img id="modal-image" src="assets/placeholder.svg" alt="Image produit" />
      </div>
      <div class="modal-body">
        <div class="modal-headline">
          <h3 id="modal-title"></h3>
          <div class="badges">
            <span id="modal-rarity" class="badge"></span>
            <span id="modal-element" class="badge"></span>
          </div>
        </div>
        <p id="modal-short" class="muted"></p>
        <div class="stats">
          <div class="stat"><span>Puissance</span>
            <div class="bar">
              <div id="bar-power" class="fill"></div>
            </div>
          </div>
          <div class="stat"><span>Finesse</span>
            <div class="bar">
              <div id="bar-finesse" class="fill"></div>
            </div>
          </div>
        </div>
        <div class="price-row">
          <span id="modal-price" class="price"></span>
          <button class="btn btn-primary" id="modal-action">Concocter cet élixir</button>
        </div>
        <div class="flavor" id="flavor-section">
          <h4>Profil de saveurs</h4>
          <dl class="flavor-grid">
            <dt>Type</dt>
            <dd id="modal-flavor-type"></dd>
            <dt>Profil</dt>
            <dd id="modal-flavor-profile"></dd>
            <dt>Notes de dégustation</dt>
            <dd id="modal-tasting-notes"></dd>
            <dt>Couleur</dt>
            <dd id="modal-color"></dd>
            <dt>Accords mets</dt>
            <dd id="modal-food-pairing"></dd>
            <dt>Cocktail signature</dt>
            <dd id="modal-signature-cocktail"></dd>
          </dl>
        </div>
        <div class="long-desc">
          <h4>Détails</h4>
          <p id="modal-long"></p>
        </div>
      </div>
    </div>
  </div>
`;

// Fonction pour injecter les composants dans le DOM
function injectComponents() {
  // Vérifier que le body existe
  if (!document.body) {
    console.error('components.js: document.body n\'existe pas encore');
    return;
  }

  // Injecter le header au début du body
  const headerContainer = document.createElement('div');
  headerContainer.innerHTML = headerHTML;
  document.body.insertBefore(headerContainer.firstElementChild, document.body.firstChild);

  // Injecter les modaux à la fin du body
  const modalsContainer = document.createElement('div');
  modalsContainer.innerHTML = authModalHTML + productModalHTML;
  while (modalsContainer.firstChild) {
    document.body.appendChild(modalsContainer.firstChild);
  }

  console.log('components.js: Header et modaux injectés avec succès');
}

// Injection immédiate - le script est chargé dans le body donc document.body existe déjà
injectComponents();
