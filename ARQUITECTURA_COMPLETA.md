# 🏗️ Arquitectura Completa de BiblioKobo

**Documento integral para entender toda la estructura, flujos y lógica del sistema.**

---

## 📋 Índice
1. [Visión General](#visión-general)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Componentes del Sistema](#componentes-del-sistema)
4. [Flujos de Datos](#flujos-de-datos)
5. [Detección de Intents](#detección-de-intents)
6. [Recomendaciones Inteligentes](#recomendaciones-inteligentes)
7. [Sistema de Spoilers](#sistema-de-spoilers)
8. [Endpoints API](#endpoints-api)
9. [Base de Datos JSON](#base-de-datos-json)
10. [Seguridad y Mejoras](#seguridad-y-mejoras)

---

## 📌 Visión General

BiblioKobo es una **plataforma de gestión de libros + asistente IA conversacional** que:

- ✅ Permite solicitar libros específicos y recibir notificaciones cuando estén disponibles
- ✅ Entiende la intención del usuario automáticamente (request, search, recommend, notify, spoiler, test)
- ✅ Recomienda libros basados en preferencias del usuario CON RAZONES PERSONALIZADAS
- ✅ Genera spoilers (reales + falsos) de libros y personajes
- ✅ Analiza preferencias de lectura mediante test interactivo
- ✅ Envía emails personalizados con diseño retro LUMOS

---

## ⚙️ Stack Tecnológico

```
┌─────────────────────────────────────────┐
│         CLIENTE (Frontend)              │
│  HTML5 + CSS3 + Vanilla JavaScript      │
│  - public/lumos.html (2300+ líneas)     │
│  - public/dashboard.html                │
└────────────────┬────────────────────────┘
                 │
        ┌────────▼────────┐
        │   Express.js    │
        │   (Node.js)     │
        │ (server.js)     │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
 Routes      Services      Utils
 ├─ books    ├─ aiService      └─ fileHandler
 ├─ requests ├─ emailService
 ├─ spoilers ├─ notifier
 └─ admin    └─ ollamaService
    
    │            │
    └────────────┼─────────────────────────┐
                 │                         │
            ┌────▼─────┐          ┌────────▼──────┐
            │   JSON   │          │  SendGrid API │
            │ (Local)  │          │  (Email)      │
            └────────────────────────────────────┘
                 │
            ┌────▼──────┐
            │  Ollama    │
            │  (IA Local)│
            └───────────┘
```

---

## 🔧 Componentes del Sistema

### 1️⃣ **Frontend (public/lumos.html)**

**Responsabilidades:**
- Interfaz chat conversacional
- Detección de intents CLIENT-SIDE (optimización)
- Enrutamiento de acciones basadas en intent
- Manejo de estado del chat (favoriteBooks, preferences, waitingFor)
- Renderizado dinámico de tarjetas de libros

**Funciones principales:**
```javascript
// Detección de intents antes de enviar al backend
detectIntentClient(message)
  → Patrones regex para 12+ tipos de intents
  
// Enrutamiento basado en intent
askLumosAI(message)
  → switch(intent) → showRecommendOptions(), showSearchResults(), etc.
  
// Máquina de estados para flujos multi-paso
processUserMessage(message)
  → state.waitingFor = 'test_book_1', 'notify_email', etc.
  
// Búsqueda de libros
handleTestBookInput(bookTitle)
  → GET /api/books/search → Almacena en state.favoriteBooks
  
// Recomendaciones personalizadas
executeRecommendation()
  → POST /api/books/recommend → Renderiza tarjetas con razones
```

### 2️⃣ **Backend - Servidor Principal (server.js)**

**Responsabilidades:**
- Inicialización de Express
- Mounting de routers
- Middleware (compression, JSON parsing)
- Integración con Google Drive (upload/download de EPUBs)
- Gestión de archivos estáticos

**Características:**
- 4661 líneas de código
- Soporta multipart/form-data para EPUB
- Compresión gzip automática
- FileHandler para operaciones JSON

### 3️⃣ **Backend - Rutas (routes/)**

#### **routes/books.js** (502 líneas)
```
GET /api/books/search
  ├─ Input: query=string
  ├─ Busca en title, author, description, categories
  └─ Output: {found: bool, books: []}

GET /api/books/recommend
  ├─ Input: category, type
  ├─ Recomendación simple (GET antiguo)
  └─ Output: {book}

POST /api/books/recommend ⭐
  ├─ Input: {type: 'saga'|'standalone'|'all', preferences: string}
  ├─ Filtra libros por preferencia/tema
  ├─ Genera 3 recomendaciones CON RAZONES PERSONALIZADAS
  └─ Output: {recommendation, books: [{..., reason}]}

POST /api/books/test
  ├─ Input: {favoriteBooks: [{id, title, author, ...}, ...]}
  ├─ Analiza: categorías, autores, saga/standalone
  ├─ Evita duplicados por título
  └─ Output: {recommendations: [...]}
```

#### **routes/requests.js** (370+ líneas)
```
POST /api/requests/book
  ├─ Input: {title, author, email}
  ├─ Guarda en data/requests.json
  ├─ Envía emails (usuario + admin)
  └─ Output: {success, message}

POST /api/requests/notify
  ├─ Input: {type, filters, email}
  ├─ Guarda en data/notifications.json
  ├─ Envía confirmación
  └─ Output: {success, message}

GET /api/requests/pending (admin)
  ├─ Retorna solicitudes sin notificar
  └─ Output: {requests: [...]}
```

#### **routes/spoilers.js** (450+ líneas)
```
POST /api/spoilers
  ├─ Input: {book, character?, attempt}
  ├─ 4 niveles de búsqueda:
  │  1. Base de datos local
  │  2. Cache (spoilers-cache.json)
  │  3. APIs externas (Wikipedia, OpenLibrary, etc)
  │  4. Generación con Ollama
  ├─ Genera 2-3 spoilers FALSOS
  └─ Output: {spoilers: [{content, isReal: bool}]}
```

### 4️⃣ **Backend - Servicios (services/)**

#### **services/aiService.js** (33KB+)
```javascript
detectIntent(message)
  → Retorna: 'request_book', 'search', 'recommend', 
             'notify', 'spoiler', 'test', 'greeting', etc.
  → Usa regex patterns + orden de prioridad

// Patrón REQUEST_BOOK:
/solicitar|solicito|pedir|quiero.*solicitar|quiero.*pedir|no.*encuentr|.../i

// Patrón NOTIFY:
/avisa|avisen|notifica|notificarme|avis(?:a|ar|o)|...|cuando.*suban|suscri/i
```

#### **services/ollamaService.js** (190 líneas) ⭐
```javascript
generate(prompt, maxTokens=300, timeout=60000)
  ├─ Conecta a http://localhost:11434/api/generate
  ├─ Soporta modelos: llama3.1, neural-chat, otros
  ├─ Timeout inteligente (60s default)
  ├─ Manejo de errores → fallback a templates
  └─ Retorna: string (respuesta generada)
```

#### **services/emailService.js** (27KB+)
```javascript
sendConfirmationEmail(email, type, data)
  └─ Plantilla HTML con diseño LUMOS retro

sendBookAvailableEmail(email, book)
  └─ Notifica cuando se sube un libro solicitado

sendNotificationEmail(email, type, filters)
  └─ Confirmación de suscripción

sendAdminNotification(type, data)
  └─ Notificación al admin (azkabanreads@gmail.com)
```

#### **services/notifier.js** (6KB)
```javascript
notifySubscribers(newBook)
  ├─ Lee data/notifications.json
  ├─ Filtra subscribers por categoría/autor
  ├─ Envía email a cada uno (no en paralelo para evitar rate limit)
  └─ Actualiza status en data/requests.json
```

### 5️⃣ **Utilidades (utils/)**

#### **utils/fileHandler.js**
```javascript
readJSON(filePath)
  ├─ Lee archivo JSON
  └─ Retorna: array/object parseado

writeJSON(filePath, data)
  ├─ Escribe archivo JSON
  └─ Soporta creación automática

updateJSON(filePath, filter, update)
  ├─ Busca elemento y lo actualiza
  └─ Retorna: elemento actualizado
```

---

## 🔄 Flujos de Datos

### 🎯 Flujo 1: Usuario solicita un libro

```
Usuario escribe en chat:
"Quiero solicitar Alas de Sangre de Sarah J Maas"
           │
           ▼
┌─────────────────────────────────────────┐
│ Frontend: detectIntentClient()           │
│ → Detecta: REQUEST_BOOK                  │
└─────────────────────────────────────────┘
           │
           ▼
Frontend: handleOptionClick('request')
           │
           ▼
┌─────────────────────────────────────────┐
│ State → waitingFor = 'request_title'     │
│ Bot pregunta: "¿Qué libro deseas?"       │
└─────────────────────────────────────────┘
           │
Usuario responde: "Alas de Sangre"
           │
           ▼
┌─────────────────────────────────────────┐
│ Frontend: GET /api/books/search          │
│ Busca libro por título                   │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Backend: routes/books.js                 │
│ → Búsqueda full-text                     │
│ → Retorna: libro encontrado              │
└─────────────────────────────────────────┘
           │
Bot pregunta: "¿A qué email te notificamos?"
           │
Usuario: "juan@example.com"
           │
           ▼
┌─────────────────────────────────────────┐
│ POST /api/requests/book                  │
│ {title, author, email}                   │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Backend: routes/requests.js              │
│ 1. Guarda en data/requests.json          │
│ 2. Envía email confirmación → usuario    │
│ 3. Envía notificación → admin            │
│ 4. Retorna {success: true}               │
└─────────────────────────────────────────┘
           │
           ▼
Bot: "¡Solicitud registrada! Te notificaremos cuando tengamos el libro"
```

### 📚 Flujo 2: Usuario pide recomendaciones por tema

```
Usuario: "Recomiéndame algo"
           │
           ▼
Frontend: detectIntentClient() → 'recommend'
           │
           ▼
showRecommendOptions()
│
├─ "Una saga envolvente"
├─ "Algo para terminar rápido"  
└─ "Sorpréndeme"
           │
Usuario: "Una saga envolvente"
           │
           ▼
State: waitingFor = 'recommend_preference'
Bot: "¿Qué géneros o temas te cautivan?"
           │
Usuario: "dragones"
           │
           ▼
┌─────────────────────────────────────────┐
│ POST /api/books/recommend                │
│ {type: 'saga', preferences: 'dragones'}  │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Backend: routes/books.js                 │
│                                          │
│ 1. booksMatchingPreference()             │
│    ├─ Busca 'dragón' en:                 │
│    │  - title                            │
│    │  - description                       │
│    │  - categories                        │
│    │  - author                            │
│    └─ Retorna: solo libros sobre dragones│
│                                          │
│ 2. Filtra por type='saga'                │
│                                          │
│ 3. Selecciona 3 aleatorios               │
│                                          │
│ 4. Para cada libro:                      │
│    ├─ Intenta generar razón con Ollama   │
│    │  "escribe 1-2 oraciones por qué...  │
│    │   [libro] sería perfecto para       │
│    │   alguien que adora dragones..."    │
│    │                                     │
│    └─ Si Ollama falla:                   │
│       └─ generateSmartReason()           │
│          └─ Selecciona template #index   │
│             de la lista de dragones      │
│                                          │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Respuesta: {                             │
│   recommendation: "He encontrado...",    │
│   books: [                               │
│     {                                    │
│       title: "Alas de Ónix",             │
│       author: "Rebecca Yarros",          │
│       reason: "Un mundo épico donde..."  │
│     },                                   │
│     ...                                  │
│   ]                                      │
│ }                                        │
└─────────────────────────────────────────┘
           │
           ▼
Frontend: addRecommendationCard()
│
└─ Renderiza 3 tarjetas con:
   ├─ Número (1, 2, 3)
   ├─ Título y autor
   ├─ Cobertura (imagen)
   ├─ Botones: [Descargar] [Ver similares]
   └─ Razón personalizada sobre dragones
```

### 🧪 Flujo 3: Usuario hace Test de preferencias

```
Usuario: "Test lector"
           │
           ▼
State: waitingFor = 'test_book_1'
Bot: "Dime tu primer libro favorito"
           │
Usuario: "trono de cristal"
           │
           ▼
┌─────────────────────────────────────────┐
│ handleTestBookInput()                    │
│                                          │
│ GET /api/books/search?q=trono            │
│ → Busca y encuentra "Reino de cenizas"  │
│ → Guarda en state.favoriteBooks[0]      │
│                                          │
│ Bot: "Libro 1: Reino de cenizas"        │
│ "¿Tu segundo favorito?"                 │
│ State: waitingFor = 'test_book_2'       │
└─────────────────────────────────────────┘
           │
(Repite 2 veces más)
           │
           ▼
┌─────────────────────────────────────────┐
│ executeReaderTest()                      │
│                                          │
│ POST /api/books/test                     │
│ {favoriteBooks: [book1, book2, book3]}  │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Backend: routes/books.js                 │
│                                          │
│ 1. Extrae categorías de los 3 libros    │
│ 2. Extrae autores de los 3 libros       │
│ 3. Detecta: ¿usuario ama sagas?         │
│                                          │
│ 4. Filtra libros similares:             │
│    ├─ Excluye favoritos (por ID + título)│
│    ├─ Suma puntos por:                   │
│    │  - Categorías coincidentes (+2)     │
│    │  - Autor coincidente (+3)           │
│    │  - Saga/standalone similar (+1)     │
│    └─ Retorna solo score > 0             │
│                                          │
│ 5. Evita duplicados:                     │
│    ├─ Crea Set de títulos             │
│    ├─ Filtra solo títulos únicos        │
│    └─ Toma top 3                        │
│                                          │
└─────────────────────────────────────────┘
           │
           ▼
Frontend: Renderiza 3 recomendaciones
│
└─ Sin duplicados ✅
   Con tarjetas descargables
```

### 🔮 Flujo 4: Usuario pide spoilers

```
Usuario: "spoilers de Harry Potter"
           │
           ▼
detectIntentClient() → 'spoiler'
           │
           ▼
State: waitingFor = 'spoiler_title'
Bot: "¿De qué libro necesitas spoilers?"
           │
Usuario: "Harry Potter y la Piedra Filosofal"
           │
           ▼
┌─────────────────────────────────────────┐
│ POST /api/spoilers                       │
│ {book: "Harry Potter...", attempt: 1}   │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Backend: routes/spoilers.js              │
│                                          │
│ Búsqueda de 4 niveles:                  │
│                                          │
│ 1️⃣ BD Local                             │
│    └─ Busca en object con título        │
│                                          │
│ 2️⃣ Cache (spoilers-cache.json)          │
│    └─ Busca spoilers previos             │
│                                          │
│ 3️⃣ APIs Externas (Wikipedia, etc)       │
│    ├─ Request a SpoilThePlot             │
│    ├─ Request a Wikipedia                │
│    ├─ Request a OpenLibrary              │
│    ├─ Request a Google Books             │
│    └─ Extrae fragmentos <150 chars       │
│                                          │
│ 4️⃣ Generación con Ollama                │
│    └─ Si todas fallan → IA genera fake   │
│                                          │
│ Generación de FAKES:                    │
│ ├─ Analiza protagonista                 │
│ ├─ Analiza género/tema                  │
│ ├─ Genera ~12 variaciones falsas         │
│ └─ Selecciona 2-3 más creíbles           │
│                                          │
│ Retorna: [                               │
│   {content: "real spoiler", isReal: true},│
│   {content: "fake spoiler", isReal: false},│
│   {content: "fake spoiler", isReal: false} │
│ ]                                        │
│                                          │
└─────────────────────────────────────────┘
           │
           ▼
Frontend: Renderiza spoilers numerados
│
├─ 1. "El palo sale del sombrero"
├─ 2. "Harry descubre que Snape es..."
├─ 3. "Dumbledore revela su pasado..."
│
└─ Bot: "¿Cuál crees que es el REAL?"
     [1] [2] [3]
           │
Usuario elige...
           │
           ▼
Bot: Revela respuesta + explica
```

---

## 🧠 Detección de Intents

### Flujo de Detección

```
Usuario escribe mensaje
           │
           ▼
┌─────────────────────────────────────────┐
│ Frontend: detectIntentClient()           │
│                                          │
│ Regex matching contra 12 patrones:      │
│ ├─ REQUEST_BOOK (prioridad 1)           │
│ ├─ NOTIFY (prioridad 2)                 │
│ ├─ SPOILER (prioridad 3)                │
│ ├─ SEARCH (prioridad 4)                 │
│ ├─ RECOMMEND (prioridad 5)              │
│ ├─ TEST (prioridad 6)                   │
│ ├─ GREETING                             │
│ ├─ HELP                                 │
│ ├─ THANKS                               │
│ └─ Fallback: SEARCH                     │
│                                          │
│ Si no coincide nada:                    │
│ └─ Fallback a SEARCH si tiene keywords  │
│    de libros (libro, autor, saga, etc)  │
│                                          │
└─────────────────────────────────────────┘
           │
           ▼
Envía intent al backend (opcional)
           │
           ▼
Frontend: askLumosAI()
│
└─ switch(intent) {
     case 'request': showBookRequestForm()
     case 'search': executeSearch()
     case 'recommend': showRecommendOptions()
     case 'notify': showNotificationTypes()
     case 'spoiler': askForBookTitle()
     case 'test': startReaderTest()
     case 'greeting': showWelcomeMessage()
   }
```

### Patrones de Intent

| Intent | Patrones | Ejemplos |
|--------|----------|----------|
| **REQUEST** | solicitar, pedir, quiero..solicitar, no encuentr, no está, agregar | "quiero solicitar", "pide este libro" |
| **NOTIFY** | avisa, notifica, avisame, suscri, cuando suba, novedades | "avísame de Colleen Hoover", "notificarme" |
| **SPOILER** | spoiler, spoilers, qué pasa, cuenta, revela | "spoilers de Harry", "qué le pasa a" |
| **SEARCH** | busco, buscar, encontrar, tienes, hay | "busca libros de romance", "tienes a King" |
| **RECOMMEND** | recomienda, recomendación, sugiere, qué leer | "recomiéndame algo", "qué debo leer" |
| **TEST** | test, preferencia, cuál es, analiza, descubre | "test lector", "analiza mis gustos" |
| **GREETING** | hola, buenos días, hey, qué tal | "hola LUMOS" |
| **HELP** | ayuda, cómo, explica, tutorial | "ayuda", "cómo funciona" |

---

## 🎨 Recomendaciones Inteligentes

### Arquitectura de Razones Personalizadas

```javascript
POST /api/books/recommend
Input: {type: 'saga', preferences: 'dragones'}

// Paso 1: Filtrado por tema
booksMatchingPreference(books, 'dragones')
├─ Busca 'dragó' o 'dragon' en:
│  ├─ book.title
│  ├─ book.description
│  ├─ book.categories
│  └─ book.author
└─ Retorna: solo libros que contengan dragones

// Paso 2: Filtrado por tipo
type === 'saga'
└─ Filtra book.saga existe y tiene name

// Paso 3: Selección aleatoria
selectedBooks = booksToRecommend
  .sort(() => Math.random() - 0.5)
  .slice(0, 3)

// Paso 4: Generación de razones
Para cada libro:
  ├─ Intenta Ollama:
  │  prompt = `escribe 1-2 oraciones por qué...`
  │  ├─ Si response.length < 25: fallback
  │  ├─ Si "dragones" aparece > 1 vez: fallback
  │  └─ Si válida: usa respuesta
  │
  └─ Fallback: generateSmartReason()
     ├─ Detecta tema en preferences
     ├─ Obtiene array de 8 templates para ese tema
     ├─ Selecciona: templates[index % 8]
     └─ Retorna: razón temática

// Razones por tema (8 templates cada una):
DRAGONES:
  1. "Un mundo épico donde los dragones..."
  2. "La presencia de dragones es magistral..."
  3. "Una saga donde las bestias aladas..."
  ... (8 total)

MAGIA:
  1. "Un sistema de magia complejo y..."
  2. "La magia aquí no es un simple..."
  ... (8 total)

ROMANCE:
  1. "Te enamorarás de la profundidad..."
  2. "Una historia de amor que crece..."
  ... (8 total)

OSCURIDAD:
  1. "Un mundo donde la oscuridad..."
  2. "La atmósfera es tan sombría..."
  ... (8 total)

MISTERIO:
  1. "Un misterio tan bien construido..."
  2. "Cada capítulo abre nuevas..."
  ... (8 total)

GUERRA:
  1. "Un épico de guerra donde los..."
  2. "Las batallas aquí son descritas..."
  ... (8 total)

GENÉRICO (fallback):
  1. "Una novela cautivadora..."
  2. "Un épico bien construido..."
  ... (8 total)
```

### Ejemplo de Resultado

```json
{
  "success": true,
  "found": true,
  "recommendation": "He encontrado estas 3 joyas...",
  "books": [
    {
      "id": "book_123",
      "title": "Alas de Ónix",
      "author": "Rebecca Yarros",
      "saga": {"name": "Empíreo", "book": 1},
      "reason": "Un mundo épico donde los dragones no son solo criaturas..."
    },
    {
      "id": "book_456",
      "title": "La Danza de Dragones",
      "author": "George R R Martin",
      "saga": {"name": "Canción de Hielo y Fuego", "book": 5},
      "reason": "La presencia de dragones es magistral: poderosos..."
    },
    ...
  ]
}
```

---

## 🔮 Sistema de Spoilers

### 4 Niveles de Búsqueda

```
POST /api/spoilers
Input: {book: "Harry Potter", character?: null, attempt: 1}

┌─────────────────────────────────────────────────────┐
│ NIVEL 1: BD Local (spoilers predefineados)          │
│                                                     │
│ if (spoilerDB[bookTitle]) {                         │
│   spoiler = spoilerDB[bookTitle];                   │
│   cache[bookTitle] = spoiler;                       │
│   return [spoiler, fake1, fake2];                   │
│ }                                                   │
└─────────────────────────────────────────────────────┘
                      │
                      ▼ (Si no encontrado)
┌─────────────────────────────────────────────────────┐
│ NIVEL 2: Cache (spoilers-cache.json)                │
│                                                     │
│ if (cacheData[bookTitle]) {                         │
│   spoiler = cacheData[bookTitle];                   │
│   return [spoiler, fake1, fake2];                   │
│ }                                                   │
└─────────────────────────────────────────────────────┘
                      │
                      ▼ (Si no encontrado)
┌─────────────────────────────────────────────────────┐
│ NIVEL 3: APIs Externas                              │
│                                                     │
│ APIs a intentar:                                    │
│ 1. SpoilThePlot: search by title                    │
│ 2. Wikipedia: fetch article → extract spoilers     │
│ 3. OpenLibrary: get book data                       │
│ 4. Google Books: fetch description                 │
│                                                     │
│ Para cada API:                                      │
│ ├─ Extract keywords (muere, traición, revela...)  │
│ ├─ Busca sentencias con keywords                    │
│ ├─ Trunca a max 150 caracteres                      │
│ ├─ Si válido: cache + return                        │
│ └─ Si no: intenta siguiente API                     │
│                                                     │
│ Timeout: 15 segundos por API                        │
└─────────────────────────────────────────────────────┘
                      │
                      ▼ (Si todas fallan)
┌─────────────────────────────────────────────────────┐
│ NIVEL 4: Generación con Ollama                      │
│                                                     │
│ prompt = `Genera 3 spoilers falsos para ${book}...` │
│                                                     │
│ ├─ Genera random fake spoilers                      │
│ ├─ Valida longitud (20-200 chars)                   │
│ ├─ Cache en memory                                  │
│ └─ Retorna: [fake1, fake2, fake3]                   │
│                                                     │
│ Timeout: 30 segundos                                │
└─────────────────────────────────────────────────────┘

// Generación de fakes
generateFakeSpoilers(book, count=2)
├─ Analiza género (fantasy, romance, thriller, etc)
├─ Obtiene protagonista (si existe)
├─ Obtiene antagonista (si existe)
├─ Genera templates falsos basados en tema
├─ 12+ variaciones únicas por llamada
└─ Selecciona count más creíbles
```

### Estructura de Response

```json
{
  "success": true,
  "spoilers": [
    {
      "content": "Harry descubre que es un Horcrux...",
      "isReal": true
    },
    {
      "content": "Ron se vuelve profesor de Defensa...",
      "isReal": false
    },
    {
      "content": "Hermione y Harry se casan...",
      "isReal": false
    }
  ],
  "source": "ollama|api|cache|db"
}
```

---

## 📡 Endpoints API

### 📚 Libros
```
GET /api/books/search
  Input: query=string
  Output: {found, books}

GET /api/books/recommend
  Input: category=string, type=string (legacy)
  Output: {book}

POST /api/books/recommend ⭐
  Input: {type, preferences}
  Output: {recommendation, books}

POST /api/books/test
  Input: {favoriteBooks}
  Output: {recommendations}
```

### 📝 Solicitudes
```
POST /api/requests/book
  Input: {title, author, email}
  Output: {success, message}

POST /api/requests/notify
  Input: {type, filters, email}
  Output: {success, message}

GET /api/requests/pending
  (admin) Output: {requests}
```

### 🔮 Spoilers
```
POST /api/spoilers
  Input: {book, character?, attempt}
  Output: {spoilers}
```

### 🤖 Chat IA
```
POST /lumos-chat
  Input: {message}
  Output: {reply, books?, spoilers?}
```

---

## 💾 Base de Datos JSON

### books.json (193+ libros)
```json
[
  {
    "id": "book_1698234723",
    "title": "Alas de Sangre",
    "author": "Rebecca Yarros",
    "publisher": "Molicule Editorial",
    "publishedDate": "2023-06-27",
    "description": "En el corazón de una...",
    "pageCount": 640,
    "imageLinks": {
      "smallThumbnail": "url",
      "thumbnail": "url"
    },
    "language": "es",
    "categories": ["Fantasy", "Romance"],
    "averageRating": 4.5,
    "ratingsCount": 1234,
    "saga": {
      "name": "Empíreo",
      "book": 1
    }
  }
]
```

### data/requests.json (Solicitudes)
```json
[
  {
    "id": "req_1...",
    "title": "Crepúsculo",
    "author": "Stephenie Meyer",
    "email": "user@example.com",
    "status": "pending|notified",
    "createdAt": "2025-12-25T10:30:00Z",
    "notifiedAt": "2025-12-25T15:45:00Z"
  }
]
```

### data/notifications.json (Suscriptores)
```json
[
  {
    "id": "notif_1...",
    "email": "user@example.com",
    "type": "author|saga|all",
    "filters": {
      "author": "Colleen Hoover"
    },
    "createdAt": "2025-12-25T10:30:00Z"
  }
]
```

---

## 🔐 Seguridad y Mejoras

### ⚠️ Problemas Actuales

1. **Sin autenticación en admin routes**
   - Cualquiera puede hacer POST /api/admin/add-book
   - **Solución**: Implementar JWT o API keys

2. **JSON como BD**
   - No escalable a millones de libros
   - No tiene índices de búsqueda
   - **Solución**: Migrar a MongoDB o PostgreSQL

3. **Rate limiting ausente**
   - Spammers pueden saturar el servidor
   - **Solución**: express-rate-limit middleware

4. **SendGrid en .env sin encriptación**
   - API key visible en repositorio
   - **Solución**: Nunca commitear .env, usar variables de Render

5. **Ollama sin caché eficiente**
   - Cada solicitud igual regenera respuesta
   - **Solución**: Redis cache de generaciones

### 📋 Hoja de ruta de mejoras

- [ ] Implementar autenticación OAuth2
- [ ] Migrar a PostgreSQL con índices full-text
- [ ] Rate limiting y DDoS protection
- [ ] Cache Redis para Ollama
- [ ] Integración S3 para portadas
- [ ] Analytics y tracking de usuario
- [ ] Dashboard admin mejorado
- [ ] Búsqueda ElasticSearch
- [ ] Logging centralizado (Sentry)
- [ ] Testing (Jest + Supertest)

---

## 📊 Estadísticas del Proyecto

```
Archivos principales:
├─ server.js              4661 líneas
├─ public/lumos.html      2327 líneas
├─ routes/books.js         513 líneas
├─ routes/requests.js      370+ líneas
├─ routes/spoilers.js      450+ líneas
├─ services/aiService.js   33KB+
├─ services/emailService   27KB+
└─ services/ollamaService  190 líneas

Total: ~800+ líneas de documentación
       ~15000+ líneas de código

Base de datos:
├─ books.json             193+ libros
├─ data/requests.json     solicitudes activas
└─ data/notifications.json suscriptores activos

APIs integradas:
├─ SendGrid (email)
├─ Google Books
├─ Wikipedia
├─ OpenLibrary
├─ SpoilThePlot
└─ Ollama (local)
```

---

## 🚀 Deployment

### Local
```bash
npm install
npm start
# http://localhost:3000
```

### Render
```
Build: npm install
Start: node server.js
Env variables: SENDGRID_API_KEY, EMAIL_FROM, SITE_URL
```

### Variables de entorno requeridas
```
SENDGRID_API_KEY=your_key
EMAIL_FROM=your_email@gmail.com
SITE_URL=https://your-domain.com
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
GOOGLE_BOOKS_API_KEY=your_key (opcional)
```

---

**Documento actualizado: 29 de Diciembre, 2025**  
**Versión: 2.0 - Recomendaciones Inteligentes + Test Lector**
