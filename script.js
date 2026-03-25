/* ========================================
   SIMPLE - COSMÉTICOS NATURALES
   Script Principal Simplificado
   ======================================== */

// ========== CONFIGURACIÓN INICIAL ==========
// URLs y datos de la aplicación
const CONFIG = {
    adminPassword: "simple2025",
    cartStorageKey: "simple-cart-v2",
    catalogStorageKey: "simple-catalog-v2"
};

// ========== ESTADO GLOBAL ==========
// Variables que guardan el estado de la aplicación

let catalog = {
    productos: [],        // Array con todos los productos
    promociones: []       // Array con promociones (si existen)
};

let cart = [];            // Carrito de compras
let isAdmin = false;      // Indica si el usuario está en modo admin
let currentCategory = 'todos'; // Categoría actualmente filtrada

// ========== FUNCIONES AUXILIARES ==========

// Formatea un número como moneda argentina
function formatPrice(price) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(price).replace('ARS', '$');
}

// Muestra una notificación flotante
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    
    // La quita después de 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Abre o cierra el carrito
function toggleCart() {
    const cartDropdown = document.getElementById('cart-dropdown');
    cartDropdown.classList.toggle('active');
}

// Cierra el carrito
function closeCart() {
    const cartDropdown = document.getElementById('cart-dropdown');
    cartDropdown.classList.remove('active');
}

// Abre o cierra el menú móvil
function toggleMobileMenu() {
    const navbar = document.querySelector('.navbar');
    navbar.classList.toggle('active');
}

// ========== ALMACENAMIENTO LOCAL ==========
// Guarda datos en el navegador para persistencia

// Carga el catálogo desde localStorage o JSON
async function loadCatalog() {
    // Primero intenta cargar desde localStorage
    const stored = localStorage.getItem(CONFIG.catalogStorageKey);
    if (stored) {
        catalog = JSON.parse(stored);
        console.log('Catálogo cargado desde localStorage');
        return;
    }

    // Si no hay datos guardados, carga desde products.json
    try {
        const response = await fetch('products.json');
        if (response.ok) {
            catalog = await response.json();
            // Guarda en localStorage para próximas cargas
            localStorage.setItem(CONFIG.catalogStorageKey, JSON.stringify(catalog));
            console.log('Catálogo cargado desde products.json');
        }
    } catch (error) {
        console.error('Error cargando catálogo:', error);
    }
}

// Carga el carrito desde localStorage
function loadCart() {
    const stored = localStorage.getItem(CONFIG.cartStorageKey);
    if (stored) {
        cart = JSON.parse(stored);
    } else {
        cart = [];
    }
}

// Guarda el carrito en localStorage
function saveCart() {
    localStorage.setItem(CONFIG.cartStorageKey, JSON.stringify(cart));
}

// ========== FUNCIONES DEL CARRITO ==========

// Agrega un producto al carrito
function addToCart(productId, varianteId = null, precio, nombre) {
    // Crea una clave única para el item
    // Si tiene variante: usa "productId-varianteId"
    // Si no: usa solo "productId"
    const cartKey = varianteId ? `${productId}-${varianteId}` : `${productId}`;

    // Busca si el item ya existe en el carrito
    const existingItem = cart.find(item => item.cartKey === cartKey);

    if (existingItem) {
        // Si existe, incrementa la cantidad
        existingItem.quantity += 1;
    } else {
        // Si no existe, lo agrega
        cart.push({
            cartKey: cartKey,
            productId: productId,
            varianteId: varianteId,
            nombre: nombre,
            precio: precio,
            quantity: 1
        });
    }

    saveCart();
    updateCartUI();
    showNotification(`✓ ${nombre} agregado al carrito`);
}

// Elimina un item del carrito
function removeFromCart(cartKey) {
    cart = cart.filter(item => item.cartKey !== cartKey);
    saveCart();
    updateCartUI();
}

// Actualiza la cantidad de un item
function updateCartItemQuantity(cartKey, quantity) {
    if (quantity <= 0) {
        removeFromCart(cartKey);
        return;
    }

    const item = cart.find(i => i.cartKey === cartKey);
    if (item) {
        item.quantity = quantity;
        saveCart();
        updateCartUI();
    }
}

// Calcula el total del carrito
function getCartTotal() {
    return cart.reduce((total, item) => {
        return total + (item.precio * item.quantity);
    }, 0);
}

