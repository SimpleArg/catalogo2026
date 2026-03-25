📋 GUÍA DE USO - SIMPLE COSMÉTICOS NATURALES v1.0 SIMPLIFICADA

================================================================================
🎯 RESUMEN DE CAMBIOS
================================================================================

Este código ha sido simplificado para ser más fácil de entender y mantener:

✅ ELIMINADO:
  - Productos con precio $1000
  - Sistema de promociones/ofertas
  - Panel de administración
  - Lógica compleja de aplicación de descuentos
  - Sincronización con GitHub

✅ CONSERVADO:
  - Carrito de compras funcional
  - Productos con variantes
  - Filtrado por categoría
  - Envío por WhatsApp
  - Diseño responsive
  - Almacenamiento en localStorage

================================================================================
📁 ESTRUCTURA DE ARCHIVOS
================================================================================

simple/
├── index.html          (Estructura HTML comentada)
├── style.css           (Estilos CSS comentados)
├── script.js           (JavaScript simplificado y comentado)
├── products.json       (Base de datos de productos)
├── images/             (Carpeta para imágenes de productos)
│   ├── shampoo-solido.jpg
│   ├── tonico-capilar.jpg
│   ├── acondicionador-solido.jpg
│   ├── cremas-faciales.jpg
│   └── cremas-faciales-premium.jpg
└── README.md           (Este archivo)


================================================================================
🔧 CÓMO USAR EL CÓDIGO
================================================================================

1. COPIAR LOS ARCHIVOS
   - Descarga los 4 archivos (HTML, CSS, JS, JSON)
   - Crea una carpeta llamada "simple"
   - Coloca los archivos en esa carpeta
   - Crea una carpeta "images" dentro para las fotos

2. AGREGAR IMÁGENES
   - Coloca las fotos de los productos en la carpeta /images
   - Los nombres deben coincidir con "imagen" en products.json
   - Ejemplo: "shampoo-solido.jpg" debe estar en /images/shampoo-solido.jpg

3. ABRIR EN NAVEGADOR
   - Haz doble click en index.html
   - O arrastra el archivo al navegador
   - También puedes usar un servidor local (Live Server en VS Code)

4. SUBIR A GITHUB PAGES
   - Sube los archivos a un repositorio en GitHub
   - Ve a Settings > Pages
   - Selecciona "main branch" como fuente
   - La página estará disponible en: https://tuusuario.github.io/nombrerepo


================================================================================
📝 CÓMO EDITAR PRODUCTOS
================================================================================

Los productos están en el archivo "products.json". Es un archivo JSON simple.

ESTRUCTURA DE UN PRODUCTO FAMILIA (con variantes):

{
  "id": 1,
  "nombre": "Shampoo sólido",
  "descripcion_base": "Descripción general del producto",
  "imagen": "shampoo-solido.jpg",     // Nombre del archivo en /images
  "categoria": "cabello",              // Categoría: cabello, rostro, cuerpo, maquillaje, otros
  "tipo_producto": "familia",          // SIEMPRE "familia" si tiene variantes
  "activo": true,                      // true = mostrar, false = ocultar
  "variantes": [
    {
      "id": 101,
      "nombre": "Seborrea / Picor",
      "descripcion": "Descripción específica de esta variante",
      "precio": 12000,                 // Precio en pesos argentinos
      "activo": true
    },
    {
      "id": 102,
      "nombre": "Pelo seco",
      "descripcion": "...",
      "precio": 12000,
      "activo": true
    }
  ]
}

NOTAS IMPORTANTES:
- Cada producto necesita un ID único (1, 2, 3...)
- Cada variante necesita un ID único diferente (101, 102, 103...)
- El campo "activo" controla si se muestra o no en la página
- Los precios deben ser números sin símbolos ($, .)

CATEGORÍAS DISPONIBLES:
- cabello
- rostro
- cuerpo
- maquillaje
- otros

EJEMPLO SIMPLE (cómo agregar un nuevo producto):

