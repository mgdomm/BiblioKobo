# 🔮 AZKABAN BRAIN - Guía de Instalación Chromebook ARM

## 📋 Requisitos Previos

### Hardware
- **Chromebook con Qualcomm Snapdragon SC7180** (8 hilos, 2.1 GHz)
- **Mínimo 4 GB RAM** (recomendado 8 GB)
- **10 GB espacio libre** para modelo + datos

### Software
- **Linux (Crostini)** activado en Chromebook
- **Node.js 16+** instalado
- **Git** instalado
- **Conexión a Internet** para descargas iniciales

---

## 🚀 Instalación Rápida

### Paso 1: Preparar Chromebook

1. **Activar Linux en Chromebook:**
   - Settings → Developers → Linux development environment → Turn on
   - Espera a que termine la instalación (5-10 min)

2. **Abrir Terminal Linux:**
   - Launcher → Terminal

3. **Actualizar sistema:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **Instalar Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   node --version  # Debe mostrar v18.x
   ```

### Paso 2: Clonar Proyecto

```bash
cd ~
git clone https://github.com/TU_USUARIO/BiblioKobo.git
cd BiblioKobo
```

### Paso 3: Ejecutar Script de Instalación ARM

```bash
./setup-azkaban-arm.sh
```

Este script automáticamente:
- ✅ Verifica arquitectura ARM64
- ✅ Instala dependencias del sistema (cmake, build-essential)
- ✅ Clona y compila llama.cpp para ARM
- ✅ Descarga TinyLlama 7B GGUF (~3.5 GB)
- ✅ Configura rutas en azkabanBrain.js
- ✅ Crea archivos de datos vacíos

**⏱️ Tiempo estimado:** 20-40 minutos (depende de conexión)

### Paso 4: Instalar Dependencias Node.js

```bash
npm install
```

Esto instalará:
- `@tensorflow/tfjs-node` (embeddings)
- `@tensorflow-models/universal-sentence-encoder` (opcional)
- `axios`, `express`, etc.

### Paso 5: Iniciar Servidor

```bash
npm start
```

El servidor iniciará en `http://localhost:3000`

---

## 🧪 Probar Instalación

### 1. Verificar Estado

```bash
curl http://localhost:3000/api/azkaban/status
```

**Respuesta esperada:**
```json
{
  "available": true,
  "model": "TinyLlama-7B-ARM",
  "platform": "linux",
  "arch": "arm64",
  "uptime": 10.5,
  "memory": {...}
}
```

### 2. Primera Pregunta

```bash
curl -X POST http://localhost:3000/api/azkaban/ask \
  -H 'Content-Type: application/json' \
  -d '{"query":"¿Quién eres?"}'
```

**⏱️ Primera ejecución:** 1-2 minutos (carga modelo en RAM)  
**Siguientes:** 30-60 segundos por respuesta

**Respuesta esperada:**
```json
{
  "success": true,
  "response": "Las sombras de Azkaban murmuran mi nombre...\nSoy el guardián ancestral de esta biblioteca maldita...",
  "sources": [],
  "elapsed": 45.2,
  "model": "TinyLlama-7B-ARM"
}
```

### 3. Indexar Biblioteca

```bash
curl -X POST http://localhost:3000/api/azkaban/index
```

Esto procesará todos los libros de `books.json` y generará embeddings.

---

## 📁 Estructura de Archivos

```
BiblioKobo/
├── llama.cpp/              # Compilado para ARM64
│   └── build/
│       └── bin/
│           └── main        # Binario TinyLlama
├── models/
│   └── tinyllama-7b.gguf   # Modelo descargado (~3.5 GB)
├── data/
│   └── book-chunks.json    # Chunks + embeddings indexados
├── services/
│   ├── azkabanBrain.js     # Motor principal IA
│   ├── embeddingService.js # Embeddings TF.js
│   └── ragService.js       # RAG + chunking
├── public/
│   └── lumos-widget.js     # Widget integrado
└── server.js               # Endpoints API
```

---

## 🔧 Configuración Avanzada

### Ajustar Rendimiento

Edita `services/azkabanBrain.js`:

```javascript
const CONFIG = {
  MAX_TOKENS: 280,        // ↓ Reducir para respuestas más rápidas
  THREADS: 8,             // = Núcleos de tu CPU
  TEMPERATURE: 0.32,      // ↑ Aumentar para más creatividad
  TIMEOUT: 120000         // Timeout en ms
};
```

### Optimizar para 4 GB RAM

Si tienes solo 4 GB RAM:

1. **Reducir chunk size:**
   ```javascript
   // services/ragService.js
   const CONFIG = {
     CHUNK_SIZE: 300,  // En vez de 400
     MAX_LOCAL_RESULTS: 3  // En vez de 5
   };
   ```

2. **Usar embeddings simples:**
   ```javascript
   // services/embeddingService.js
   // Comentar la carga de TensorFlow:
   model = 'simple';  // Fallback directo
   ```

