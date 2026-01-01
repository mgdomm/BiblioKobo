# 📚 BiblioKobo - Azkaban Reads + 🔮 Azkaban Brain

**Plataforma oscura para custodiar y compartir libros prohibidos + Asistente de IA literaria ARM**

BiblioKobo combina biblioteca digital con asistente inteligente LUMOS + Azkaban Brain (TinyLlama 7B):
- 🎯 Gestión de solicitudes de libros específicos
- 📧 Notificaciones automáticas de nuevos libros
- 🤖 Asistente conversacional inteligente con detección de intents
- 🔮 **NUEVO: Azkaban Brain** - IA literaria 100% local para Chromebook ARM
- 📚 Recomendaciones personalizadas con RAG + embeddings
- 🧪 Test de preferencias de lectura

---

## 🌟 NUEVO: Azkaban Brain

**Motor de IA literaria optimizado para Chromebook ARM (Snapdragon SC7180)**

### Características
- 🧠 **TinyLlama 7B** compilado para ARM64
- 🔎 **RAG** con embeddings locales (TensorFlow.js)
- 🌐 **Búsqueda híbrida**: biblioteca local + Google Books/Open Library
- 📝 **Respuestas literarias** en tono de "guardián de Azkaban"
- ⚡ **Sin GPU** - funciona en CPU ARM (30-60s por respuesta)
- 🆓 **100% gratis** - sin servicios cloud

### Instalación Rápida

```bash
# 1. Setup automático ARM
./setup-azkaban-arm.sh  # ⏱️ 30-40 min

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor
npm start

# 4. Validar
./validate-install.sh
```

📖 **Documentación completa:** [AZKABAN_BRAIN_SETUP.md](AZKABAN_BRAIN_SETUP.md)  
🚀 **Guía rápida:** [AZKABAN_QUICK_START.md](AZKABAN_QUICK_START.md)  
✅ **Checklist:** [CHECKLIST_INSTALACION.md](CHECKLIST_INSTALACION.md)

---

## 🎯 Características principales

### 📖 Gestión de biblioteca
- Catálogo de 193+ libros capturados
- Búsqueda inteligente por título, autor o saga
- Filtrado por categoría y tipo (saga / autoconclusivo)
- Sistema de recomendaciones personalizadas por tema (dragones, magia, romance, oscuro, misterio, guerra)

### 🤖 Asistente LUMOS - Detección inteligente de intents
LUMOS entiende la intención del usuario automáticamente:

| Intent | Ejemplo | Acción |
|--------|---------|--------|
| **REQUEST_BOOK** | "quiero solicitar Alas de Sangre" | Abre formulario de solicitud |
| **SEARCH** | "busca libros de romántica" | Búsqueda full-text |
| **RECOMMEND** | "recomiéndame algo" | Sistema de recomendaciones temáticas |
| **NOTIFY** | "avísame de Colleen Hoover" | Suscripción a autor/saga/todas |
| **SPOILER** | "spoilers de Harry Potter" | Generador real + fake |
| **TEST** | "test lector" | Análisis de preferencias |
| **GREETING** | "hola" | Respuesta conversacional |
| **HELP** | "ayuda" | Guía de uso |

### 📧 Sistema de notificaciones - 5 tipos de emails
1. **Confirmación de solicitud** → Usuario solicita libro
2. **Libro capturado** → Se sube el libro solicitado
3. **Confirmación de suscripción** → Usuario se suscribe
4. **Notificación al admin (solicitud)** → Log de nuevas solicitudes
5. **Notificación al admin (suscripción)** → Log de nuevas suscripciones

Todos con diseño LUMOS retro + compatible con Gmail, iCloud, Outlook

### 🎨 Recomendaciones inteligentes por tema
Cada tema tiene 8 razones personalizadas y únicas:

- **Dragones**: Criaturas épicas, fuerzas del destino, poder, política...
- **Magia**: Sistemas complejos, alma de la historia, consecuencias...
- **Romance**: Profundidad emocional, adversidades, complicidad...
- **Oscuridad**: Moralidad gris, atmósfera sombría, complejidad del mal...
- **Misterio**: Preguntas sin respuesta, secretos, revelaciones...
- **Guerra**: Conflictos militares, estrategia, costo humano...

El sistema **filtra libros que realmente contengan el tema** antes de recomendar.

### 🔮 Generador de spoilers inteligente
1. **Fetch de fuentes reales**: Wikipedia, OpenLibrary, Google Books, SpoilThePlot
2. **Extracción inteligente**: Palabras clave (muere, traición, revela...)
3. **Validación de longitud**: Máximo 150 caracteres
4. **Generación de fakes**: 2-3 spoilers falsos basados en análisis narrativo
5. **Lógica de distinción**: Spoilers de libro vs. personaje
6. **Cache inteligente**: Evita repetir spoilers en la misma sesión

