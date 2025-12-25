# 📚 Azkaban Reads

**Plataforma oscura para custodiar y compartir libros prohibidos, olvidados y raramente accesibles.**

Azkaban Reads es un sistema web que combina una biblioteca digital con un asistente inteligente (LUMOS) para gestionar solicitudes de libros, notificaciones de novedades y un generador de spoilers dinámico.

---

## 🎯 Características principales

### 📖 Gestión de biblioteca
- Catálogo de libros capturados entre los muros de Azkaban
- Búsqueda por título, autor o saga
- Filtrado por categoría y tipo (saga / autoconclusivo)
- Sistema de recomendaciones personalizadas

### 🤖 Asistente LUMOS
- Chat conversacional integrado en el sitio
- Búsqueda de libros con lenguaje natural
- Solicitud de libros específicos
- Revelación de spoilers inteligentes (real + fake)
- Suscripción a notificaciones de novedades

### 📧 Sistema de notificaciones
- **Solicitudes de libros**: Confirmación + notificación al admin
- **Suscripciones**: Autor, saga, todas las novedades
- **Notificaciones automáticas**: Cuando se sube un libro coincidente
- Todos los emails con diseño LUMOS personalizado
- Compatible con Gmail, iCloud, Outlook

### 🔮 Generador de spoilers inteligente
- Fetching de spoilers reales desde múltiples APIs:
  - SpoilThePlot
  - Wikipedia
  - OpenLibrary
  - Google Books
- Extracción de fragmentos cortos (máx 150 caracteres)
- Generación de spoilers falsos basados en análisis narrativo
- Distinción automática entre spoilers de libro vs. personaje

---

## 🏗️ Arquitectura técnica

### Stack
- **Backend**: Node.js + Express.js
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **Base de datos**: Archivos JSON (FileHandler)
- **Email**: SendGrid API REST (no SMTP)
- **Hosting**: Render
- **Diseño**: Terminal retro VT323

### Estructura de carpetas
```
BiblioKobo/
├── public/
│   ├── lumos.html           # Chat bot LUMOS
│   ├── lumos-widget.js      # Componente del bot
│   ├── dashboard.html       # Panel de admin
│   └── assets/              # SVGs y recursos
├── routes/
│   ├── books.js             # Búsqueda y recomendaciones
│   ├── requests.js          # Solicitudes y notificaciones
│   └── admin.js             # Gestión de libros
├── services/
│   ├── aiService.js         # IA: spoilers, intents
│   ├── emailService.js      # SendGrid API
│   └── notifier.js          # Gestión de notificaciones
├── utils/
│   └── fileHandler.js       # CRUD JSON
├── data/
│   ├── requests.json        # Solicitudes pendientes
│   ├── notifications.json   # Suscripciones activas
│   └── ratings-cache.json   # Cache de ratings
├── books.json              # Catálogo completo
└── server.js               # Servidor principal
```

---

## 🚀 Configuración e instalación

### Requisitos previos
- Node.js v24+
- npm o yarn
- Cuenta SendGrid con API key
- Variable de entorno SITE_URL (para enlaces en emails)

### Instalación local

```bash
# Clonar repositorio
git clone https://github.com/mgdomm/BiblioKobo.git
cd BiblioKobo

# Instalar dependencias
npm install

# Configurar variables de entorno
cat > .env << EOF
SENDGRID_API_KEY=your_api_key_here
EMAIL_FROM=your-verified-email@gmail.com
SITE_URL=http://localhost:3000
EOF

# Iniciar servidor
npm start
```

El servidor estará disponible en `http://localhost:3000`

### Despliegue en Render

1. Conectar repositorio GitHub a Render
2. Agregar variables de entorno en Render:
   - `SENDGRID_API_KEY`
   - `EMAIL_FROM`
   - `SITE_URL` (tu dominio de Render)
3. Configurar build command: `npm install`
4. Configurar start command: `node server.js`
5. Desplegar

---

## 📡 Endpoints principales

### 📚 Libros
- `GET /api/books/search?query=...` - Buscar libros
- `GET /api/books/recommend?category=...&type=...` - Recomendaciones
- `POST /api/books/test` - Test de preferencias