// Actualiza la interfaz del carrito (cantidad de items, total, etc)
function updateCartUI() {
    const cartCount = document.getElementById('cart-count');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalElement = document.getElementById('cart-total-price');

    // Actualiza el contador de items
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;

    // Si el carrito está vacío
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Tu carrito está vacío</p>';
        cartTotalElement.textContent = '$0';
        return;
    }

    // Reconstruye la lista de items del carrito
    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <h4>${item.nombre}</h4>
                <p>${formatPrice(item.precio)} x ${item.quantity} = ${formatPrice(item.precio * item.quantity)}</p>
            </div>
            <!-- Botón para eliminar el item -->
            <i class="fas fa-trash remove-item" data-cart-key="${item.cartKey}" title="Eliminar"></i>
        </div>
    `).join('');

    // Actualiza el total
    cartTotalElement.textContent = formatPrice(getCartTotal());

    // Agrega eventos a los botones de eliminar
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cartKey = e.target.getAttribute('data-cart-key');
            removeFromCart(cartKey);
        });
    });
}

// ========== RENDERIZADO DE PRODUCTOS ==========

// Renderiza los productos en la página
function renderProducts(filter = 'todos') {
    const container = document.getElementById('products-container');
    currentCategory = filter;

    // Filtra los productos según la categoría
    let productsToShow = [];

    for (let product of catalog.productos) {
        // Si la categoría no coincide, salta este producto
        if (filter !== 'todos' && product.categoria !== filter) {
            continue;
        }

        // Si el producto no está activo, no lo muestra
        if (!product.activo) {
            continue;
        }

        // Si es una familia con variantes
        if (product.tipo_producto === 'familia') {
            // Solo incluye variantes activas
            const activeVariantes = product.variantes.filter(v => v.activo);
            if (activeVariantes.length > 0) {
                productsToShow.push(product);
            }
        } else if (product.tipo_producto === 'simple') {
            // Si es un producto simple, lo incluye directamente
            productsToShow.push(product);
        }
    }

    // Si no hay productos, muestra un mensaje
    if (productsToShow.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; grid-column: 1/-1;">No hay productos en esta categoría</p>';
        return;
    }

    // Renderiza cada producto como una tarjeta
    container.innerHTML = productsToShow.map(product => {
        // Si es una familia, necesita un selector de variantes
        if (product.tipo_producto === 'familia') {
            const variant = product.variantes[0]; // Toma la primera variante
            return `
                <div class="product-card">
                    <div class="product-image">
                        <img src="images/${product.imagen}" alt="${product.nombre}" 
                             onerror="this.parent.textContent='${product.nombre.substring(0, 3)}'">
                    </div>
                    <div class="product-info">
                        <h3 class="product-name">${product.nombre}</h3>
                        <p class="product-description">${product.descripcion_base}</p>
                        <p class="product-price">${formatPrice(variant.precio)}</p>
                        
                        <!-- Selector de variantes -->
                        <select class="variant-select" data-product-id="${product.id}">
                            ${product.variantes.map(v => `
                                <option value="${v.id}" data-price="${v.precio}">
                                    ${v.nombre}
                                </option>
                            `).join('')}
                        </select>

                        <!-- Botón para agregar al carrito -->
                        <button class="btn-add-cart add-to-cart-btn" 
                                data-product-id="${product.id}"
                                data-product-name="${product.nombre}">
                            Agregar al Carrito
                        </button>
                    </div>
                </div>
            `;
        }

        // Si es un producto simple (sin variantes)
        return `
            <div class="product-card">
                <div class="product-image">
                    <img src="images/${product.imagen}" alt="${product.nombre}"
                         onerror="this.parentElement.textContent='${product.nombre.substring(0, 3)}'">
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.nombre}</h3>
                    <p class="product-description">${product.descripcion}</p>
                    <p class="product-price">${formatPrice(product.precio)}</p>
                    
                    <!-- Botón para agregar al carrito -->
                    <button class="btn-add-cart add-to-cart-btn"
                            data-product-id="${product.id}"
                            data-product-name="${product.nombre}"
                            data-product-price="${product.precio}">
                        Agregar al Carrito
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Agrega eventos a los botones de agregar al carrito
    attachAddToCartListeners();
}

