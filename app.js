// Importar Firebase y los módulos necesarios desde el CDN oficial
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBT1sruTOxxnmo7iqm7XhL9RzjRGqT1k68",
  authDomain: "simple-cosmetica-natural.firebaseapp.com",
  projectId: "simple-cosmetica-natural",
  storageBucket: "simple-cosmetica-natural.firebasestorage.app",
  messagingSenderId: "198936803183",
  appId: "1:198936803183:web:cd27aac9e911233cbe1a9a"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ── ESTADO DEL CARRITO Y DATOS ────────────────────────
let cart = [];
let allProductsCache = []; // Guardamos los productos en memoria para el panel admin

// ── CARGAR PRODUCTOS DESDE FIRESTORE ──────────────────
async function loadProducts() {
  const catalogContainer = document.getElementById('catalog-container');
  if (!catalogContainer) return;

  catalogContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">Cargando catálogo... 🌿</div>';

  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    let productsByCategory = {};
    allProductsCache = []; // Limpiar caché

    querySnapshot.forEach((docSnap) => {
      const prodId = docSnap.id;
      const data = docSnap.data();
      const cat = data.category || 'otros';
      
      const productObj = { id: prodId, ...data };
      allProductsCache.push(productObj);

      if (!productsByCategory[cat]) {
        productsByCategory[cat] = [];
      }
      productsByCategory[cat].push(productObj);
    });

    renderCatalog(productsByCategory);
    renderAdminProductsList(); // Actualizar panel admin si está abierto
  } catch (error) {
    console.error("Error al cargar productos:", error);
    catalogContainer.innerHTML = '<div style="text-align:center;padding:40px;color:red;">Error al cargar los productos. Verificá tu conexión.</div>';
  }
}

// ── RENDERIZAR EL CATÁLOGO EN EL HTML ─────────────────
function renderCatalog(categoriesObj) {
  const catalogContainer = document.getElementById('catalog-container');
  catalogContainer.innerHTML = '';

  const categoryNames = {
    cabello: "Cabello",
    rostro: "Rostro",
    cuerpo: "Cuerpo",
    maquillaje: "Maquillaje",
    promo: "Promos & Combos",
    otros: "Otros"
  };

  for (const [catId, products] of Object.entries(categoriesObj)) {
    const sectionHtml = `
      <section class="catalog-section" data-section="${catId}">
        <div class="section-header">
          <h2 class="section-title"><em>${categoryNames[catId] || catId}</em></h2>
          <span class="section-count">${products.length} productos</span>
        </div>
        <div class="product-grid">
          ${products.map(p => createProductCard(p)).join('')}
        </div>
      </section>
    `;
    catalogContainer.innerHTML += sectionHtml;
  }
}

