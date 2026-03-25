/* ========================================
   SIMPLE - COSMÉTICOS NATURALES
   Script Simplificado v1.0
   
   Este script maneja:
   - Cargar productos desde products.json
   - Mostrar/ocultar carrito
   - Agregar/eliminar productos del carrito
   - Generar pedido por WhatsApp
   ======================================== */

// ========== CONFIGURACIÓN INICIAL ==========
const CONFIG = {
    adminPassword: "simple2025",
    storageKey: "simple-catalog", // Clave para localStorage
    cartKey: "simple-cart", // Clave para guardar carrito
    whatsappNumber: "5493434747844" // Número WhatsApp para pedidos
};

// ========== VARIABLES GLOBALES ==========
let catalog = { productos: [] }; // Almacena todos los productos
let cart = []; // Almacena items del carrito
let currentCategory = 'todos'; // Categoría actualmente filtrada

// ========== CARGAR DATOS AL INICIAR ==========
document.addEventListener('DOMContentLoaded', async () => {
    // Cargar productos desde products.json
    await loadProducts();
    
    // Cargar carrito guardado previamente
    loadCart();
    
    // Mostrar productos en la página
    displayProducts();
    
    // Actualizar contador del carrito
    updateCartCount();
    
    // Configurar event listeners (click, submit, etc.)
    setupEventListeners();
});

// ========== CARGAR PRODUCTOS DESDE JSON ==========
async function loadProducts() {
    try {
        // Solicitar el archivo products.json
        const response = await fetch('products.json');
        
        // Si la respuesta es OK, convertir a JSON
        if (response.ok) {
            catalog = await response.json();
        } else {
            console.error('Error al cargar productos');
        }
    } catch (error) {
        console.error('Error en loadProducts:', error);
    }
}

// ========== MOSTRAR PRODUCTOS EN LA PÁGINA ==========
function displayProducts() {
    const container = document.getElementById('products-container');
    container.innerHTML = ''; // Limpiar contenedor anterior
    
    // Filtrar productos por categoría
    const filteredProducts = filterProductsByCategory();
    
    // Para cada producto, crear una tarjeta
    filteredProducts.forEach(product => {
        if (product.tipo_producto === 'familia') {
            // Si es una familia (tiene variantes)
            container.appendChild(createFamilyCard(product));
        }
    });
}

// ========== FILTRAR PRODUCTOS POR CATEGORÍA ==========
function filterProductsByCategory() {
    if (currentCategory === 'todos') {
        // Si es "todos", mostrar todos los productos activos
        return catalog.productos.filter(p => p.activo);
    } else {
        // Si no, filtrar por categoría
        return catalog.productos.filter(p => 
            p.categoria === currentCategory && p.activo
        );
    }
}

// ========== CREAR TARJETA DE PRODUCTO FAMILIA ==========
function createFamilyCard(product) {
    // Crear el contenedor principal de la tarjeta
    const card = document.createElement('div');
    card.className = 'product-card';
    
    // HTML de la tarjeta con imagen, nombre, y selector de variantes
    card.innerHTML = `
        <div class="product-image">
            <img src="images/${product.imagen}" alt="${product.nombre}" loading="lazy">
        </div>
        <div class="product-info">
            <h3>${product.nombre}</h3>
            <p>${product.descripcion_base}</p>
            
            <!-- Selector de variantes (desplegable) -->
            <select class="variant-select" data-product-id="${product.id}">
                <option value="">Selecciona una opción</option>
                ${product.variantes.map(v => `
                    <option value="${v.id}" data-price="${v.precio}">
                        ${v.nombre} - $${formatPrice(v.precio)}
                    </option>
                `).join('')}
            </select>
            
            <!-- Botón para agregar al carrito -->
            <button class="btn-primary add-to-cart" data-product-id="${product.id}">
                Agregar al carrito
            </button>
        </div>
    `;
    
    return card;
}

