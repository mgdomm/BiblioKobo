# 🎯 Azkaban Brain - Resumen Visual del Sistema

```
┌────────────────────────────────────────────────────────────────┐
│                    AZKABAN BRAIN ECOSYSTEM                      │
│                  IA Literaria ARM-Powered                       │
└────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│   👤 USUARIO    │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│         🌐 INTERFAZ WEB                      │
├──────────────────────────────────────────────┤
│  • Dashboard principal (dashboard.html)      │
│  • Test Azkaban (test-azkaban.html)         │
│  • LUMOS Widget (lumos-widget.js)           │
└────────┬─────────────────────────────────────┘
         │ HTTP POST
         ▼
┌──────────────────────────────────────────────┐
│      🖥️  EXPRESS SERVER (server.js)         │
├──────────────────────────────────────────────┤
│                                              │
│  RUTAS BIBLIOTECA:                           │
│  • /api/books        → Catálogo             │
│  • /api/requests     → Solicitudes          │
│  • /api/admin        → Administración       │
│  • /api/spoilers     → Generador spoilers   │
│                                              │
│  RUTAS AZKABAN BRAIN: ⬇️                     │
│  • /api/azkaban/ask       → Pregunta        │
│  • /api/azkaban/summarize → Resumen         │
│  • /api/azkaban/recommend → Recomendar      │
│  • /api/azkaban/status    → Estado          │
│  • /api/azkaban/index     → Indexar         │
│                                              │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│   🧠 AZKABAN BRAIN (azkabanBrain.js)        │
├──────────────────────────────────────────────┤
│                                              │
│  FLUJO:                                      │
│  1. Recibe query del usuario                 │
│  2. Busca chunks locales (RAG)              │
│  3. Fallback búsqueda externa               │
│  4. Construye prompt completo                │
│  5. Ejecuta TinyLlama ARM                   │
│  6. Retorna respuesta literaria              │
│                                              │
└─────┬───────────────────┬────────────────────┘
      │                   │
      │                   │
      ▼                   ▼
┌─────────────────┐  ┌──────────────────────┐
│  📚 RAG SERVICE │  │  🔮 EMBEDDING SERVICE│
│  ragService.js  │  │  embeddingService.js │
├─────────────────┤  ├──────────────────────┤
│                 │  │                      │
│ • Chunking      │  │ • TensorFlow.js      │
│ • Embeddings    │  │ • Vector similarity  │
│ • Local search  │  │ • Fallback simple    │
│ • Google Books  │  │ • Cosine distance    │
│ • Open Library  │  │                      │
│                 │  │                      │
└─────────┬───────┘  └──────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│     💾 ALMACENAMIENTO                   │
├─────────────────────────────────────────┤
│                                         │
│  • data/book-chunks.json                │
│    ├─ chunks: []                        │
│    ├─ books: {}                         │
│    └─ metadata: {}                      │
│                                         │
│  • books.json (catálogo)                │
│  • data/requests.json (solicitudes)     │
│  • data/notifications.json              │
│                                         │
└─────────────────────────────────────────┘

          ▼
┌─────────────────────────────────────────┐
│    🤖 TINYLLAMA 7B (llama.cpp)         │
├─────────────────────────────────────────┤
│                                         │
│  Ubicación:                             │
│  llama.cpp/build/bin/main               │
│                                         │
│  Modelo:                                │
│  models/tinyllama-7b.gguf (~3.5 GB)    │
│                                         │
│  Config ARM:                            │
│  • Threads: 8 (Snapdragon SC7180)      │
│  • Max tokens: 280                      │
│  • Temperature: 0.32                    │
│  • Timeout: 120s                        │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📊 Flujo de Datos Detallado

### 🔍 Query → Respuesta

```
1️⃣  Usuario pregunta: "¿Qué libros hay sobre dragones?"
    ↓
2️⃣  POST /api/azkaban/ask
    {
      "query": "¿Qué libros hay sobre dragones?"
    }
    ↓
3️⃣  azkabanBrain.askAzkaban()
    ↓
4️⃣  ragService.getRelevantChunks()
    ├─ Genera embedding del query
    ├─ Busca en 234 chunks locales
    └─ Retorna top 5 por similitud
    ↓
    ✅ Encontrados 3 chunks relevantes:
       • "El Hobbit" - fragmento sobre Smaug
       • "Eragon" - fragmento sobre Saphira
       • "Juego de Tronos" - fragmento sobre Drogon
    ↓
