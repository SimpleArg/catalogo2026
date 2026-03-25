/* ========================================
   SIMPLE - COSMÉTICOS NATURALES
   Script Principal — v2.0

   ARQUITECTURA:
   · catalog.productos  → array de familias y productos simples
     - tipo_producto: "familia" → tiene .variantes[]
     - tipo_producto: "simple"  → tiene .precio directamente
   · catalog.promociones → array de promos con productos_requeridos
     (IDs de variantes o productos simples)
   · cart → items: { cartKey, id, varianteId?, nombre, precio, descuento, quantity }
   · Detección de promos: automática al actualizar UI del carrito.
     Si todos los componentes de una promo activa están en el carrito →
     se aplica el descuento y se muestra en el resumen del carrito y en WhatsApp.
   ======================================== */

/* === CONFIGURACIÓN === */
const CONFIG = {
    adminPassword: "simple2025",
    storageKey: "simple-catalog-v2",
    cartKey: "simple-cart-v2",
    github: {
        repo: "Alu96hub/Simple",
        branch: "main",
        productsPath: "data/products.json",
        token: ""
    }
};

/* === ESTADO GLOBAL === */
let catalog = { productos: [], promociones: [] };
let cart = [];
let isAdmin = false;
let currentCategory = 'todos';
let domCache = {};

/* === UTILIDADES === */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function formatPrice(price) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS', minimumFractionDigits: 0
    }).format(price).replace('ARS', '$');
}

function nextId(arr) {
    return arr.length > 0 ? Math.max(...arr.map(x => x.id)) + 1 : 1;
}

/* === CACHE DOM === */
function cacheDOM() {
    domCache = {
        productsContainer:   document.getElementById('products-container'),
        cartCount:           document.getElementById('cart-count'),
        cartDropdown:        document.getElementById('cart-dropdown'),
        cartItemsContainer:  document.getElementById('cart-items'),
        cartTotalElement:    document.getElementById('cart-total-price'),
        cartPromoSummary:    document.getElementById('cart-promo-summary'),
        checkoutModal:       document.getElementById('checkout-modal'),
        notification:        document.getElementById('notification'),
        adminPanel:          document.getElementById('admin-panel'),
        adminProductsList:   document.getElementById('admin-products-list'),
        adminPromosList:     document.getElementById('admin-promos-list'),
        offersSection:       document.getElementById('offers-section'),
        offersContainer:     document.getElementById('offers-container'),
        filterBtns:          document.querySelectorAll('.filter-btn')
    };
}

/* ============================================================
   CARGA / GUARDADO DE DATOS
   ============================================================ */
async function loadCatalog() {
    if (CONFIG.github.token && CONFIG.github.repo) {
        try {
            const url = `https://raw.githubusercontent.com/${CONFIG.github.repo}/${CONFIG.github.branch}/${CONFIG.github.productsPath}`;
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
                catalog = await res.json();
                saveToLocalStorage();
                return;
            }
        } catch (e) { console.log('GitHub no disponible, usando localStorage'); }
    }
    const local = localStorage.getItem(CONFIG.storageKey);
    if (local) {
        try { catalog = JSON.parse(local); } catch(e) { catalog = { productos: [], promociones: [] }; }
    }
}

function saveToLocalStorage() {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(catalog)); } catch(e) {}
}