// ========== AGREGAR PRODUCTO AL CARRITO ==========
function addToCart(event) {
    const button = event.target;
    const productId = parseInt(button.dataset.productId);
    
    // Encontrar el selector de variantes correspondiente
    const select = document.querySelector(`select[data-product-id="${productId}"]`);
    const selectedOption = select.options[select.selectedIndex];
    
    // Validar que haya seleccionado una variante
    if (!selectedOption.value) {
        alert('Por favor selecciona una opción');
        return;
    }
    
    // Obtener datos de la variante seleccionada
    const variantId = parseInt(selectedOption.value);
    const price = parseInt(selectedOption.dataset.price);
    
    // Encontrar el producto en el catálogo
    const product = catalog.productos.find(p => p.id === productId);
    const variant = product.variantes.find(v => v.id === variantId);
    
    // Crear clave única para este item
    const cartKey = `${productId}-${variantId}`;
    
    // Buscar si ya existe en el carrito
    const existingItem = cart.find(item => item.cartKey === cartKey);
    
    if (existingItem) {
        // Si ya existe, aumentar cantidad
        existingItem.quantity += 1;
    } else {
        // Si no existe, agregarlo nuevo
        cart.push({
            cartKey: cartKey,
            productId: productId,
            variantId: variantId,
            productName: product.nombre,
            variantName: variant.nombre,
            price: price,
            quantity: 1
        });
    }
    
    // Guardar carrito en localStorage
    saveCart();
    
    // Actualizar UI
    updateCartCount();
    showNotification(`${variant.nombre} agregado al carrito`);
    
    // Limpiar selector
    select.value = '';
}

// ========== ACTUALIZAR CONTADOR DEL CARRITO ==========
function updateCartCount() {
    const cartCount = document.getElementById('cart-count');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
}

// ========== MOSTRAR/OCULTAR CARRITO DESPLEGABLE ==========
function toggleCartDropdown() {
    const dropdown = document.getElementById('cart-dropdown');
    const isVisible = dropdown.style.display !== 'none';
    
    if (isVisible) {
        dropdown.style.display = 'none';
    } else {
        dropdown.style.display = 'block';
        displayCartItems();
    }
}