### 🧪 Test de preferencias del lector
- Solicita 3 libros favoritos del usuario
- Analiza categorías, autores y preferencia saga/standalone
- Genera 3 recomendaciones basadas en patrones similares
- **Sin duplicados**: Filtra por ID y título para evitar repeticiones

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
│   ├── lumos.html              # 2300+ líneas - Chat bot LUMOS completo
│   ├── lumos-widget.js         # Componente independiente del bot
│   ├── dashboard.html          # Panel admin
│   ├── lumos-demo.html         # Demo pública
│   └── assets/svg/             # Iconos SVG
│
├── routes/
│   ├── books.js                # Búsqueda + recomendaciones + test lector
│   ├── requests.js             # Solicitudes + suscripciones
│   ├── spoilers.js             # Generador de spoilers
│   └── admin.js                # Gestión de libros (REQUIERE AUTENTICACIÓN)
│
├── services/
│   ├── aiService.js            # IA: detección de intents, análisis narrativo
│   ├── ollamaService.js        # Integración con Ollama para IA local
│   ├── emailService.js         # SendGrid API REST (sin SMTP)
│   ├── notifier.js             # Orquestación de notificaciones
│   ├── aiOllama.js             # Fallback de IA (deprecated)
│   └── oracleService.js        # Integración Oracle (experimental)
│
├── utils/
│   └── fileHandler.js          # CRUD operaciones JSON
│
├── data/
│   ├── requests.json           # Solicitudes de libros pendientes
│   ├── notifications.json      # Suscriptores activos
│   └── ratings-cache.json      # Cache de ratings de Google Books
│
├── cover/                      # Archivos XML de portadas (legacy)
├── themes/                     # Temas CSS alternativos
│
├── books.json                  # Base de datos de 193+ libros
├── server.js                   # Servidor Express principal (4661 líneas)
├── lumosAI.js                  # Router específico de chat IA
├── package.json                # Dependencias
└── .env                        # Variables de entorno (no trackeado)
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
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
EOF

# Iniciar servidor
npm start
```

El servidor estará disponible en `http://localhost:3000`

### IA (Ollama)

- Levanta Ollama: `ollama serve`.
- Descarga un modelo: `ollama pull llama3.1` (o el que prefieras).
- Configura `OLLAMA_BASE_URL` y `OLLAMA_MODEL` si usas otro host o modelo.
- Node.js consume la API de Ollama vía HTTP.

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

## 🔮 Azkaban Brain - API Endpoints

### POST `/api/azkaban/ask`
Pregunta general al guardián de Azkaban.

```bash
curl -X POST http://localhost:3000/api/azkaban/ask \
  -H 'Content-Type: application/json' \
  -d '{"query":"¿Quién escribió El Hobbit?"}'
```

### POST `/api/azkaban/summarize`
Resumen literario de un libro.

```bash
curl -X POST http://localhost:3000/api/azkaban/summarize \
  -H 'Content-Type: application/json' \
  -d '{"bookTitle":"1984"}'
```

### POST `/api/azkaban/recommend`
Recomendaciones personalizadas.

```bash
curl -X POST http://localhost:3000/api/azkaban/recommend \
  -H 'Content-Type: application/json' \
  -d '{"preferences":"fantasía épica con dragones"}'
```

### GET `/api/azkaban/status`
Estado del sistema.

```bash
curl http://localhost:3000/api/azkaban/status
```

### POST `/api/azkaban/index`
Indexar biblioteca completa.

```bash
curl -X POST http://localhost:3000/api/azkaban/index
```

---

## 📚 Documentación Azkaban Brain

- 📖 [Guía Completa](AZKABAN_BRAIN_SETUP.md) - Instalación paso a paso
- 🚀 [Quick Start](AZKABAN_QUICK_START.md) - Resumen ejecutivo
- ✅ [Checklist](CHECKLIST_INSTALACION.md) - Verificación de instalación

## 🛠️ Scripts NPM

```bash
npm start              # Iniciar servidor
npm run dev            # Modo desarrollo (nodemon)
npm run setup-arm      # Instalar Azkaban Brain ARM
npm run index-books    # Indexar biblioteca completa
```

## 🔧 Scripts Shell

```bash
./setup-azkaban-arm.sh # Setup automático ARM64 (30-40 min)
./validate-install.sh  # Validar instalación completa
./test-azkaban.sh      # Test rápido de TinyLlama
```

---

**"Los libros permanecen capturados entre estos muros... y solo los elegidos pueden acceder a ellos."** 🪄

**✨ "Las sombras de Azkaban guardan mil historias... ¿Cuál deseas descubrir?"** 🔮

*Azkaban Reads + Azkaban Brain © 2025-2026*

### Google Drive Integration

#### Opción 1: Service Account (Solo lectura - Recomendado)
1. Crear Service Account en Google Cloud Console
2. Descargar JSON y guardar como `service-account.json`
3. Compartir carpeta de Drive con el email del Service Account

#### Opción 2: OAuth2 (Lectura/Escritura)
1. Crear OAuth2 credentials en Google Cloud Console