### 📝 Solicitudes y notificaciones
- `POST /api/requests/book` - Solicitar un libro
- `POST /api/requests/notify` - Suscribirse a notificaciones
- `GET /api/requests/pending` - Solicitudes pendientes (admin)
- `GET /api/requests/notifications` - Suscriptores (admin)

### 🔮 Spoilers
- `POST /api/spoilers` - Generar spoilers

### 🤖 Admin
- `POST /api/admin/add-book` - Agregar libro nuevo
- `DELETE /api/admin/book/:id` - Eliminar libro

---

## 🧠 Sistema de inteligencia

### Detección de intents
LUMOS entiende múltiples tipos de solicitudes:

```javascript
// Solicitud de libro
"quiero leer Alas de Sangre de Sarah J Maas"

// Solicitud de spoiler de libro
"spoilers de El Principito"

// Solicitud de spoiler de personaje
"qué pasa con Harry Potter"

// Suscripción a autor
"notificarme de Colleen Hoover"

// Suscripción a saga
"notificarme de libros de Percy Jackson"

// Suscripción a todas las novedades
"dame aviso de todo lo que suban"
```

### Generación de spoilers
1. **Fetch de fuentes reales**: 4 APIs diferentes
2. **Extracción inteligente**: Keywords (muere, traición, revela, secreto...)
3. **Truncado a 150 caracteres**: Spoiler corto, no sinopsis completa
4. **Análisis narrativo**: Extrae elementos (protagonista, antagonista, stakes)
5. **Generación de fakes**: ~12 variaciones únicas por spoiler
6. **Nunca repite**: Cada solicitud devuelve diferentes fakes

---

## 📧 Sistema de emails

### Tipos de emails

#### 1️⃣ Confirmación de solicitud
- **Para**: Usuario que solicita un libro
- **Contenido**: Título, autor, confirmación visual
- **Trigger**: Tras POST /api/requests/book

#### 2️⃣ Libro capturado
- **Para**: Usuario que solicitó o está suscrito
- **Contenido**: Libro disponible + enlace directo
- **Trigger**: Admin sube nuevo libro (POST /api/admin/add-book)

#### 3️⃣ Confirmación de suscripción
- **Para**: Usuario que se suscribe
- **Contenido**: Tipo de notificación, confirmación visual
- **Trigger**: Tras POST /api/requests/notify

#### 4️⃣ Notificación al admin (solicitud)
- **Para**: azkabanreads@gmail.com
- **Contenido**: Email usuario + libro solicitado
- **Trigger**: Tras POST /api/requests/book

#### 5️⃣ Notificación al admin (suscripción)
- **Para**: azkabanreads@gmail.com
- **Contenido**: Email usuario + tipo de suscripción
- **Trigger**: Tras POST /api/requests/notify

### Diseño de emails
- **Tema**: LUMOS retro terminal
- **Fuente**: VT323 monospace
- **Colores**: #00FFFF (cyan) / #0a0a0a (gris oscuro) / #000 (negro)
- **Compatibilidad**: Gmail, iCloud, Outlook, Apple Mail
- **Responsive**: Optimizado para mobile

---

## 🔄 Flujos principales

### Solicitar un libro
```
Usuario solicita (bot) 
  ↓
POST /api/requests/book
  ↓
Se guarda en data/requests.json
  ↓
Email confirmación → Usuario
Email notificación → Admin
  ↓
(Cuando se sube el libro)
  ↓
Email "libro capturado" → Usuario
Status actualizado → "notified"
```

### Suscribirse a notificaciones
```
Usuario elige tipo (autor/saga/todas)
  ↓
LUMOS solicita correo
  ↓
POST /api/requests/notify
  ↓
Se guarda en data/notifications.json
  ↓
Email confirmación → Usuario
Email notificación → Admin
  ↓
(Cuando se sube libro coincidente)
  ↓
Email automático → Usuario
```

### Pedir spoilers
```
Usuario escribe título en bot
  ↓
LUMOS detecta intent "spoiler"
  ↓
POST /api/spoilers
  ↓
AI Service busca en 4 APIs
  ↓
Extrae 1 spoiler real + genera 2 fakes
  ↓
Usuario elige cuál cree que es real
```