// ========== MOSTRAR ITEMS DEL CARRITO ==========
function displayCartItems() {
    const container = document.getElementById('cart-items');
    const totalPrice = document.getElementById('cart-total-price');
    
    // Si el carrito está vacío
    if (cart.length === 0) {
        container.innerHTML = '<p class="empty-cart-msg">Tu carrito está vacío</p>';
        totalPrice.textContent = '$0';
        return;
    }
    
    // Crear HTML para cada item del carrito
    let html = '';
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        html += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.productName}</h4>
                    <p>${item.variantName}</p>
                    <p class="cart-item-price">$${formatPrice(item.price)} x ${item.quantity}</p>
                </div>
                <div class="cart-item-actions">
                    <button class="btn-small" onclick="changeQuantity('${item.cartKey}', 1)">+</button>
                    <button class="btn-small" onclick="changeQuantity('${item.cartKey}', -1)">-</button>
                    <button class="btn-delete" onclick="removeFromCart('${item.cartKey}')">🗑️</button>
                </div>
            </div>
        `;
    });
    
    // Insertar en el HTML
    container.innerHTML = html;
    
    // Mostrar total formateado
    totalPrice.textContent = '$' + formatPrice(total);
}

// ========== CAMBIAR CANTIDAD DE UN ITEM ==========
function changeQuantity(cartKey, change) {
    const item = cart.find(i => i.cartKey === cartKey);
    
    if (item) {
        item.quantity += change;
        
        // Si la cantidad es 0 o menos, eliminar
        if (item.quantity <= 0) {
            removeFromCart(cartKey);
        } else {
            saveCart();
            displayCartItems();
            updateCartCount();
        }
    }
}

// ========== ELIMINAR ITEM DEL CARRITO ==========
function removeFromCart(cartKey) {
    // Filtrar y eliminar el item
    cart = cart.filter(item => item.cartKey !== cartKey);
    
    // Guardar y actualizar UI
    saveCart();
    displayCartItems();
    updateCartCount();
}

// ========== MOSTRAR NOTIFICACIÓN TEMPORAL ==========
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.display = 'block';
    
    // Desaparecer después de 3 segundos
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// ========== ABRIR MODAL DE CHECKOUT ==========
function openCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    modal.style.display = 'block';
}

// ========== CERRAR MODAL DE CHECKOUT ==========
function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    modal.style.display = 'none';
}

// ========== GENERAR PEDIDO Y ENVIAR POR WHATSAPP ==========
function submitCheckout(event) {
    event.preventDefault();
    
    // Obtener datos del formulario
    const name = document.getElementById('customer-name').value;
    const address = document.getElementById('customer-address').value;
    const comments = document.getElementById('customer-comments').value;
    
    // Validar que haya items en el carrito
    if (cart.length === 0) {
        alert('El carrito está vacío');
        return;
    }
    
    // Generar texto del pedido
    let orderText = `*Nuevo Pedido de Simple Cosméticos*\n\n`;
    orderText += `*Cliente:* ${name}\n`;
    orderText += `*Dirección:* ${address}\n`;
    orderText += `*Comentarios:* ${comments || 'Ninguno'}\n\n`;
    orderText += `*Productos:*\n`;
    
    let total = 0;
    
    // Agregar cada item al texto
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        orderText += `- ${item.productName} (${item.variantName}): $${formatPrice(item.price)} x${item.quantity} = $${formatPrice(itemTotal)}\n`;
    });
    
    // Agregar total
    orderText += `\n*TOTAL: $${formatPrice(total)}*`;
    
    // Codificar el mensaje para URL
    const encodedMessage = encodeURIComponent(orderText);
    
    // Abrir WhatsApp con el mensaje
    const whatsappUrl = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
    
    // Limpiar carrito y cerrar modal
    cart = [];
    saveCart();
    updateCartCount();
    closeCheckoutModal();
    displayCartItems();
    document.getElementById('checkout-form').reset();
    
    showNotification('Pedido enviado por WhatsApp ✓');
}

// ========== FILTRAR POR CATEGORÍA ==========
function filterByCategory(event) {
    const button = event.target;
    
    // Si no es un botón de filtro, salir
    if (!button.classList.contains('filter-btn')) return;
    
    // Remover clase "active" de todos los botones
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Agregar clase "active" al botón clickeado
    button.classList.add('active');
    
    // Actualizar categoría y mostrar productos filtrados
    currentCategory = button.dataset.category;
    displayProducts();
}

// ========== FORMATEAR PRECIO ==========
function formatPrice(price) {
    // Convertir precio a formato de moneda argentina
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(price).replace('ARS', '').trim();
}

// ========== GUARDAR CARRITO EN LOCALSTORAGE ==========
function saveCart() {
    localStorage.setItem(CONFIG.cartKey, JSON.stringify(cart));
}

// ========== CARGAR CARRITO DESDE LOCALSTORAGE ==========
function loadCart() {
    const saved = localStorage.getItem(CONFIG.cartKey);
    if (saved) {
        cart = JSON.parse(saved);
    }
}

// ========== CONFIGURAR EVENT LISTENERS ==========
function setupEventListeners() {
    // Botón para abrir/cerrar carrito
    document.getElementById('cart-btn').addEventListener('click', toggleCartDropdown);
    document.getElementById('close-cart').addEventListener('click', toggleCartDropdown);
    
    // Botones para agregar al carrito
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('add-to-cart')) {
            addToCart(event);
        }
    });
    
    // Filtros de categoría
    document.querySelector('.categories-filter').addEventListener('click', filterByCategory);
    
    // Botón para finalizar compra
    document.getElementById('checkout-btn').addEventListener('click', openCheckoutModal);
    document.getElementById('close-checkout-modal').addEventListener('click', closeCheckoutModal);
    document.getElementById('cancel-checkout').addEventListener('click', closeCheckoutModal);
    
    // Formulario de checkout
    document.getElementById('checkout-form').addEventListener('submit', submitCheckout);
    
    // Cerrar modal si se hace click fuera
    document.getElementById('checkout-modal').addEventListener('click', (event) => {
        if (event.target.id === 'checkout-modal') {
            closeCheckoutModal();
        }
    });
}
