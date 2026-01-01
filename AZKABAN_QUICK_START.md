# 🔮 Azkaban Brain - Resumen Ejecutivo

## ¿Qué es esto?

**Azkaban Brain** es un asistente literario de IA que funciona **100% local** en tu Chromebook ARM (Snapdragon SC7180), sin necesidad de GPU ni servicios cloud de pago.

### Características Principales

✅ **TinyLlama 7B** compilado para ARM64  
✅ **RAG (Retrieval-Augmented Generation)** con embeddings locales  
✅ **Búsqueda híbrida**: local + Google Books/Open Library  
✅ **Fragmentación inteligente** de libros (chunking)  
✅ **Respuestas literarias** con tono de "guardián de Azkaban"  
✅ **API REST** integrada en servidor Express  
✅ **Widget LUMOS** listo para usar  

---

## 🚀 Instalación Rápida (3 pasos)

### 1. Preparar Chromebook

```bash
# Activar Linux (Crostini) en Settings → Developers
# Luego en Terminal:
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git
```

### 2. Clonar e instalar

```bash
git clone https://github.com/TU_USUARIO/BiblioKobo.git
cd BiblioKobo
./setup-azkaban-arm.sh  # Tarda ~30 min (descarga modelo 3.5 GB)
npm install
```

### 3. Iniciar servidor

```bash
npm start
# Abre http://localhost:3000/test-azkaban.html
```

---

## 📊 Rendimiento Esperado

| Métrica | Valor |
|---------|-------|
| **Primera respuesta** | 90-120 segundos |
| **Respuestas subsecuentes** | 30-60 segundos |
| **Uso de RAM** | 3-4 GB |
| **Calidad** | Alta (contexto literario coherente) |

---

## 🎯 Casos de Uso

### 1. Pregunta Simple
```bash
curl -X POST http://localhost:3000/api/azkaban/ask \
  -H 'Content-Type: application/json' \
  -d '{"query":"¿Quién escribió 1984?"}'
```

**Respuesta:**
```json
{
  "response": "Las sombras de Azkaban murmuran ese nombre... George Orwell, prisionero de su propia distopía, forjó '1984' en las cenizas de la Segunda Guerra Mundial...",
  "elapsed": 42.3,
  "model": "TinyLlama-7B-ARM"
}
```

### 2. Resumen de Libro
```bash
curl -X POST http://localhost:3000/api/azkaban/summarize \
  -H 'Content-Type: application/json' \
  -d '{"bookTitle":"El Señor de los Anillos"}'
```

### 3. Recomendaciones
```bash
curl -X POST http://localhost:3000/api/azkaban/recommend \
  -H 'Content-Type: application/json' \
  -d '{"preferences":"fantasía épica con dragones"}'
```

---

## 🏗️ Arquitectura

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │ HTTP POST /api/azkaban/ask
       ▼
┌─────────────────────────────────┐
│  Express Server (server.js)     │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Azkaban Brain                  │
│  (azkabanBrain.js)              │
├─────────────────────────────────┤
│ 1. Buscar chunks locales (RAG)  │
│ 2. Fallback búsqueda externa    │
│ 3. Construir prompt completo    │
│ 4. Ejecutar TinyLlama ARM       │
└──────┬──────────────────────────┘
       │
       ├──► RAG Service (ragService.js)
       │    ├─ Chunking
       │    ├─ Embeddings
       │    └─ Búsqueda Google/Open Library
       │
       └──► TinyLlama 7B (llama.cpp)
            └─ Respuesta literaria
