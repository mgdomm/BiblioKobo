# 📚 Azkaban Reads - BiblioKobo

Una aplicación web de gestión de biblioteca personal con una temática oscura inspirada en Harry Potter. Permite buscar, ordenar y descargar libros en formato EPUB, con soporte para Google Drive y Google Books API.

## 🎯 Características Principales

- **Gestión de Libros**: Búsqueda y filtrado por título, autor o saga
- **Ordenamiento Flexible**: A→Z, Z→A, Más recientes, Por número de saga
- **Portadas Dinámicas**: Integración con Google Books API para obtener portadas automáticamente
- **Descarga de Archivos**: Descarga individual o múltiple (ZIP)
- **Página de Estadísticas**: Dashboard con métricas de la biblioteca (protegido con contraseña)
- **Responsive Design**: Optimizado para desktop, tablet y móvil
- **Soporte Kobo**: Versión ligera sin imágenes para dispositivos Kobo
- **Fade Effect**: Efecto de transparencia progresiva en las tarjetas de libros

## 🚀 Requisitos

- Node.js 14+
- npm o yarn
- Credenciales de Google (Service Account o OAuth2)

## 📦 Instalación

```bash
# Clonar el repositorio
git clone https://github.com/mgdomm/BiblioKobo.git
cd BiblioKobo

# Instalar dependencias
npm install

# Crear archivo de credenciales (service-account.json o oauth-credentials.json)
# Ver sección de Configuración

# Iniciar servidor
npm start
```

El servidor escuchará en `http://localhost:3000`

## ⚙️ Configuración

### Variables de Entorno

```bash
PORT=3000                          # Puerto del servidor (default: 3000)
ADMIN_PASS=252914                  # Contraseña para acceso a stats (default: 252914)
GOOGLE_BOOKS_API_KEY=...          # Clave API de Google Books (opcional)
```

### Google Drive Integration

#### Opción 1: Service Account (Solo lectura - Recomendado)
1. Crear Service Account en Google Cloud Console
2. Descargar JSON y guardar como `service-account.json`
3. Compartir carpeta de Drive con el email del Service Account

#### Opción 2: OAuth2 (Lectura/Escritura)
1. Crear OAuth2 credentials en Google Cloud Console
2. Guardar como `oauth-credentials.json`
3. Ejecutar autenticación la primera vez

## 📁 Estructura de Carpetas

```
BiblioKobo/
├── server.js              # Archivo principal (3200+ líneas)
├── books.json             # Base de datos JSON con metadatos de libros
├── package.json           # Dependencias
├── service-account.json   # Credenciales Google (gitignored)
├── cover/
│   ├── portada/          # Portada principal (portada1.jpg)
│   └── secuendarias/     # Portadas secundarias (portada11.jpg)
└── README.md             # Este archivo
```

## 🛠️ Rutas Principales

### Públicas
- `/` - Página de inicio
- `/libros` - Listado de libros con búsqueda y filtrado
- `/autores` - Listado de autores
- `/sagas` - Listado de sagas
- `/libro?id=...` - Detalle de libro con sinopsis
- `/download?id=...` - Descargar EPUB individual
- `/download-zip` - Descargar múltiples EPUBs como ZIP

### Protegidas (requieren contraseña)
- `/stats` - Dashboard de estadísticas
- `/upload` - Página de subida de EPUBs
- `/dashboard` - Editor de metadatos de libros

### API
- `GET /api/books` - Obtener todos los libros
- `GET /api/books/:id` - Obtener libro específico
- `PUT /api/books/:id` - Actualizar libro y auto-fetch Google Books
- `DELETE /api/books/:id` - Eliminar libro
- `GET /api/book-cover?id=...&title=...&author=...` - Obtener portada
- `GET /api/sync-google-books` - Sincronizar metadatos con Google Books
- `POST /api/upload-to-drive` - Subir EPUB a Google Drive

## 🎨 Personalización

### Estilos CSS
Los estilos se definen en la variable `css` dentro de `server.js` (línea ~345):

```javascript
// Modificar tamaños de fuente
h1 { font-size: 56px; }           // Título principal
.top-buttons a { font-size: 24px; } // Botones de navegación
.title { font-size: 15px; }       // Título de libro en tarjeta

// Modificar alturas de banner
@media (min-width: 1024px) {
  .header-banner.top { height: 290px; }
}
```

### Colores Temáticos
```css
#19E6D6  /* Cyan: Color primario (botones, enlaces) */
#000     /* Negro: Fondo */
#fff     /* Blanco: Texto principal */
```

## 📊 Fade Effect (Transparencia progresiva)

Las tarjetas de libros desaparecen gradualmente cuando pasan por debajo del banner:

```javascript
const offset = 100;        // px de offset desde el borde inferior del banner
const fadeLength = 150;    // Duración suave de la transición
const minOpacity = 0.15;   // Opacidad mínima cuando está oculta
```

Modificar en línea ~1140 para ajustar el efecto.

## 🔄 Workflows Típicos

### Agregar un libro nuevo
1. Ir a `/upload` (requiere contraseña)
2. Subir archivo EPUB
3. El sistema automáticamente:
   - Crea entry en `books.json`
   - Fetch datos de Google Books (si existe)
   - Obtiene portada y descripción

### Actualizar metadatos
1. Ir a `/dashboard` (requiere contraseña)
2. Buscar el libro
3. Editar campos
4. Al guardar: auto-fetch de Google Books si hay cambios

### Descargar libros
- **Individual**: Click en botón "Descargar" en la tarjeta
- **Múltiple**: Seleccionar checkboxes en las tarjetas → Click "Descarga múltiple"

## 🔌 Integración con Servicios Externos

### Google Books API
- Obtiene portadas, descripciones, ratings
- Rate limit: 800ms entre requests
- Caché en memoria durante la sesión

### Open Library API
- Alternativa para obtener sinopsis
- Sin límite de rate (fallback)

### Google Drive API
- Subir y descargar EPUBs
- Listar archivos automáticamente
- Service Account: solo lectura
- OAuth2: lectura + escritura

## 📱 Responsive Design

```
Desktop (≥1024px):  h1 56px, banner 290px
Tablet (768-1023px): h1 48px, banner 230px
Mobile (<768px):    h1 38px, banner 220px, image 80% size
```

## 🐛 Troubleshooting

**Servidor no arranca**
```bash
node -c server.js  # Verificar sintaxis
npm install        # Reinstalar dependencias
```

**Portadas no cargan**
- Verificar credenciales de Google
- Revisar rate limit (esperar unos minutos)
- Usar `/api/sync-google-books` para re-sincronizar

**Cambios no visibles en navegador**
- Hard refresh: `Ctrl+Shift+R` (Chrome/Firefox)
- Limpiar caché: `Cmd+Shift+R` (Mac)
- Abrir en incógnito

## 📝 Licencia

Uso personal. Las portadas y contenidos son propiedad de sus respectivos autores.

## 👤 Autor

Desarrollado como proyecto personal de gestión de biblioteca.

---

**Última actualización**: Diciembre 2025  
**Versión**: 2.0 (con fade effect, responsive completo, botón ordenar mejorado)