async function commitToGitHub() {
    if (!CONFIG.github.token) return false;
    const url = `https://api.github.com/repos/${CONFIG.github.repo}/contents/${CONFIG.github.productsPath}`;
    let sha = '';
    try {
        const r = await fetch(url, { headers: { 'Authorization': `token ${CONFIG.github.token}`, 'Accept': 'application/vnd.github.v3+json' }});
        if (r.ok) sha = (await r.json()).sha;
    } catch(e) {}
    const body = {
        message: `Update catalogo ${new Date().toLocaleString('es-AR')}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(catalog, null, 2)))),
        branch: CONFIG.github.branch
    };
    if (sha) body.sha = sha;
    try {
        const r = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${CONFIG.github.token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return r.ok;
    } catch(e) { return false; }
}

function persistCatalog() {
    saveToLocalStorage();
    commitToGitHub();
}

/* ============================================================
   HELPERS DE ACCESO AL CATÁLOGO
   ============================================================ */
function getActiveProducts() {
    return catalog.productos.filter(p => p.activo !== false);
}

function findVariantById(varianteId) {
    for (const p of catalog.productos) {
        if (p.tipo_producto === 'familia' && p.variantes) {
            const v = p.variantes.find(v => v.id === varianteId);
            if (v) return { producto: p, variante: v };
        }
    }
    return null;
}

function itemEffectivePrice(item) {
    const d = item.descuento || 0;
    return d > 0 ? item.precio * (1 - d / 100) : item.precio;
}

/* ============================================================
   DETECCIÓN DE PROMOS APLICABLES AL CARRITO
   ============================================================ */
function detectApplicablePromos() {
    const activePromos = (catalog.promociones || []).filter(p => p.activa);
    const applied = [];
    for (const promo of activePromos) {
        const required = promo.productos_requeridos || [];
        let allPresent = true;
        const matchedItems = [];
        for (const reqId of required) {
            const found = cart.find(item => item.varianteId === reqId || (item.varianteId === null && item.id === reqId));
            if (!found) { allPresent = false; break; }
            matchedItems.push(found);
        }
        if (!allPresent) continue;
        const basePrice = matchedItems.reduce((sum, item) => sum + item.precio, 0);
        let descuentoMonto = 0;
        if (promo.regla_descuento.tipo === 'porcentaje') {
            descuentoMonto = basePrice * (promo.regla_descuento.valor / 100);
        } else if (promo.regla_descuento.tipo === 'fijo') {
            descuentoMonto = promo.regla_descuento.valor;
        }
        applied.push({ promo, descuentoMonto, matchedItems });
    }
    return applied;
}

/* ============================================================
   RENDERIZADO DE OFERTAS (sección pública)
   ============================================================ */
function renderOffers() {
    const section = domCache.offersSection;
    const container = domCache.offersContainer;
    if (!section || !container) return;

    const activePromos = (catalog.promociones || []).filter(p => p.activa).slice(0, 3);
    if (activePromos.length === 0) { section.style.display = 'none'; return; }

    section.style.display = 'block';
    container.innerHTML = '';

    activePromos.forEach(promo => {
        let originalPrice = 0;
        const componentNames = [];
        for (const reqId of (promo.productos_requeridos || [])) {
            const fv = findVariantById(reqId);
            if (fv) {
                originalPrice += fv.variante.precio;
                componentNames.push(`${fv.producto.nombre} — ${fv.variante.nombre}`);
            } else {
                const sp = catalog.productos.find(p => p.id === reqId);
                if (sp) { originalPrice += sp.precio || 0; componentNames.push(sp.nombre); }
            }
        }
        let discountedPrice = originalPrice;
        if (promo.regla_descuento.tipo === 'porcentaje') {
            discountedPrice = originalPrice * (1 - promo.regla_descuento.valor / 100);
        } else if (promo.regla_descuento.tipo === 'fijo') {
            discountedPrice = originalPrice - promo.regla_descuento.valor;
        }

        const card = document.createElement('div');
        card.className = 'offer-card';
        card.innerHTML = `
            <div class="offer-badge">-${promo.regla_descuento.valor}${promo.regla_descuento.tipo === 'porcentaje' ? '%' : '$'}</div>
            <div class="offer-icon">🎁</div>
            <h4 class="offer-name">${promo.nombre}</h4>
            <p class="offer-description">${promo.descripcion}</p>
            <div class="offer-components">
                ${componentNames.map(n => `<span class="offer-component-tag">${n}</span>`).join('')}
            </div>
            <div class="offer-pricing">
              de <span class="offer-original">${formatPrice(originalPrice)}</span>
               a <span class="offer-final">${formatPrice(discountedPrice)}</span>
            </div>
            <p class="offer-hint">💡 Agregá los productos al carrito para obtener el descuento automáticamente</p>
        `;
        container.appendChild(card);
    });
}

/* ============================================================
   RENDERIZADO DE PRODUCTOS (tienda pública)
   ============================================================ */
const categoryColors = {
    'cabello': '#2E8B57', 'rostro': '#4682B4', 'cuerpo': '#8B4513',
    'maquillaje': '#DDA0DD', 'otros': '#666666'
};

const debouncedRender = debounce(renderProducts, 100);

function renderProducts(category) {
    currentCategory = category || 'todos';
    const container = domCache.productsContainer;
    if (!container) return;

    const active = getActiveProducts();
    const filtered = currentCategory === 'todos'
        ? active
        : active.filter(p => p.categoria === currentCategory);

    filtered.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-msg">No se encontraron productos en esta categoría ✨</p>';
        return;
    }

    const fallbackImg = "https://via.placeholder.com/300x300/f8f8f8/FF69B4?text=Simple";
    const fragment = document.createDocumentFragment();

    filtered.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.id = product.id;

        const catColor = categoryColors[product.categoria] || '#666';
        const imgPath = `assets/productos/${product.imagen || product.image || 'placeholder.jpg'}`;

        // Precio base a mostrar
        let displayPrice = product.precio || 0;
        if (product.tipo_producto === 'familia' && product.variantes?.length > 0) {
            const first = product.variantes.find(v => v.activo !== false);
            if (first) displayPrice = first.precio;
        }

        const descuento = product.descuento || 0;

        // Badge descuento
        const discountBadge = descuento > 0
            ? `<span class="product-discount-badge">-${descuento}%</span>` : '';

        // HTML precio
        const priceHTML = descuento > 0
            ? `<p class="product-price">
                <span class="price-original">${formatPrice(displayPrice)}</span>
                <span class="price-final">${formatPrice(displayPrice * (1 - descuento / 100))}</span>
               </p>`
            : `<p class="product-price">${formatPrice(displayPrice)}</p>`;

        // Selector de variantes
        let variantSelector = '';
        if (product.tipo_producto === 'familia' && product.variantes?.length > 0) {
            const activeV = product.variantes.filter(v => v.activo !== false);
            if (activeV.length > 0) {
                variantSelector = `
                    <div class="variant-selector">
                        <label for="variant-${product.id}">Variante:</label>
                        <select id="variant-${product.id}" class="variant-select" data-product-id="${product.id}">
                            ${activeV.map(v =>
                                `<option value="${v.id}" data-price="${v.precio}">${v.nombre}</option>`
                            ).join('')}
                        </select>
                    </div>`;
            }
        }

        const notaHTML = product.nota_cliente
            ? `<p class="product-note"><i class="fas fa-info-circle"></i> ${product.nota_cliente}</p>` : '';

        card.innerHTML = `
            <div class="product-img">
                <span class="product-category" style="background:${catColor}">${product.categoria.toUpperCase()}</span>
                ${discountBadge}
                <img src="${imgPath}" alt="${product.nombre}" loading="lazy"
                     onerror="this.src='${fallbackImg}'; this.onerror=null;">
            </div>
            <div class="product-content">
                <h3 class="product-title">${product.nombre}</h3>
                ${priceHTML}
                ${variantSelector}
                ${notaHTML}
                <button class="btn-add-cart" data-id="${product.id}">
                    <i class="fas fa-cart-plus"></i> Agregar
                </button>
            </div>
        `;
        fragment.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(fragment);

    // Botones agregar
    container.querySelectorAll('.btn-add-cart').forEach(btn => {
        btn.onclick = (e) => { e.stopPropagation(); addToCart(parseInt(btn.dataset.id)); };
    });

    // Actualizar precio al cambiar variante
    container.querySelectorAll('.variant-select').forEach(sel => {
        sel.onchange = () => {
            const opt = sel.options[sel.selectedIndex];
            const priceEl = sel.closest('.product-card')?.querySelector('.product-price');
            if (priceEl) priceEl.textContent = formatPrice(parseFloat(opt.dataset.price));
        };
    });
}

/* ============================================================
   CARRITO
   ============================================================ */
function addToCart(productId) {
    const product = catalog.productos.find(p => p.id === productId);
    if (!product) return;

    let nombre, precio, varianteId = null, cartKey, descuento = 0;

    if (product.tipo_producto === 'familia') {
        const select = document.getElementById(`variant-${productId}`);
        const selId = select ? parseInt(select.value) : null;
        const variant = selId
            ? product.variantes.find(v => v.id === selId)
            : product.variantes.find(v => v.activo !== false);
        if (!variant) { showNotification('Seleccioná una variante'); return; }
        varianteId = variant.id;
        nombre = `${product.nombre} — ${variant.nombre}`;
        precio = variant.precio;
        descuento = variant.descuento || product.descuento || 0;
        cartKey = `familia-${variant.id}`;
    } else {
        nombre = product.nombre;
        precio = product.precio;
        descuento = product.descuento || 0;
        cartKey = `simple-${product.id}`;
    }

    const existing = cart.find(item => item.cartKey === cartKey);
    if (existing) { existing.quantity++; }
    else { cart.push({ cartKey, id: productId, varianteId, nombre, precio, descuento, quantity: 1 }); }

    saveCart(); updateCartUI();
    showNotification(`¡${nombre} agregado! 🛍️`);
    const cartIcon = document.querySelector('.cart-icon-container');
    if (cartIcon) {
        cartIcon.style.transform = 'scale(1.2)';
        setTimeout(() => cartIcon.style.transform = 'scale(1)', 150);
    }
}

function removeFromCart(cartKey) {
    cart = cart.filter(item => item.cartKey !== cartKey);
    saveCart(); updateCartUI();
    showNotification('Producto eliminado del carrito');
}

function saveCart() {
    try { localStorage.setItem(CONFIG.cartKey, JSON.stringify(cart)); } catch(e) {}
}

function loadCart() {
    try {
        const saved = localStorage.getItem(CONFIG.cartKey);
        cart = saved ? JSON.parse(saved) : [];
    } catch(e) { cart = []; }
}

function updateCartUI() {
    const { cartCount, cartItemsContainer, cartTotalElement, cartPromoSummary } = domCache;
    if (!cartCount || !cartItemsContainer || !cartTotalElement) return;

    const totalCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    if (cartCount.textContent != totalCount) {
        cartCount.style.transform = 'scale(1.3)';
        setTimeout(() => cartCount.style.transform = 'scale(1)', 150);
    }
    cartCount.textContent = totalCount;
    cartCount.style.display = totalCount > 0 ? 'flex' : 'none';

    cartItemsContainer.innerHTML = '';

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Tu carrito está vacío ✨</p>';
        if (cartPromoSummary) cartPromoSummary.style.display = 'none';
        cartTotalElement.textContent = formatPrice(0);
        return;
    }

    const appliedPromos = detectApplicablePromos();
    const totalPromoDiscount = appliedPromos.reduce((sum, ap) => sum + ap.descuentoMonto, 0);
    const subtotal = cart.reduce((acc, item) => acc + itemEffectivePrice(item) * item.quantity, 0);
    const total = subtotal - totalPromoDiscount;

    const fragment = document.createDocumentFragment();
    cart.forEach(item => {
        const unitPrice = itemEffectivePrice(item);
        const itemTotal = unitPrice * item.quantity;
        const el = document.createElement('div');
        el.className = 'cart-item';
        const priceDisplay = item.descuento > 0
            ? `<span class="cart-price-original">${formatPrice(item.precio)}</span> ${formatPrice(unitPrice)}`
            : formatPrice(unitPrice);
        el.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.nombre}</h4>
                <p>${item.quantity} × ${priceDisplay} = <strong>${formatPrice(itemTotal)}</strong></p>
            </div>
            <i class="fas fa-trash remove-item" data-key="${item.cartKey}" title="Eliminar"></i>
        `;
        fragment.appendChild(el);
    });
    cartItemsContainer.appendChild(fragment);

    cartItemsContainer.querySelectorAll('.remove-item').forEach(btn => {
        btn.onclick = (e) => { e.stopPropagation(); removeFromCart(btn.dataset.key); };
    });

    // Resumen promos en carrito
    if (cartPromoSummary) {
        if (appliedPromos.length > 0) {
            cartPromoSummary.style.display = 'block';
            cartPromoSummary.innerHTML = appliedPromos.map(ap => `
                <div class="promo-applied">
                    <span>🎉 <strong>${ap.promo.nombre}</strong></span>
                    <span class="promo-discount-amount">-${formatPrice(ap.descuentoMonto)}</span>
                </div>
            `).join('');
        } else {
            cartPromoSummary.style.display = 'none';
        }
    }

    cartTotalElement.textContent = formatPrice(total);
}

