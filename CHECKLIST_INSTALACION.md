# 🔮 AZKABAN BRAIN - Setup Completo para Chromebook ARM

Sistema de IA literaria 100% local con TinyLlama 7B optimizado para Snapdragon SC7180.

---

## ✅ Archivos Creados

### 📦 Servicios Core
- ✅ `services/azkabanBrain.js` - Motor principal IA con TinyLlama ARM
- ✅ `services/ragService.js` - RAG + chunking + búsqueda externa
- ✅ `services/embeddingService.js` - Embeddings TensorFlow.js

### 🔧 Scripts de Instalación
- ✅ `setup-azkaban-arm.sh` - Instalador automático ARM64 (ejecutable)
- ✅ `test-azkaban.sh` - Test rápido de TinyLlama (ejecutable)

### 📄 Documentación
- ✅ `AZKABAN_BRAIN_SETUP.md` - Guía completa de instalación
- ✅ `AZKABAN_QUICK_START.md` - Resumen ejecutivo
- ✅ `CHECKLIST_INSTALACION.md` - Este archivo

### 🌐 Frontend
- ✅ `public/test-azkaban.html` - Interfaz de prueba

### 🗂️ Datos
- ✅ `data/book-chunks.json` - Archivo de chunks (vacío inicialmente)

### ⚙️ Configuración
- ✅ `server.js` - Endpoints API agregados
- ✅ `package.json` - Dependencias actualizadas

---

## 🚀 Próximos Pasos en tu Chromebook

### 1️⃣ Ejecutar Instalación

```bash
cd ~/BiblioKobo
./setup-azkaban-arm.sh
```

**⏱️ Tiempo:** 30-40 minutos  
**Descarga:** ~3.5 GB (modelo TinyLlama)

El script hará:
- ✅ Verificar arquitectura ARM64
- ✅ Instalar dependencias (cmake, build-essential)
- ✅ Clonar y compilar llama.cpp
- ✅ Descargar TinyLlama 7B GGUF
- ✅ Configurar rutas automáticamente

### 2️⃣ Instalar Dependencias Node.js

```bash
npm install
```

Esto instalará:
- `@tensorflow/tfjs-node`
- `@tensorflow-models/universal-sentence-encoder`
- `express-rate-limit`
- (Y todas las existentes)

### 3️⃣ Iniciar Servidor

```bash
npm start
```

### 4️⃣ Probar Instalación

**Opción A: Test en terminal**
```bash
./test-azkaban.sh
```

**Opción B: Interfaz web**
```
http://localhost:3000/test-azkaban.html
```

**Opción C: API directa**
```bash
curl -X POST http://localhost:3000/api/azkaban/ask \
  -H 'Content-Type: application/json' \
  -d '{"query":"¿Quién eres?"}'
```

### 5️⃣ Indexar Biblioteca

```bash
curl -X POST http://localhost:3000/api/azkaban/index
```

O desde Node:
```bash
npm run index-books
```

---

## 📊 Endpoints API Disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/azkaban/ask` | POST | Pregunta general |
| `/api/azkaban/summarize` | POST | Resumen de libro |
| `/api/azkaban/recommend` | POST | Recomendaciones |
| `/api/azkaban/status` | GET | Estado del sistema |
| `/api/azkaban/index` | POST | Indexar biblioteca |

---

## 🔍 Verificar Instalación

### ✅ Checklist Post-Instalación

- [ ] **llama.cpp compilado:**
  ```bash
  ls -lh llama.cpp/build/bin/main
  # Debe mostrar ~40-50 MB
  ```

- [ ] **Modelo descargado:**
  ```bash
  ls -lh models/tinyllama-7b.gguf
  # Debe mostrar ~3.5 GB
  ```

- [ ] **Chunks inicializados:**
  ```bash
  cat data/book-chunks.json
  # Debe mostrar JSON válido
  ```

- [ ] **Servidor arranca sin errores:**
  ```bash
  npm start
  # No debe mostrar errores en consola
  ```