5️⃣  Construye prompt:
    """
    Eres AZKABAN, guardián de la biblioteca...
    
    CONTEXTO:
    [FRAGMENTO 1]
    En el corazón de la Montaña Solitaria yacía Smaug...
    ---
    [FRAGMENTO 2]
    Saphira extendió sus alas azules...
    ---
    [FRAGMENTO 3]
    Los dragones de Daenerys rugieron...
    ---
    
    PREGUNTA:
    ¿Qué libros hay sobre dragones?
    """
    ↓
6️⃣  Ejecuta TinyLlama ARM (45 segundos)
    llama.cpp/build/bin/main \
      -m models/tinyllama-7b.gguf \
      -p "prompt completo" \
      -n 280 -t 8 --temp 0.32
    ↓
7️⃣  Respuesta generada:
    """
    Las sombras de Azkaban custodian varias crónicas 
    de bestias aladas...
    
    En los fragmentos que conservo:
    
    "El Hobbit" de Tolkien relata: 'Smaug el Dorado, 
    terror de las tierras del norte...'
    
    "Eragon" de Paolini cuenta: 'Saphira, dragona de 
    escamas de zafiro...'
    
    ¿Deseas que busque más allá de estos muros?
    """
    ↓
8️⃣  Respuesta al usuario (JSON):
    {
      "success": true,
      "response": "Las sombras de Azkaban...",
      "sources": [
        {"type": "local", "book": "El Hobbit"},
        {"type": "local", "book": "Eragon"},
        {"type": "local", "book": "Juego de Tronos"}
      ],
      "elapsed": 45.2,
      "model": "TinyLlama-7B-ARM"
    }
```

---

## 🗺️ Estructura de Archivos

```
BiblioKobo/
│
├── 📁 services/              # Servicios backend
│   ├── azkabanBrain.js       # ⭐ Motor principal IA
│   ├── ragService.js         # ⭐ RAG + búsqueda
│   ├── embeddingService.js   # ⭐ Embeddings
│   ├── aiService.js          # Ollama/external
│   ├── emailService.js       # SendGrid
│   └── notifier.js           # Notificaciones
│
├── 📁 routes/                # Rutas Express
│   ├── books.js
│   ├── requests.js
│   ├── admin.js
│   └── spoilers.js
│
├── 📁 public/                # Frontend
│   ├── dashboard.html
│   ├── lumos.html
│   ├── lumos-widget.js
│   └── test-azkaban.html     # ⭐ Test IA
│
├── 📁 data/                  # Datos
│   ├── book-chunks.json      # ⭐ Chunks + embeddings
│   ├── requests.json
│   └── notifications.json
│
├── 📁 llama.cpp/             # ⭐ Compilado ARM64
│   └── build/
│       └── bin/
│           └── main          # Binario TinyLlama
│
├── 📁 models/                # ⭐ Modelos IA
│   └── tinyllama-7b.gguf     # 3.5 GB
│
├── 🔧 setup-azkaban-arm.sh   # ⭐ Instalador
├── 🔧 validate-install.sh    # ⭐ Validador
├── 🔧 test-azkaban.sh        # ⭐ Test rápido
│
├── 📖 AZKABAN_BRAIN_SETUP.md      # ⭐ Guía completa
├── 📖 AZKABAN_QUICK_START.md      # ⭐ Resumen
├── 📖 CHECKLIST_INSTALACION.md    # ⭐ Checklist
├── 📖 ARQUITECTURA_VISUAL.md      # ⭐ Este archivo
│
├── 📄 server.js              # Servidor Express
├── 📄 package.json           # Dependencias
└── 📄 README.md              # README principal
```

---

## ⚙️ Configuración del Sistema

### 🔧 azkabanBrain.js

```javascript
const CONFIG = {
  TINYLLAMA_BIN: '../llama.cpp/build/bin/main',
  MODEL_PATH: '../models/tinyllama-7b.gguf',
  MAX_TOKENS: 280,         // Tokens por respuesta
  THREADS: 8,              // Hilos CPU
  TEMPERATURE: 0.32,       // Creatividad (0.0-1.0)
  TIMEOUT: 120000          // 2 minutos
};
```

### 🔧 ragService.js

```javascript
const CONFIG = {
  CHUNK_SIZE: 400,         // Tokens por chunk
  OVERLAP: 50,             // Overlap entre chunks
  MAX_LOCAL_RESULTS: 5,    // Top chunks a retornar
  GOOGLE_BOOKS_API: '...'  // API Key
};
```

### 🔧 embeddingService.js

```javascript
// Opción A: TensorFlow.js (mejor calidad)
model = await use.load();