---

## 🔐 Seguridad

### Consideraciones
- ⚠️ Los endpoints `/api/admin/*` **NO tienen autenticación** por defecto
- En producción: Agregar JWT o middleware de autenticación
- Las credenciales SendGrid se alojan en variables de entorno (Render)
- Los datos se guardan en archivos JSON locales

### Mejoras recomendadas
1. Implementar autenticación en rutas admin
2. Usar base de datos (MongoDB/PostgreSQL) en lugar de JSON
3. Rate limiting en endpoints públicos
4. Validación más estricta de inputs

---

## 🛠️ Desarrollo

### Scripts disponibles
```bash
# Iniciar servidor
npm start

# Ejecutar tests (si existen)
npm test

# Linter (si está configurado)
npm run lint
```

### Dependencias principales
```json
{
  "express": "^4.18.2",
  "@sendgrid/mail": "^6.10.1",
  "dotenv": "^17.2.3"
}
```

### Variables de entorno
```
SENDGRID_API_KEY      # API key SendGrid
EMAIL_FROM            # Email verificado en SendGrid
SITE_URL              # URL base para enlaces (http://localhost:3000 o dominio)
```

---

## 📝 Datos y JSON

### books.json
```json
[
  {
    "id": "book_12345...",
    "title": "Alas de Sangre",
    "author": "Sarah J Maas",
    "cover": "url_to_image",
    "categories": ["fantasía", "dark romance"],
    "saga": {
      "name": "Acotar",
      "book": 1
    },
    "synopsys": "...",
    "year": 2015,
    "rating": 4.5
  }
]
```

### data/requests.json
```json
[
  {
    "id": "req_12345...",
    "title": "Crepúsculo",
    "author": "Stephenie Meyer",
    "email": "user@example.com",
    "status": "pending|notified",
    "createdAt": "2025-12-25T10:30:00Z",
    "notifiedAt": "2025-12-25T15:45:00Z"
  }
]
```

### data/notifications.json
```json
[
  {
    "id": "notif_12345...",
    "email": "user@example.com",
    "type": "author|saga|all",
    "filters": { "author": "Colleen Hoover" },
    "createdAt": "2025-12-25T10:30:00Z"
  }
]
```

---

## 🐛 Troubleshooting

### Error: SendGrid no configurado
**Causa**: Faltan variables de entorno  
**Solución**: Agregar `SENDGRID_API_KEY` y `EMAIL_FROM` en Render o `.env` local

### Emails no llegan
1. Verificar que el email esté verificado en SendGrid
2. Revisar carpeta de spam
3. Ver logs en Render dashboard: `[CONFIRMATION]`, `[ADMIN]`

### Spoilers no funcionan
1. Verificar conectividad a APIs externas
2. Las APIs pueden retornar 429 (rate limit)
3. Revisar logs de AI Service en servidor

### Libro no triggerea notificaciones
1. Asegurarse de usar POST `/api/admin/add-book`
2. Verificar que hay suscriptores activos en `data/notifications.json`
3. Revisar logs: `[ADMIN]`, `notifySubscribers`

---

## 📚 Más información

- **Bot LUMOS**: Ver [LUMOS_BOT.md](LUMOS_BOT.md) para documentación específica
- **GitHub**: https://github.com/mgdomm/BiblioKobo
- **Deploy**: Hosted en Render

---

## 📄 Licencia

Este proyecto es de código abierto. Úsalo, modifícalo, comparte.

---

**"Los libros permanecen capturados entre estos muros... y solo los elegidos pueden acceder a ellos."** 🪄

*Azkaban Reads © 2025*

### Google Drive Integration

#### Opción 1: Service Account (Solo lectura - Recomendado)
1. Crear Service Account en Google Cloud Console
2. Descargar JSON y guardar como `service-account.json`
3. Compartir carpeta de Drive con el email del Service Account

#### Opción 2: OAuth2 (Lectura/Escritura)
1. Crear OAuth2 credentials en Google Cloud Console