{
  "id": 4,
  "nombre": "Nuevo Producto",
  "descripcion_base": "Descripción",
  "imagen": "nuevo-producto.jpg",
  "categoria": "cabello",
  "tipo_producto": "familia",
  "activo": true,
  "variantes": [
    {
      "id": 401,
      "nombre": "Variante 1",
      "descripcion": "Descripción de variante 1",
      "precio": 10000,
      "activo": true
    }
  ]
}


================================================================================
🎨 CÓMO CAMBIAR COLORES
================================================================================

En el archivo "style.css", al inicio hay variables de color:

:root {
    --rosa-principal: #FF69B4;    /* Color principal (botones, títulos) */
    --rosa-claro: #FFB6C1;        /* Color para bordes */
    --rosa-suave: #FFF0F5;        /* Color de fondo suave */
    --blanco: #FFFFFF;
    --texto-oscuro: #4A4A4A;
    --texto-claro: #7A7A7A;
}

PARA CAMBIAR EL COLOR PRINCIPAL:
1. Abre style.css
2. Busca "--rosa-principal: #FF69B4;"
3. Reemplaza #FF69B4 con otro código de color
4. Los colores se actualizan automáticamente en toda la página

RECURSOS PARA ENCONTRAR COLORES:
- https://www.colorhexa.com (colores por código hex)
- https://coolors.co (generador de paletas de colores)
- https://colorpicker.com (selector de colores)


================================================================================
📞 CÓMO CAMBIAR DATOS DE CONTACTO
================================================================================

En "index.html" busca la sección FOOTER y cambia:

<!-- WHATSAPP -->
<a href="https://wa.me/5493434747844">343 474-7844</a>
Reemplaza 5493434747844 con tu número (sin espacios, con código país)

<!-- INSTAGRAM -->
<a href="https://instagram.com/simplep.naturales">@simplep.naturales</a>
Reemplaza simplep.naturales con tu usuario

<!-- ZONAS DE ENTREGA -->
<li>Colonia Avellaneda</li>
<li>Paraná</li>
Agrega o modifica según tus zonas

<!-- HORARIOS -->
<li>Lun a Vie: 9-18hs</li>
Actualiza con tus horarios


================================================================================
🛒 CÓMO FUNCIONA EL CARRITO
================================================================================

El carrito guarda los datos en "localStorage" (memoria del navegador).
Funciona incluso si cierras la página.

FLUJO DEL CARRITO:

1. Usuario selecciona un producto y variante
2. Hace click en "Agregar al carrito"
3. El item se agrega al carrito (guardado en localStorage)
4. Contador en header se actualiza
5. Usuario puede ver el carrito haciendo click en el ícono de bolsa
6. Puede cambiar cantidades o eliminar items
7. Cuando hace "Finalizar compra":
   - Se abre un modal con formulario
   - Ingresa nombre, dirección, comentarios
   - Hace click en "Enviar Pedido"
   - Se abre WhatsApp con el pedido pre-escrito
   - Cliente solo tiene que enviarlo


================================================================================
🔢 NÚMEROS IMPORTANTES EN script.js
================================================================================

CONFIG (en la parte superior):

const CONFIG = {
    adminPassword: "simple2025",  // (NO SE USA en versión simplificada)
    storageKey: "simple-catalog",  // Nombre de la clave en localStorage
    cartKey: "simple-cart",        // Nombre del carrito en localStorage
    whatsappNumber: "5493434747844" // Tu número WhatsApp
};

CAMBIAR NÚMERO WHATSAPP:
1. Abre script.js
2. Busca "whatsappNumber: "5493434747844""
3. Reemplaza con tu número (sin espacios, con código país Argentina: 54)


================================================================================
🐛 SOLUCIÓN DE PROBLEMAS
================================================================================

PROBLEMA: Los productos no aparecen
SOLUCIÓN:
- Verifica que products.json esté en la misma carpeta que index.html
- Comprueba que los productos tengan "activo": true
- Abre la consola (F12) y busca errores en la pestaña "Console"