// ── CREAR CADA TARJETA DE PRODUCTO ────────────────────
function createProductCard(p) {
  const isFamily = p.isFamily && p.variants && p.variants.length > 0;

  if (isFamily) {
    const firstVariant = p.variants[0];
    return `
      <div class="product-card family-card" data-product-id="${p.id}">
        <div class="card-img">
          <img src="${firstVariant.image || p.defaultImage}" alt="${p.name}" onerror="this.parentElement.innerHTML='<div class=\'card-img-placeholder\'><span>🫙</span>${p.name}</div>'" />
          <span class="card-badge">${p.badge || 'Natural'}</span>
        </div>
        <div class="card-body">
          <div class="card-name">${p.name}</div>
          <div class="card-desc">${p.description || ''}</div>
          <div class="card-ingredients variant-ingredients">
            <strong>Ingredientes / Indicaciones</strong>
            <span class="ingredient-text">${firstVariant.ingredients || p.ingredients || 'Producto artesanal.'}</span>
          </div>
          <button class="variants-toggle" onclick="toggleVariants(this)">
            Ver variantes (${p.variants.length}) <span class="arrow">▼</span>
          </button>
          <div class="variants-list">
            ${p.variants.map((v, idx) => `
              <div class="variant-row" onclick="selectVariant(this, '${p.id}',${idx}, '${v.image \vert{}\vert{} p.defaultImage}', '${v.name}', ${v.price}, '${v.ingredients || ''}')">
                <span class="variant-row-name ${idx === 0 ? 'active-variant' : ''}">• ${v.name}</span>                 <span class="variant-row-price">$${v.price.toLocaleString('es-AR')}</span>
                <button class="btn-variant-add" onclick="event.stopPropagation(); addToCart('${p.name} — ${v.name}',${v.price})">+</button>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="card-footer">
          <div class="card-price variant-price-display">$${firstVariant.price.toLocaleString('es-AR')} <small>c/u</small></div>
        </div>
      </div>
    `;
  } else {
    return `
      <div class="product-card" data-product-id="${p.id}">
        <div class="card-img">
          <img src="${p.defaultImage}" alt="${p.name}" onerror="this.parentElement.innerHTML='<div class=\'card-img-placeholder\'><span>🌿</span>${p.name}</div>'" />
          <span class="card-badge">${p.badge || 'Natural'}</span>
        </div>
        <div class="card-body">
          <div class="card-name">${p.name}</div>
          <div class="card-desc">${p.description || ''}</div>
          <div class="card-ingredients"><strong>Ingredientes</strong> ${p.ingredients || ''}</div>
        </div>
        <div class="card-footer">
          <div class="card-price">$${(p.price || 0).toLocaleString('es-AR')}</div>
          <button class="btn-add" onclick="addToCart('${p.name}', ${p.price || 0})">Agregar</button>
        </div>
      </div>
    `;
  }
}

// ── SELECCIONAR VARIANTE ──────────────────────────────
window.selectVariant = function(rowElement, productId, variantIdx, imageUrl, variantName, variantPrice, variantIngredients) {
  const card = rowElement.closest('.product-card');
  const imgElement = card.querySelector('.card-img img');
  if (imgElement) imgElement.src = imageUrl;

  const priceElement = card.querySelector('.variant-price-display');
  if (priceElement) priceElement.innerHTML = `$${variantPrice.toLocaleString('es-AR')} <small>c/u</small>`;

  const ingElement = card.querySelector('.variant-ingredients .ingredient-text');
  if (ingElement) ingElement.textContent = variantIngredients || 'Producto artesanal.';

  card.querySelectorAll('.variant-row-name').forEach(el => el.classList.remove('active-variant'));
  rowElement.querySelector('.variant-row-name').classList.add('active-variant');
};

// ── GESTIÓN DEL CARRITO ──────────────────────────────
window.addToCart = function(name, price) {
  const existing = cart.find(i => i.name === name);
  if (existing) existing.qty++;
  else cart.push({ name, price, qty: 1 });
  updateCartUI();
  showToast('✓ ' + name.split(' ').slice(0, 3).join(' ') + ' agregado');
};

function updateCartUI() {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const countEl = document.getElementById('cartCount');
  const totalEl = document.getElementById('cartTotal');
  const itemsEl = document.getElementById('cartItems');

  if (countEl) countEl.textContent = cart.reduce((s, i) => s + i.qty, 0);
  if (totalEl) totalEl.textContent = '$' + total.toLocaleString('es-AR');
  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px 0;font-size:.9rem;">Tu carrito está vacío 🛍️</div>';
    return;
  }

  itemsEl.innerHTML = cart.map((item, idx) => `
    <div style="display:flex;align-items:center;gap:12px;background:var(--pink);border-radius:12px;padding:12px 14px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:.82rem;font-weight:600;color:var(--dark);line-height:1.3;">${item.name}</div>
        <div style="font-size:.75rem;color:var(--muted);">$${item.price.toLocaleString('es-AR')} c/u</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button onclick="changeQty(${idx},-1)" style="width:26px;height:26px;border-radius:50%;border:1.5px solid var(--pink-mid);background:white;cursor:pointer;font-size:.9rem;display:flex;align-items:center;justify-content:center;color:var(--pink-btn);">−</button>
        <span style="font-weight:700;font-size:.88rem;color:var(--dark);min-width:16px;text-align:center;">${item.qty}</span>
        <button onclick="changeQty(${idx},1)" style="width:26px;height:26px;border-radius:50%;border:1.5px solid var(--pink-mid);background:white;cursor:pointer;font-size:.9rem;display:flex;align-items:center;justify-content:center;color:var(--pink-btn);">+</button>
      </div>
      <div style="font-weight:700;font-size:.88rem;color:var(--pink-btn);min-width:55px;text-align:right;">$${(item.price * item.qty).toLocaleString('es-AR')}</div>
    </div>
  `).join('');
}

window.changeQty = function(idx, delta) {
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  updateCartUI();
};

window.clearCart = function() {
  cart = [];
  updateCartUI();
};

window.toggleCart = function() {
  const m = document.getElementById('cartModal');
  if (m) {
    m.style.display = m.style.display === 'none' ? 'block' : 'none';
    if (m.style.display === 'block') updateCartUI();
  }
};

window.closeCartOutside = function(e) {
  if (e.target === document.getElementById('cartModal')) toggleCart();
};

window.checkout = function() {
  if (cart.length === 0) return;
  const msg = '¡Hola! Me gustaría encargar:%0A%0A' +
    cart.map(i => `• ${i.name} x${i.qty} — $${(i.price * i.qty).toLocaleString('es-AR')}`).join('%0A') +
    '%0A%0A*Total: $' + cart.reduce((s, i) => s + i.price * i.qty, 0).toLocaleString('es-AR') + '*';
  window.open('https://wa.me/5493433005288?text=' + msg, '_blank');
};

// ── TOAST NOTIFICATIONS ───────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── VARIANTS ACCORDION TOGGLE ─────────────────────────
window.toggleVariants = function(btn) {
  btn.classList.toggle('open');
  const list = btn.nextElementSibling;
  if (list) list.classList.toggle('open');
};

// ── NAV FILTER ────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;

    document.querySelectorAll('[data-section]').forEach(el => {
      if (filter === 'all' || el.dataset.section === filter) {
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    });
  });
});


// ── 🔐 LÓGICA DEL PANEL DE ADMINISTRACIÓN Y AUTENTICACIÓN ──

window.toggleAdminModal = function() {
  const modal = document.getElementById('adminModal');
  if (modal) {
    modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
  }
};

window.closeAdminOutside = function(e) {
  if (e.target === document.getElementById('adminModal')) toggleAdminModal();
};

// Escuchar cambios de estado de autenticación en Firebase
onAuthStateChanged(auth, (user) => {
  const loginView = document.getElementById('adminLoginView');
  const dashView = document.getElementById('adminDashboardView');
  
  if (user) {
    // Está logueado
    if (loginView) loginView.style.display = 'none';
    if (dashView) dashView.style.display = 'block';
    renderAdminProductsList();
  } else {
    // No está logueado
    if (loginView) loginView.style.display = 'block';
    if (dashView) dashView.style.display = 'none';
  }
});

// Iniciar sesión
window.loginAdmin = async function() {
  const email = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;
  const errorEl = document.getElementById('loginError');

  try {
    errorEl.textContent = '';
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Error de login:", error);
    errorEl.textContent = "Credenciales incorrectas o error de acceso.";
  }
};

// Cerrar sesión
window.logoutAdmin = async function() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error al salir:", error);
  }
};

// Alternar campo de precio vs aviso de familia en el form
window.toggleVariantInputMode = function(checkbox) {
  const priceContainer = document.getElementById('simplePriceContainer');
  const familyNotice = document.getElementById('familyNoticeContainer');
  if (checkbox.checked) {
    priceContainer.style.display = 'none';
    familyNotice.style.display = 'block';
  } else {
    priceContainer.style.display = 'block';
    familyNotice.style.display = 'none';
  }
};

// Agregar producto simple o familia vacía desde el panel
window.handleAddNewProduct = async function(e) {
  e.preventDefault();
  
  const name = document.getElementById('newProdName').value;
  const category = document.getElementById('newProdCategory').value;
  const badge = document.getElementById('newProdBadge').value || 'Natural';
  const description = document.getElementById('newProdDesc').value;
  const defaultImage = document.getElementById('newProdImage').value || 'img/placeholder.jpg';
  const isFamily = document.getElementById('newProdIsFamily').checked;

  let newProductData = {
    name,
    category,
    badge,
    description,
    defaultImage,
    isFamily
  };

  if (isFamily) {
    newProductData.variants = [
      { name: "Variante Principal", price: 10000, image: defaultImage, ingredients: "Ingredientes naturales." }
    ];
  } else {
    newProductData.price = Number(document.getElementById('newProdPrice').value) || 0;
  }

  try {
    await addDoc(collection(db, "products"), newProductData);
    showToast('✓ Producto guardado en Firestore');
    document.getElementById('addProductForm').reset();
    document.getElementById('simplePriceContainer').style.display = 'block';
    document.getElementById('familyNoticeContainer').style.display = 'none';
    loadProducts(); // Recargar catálogo y lista admin
  } catch (error) {
    console.error("Error al guardar:", error);
    alert("Error al guardar el producto. Verificá tus permisos de Firestore.");
  }
};

// Renderizar la lista de administración para borrar
function renderAdminProductsList() {
  const listEl = document.getElementById('adminProductsList');
  if (!listEl) return;

  if (allProductsCache.length === 0) {
    listEl.innerHTML = '<div style="font-size:0.8rem;color:var(--muted);text-align:center;padding:10px;">No hay productos cargados.</div>';
    return;
  }

  listEl.innerHTML = allProductsCache.map(p => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:white; border:1px solid #eee; padding:8px 12px; border-radius:8px;">
      <div style="font-size:0.85rem; font-weight:600; color:var(--dark);">${p.name} <span style="font-weight:normal;color:var(--muted);font-size:0.75rem;">(${p.category})</span></div>
      <button onclick="deleteProduct('${p.id}')" style="background:#ffebee; color:#c62828; border:none; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:600;">Eliminar</button>
    </div>
  `).join('');
}

// Eliminar producto de Firestore
window.deleteProduct = async function(productId) {
  if (!confirm("¿Estás segura de que querés eliminar este producto?")) return;

  try {
    await deleteDoc(doc(db, "products", productId));
    showToast('🗑️ Producto eliminado');
    loadProducts();
  } catch (error) {
    console.error("Error al eliminar:", error);
    alert("No se pudo eliminar el producto.");
  }
};

// ── INICIALIZAR AL CARGAR LA PÁGINA ───────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  updateCartUI();
});