/* ============================================================
   NOTIFICACIONES
   ============================================================ */
function showNotification(msg) {
    const notif = domCache.notification;
    if (!notif) return;
    notif.textContent = msg;
    notif.classList.remove('show');
    void notif.offsetWidth;
    notif.classList.add('show');
    setTimeout(() => notif.classList.remove('show'), 3000);
}

/* ============================================================
   CHECKOUT / WHATSAPP
   ============================================================ */
function closeModal() {
    if (domCache.checkoutModal) domCache.checkoutModal.style.display = 'none';
    document.getElementById('checkout-form')?.reset();
}

function processWhatsAppOrder(e) {
    e.preventDefault();
    const name    = document.getElementById('customer-name')?.value.trim();
    const address = document.getElementById('customer-address')?.value.trim();
    const comments= document.getElementById('customer-comments')?.value.trim();
    if (!name || !address) { showNotification('Completá nombre y dirección'); return; }

    const appliedPromos = detectApplicablePromos();
    const totalPromoDiscount = appliedPromos.reduce((sum, ap) => sum + ap.descuentoMonto, 0);
    const subtotal = cart.reduce((acc, item) => acc + itemEffectivePrice(item) * item.quantity, 0);
    const total = subtotal - totalPromoDiscount;

    let message = `Hola Simple! Quiero realizar un pedido:\n\n`;
    cart.forEach(item => {
        const unitPrice = itemEffectivePrice(item);
        const descLabel = item.descuento > 0 ? ` (${item.descuento}% OFF)` : '';
        message += `* ${item.quantity} x ${item.nombre}${descLabel} - ${formatPrice(unitPrice * item.quantity)}\n`;
    });
    if (appliedPromos.length > 0) {
        message += `\nDescuentos por kit aplicados:\n`;
        appliedPromos.forEach(ap => {
            message += `  - ${ap.promo.nombre}: -${formatPrice(ap.descuentoMonto)}\n`;
        });
    }
    message += `\nTOTAL: ${formatPrice(total)}\n\n`;
    message += `Datos:\nNombre: ${name}\nDireccion: ${address}\n`;
    if (comments) message += `Nota: ${comments}\n`;
    message += `\nZona: Consultar disponibilidad`;

    cart = []; saveCart(); updateCartUI(); closeModal();
    window.open(`https://wa.me/5493434747844?text=${encodeURIComponent(message)}`, '_blank');
    showNotification('Redirigiendo a WhatsApp...');
}