### Cambiar Modelo

Si quieres probar otros modelos GGUF compatibles:

1. Descarga desde [HuggingFace](https://huggingface.co/models?search=gguf)
2. Coloca en `models/`
3. Actualiza `CONFIG.MODEL_PATH` en `azkabanBrain.js`

**Modelos recomendados para ARM:**
- `TinyLlama-1.1B-Chat` ✅ (actual)
- `Phi-2-GGUF` ⚠️ (más pesado, 7 GB)
- `OpenLLaMA-3B` ✅ (intermedio)

---

## 🎨 Integración con LUMOS Widget

El widget ya está configurado para usar Azkaban Brain.

### En cualquier página HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Mi Biblioteca</title>
</head>
<body>
  <!-- Tu contenido -->
  
  <!-- LUMOS Widget con Azkaban Brain -->
  <script src="/lumos-widget.js"></script>
  <script>
    // Configurar endpoint de Azkaban
    window.LumosWidget.init({
      apiEndpoint: '/api/azkaban/ask',
      theme: 'stranger-things'
    });
  </script>
</body>
</html>
```

### Personalizar Respuestas

Edita `SYSTEM_PROMPT` en `azkabanBrain.js`:

```javascript
const SYSTEM_PROMPT = `
Eres AZKABAN, prisionero milenario...
[Tu personalización aquí]
`;
```

---

## 🐛 Solución de Problemas

### ❌ Error: "llama.cpp no disponible"

**Causa:** No se compiló llama.cpp  
**Solución:**
```bash
cd llama.cpp
mkdir -p build && cd build
cmake ..
make -j8
```

### ❌ Error: "Modelo no encontrado"

**Causa:** TinyLlama no descargado  
**Solución:**
```bash
mkdir -p models
wget -O models/tinyllama-7b.gguf \
  https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf
```

### ⏱️ Respuestas muy lentas (>3 minutos)

**Causa:** Pocos hilos o modelo muy grande  
**Solución:**
```javascript
// Aumentar hilos en azkabanBrain.js
THREADS: $(nproc),  // Usa todos los núcleos
```

### 💾 Error: "Out of memory"

**Causa:** RAM insuficiente  
**Solución:**
1. Cerrar aplicaciones en Chromebook
2. Reducir `CHUNK_SIZE` y `MAX_LOCAL_RESULTS`
3. Usar embeddings simples (desactivar TensorFlow)

### 🌐 Búsqueda externa no funciona

**Causa:** API Key de Google Books no configurada  
**Solución:**
```bash
# Crear .env en raíz del proyecto
echo "GOOGLE_BOOKS_API_KEY=tu_key_aqui" > .env
```

---

## 📊 Rendimiento Esperado

### Snapdragon SC7180 (8 hilos @ 2.1 GHz)

| Tarea | Tiempo | Calidad |
|-------|--------|---------|
| Primera respuesta | 90-120s | Alta |
| Respuestas subsecuentes | 30-60s | Alta |
| Indexar 100 libros | 15-20 min | - |
| Búsqueda local | <2s | Alta |

### Comparación con GPU

| Hardware | Respuesta | Notas |
|----------|-----------|-------|
| **ARM CPU** (tu caso) | 30-60s | ✅ 100% gratis |
| GPU NVIDIA RTX 3060 | 2-5s | 💰 Requiere hardware |
| Cloud GPU (Colab) | 1-3s | 💰 Límites gratuitos |

---

## 🔒 Seguridad para 5-10 Usuarios

### Autenticación Simple

```javascript
// server.js
const authMiddleware = (req, res, next) => {
  const token = req.headers['x-auth-token'];
  if (token !== process.env.AUTH_TOKEN) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};

app.post('/api/azkaban/ask', authMiddleware, async (req, res) => {
  // ... tu código
});
```

### Rate Limiting

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10 // 10 requests por minuto
});

app.use('/api/azkaban', limiter);
```

---

## 🆘 Soporte

### Logs

```bash
# Ver logs en tiempo real
npm start | tee azkaban.log

# Buscar errores
grep -i error azkaban.log
```

### Diagnosticar

```bash
# Verificar proceso TinyLlama
ps aux | grep main

# Uso de memoria
free -h

# Uso de CPU
top
```

---

## ✨ Próximas Mejoras

- [ ] Cache de respuestas frecuentes
- [ ] Streaming de respuestas (Server-Sent Events)
- [ ] Soporte multi-idioma
- [ ] Integración con Discord/Telegram
- [ ] Panel de administración web

---

## 📚 Referencias

- [llama.cpp](https://github.com/ggerganov/llama.cpp)
- [TinyLlama](https://github.com/jzhang38/TinyLlama)
- [GGUF Models](https://huggingface.co/models?search=gguf)
- [TensorFlow.js](https://www.tensorflow.org/js)

---

**🎉 ¡Disfruta de tu guardián literario personal!**

*"Las sombras de Azkaban guardan mil historias... ¿Cuál deseas descubrir?"*