PROBLEMA: Las imágenes no se muestran
SOLUCIÓN:
- Crea una carpeta llamada "images" en la raíz
- Coloca las imágenes ahí
- Verifica que el nombre en products.json coincida exactamente
- Comprueba que sea .jpg, .png o .webp

PROBLEMA: El carrito no guarda datos
SOLUCIÓN:
- Asegúrate que localStorage está habilitado en el navegador
- Prueba en modo privado/incógnito
- Limpia el cache del navegador (Ctrl+Shift+Supr)

PROBLEMA: WhatsApp no abre
SOLUCIÓN:
- Verifica que el número esté con código país (54 para Argentina)
- Usa solo dígitos, sin espacios o guiones
- Ejemplo correcto: 5493434747844

PROBLEMA: "Failed to fetch products.json"
SOLUCIÓN:
- Si usas GitHub Pages, espera 5-15 minutos después de subir
- Haz Ctrl+Shift+R para limpiar caché
- Abre en modo incógnito


================================================================================
💡 CONSEJOS
================================================================================

1. NOMBRA LAS IMÁGENES CORRECTAMENTE
   - Sin espacios ni caracteres especiales
   - Usa guiones: "shampoo-solido.jpg" no "shampoo solido.jpg"

2. REVISA EL JSON ANTES DE SUBIR
   - Usa https://jsonlint.com para validar
   - JSON es sensible a comas y comillas

3. PRUEBA EN MOBILE
   - Abre la página en tu celular
   - Comprueba que se ve bien
   - Prueba que WhatsApp abre correctamente

4. USA DESCRIPCIONES CORTAS
   - Las descripciones largas ocupan más espacio
   - Sé conciso pero completo

5. MANTÉN EL CÓDIGO COMENTADO
   - Si necesitas editar el futuro, los comentarios ayudan
   - Não elimines comentarios si no sabes qué hacen

================================================================================
📚 ARCHIVOS EXPLICADOS
================================================================================

📄 index.html
- Estructura de la página
- Todo está comentado para entender cada sección
- Cambios principales:
  - Sin panel admin
  - Sin sección de ofertas
  - Formulario checkout más simple

📄 style.css
- Todos los estilos comentados línea por línea
- Variables de color al inicio
- Responsive para mobile, tablet y desktop
- Sin estilos para admin panel ni ofertas

📄 script.js
- Lógica simplificada
- Cada función tiene comentarios explicativos
- Sin sincronización GitHub
- Sin sistema de promociones
- Funciones principales:
  * loadProducts() - Cargar JSON
  * displayProducts() - Mostrar productos
  * addToCart() - Agregar al carrito
  * submitCheckout() - Enviar por WhatsApp

📄 products.json
- Base de datos en formato JSON
- Solo 5 productos de ejemplo
- Estructura explicada arriba en esta guía


================================================================================
✅ CHECKLIST ANTES DE SUBIR A PRODUCCIÓN
================================================================================

□ Edité products.json con mis productos
□ Agregué todas las imágenes en /images
□ Cambié el número de WhatsApp en script.js
□ Cambié datos de contacto en footer (HTML)
□ Cambié colores en style.css si lo deseaba
□ Probé en navegador local (doble click en index.html)
□ Probé agregar productos al carrito
□ Probé finalizar compra y abrir WhatsApp
□ Probé en mobile con teléfono
□ Probé filtros de categoría
□ Limpié los archivos (sin carpetas innecesarias)
□ Subí a GitHub
□ Esperé 5-15 minutos y abrí el link en GitHub Pages


================================================================================
🎉 ¡LISTO!
================================================================================

Tu tienda online está lista. Si tienes preguntas sobre cómo usar o
modificar el código, revisa los comentarios en cada archivo.

Cualquier duda, puedes pedirle a Claude que te ayude con:
- Agregar funcionalidades
- Cambiar diseño
- Editar productos
- Resolver bugs


¡Buena suerte con tu negocio Simple! 🌿🌸