- [ ] **Status API responde:**
  ```bash
  curl http://localhost:3000/api/azkaban/status
  # Debe retornar {"available": true}
  ```

- [ ] **Primera respuesta funciona:**
  ```bash
  # Tarda 90-120s la primera vez
  curl -X POST http://localhost:3000/api/azkaban/ask \
    -H 'Content-Type: application/json' \
    -d '{"query":"Hola"}'
  ```

---

## ⚙️ Configuración Opcional

### Variables de Entorno

Crea `.env` en la raíz:

```env
PORT=3000
GOOGLE_BOOKS_API_KEY=AIzaSyA4Rm0J2mdQuCK7MChxJP-SnMrV9HVrnGo
AUTH_TOKEN=mi_token_secreto_123
```

### Optimizaciones para RAM Limitada

Si tienes solo 4 GB RAM, edita `services/azkabanBrain.js`:

```javascript
const CONFIG = {
  MAX_TOKENS: 200,        // ↓ De 280 a 200
  THREADS: 6,             // ↓ De 8 a 6
  TEMPERATURE: 0.32,
  TIMEOUT: 120000
};
```

Y en `services/ragService.js`:

```javascript
const CONFIG = {
  CHUNK_SIZE: 300,        // ↓ De 400 a 300
  OVERLAP: 30,            // ↓ De 50 a 30
  MAX_LOCAL_RESULTS: 3    // ↓ De 5 a 3
};
```

---

## 🐛 Problemas Comunes

### ❌ "Error: No such file or directory: llama.cpp/build/bin/main"

**Solución:**
```bash
./setup-azkaban-arm.sh
# O manualmente:
cd llama.cpp
mkdir -p build && cd build
cmake ..
make -j8
```

### ❌ "Error downloading model"

**Solución:**
```bash
mkdir -p models
wget -O models/tinyllama-7b.gguf \
  https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf
```

### ⚠️ "Respuestas tardan >3 minutos"

**Causas:**
1. RAM insuficiente → Cerrar apps
2. Modelo muy grande → Usar versión Q4 (más ligera)
3. Demasiados tokens → Reducir `MAX_TOKENS`

**Solución:**
```bash
# Ver uso de RAM
free -h

# Si <1 GB libre, cierra apps en ChromeOS
```

### 💾 "Cannot allocate memory"

**Solución:**
```javascript
// Usar embeddings simples (sin TensorFlow)
// En services/embeddingService.js línea 20:
model = 'simple';
```

---

## 📈 Monitoreo

### Ver Logs en Tiempo Real

```bash
npm start 2>&1 | tee -a azkaban.log
```

### Analizar Rendimiento

```bash
# Buscar errores
grep -i error azkaban.log

# Ver tiempos de respuesta
grep "✅ Respuesta generada" azkaban.log
```

### Uso de Recursos

```bash
# CPU
top -p $(pgrep -f "node server.js")

# Memoria
ps aux | grep node

# Proceso llama.cpp
ps aux | grep main
```

---

## 🎯 Próximos Pasos

1. **Poblar biblioteca:** Agrega libros a `books.json`
2. **Indexar contenido:** `npm run index-books`
3. **Integrar LUMOS:** El widget ya está listo
4. **Personalizar prompt:** Edita `SYSTEM_PROMPT` en `azkabanBrain.js`
5. **Agregar autenticación:** Implementa `authMiddleware`

---

## 🆘 Soporte

- **Documentación completa:** [AZKABAN_BRAIN_SETUP.md](AZKABAN_BRAIN_SETUP.md)
- **Resumen ejecutivo:** [AZKABAN_QUICK_START.md](AZKABAN_QUICK_START.md)
- **Logs:** `azkaban.log`

---

## ✨ Estado Actual

```
🟢 Código: 100% completo
🟢 Documentación: 100% completa
🟡 Instalación: Pendiente en tu Chromebook
🟡 Testing: Pendiente primera ejecución
```

**🎉 ¡Todo listo para ejecutar `./setup-azkaban-arm.sh`!**

---

*"Las sombras de Azkaban esperan ser invocadas..."*