// Agrega eventos a los botones de "Agregar al Carrito"
function attachAddToCartListeners() {
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = parseInt(btn.getAttribute('data-product-id'));
            const productName = btn.getAttribute('data-product-name');

            // Si tiene variantes, obtiene la variante seleccionada
            const variantSelect = btn.parentElement.querySelector('.variant-select');
            if (variantSelect) {
                const varianteId = parseInt(variantSelect.value);
                const precio = parseInt(variantSelect.options[variantSelect.selectedIndex].getAttribute('data-price'));
                addToCart(productId, varianteId, precio, `${productName} - ${variantSelect.options[variantSelect.selectedIndex].text}`);
            } else {
                // Si no tiene variantes, usa el precio del atributo
                const precio = parseInt(btn.getAttribute('data-product-price'));
                addToCart(productId, null, precio, productName);
            }
        });
    });

    // Agrega evento para cambiar el precio cuando se selecciona otra variante
    document.querySelectorAll('.variant-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const newPrice = parseInt(e.target.options[e.target.selectedIndex].getAttribute('data-price'));
            const priceElement = select.parentElement.querySelector('.product-price');
            if (priceElement) {
                priceElement.textContent = formatPrice(newPrice);
            }
        });
    });
}

// ========== FILTROS DE CATEGORÍA ==========

// Configura los botones de filtro
function setupCategoryFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remueve la clase "active" de todos los botones
            filterBtns.forEach(b => b.classList.remove('active'));
            // Agrega "active" al botón clickeado
            e.target.classList.add('active');
            // Renderiza los productos filtrados
            renderProducts(e.target.getAttribute('data-category'));
        });
    });
}

// ========== CHECKOUT ==========

// Abre el modal de checkout
function openCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    modal.classList.add('active');
}

// Cierra el modal de checkout
function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    modal.classList.remove('active');
}

// Envía el pedido por WhatsApp
function submitCheckoutForm(e) {
    e.preventDefault();

    // Obtiene los datos del formulario
    const name = document.getElementById('customer-name').value;
    const address = document.getElementById('customer-address').value;
    const comments = document.getElementById('customer-comments').value;

    // Si el carrito está vacío, muestra error
    if (cart.length === 0) {
        showNotification('❌ El carrito está vacío');
        return;
    }

    // Construye el mensaje de WhatsApp
    let message = `*PEDIDO SIMPLE - Cosméticos Naturales*\n\n`;
    message += `*Cliente:* ${name}\n`;
    message += `*Dirección:* ${address}\n`;
    message += `${comments ? `*Observaciones:* ${comments}\n` : ''}`;
    message += `\n*PRODUCTOS:*\n`;

    // Agrega cada item del carrito
    cart.forEach(item => {
        message += `• ${item.nombre}\n`;
        message += `  ${formatPrice(item.precio)} x ${item.quantity} = ${formatPrice(item.precio * item.quantity)}\n`;
    });

    message += `\n*TOTAL:* ${formatPrice(getCartTotal())}\n`;

    // Número de WhatsApp (cambiar según necesites)
    const phoneNumber = '5493434747844';

    // URL de WhatsApp (encoda el mensaje)
    const whatsappURL = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    // Abre WhatsApp en una nueva pestaña
    window.open(whatsappURL, '_blank');

    // Limpia el carrito y el formulario
    cart = [];
    saveCart();
    updateCartUI();
    document.getElementById('checkout-form').reset();
    closeCheckoutModal();
    closeCart();
    showNotification('✓ Pedido enviado a WhatsApp');
}

// ========== EVENTOS DEL DOM ==========

// Se ejecuta cuando la página carga
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicializando aplicación...');

    // Carga el catálogo y el carrito
    await loadCatalog();
    loadCart();

    // Renderiza los productos
    renderProducts('todos');

    // Configura los filtros
    setupCategoryFilters();

    // Actualiza el UI del carrito
    updateCartUI();

    // ========== EVENTOS DEL CARRITO ==========
    document.getElementById('cart-btn').addEventListener('click', toggleCart);
    document.getElementById('close-cart').addEventListener('click', closeCart);
    document.getElementById('checkout-btn').addEventListener('click', openCheckoutModal);

    // ========== EVENTOS DEL MENÚ MÓVIL ==========
    document.getElementById('menu-btn').addEventListener('click', toggleMobileMenu);

    // Cierra el menú cuando se hace clic en un enlace
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            document.querySelector('.navbar').classList.remove('active');
        });
    });

    // ========== EVENTOS DEL MODAL CHECKOUT ==========
    const modal = document.getElementById('checkout-modal');
    
    // Cierra el modal al hacer clic en la X
    document.querySelector('.close-modal').addEventListener('click', closeCheckoutModal);
    
    // Cierra el modal al hacer clic en Cancelar
    document.querySelector('.close-modal-btn').addEventListener('click', closeCheckoutModal);
    
    // Cierra el modal al hacer clic fuera de él
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeCheckoutModal();
        }
    });

    // Envía el formulario de checkout
    document.getElementById('checkout-form').addEventListener('submit', submitCheckoutForm);

    // Cierra el carrito cuando la ventana se redimensiona
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeCart();
        }
    });

    console.log('Aplicación lista');
});