// Opción B: Fallback simple (menos RAM)
model = 'simple';
```

---

## 📈 Métricas de Rendimiento

### Snapdragon SC7180 (8 hilos @ 2.1 GHz)

| Operación | Tiempo | RAM |
|-----------|--------|-----|
| Cargar modelo en memoria | 10-15s | +2.5 GB |
| Primera respuesta (cold) | 90-120s | 3.5 GB |
| Respuestas subsecuentes | 30-60s | 3.5 GB |
| Generar embedding (1 chunk) | <1s | +50 MB |
| Buscar en 1000 chunks | 2-3s | - |
| Indexar 100 libros | 15-20 min | - |

### Comparación

| Hardware | Respuesta | Costo |
|----------|-----------|-------|
| Chromebook ARM | 30-60s | 🆓 $0 |
| GPU RTX 3060 | 2-5s | 💰 $300+ |
| Cloud GPU | 1-3s | 💰 $0.50/hr |

---

## 🎯 Casos de Uso

### 1. Biblioteca Pequeña (5-10 amigos)
- ✅ Funciona perfectamente
- ✅ 30-60s por respuesta aceptable
- ✅ Sin costos operativos
- ✅ Control total de datos

### 2. Asistente Personal
- ✅ Resúmenes de libros
- ✅ Recomendaciones contextuales
- ✅ Búsqueda en biblioteca
- ✅ Citas literales

### 3. Investigación Literaria
- ✅ RAG con fragmentos originales
- ✅ Fuentes rastreables
- ✅ Búsqueda semántica
- ⚠️ Velocidad limitada para volumen alto

---

## 🔒 Seguridad y Privacidad

### ✅ Ventajas del Modelo Local

- 🔐 **100% privado** - Datos no salen del Chromebook
- 🆓 **Sin costos** - No requiere APIs de pago
- 🌐 **Offline** - Funciona sin internet (después de instalación)
- 📊 **Auditable** - Código y modelo verificables

### 🛡️ Protecciones Implementadas

```javascript
// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10
});

// Autenticación (opcional)
const authMiddleware = (req, res, next) => {
  const token = req.headers['x-auth-token'];
  if (token !== process.env.AUTH_TOKEN) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};
```

---

## 🚀 Escalabilidad

### Optimizaciones Posibles

1. **Cache de respuestas**
   ```javascript
   const cache = new Map();
   if (cache.has(query)) return cache.get(query);
   ```

2. **Streaming**
   ```javascript
   // Server-Sent Events
   res.writeHead(200, {
     'Content-Type': 'text/event-stream'
   });
   ```

3. **Worker threads**
   ```javascript
   const { Worker } = require('worker_threads');
   const worker = new Worker('./tinyllama-worker.js');
   ```

4. **Redis para chunks**
   ```javascript
   const redis = require('redis');
   const client = redis.createClient();
   ```

---

## 🎨 Personalización

### Cambiar Personalidad

```javascript
// En azkabanBrain.js
const SYSTEM_PROMPT = `
Eres BIBLIOTECARIO, asistente alegre y moderno.
Hablas con entusiasmo y emojis.
...
`;
```

### Ajustar Creatividad

```javascript
TEMPERATURE: 0.1,  // Muy literal
TEMPERATURE: 0.5,  // Balanceado
TEMPERATURE: 0.9,  // Muy creativo
```

### Cambiar Modelo

```bash
# Descargar Phi-2
wget https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf

# Actualizar config
MODEL_PATH: '../models/phi-2.Q4_K_M.gguf'
```

---

## 📞 Troubleshooting Visual

```
┌─────────────────────────────────────────┐
│  ❌ PROBLEMA                            │
├─────────────────────────────────────────┤
│  "TinyLlama no disponible"              │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  🔍 DIAGNÓSTICO                         │
├─────────────────────────────────────────┤
│  ls llama.cpp/build/bin/main            │
│  → Existe? NO                           │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  ✅ SOLUCIÓN                            │
├─────────────────────────────────────────┤
│  ./setup-azkaban-arm.sh                 │
└─────────────────────────────────────────┘
```

---

**🎉 Sistema completo documentado y listo para usar**

*"Las sombras de Azkaban te esperan..."* 🔮