```

---

## 📁 Archivos Principales

| Archivo | Descripción |
|---------|-------------|
| [`services/azkabanBrain.js`](services/azkabanBrain.js) | Motor principal IA |
| [`services/ragService.js`](services/ragService.js) | RAG + chunking + búsqueda externa |
| [`services/embeddingService.js`](services/embeddingService.js) | Embeddings TF.js |
| [`setup-azkaban-arm.sh`](setup-azkaban-arm.sh) | Instalador ARM64 |
| [`AZKABAN_BRAIN_SETUP.md`](AZKABAN_BRAIN_SETUP.md) | Documentación completa |
| [`test-azkaban.sh`](test-azkaban.sh) | Test rápido |
| [`public/test-azkaban.html`](public/test-azkaban.html) | Interfaz de prueba |

---

## 🔧 Configuración

### Variables de Entorno

Crea un archivo `.env`:

```env
PORT=3000
GOOGLE_BOOKS_API_KEY=tu_key_aqui
AUTH_TOKEN=tu_token_secreto  # Opcional para autenticación
```

### Ajustar Rendimiento

Edita [`services/azkabanBrain.js`](services/azkabanBrain.js):

```javascript
const CONFIG = {
  MAX_TOKENS: 280,        // ↓ Reducir = más rápido
  THREADS: 8,             // = Núcleos de tu CPU
  TEMPERATURE: 0.32,      // ↑ Aumentar = más creativo
  TIMEOUT: 120000         // 2 minutos
};
```

---

## 🎨 Integración con LUMOS Widget

Ya está integrado automáticamente. Solo incluye en tu HTML:

```html
<script src="/lumos-widget.js"></script>
<script>
  window.LumosWidget.init({
    apiEndpoint: '/api/azkaban/ask',
    theme: 'stranger-things'
  });
</script>
```

---

## 🐛 Solución de Problemas

### ❌ "TinyLlama no disponible"

```bash
# Verificar instalación
ls -lh llama.cpp/build/bin/main
ls -lh models/tinyllama-7b.gguf

# Si faltan, ejecutar:
./setup-azkaban-arm.sh
```

### ⏱️ Respuestas muy lentas (>3 min)

```bash
# Cerrar apps en Chromebook para liberar RAM
# Reducir tokens en azkabanBrain.js:
MAX_TOKENS: 200  # En vez de 280
```

### 💾 "Out of memory"

Usa embeddings simples (sin TensorFlow):

```javascript
// En services/embeddingService.js línea 20:
model = 'simple';  // Comentar la carga de TF
```

---

## 📈 Próximas Mejoras

- [ ] Cache de respuestas frecuentes (Redis)
- [ ] Streaming de respuestas (SSE)
- [ ] Multi-idioma (inglés/español)
- [ ] Panel de administración web
- [ ] Integración Discord/Telegram

---

## 🆘 Ayuda

**Documentación completa:** [AZKABAN_BRAIN_SETUP.md](AZKABAN_BRAIN_SETUP.md)

**Test rápido:**
```bash
./test-azkaban.sh
```

**Ver logs:**
```bash
npm start 2>&1 | tee azkaban.log
```

---

## 📚 Stack Tecnológico

- **LLM:** TinyLlama 7B (GGUF)
- **Inferencia:** llama.cpp (ARM64)
- **Embeddings:** TensorFlow.js / Fallback simple
- **Backend:** Node.js + Express
- **RAG:** Custom chunking + vector search
- **Frontend:** LUMOS Widget + test UI

---

## 🎉 Resultado Final

```
Usuario: "¿Qué libros tienes sobre dragones?"
         ↓
Azkaban Brain busca en 234 chunks locales
         ↓
Encuentra 3 fragmentos relevantes de "El Hobbit"
         ↓
TinyLlama genera respuesta literaria (45s)
         ↓
Respuesta: "Las sombras de Azkaban guardan ecos de Smaug...
           En los fragmentos que conservo, Tolkien describe:
           'El dragón yacía inmenso, escarlata y dorado...'
           
           ¿Deseas explorar más tesoros custodiados por bestias aladas?"
```

---

**✨ "Los muros de Azkaban guardan mil historias... ¿Cuál deseas descubrir?"**

---

## 📄 Licencia

MIT © MG

---

## 🔗 Enlaces

- [TinyLlama](https://github.com/jzhang38/TinyLlama)
- [llama.cpp](https://github.com/ggerganov/llama.cpp)
- [TensorFlow.js](https://www.tensorflow.org/js)
- [GGUF Models](https://huggingface.co/models?search=gguf)