/* ============================================================
   ADMIN — PRODUCTOS
   ============================================================ */
function renderAdminProductsList() {
    const container = domCache.adminProductsList;
    if (!container) return;
    container.querySelectorAll('.admin-form').forEach(f => f.remove());

    const sorted = [...catalog.productos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    if (sorted.length === 0) { container.innerHTML = '<p class="empty-msg">No hay productos registrados.</p>'; return; }

    const fragment = document.createDocumentFragment();
    sorted.forEach(product => {
        const el = document.createElement('div');
        el.className = `admin-product-item${product.activo === false ? ' inactive' : ''}`;
        el.dataset.id = product.id;
        const imgPath = `assets/productos/${product.imagen || product.image || 'placeholder.jpg'}`;
        const isFamily = product.tipo_producto === 'familia';
        const varCount = isFamily && product.variantes ? product.variantes.length : 0;
        const descuento = product.descuento || 0;
        el.innerHTML = `
            <img src="${imgPath}" alt="${product.nombre}" loading="lazy"
                 onerror="this.src='https://via.placeholder.com/80?text=IMG'">
            <div class="admin-product-info">
                <h4>${product.nombre}
                    <span class="admin-type-badge">${isFamily ? 'Familia (' + varCount + ' variantes)' : 'Simple'}</span>
                    ${product.activo === false ? '<span class="admin-type-badge inactive-badge">Oculto</span>' : ''}
                    ${descuento > 0 ? '<span class="admin-type-badge discount-badge">-' + descuento + '%</span>' : ''}
                </h4>
                <p><strong>Categoria:</strong> ${product.categoria}</p>
                ${isFamily
                    ? `<div class="admin-variants-list">${(product.variantes || []).map(v =>
                        `<span class="admin-variant-chip${v.activo === false ? ' inactive' : ''}">${v.nombre} - ${formatPrice(v.precio)}</span>`
                      ).join('')}</div>`
                    : `<p><strong>Precio:</strong> ${formatPrice(product.precio || 0)}</p>`
                }
            </div>
            <div class="admin-product-actions">
                <button class="btn-edit" data-id="${product.id}">Editar</button>
                <button class="btn-toggle-vis" data-id="${product.id}">${product.activo === false ? 'Mostrar' : 'Ocultar'}</button>
                <button class="btn-delete" data-id="${product.id}">Eliminar</button>
            </div>
        `;
        fragment.appendChild(el);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
    container.querySelectorAll('.btn-edit').forEach(btn => btn.onclick = () => showEditProductForm(parseInt(btn.dataset.id)));
    container.querySelectorAll('.btn-toggle-vis').forEach(btn => btn.onclick = () => toggleProductVisibility(parseInt(btn.dataset.id)));
    container.querySelectorAll('.btn-delete').forEach(btn => btn.onclick = () => deleteProduct(parseInt(btn.dataset.id)));
}

function toggleProductVisibility(id) {
    const p = catalog.productos.find(p => p.id === id);
    if (!p) return;
    p.activo = p.activo === false ? true : false;
    persistCatalog(); renderAdminProductsList(); renderProducts(currentCategory); renderOffers();
    showNotification(p.activo ? 'Producto visible' : 'Producto oculto');
}

function deleteProduct(id) {
    if (!confirm('Eliminar este producto? No se puede deshacer.')) return;
    catalog.productos = catalog.productos.filter(p => p.id !== id);
    persistCatalog(); renderAdminProductsList(); renderProducts(currentCategory);
    showNotification('Producto eliminado');
}

/* Formulario producto (nuevo y edicion) */
function showAddProductForm() {
    const container = domCache.adminProductsList;
    if (!container) return;
    document.getElementById('admin-product-form')?.remove();
    const form = document.createElement('div');
    form.className = 'admin-form active'; form.id = 'admin-product-form';
    form.innerHTML = buildProductFormHTML(null);
    container.insertBefore(form, container.firstChild);
    initProductFormListeners(form, null);
}

function showEditProductForm(id) {
    const product = catalog.productos.find(p => p.id === id);
    if (!product) return;
    document.getElementById('admin-product-form')?.remove();
    const container = domCache.adminProductsList;
    const targetRow = container.querySelector(`.admin-product-item[data-id="${id}"]`);
    const form = document.createElement('div');
    form.className = 'admin-form active'; form.id = 'admin-product-form';
    form.innerHTML = buildProductFormHTML(product);
    if (targetRow) targetRow.insertAdjacentElement('afterend', form);
    else container.insertBefore(form, container.firstChild);
    initProductFormListeners(form, product);
}

function buildProductFormHTML(product) {
    const isEdit = !!product;
    const tipo = product?.tipo_producto || 'simple';
    const isFamily = tipo === 'familia';
    const categorias = ['cabello', 'rostro', 'cuerpo', 'maquillaje', 'otros'];
    const catOptions = categorias.map(c =>
        `<option value="${c}"${product?.categoria === c ? ' selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`
    ).join('');
    const variantesHTML = isFamily && product?.variantes
        ? product.variantes.map((v) => buildVariantRowHTML(v)).join('') : '';
    return `
        <h4 style="margin-bottom:15px; color:var(--rosa-principal)">${isEdit ? 'Editar Producto' : '+ Nuevo Producto'}</h4>
        <div class="form-row-2">
            <div class="form-group">
                <label>Nombre *</label>
                <input type="text" id="pf-nombre" required value="${product?.nombre || ''}" placeholder="Nombre del producto">
            </div>
            <div class="form-group">
                <label>Categoria *</label>
                <select id="pf-categoria">${catOptions}</select>
            </div>
        </div>
        <div class="form-row-2">
            <div class="form-group">
                <label>Tipo *</label>
                <select id="pf-tipo">
                    <option value="simple"${tipo === 'simple' ? ' selected' : ''}>Simple (sin variantes)</option>
                    <option value="familia"${tipo === 'familia' ? ' selected' : ''}>Familia (con variantes)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Imagen (nombre de archivo)</label>
                <input type="text" id="pf-imagen" placeholder="imagen.jpg" value="${product?.imagen || product?.image || ''}">
            </div>
        </div>
        <div id="pf-simple-fields" style="display:${!isFamily ? 'block' : 'none'}">
            <div class="form-row-2">
                <div class="form-group">
                    <label>Precio *</label>
                    <input type="number" id="pf-precio" min="0" step="100" value="${product?.precio || ''}">
                </div>
                <div class="form-group">
                    <label>Descuento % (0 = sin descuento)</label>
                    <input type="number" id="pf-descuento" min="0" max="100" step="1" value="${product?.descuento || 0}">
                </div>
            </div>
        </div>
        <div id="pf-familia-fields" style="display:${isFamily ? 'block' : 'none'}">
            <div class="form-group">
                <label>Descripcion base</label>
                <input type="text" id="pf-descripcion" value="${product?.descripcion_base || ''}" placeholder="Descripcion general">
            </div>
            <div class="form-row-2">
                <div class="form-group">
                    <label>Nota para el cliente (opcional)</label>
                    <input type="text" id="pf-nota" value="${product?.nota_cliente || ''}" placeholder="Ej: Podes aclarar variante en comentarios">
                </div>
                <div class="form-group">
                    <label>Descuento % general (0 = sin descuento)</label>
                    <input type="number" id="pf-descuento-fam" min="0" max="100" step="1" value="${product?.descuento || 0}">
                </div>
            </div>
            <div class="admin-variants-editor">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <strong>Variantes</strong>
                    <button type="button" class="btn-secondary btn-sm" id="pf-add-variant">+ Agregar Variante</button>
                </div>
                <div id="pf-variants-list">${variantesHTML}</div>
            </div>
        </div>
        <div style="display:flex; gap:10px; margin-top:20px; flex-wrap:wrap;">
            <button type="button" class="btn-primary" id="pf-submit">${isEdit ? 'Guardar Cambios' : 'Crear Producto'}</button>
            <button type="button" class="btn-secondary" id="pf-cancel">Cancelar</button>
        </div>`;
}

function buildVariantRowHTML(variant) {
    const activo = variant?.activo !== false;
    return `
        <div class="variant-row" data-variant-id="${variant?.id || ''}">
            <div class="form-row-3">
                <div class="form-group">
                    <label>Nombre variante *</label>
                    <input type="text" class="vr-nombre" value="${variant?.nombre || ''}" placeholder="Ej: Pelo seco">
                </div>
                <div class="form-group">
                    <label>Precio *</label>
                    <input type="number" class="vr-precio" min="0" step="100" value="${variant?.precio || ''}">
                </div>
                <div class="form-group">
                    <label>Descuento %</label>
                    <input type="number" class="vr-descuento" min="0" max="100" step="1" value="${variant?.descuento || 0}">
                </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px; flex-wrap:wrap;">
                <label style="font-size:0.85rem; display:flex; align-items:center; gap:5px; cursor:pointer;">
                    <input type="checkbox" class="vr-activo" ${activo ? 'checked' : ''}> Visible
                </label>
                <button type="button" class="btn-delete btn-sm vr-remove">Quitar</button>
            </div>
            <hr style="border-color:var(--rosa-borde); margin-bottom:10px;">
        </div>`;
}

function initProductFormListeners(form, existingProduct) {
    const tipoSelect = form.querySelector('#pf-tipo');
    tipoSelect?.addEventListener('change', () => {
        const isFam = tipoSelect.value === 'familia';
        form.querySelector('#pf-simple-fields').style.display = isFam ? 'none' : 'block';
        form.querySelector('#pf-familia-fields').style.display = isFam ? 'block' : 'none';
    });
    form.querySelector('#pf-add-variant')?.addEventListener('click', () => {
        const list = form.querySelector('#pf-variants-list');
        const temp = document.createElement('div');
        temp.innerHTML = buildVariantRowHTML(null);
        const row = temp.firstElementChild;
        list.appendChild(row);
        row.querySelector('.vr-remove')?.addEventListener('click', () => row.remove());
    });
    form.querySelectorAll('.variant-row').forEach(row => {
        row.querySelector('.vr-remove')?.addEventListener('click', () => row.remove());
    });
    form.querySelector('#pf-submit')?.addEventListener('click', () => submitProductForm(form, existingProduct));
    form.querySelector('#pf-cancel')?.addEventListener('click', () => form.remove());
}

function submitProductForm(form, existingProduct) {
    const nombre    = form.querySelector('#pf-nombre')?.value.trim();
    const categoria = form.querySelector('#pf-categoria')?.value;
    const tipo      = form.querySelector('#pf-tipo')?.value;
    const imagen    = form.querySelector('#pf-imagen')?.value.trim() || 'placeholder.jpg';

    if (!nombre) { alert('El nombre es obligatorio'); return; }

    let productData = { nombre, categoria, tipo_producto: tipo, imagen, activo: existingProduct ? existingProduct.activo : true };

    if (tipo === 'simple') {
        const precio   = parseFloat(form.querySelector('#pf-precio')?.value);
        const descuento= parseFloat(form.querySelector('#pf-descuento')?.value) || 0;
        if (isNaN(precio) || precio < 0) { alert('Precio invalido'); return; }
        productData.precio = precio; productData.descuento = descuento;
    } else {
        productData.descripcion_base = form.querySelector('#pf-descripcion')?.value.trim() || '';
        productData.nota_cliente = form.querySelector('#pf-nota')?.value.trim() || null;
        productData.descuento = parseFloat(form.querySelector('#pf-descuento-fam')?.value) || 0;

        // Recolectar variantes desde los campos del formulario
        const variantRows = form.querySelectorAll('.variant-row');
        let maxExistingId = existingProduct?.variantes?.length > 0
            ? Math.max(...existingProduct.variantes.map(v => v.id)) : 1000;
        const variantes = [];

        variantRows.forEach(row => {
            const vNombre   = row.querySelector('.vr-nombre')?.value.trim();
            const vPrecio   = parseFloat(row.querySelector('.vr-precio')?.value);
            const vDescuento= parseFloat(row.querySelector('.vr-descuento')?.value) || 0;
            const vActivo   = row.querySelector('.vr-activo')?.checked !== false;
            const existingId= parseInt(row.dataset.variantId) || null;
            if (!vNombre || isNaN(vPrecio)) return;
            // Si no tiene ID numérico real (nuevo), asignar uno
            const finalId = (existingId && existingId < 1e12) ? existingId : ++maxExistingId;
            variantes.push({ id: finalId, nombre: vNombre, precio: vPrecio, descuento: vDescuento, activo: vActivo });
        });

        if (variantes.length === 0) { alert('Agrega al menos una variante'); return; }
        productData.variantes = variantes;
    }

    if (existingProduct) {
        const idx = catalog.productos.findIndex(p => p.id === existingProduct.id);
        catalog.productos[idx] = { ...existingProduct, ...productData };
        showNotification('Producto actualizado');
    } else {
        productData.id = nextId(catalog.productos);
        catalog.productos.push(productData);
        showNotification('Producto creado');
    }

    persistCatalog(); form.remove();
    renderAdminProductsList(); renderProducts(currentCategory); renderOffers();
}

/* ============================================================
   ADMIN — OFERTAS / PROMOCIONES
   ============================================================ */
function renderAdminPromosList() {
    const container = domCache.adminPromosList;
    if (!container) return;
    container.querySelectorAll('.admin-form').forEach(f => f.remove());

    const promos = catalog.promociones || [];
    if (promos.length === 0) { container.innerHTML = '<p class="empty-msg">No hay ofertas creadas.</p>'; return; }

    const fragment = document.createDocumentFragment();
    promos.forEach(promo => {
        const el = document.createElement('div');
        el.className = `admin-product-item${!promo.activa ? ' inactive' : ''}`;
        el.dataset.promoId = promo.id;

        const discLabel = promo.regla_descuento.tipo === 'porcentaje'
            ? `${promo.regla_descuento.valor}% OFF`
            : `${formatPrice(promo.regla_descuento.valor)} OFF`;

        const compNames = (promo.productos_requeridos || []).map(reqId => {
            const fv = findVariantById(reqId);
            if (fv) return `${fv.producto.nombre} - ${fv.variante.nombre}`;
            const sp = catalog.productos.find(p => p.id === reqId);
            return sp ? sp.nombre : `ID ${reqId}`;
        });

        el.innerHTML = `
            <div style="font-size:2rem;text-align:center;line-height:1">🏷️</div>
            <div class="admin-product-info">
                <h4>${promo.nombre} <span class="admin-type-badge">${discLabel}</span>
                    ${promo.activa ? '' : '<span class="admin-type-badge inactive-badge">Inactiva</span>'}
                </h4>
                <p>${promo.descripcion}</p>
                <p><strong>Componentes:</strong> ${compNames.join(' + ')}</p>
            </div>
            <div class="admin-product-actions">
                <button class="btn-edit" data-promo-id="${promo.id}">Editar</button>
                <button class="btn-toggle-vis" data-promo-id="${promo.id}">${promo.activa ? 'Desactivar' : 'Activar'}</button>
                <button class="btn-delete" data-promo-id="${promo.id}">Eliminar</button>
            </div>`;
        fragment.appendChild(el);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
    container.querySelectorAll('.btn-edit').forEach(btn => btn.onclick = () => showEditPromoForm(parseInt(btn.dataset.promoId)));
    container.querySelectorAll('.btn-toggle-vis').forEach(btn => btn.onclick = () => togglePromoActive(parseInt(btn.dataset.promoId)));
    container.querySelectorAll('.btn-delete').forEach(btn => btn.onclick = () => deletePromo(parseInt(btn.dataset.promoId)));
}

function togglePromoActive(id) {
    const promo = (catalog.promociones || []).find(p => p.id === id);
    if (!promo) return;
    promo.activa = !promo.activa;
    persistCatalog(); renderAdminPromosList(); renderOffers(); updateCartUI();
    showNotification(promo.activa ? 'Oferta activada' : 'Oferta desactivada');
}

function deletePromo(id) {
    if (!confirm('Eliminar esta oferta?')) return;
    catalog.promociones = (catalog.promociones || []).filter(p => p.id !== id);
    persistCatalog(); renderAdminPromosList(); renderOffers(); updateCartUI();
    showNotification('Oferta eliminada');
}

function showAddPromoForm() {
    const container = domCache.adminPromosList;
    if (!container) return;
    document.getElementById('admin-promo-form')?.remove();
    const form = document.createElement('div');
    form.className = 'admin-form active'; form.id = 'admin-promo-form';
    form.innerHTML = buildPromoFormHTML(null);
    container.insertBefore(form, container.firstChild);
    initPromoFormListeners(form, null);
}

function showEditPromoForm(id) {
    const promo = (catalog.promociones || []).find(p => p.id === id);
    if (!promo) return;
    document.getElementById('admin-promo-form')?.remove();
    const container = domCache.adminPromosList;
    const targetRow = container.querySelector(`[data-promo-id="${id}"]`);
    const form = document.createElement('div');
    form.className = 'admin-form active'; form.id = 'admin-promo-form';
    form.innerHTML = buildPromoFormHTML(promo);
    if (targetRow) targetRow.insertAdjacentElement('afterend', form);
    else container.insertBefore(form, container.firstChild);
    initPromoFormListeners(form, promo);
}

function buildSelectableItems() {
    const items = [];
    catalog.productos.forEach(p => {
        if (p.tipo_producto === 'familia' && p.variantes) {
            p.variantes.forEach(v => items.push({ id: v.id, label: `${p.nombre} - ${v.nombre} (${formatPrice(v.precio)})` }));
        } else if (p.tipo_producto === 'simple') {
            items.push({ id: p.id, label: `${p.nombre} (${formatPrice(p.precio || 0)})` });
        }
    });
    return items.sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

function buildPromoFormHTML(promo) {
    const isEdit = !!promo;
    const required = promo?.productos_requeridos || [];
    const items = buildSelectableItems();
    const checkboxes = items.map(item => `
        <label class="promo-item-check">
            <input type="checkbox" class="promo-req-item" value="${item.id}" ${required.includes(item.id) ? 'checked' : ''}>
            ${item.label}
        </label>`).join('');
    const descTipo  = promo?.regla_descuento?.tipo || 'porcentaje';
    const descValor = promo?.regla_descuento?.valor || '';
    return `
        <h4 style="margin-bottom:15px; color:var(--rosa-principal)">${isEdit ? 'Editar Oferta' : '+ Nueva Oferta'}</h4>
        <div class="form-row-2">
            <div class="form-group">
                <label>Nombre *</label>
                <input type="text" id="promo-nombre" value="${promo?.nombre || ''}" placeholder="Ej: Kit Cabello">
            </div>
            <div class="form-group">
                <label>Descripcion</label>
                <input type="text" id="promo-descripcion" value="${promo?.descripcion || ''}" placeholder="Ej: Shampoo + Acondicionador 25% OFF">
            </div>
        </div>
        <div class="form-row-2">
            <div class="form-group">
                <label>Tipo de descuento</label>
                <select id="promo-desc-tipo">
                    <option value="porcentaje"${descTipo === 'porcentaje' ? ' selected' : ''}>Porcentaje (%)</option>
                    <option value="fijo"${descTipo === 'fijo' ? ' selected' : ''}>Monto fijo ($)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Valor del descuento *</label>
                <input type="number" id="promo-desc-valor" min="0" step="1" value="${descValor}" placeholder="Ej: 25">
            </div>
        </div>
        <div class="form-group">
            <label>Productos del kit * <small>(selecciona 2 o mas)</small></label>
            <div class="promo-items-checklist">
                ${checkboxes || '<p style="color:var(--texto-claro)">Primero agrega productos al catalogo.</p>'}
            </div>
        </div>
        <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="promo-activa" ${promo?.activa !== false ? 'checked' : ''}> Oferta activa (visible en la tienda)
            </label>
        </div>
        <div style="display:flex; gap:10px; margin-top:20px; flex-wrap:wrap;">
            <button type="button" class="btn-primary" id="promo-submit">${isEdit ? 'Guardar Cambios' : 'Crear Oferta'}</button>
            <button type="button" class="btn-secondary" id="promo-cancel">Cancelar</button>
        </div>`;
}

function initPromoFormListeners(form, existingPromo) {
    form.querySelector('#promo-submit')?.addEventListener('click', () => submitPromoForm(form, existingPromo));
    form.querySelector('#promo-cancel')?.addEventListener('click', () => form.remove());
}

function submitPromoForm(form, existingPromo) {
    const nombre      = form.querySelector('#promo-nombre')?.value.trim();
    const descripcion = form.querySelector('#promo-descripcion')?.value.trim();
    const descTipo    = form.querySelector('#promo-desc-tipo')?.value;
    const descValor   = parseFloat(form.querySelector('#promo-desc-valor')?.value);
    const activa      = form.querySelector('#promo-activa')?.checked !== false;
    const required    = [];
    form.querySelectorAll('.promo-req-item:checked').forEach(cb => required.push(parseInt(cb.value)));

    if (!nombre) { alert('El nombre es obligatorio'); return; }
    if (isNaN(descValor) || descValor <= 0) { alert('El valor del descuento debe ser mayor a 0'); return; }
    if (required.length < 2) { alert('Selecciona al menos 2 productos para la oferta'); return; }

    if (!catalog.promociones) catalog.promociones = [];
    const promoData = {
        nombre, descripcion: descripcion || nombre,
        tipo: 'descuento_por_kit', productos_requeridos: required,
        regla_descuento: { tipo: descTipo, valor: descValor }, activa
    };

    if (existingPromo) {
        const idx = catalog.promociones.findIndex(p => p.id === existingPromo.id);
        catalog.promociones[idx] = { ...existingPromo, ...promoData };
        showNotification('Oferta actualizada');
    } else {
        promoData.id = nextId(catalog.promociones);
        catalog.promociones.push(promoData);
        showNotification('Oferta creada');
    }

    persistCatalog(); form.remove();
    renderAdminPromosList(); renderOffers(); updateCartUI();
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */
function setupEventListeners() {
    // Filtros de categoria
    domCache.filterBtns?.forEach(btn => {
        btn.addEventListener('click', throttle((e) => {
            domCache.filterBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            debouncedRender(e.currentTarget.dataset.category);
        }, 200));
    });

    // Carrito
    const cartBtn = document.getElementById('cart-btn');
    document.getElementById('close-cart')?.addEventListener('click', () => domCache.cartDropdown?.classList.remove('active'));
    cartBtn?.addEventListener('click', (e) => { e.stopPropagation(); domCache.cartDropdown?.classList.toggle('active'); });
    document.addEventListener('click', (e) => {
        if (domCache.cartDropdown?.classList.contains('active') &&
            !domCache.cartDropdown.contains(e.target) && !cartBtn?.contains(e.target)) {
            domCache.cartDropdown.classList.remove('active');
        }
    });

    // Menu movil
    const menuBtn = document.getElementById('menu-btn');
    const navbar  = document.querySelector('.navbar');
    if (menuBtn && navbar) {
        menuBtn.addEventListener('click', () => {
            navbar.classList.toggle('active');
            const icon = menuBtn.querySelector('i');
            icon?.classList.toggle('fa-bars'); icon?.classList.toggle('fa-times');
        });
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navbar.classList.remove('active');
                const icon = menuBtn.querySelector('i');
                icon?.classList.add('fa-bars'); icon?.classList.remove('fa-times');
            });
        });
    }

    // Checkout
    document.getElementById('checkout-btn')?.addEventListener('click', () => {
        if (cart.length === 0) { showNotification('El carrito esta vacio'); return; }
        domCache.cartDropdown?.classList.remove('active');
        if (domCache.checkoutModal) domCache.checkoutModal.style.display = 'flex';
    });
    document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => btn?.addEventListener('click', closeModal));
    window.addEventListener('click', (e) => { if (e.target === domCache.checkoutModal) closeModal(); });
    document.getElementById('checkout-form')?.addEventListener('submit', processWhatsAppOrder);

    // Admin
    setupAdminListeners();
}

function setupAdminListeners() {
    const adminAccessBtn  = document.getElementById('admin-access-btn');
    const adminLoginModal = document.getElementById('admin-login-modal');
    const closeAdminLogin = document.getElementById('close-admin-login');

    adminAccessBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        if (adminLoginModal) adminLoginModal.style.display = 'flex';
    });
    closeAdminLogin?.addEventListener('click', () => { if (adminLoginModal) adminLoginModal.style.display = 'none'; });
    window.addEventListener('click', (e) => { if (e.target === adminLoginModal) adminLoginModal.style.display = 'none'; });

    document.getElementById('admin-login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('admin-password')?.value;
        if (password === CONFIG.adminPassword) {
            isAdmin = true;
            if (adminLoginModal) adminLoginModal.style.display = 'none';
            if (domCache.adminPanel) domCache.adminPanel.style.display = 'block';
            if (domCache.productsContainer) domCache.productsContainer.style.display = 'none';
            document.querySelector('.categories-filter')?.style.setProperty('display', 'none', 'important');
            document.getElementById('offers-section')?.style.setProperty('display', 'none', 'important');
            renderAdminProductsList(); renderAdminPromosList();
            showNotification('Sesion admin iniciada');
            document.getElementById('admin-password').value = '';
        } else { alert('Contrasena incorrecta'); }
    });

    document.getElementById('logout-admin-btn')?.addEventListener('click', () => {
        isAdmin = false;
        if (domCache.adminPanel) domCache.adminPanel.style.display = 'none';
        if (domCache.productsContainer) domCache.productsContainer.style.display = '';
        document.querySelector('.categories-filter')?.style.removeProperty('display');
        document.getElementById('offers-section')?.style.removeProperty('display');
        debouncedRender(currentCategory); renderOffers();
        showNotification('Sesion cerrada');
    });

    // Pestañas admin
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
        });
    });

    document.getElementById('add-product-btn')?.addEventListener('click', showAddProductForm);
    document.getElementById('add-promo-btn')?.addEventListener('click', showAddPromoForm);
}

/* ============================================================
   INICIALIZACION
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    cacheDOM();
    await loadCatalog();
    loadCart();
    renderProducts('todos');
    renderOffers();
    updateCartUI();
    setupEventListeners();
    console.log('Simple Cosmeticos v2.0 | Productos:', catalog.productos.length, '| Promos:', (catalog.promociones || []).length);
});

window.addToCart    = addToCart;
window.removeFromCart = removeFromCart;
window.deleteProduct  = deleteProduct;
window.deletePromo    = deletePromo;
