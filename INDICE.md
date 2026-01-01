# 📚 Índice de Documentación - Azkaban Brain

## 🎯 ¿Qué documento necesito?

### 🚀 Quiero instalarlo AHORA
→ **[AZKABAN_QUICK_START.md](AZKABAN_QUICK_START.md)**  
   Resumen ejecutivo, 3 pasos, listo en 40 minutos.

### 📖 Necesito la guía completa
→ **[AZKABAN_BRAIN_SETUP.md](AZKABAN_BRAIN_SETUP.md)**  
   458 líneas, paso a paso, troubleshooting, optimizaciones.

### ✅ Ya instalé, ¿funciona todo?
→ **[CHECKLIST_INSTALACION.md](CHECKLIST_INSTALACION.md)**  
   Verificaciones post-instalación, configuración opcional.

### 🗺️ ¿Cómo funciona internamente?
→ **[ARQUITECTURA_VISUAL.md](ARQUITECTURA_VISUAL.md)**  
   Diagramas, flujos de datos, estructura de archivos.

### 🎉 ¿Qué se implementó?
→ **[IMPLEMENTACION_COMPLETA.md](IMPLEMENTACION_COMPLETA.md)**  
   Resumen ejecutivo de todo el proyecto, métricas, logros.

### 📘 Inicio rápido general
→ **[README.md](README.md)**  
   Visión general del proyecto completo (biblioteca + IA).

---

## 📁 Documentación por Categoría

### 🔧 Instalación

| Documento | Tiempo de Lectura | Propósito |
|-----------|-------------------|-----------|
| [AZKABAN_QUICK_START.md](AZKABAN_QUICK_START.md) | 5 min | Instalación rápida |
| [AZKABAN_BRAIN_SETUP.md](AZKABAN_BRAIN_SETUP.md) | 15-20 min | Guía completa |
| [CHECKLIST_INSTALACION.md](CHECKLIST_INSTALACION.md) | 10 min | Verificación |

### 🧠 Arquitectura y Diseño

| Documento | Tiempo de Lectura | Propósito |
|-----------|-------------------|-----------|
| [ARQUITECTURA_VISUAL.md](ARQUITECTURA_VISUAL.md) | 10-15 min | Diagramas y flujos |
| [IMPLEMENTACION_COMPLETA.md](IMPLEMENTACION_COMPLETA.md) | 8-10 min | Resumen técnico |

### 📖 General

| Documento | Tiempo de Lectura | Propósito |
|-----------|-------------------|-----------|
| [README.md](README.md) | 5-8 min | Visión general |
| [ARQUITECTURA_COMPLETA.md](ARQUITECTURA_COMPLETA.md) | 15 min | Sistema completo |
| [LUMOS_BOT.md](LUMOS_BOT.md) | 10 min | Asistente LUMOS |

---

## 🛠️ Scripts Disponibles

### Instalación
```bash
./setup-azkaban-arm.sh    # Setup completo ARM64 (40 min)
```

### Validación
```bash
./validate-install.sh     # Verificar instalación (2 min)
./test-azkaban.sh         # Test rápido TinyLlama (1 min)
```

### Uso
```bash
./ejemplos-azkaban.sh     # Ejemplos prácticos (5 min)
npm run index-books       # Indexar biblioteca
```

---

## 🔍 Buscar por Tema

### ❓ Tengo un problema

**Problema:** No compila llama.cpp  
→ [AZKABAN_BRAIN_SETUP.md#troubleshooting](AZKABAN_BRAIN_SETUP.md)

**Problema:** Respuestas muy lentas  
→ [AZKABAN_BRAIN_SETUP.md#optimizar-rendimiento](AZKABAN_BRAIN_SETUP.md)

**Problema:** Out of memory  
→ [CHECKLIST_INSTALACION.md#optimizaciones](CHECKLIST_INSTALACION.md)

**Problema:** Puerto en uso  
→ [CHECKLIST_INSTALACION.md#puerto-3000](CHECKLIST_INSTALACION.md)

### 🎨 Quiero personalizarlo

**Cambiar personalidad:**  
→ [AZKABAN_BRAIN_SETUP.md#personalización](AZKABAN_BRAIN_SETUP.md)  
→ [services/azkabanBrain.js](services/azkabanBrain.js) línea 11

**Ajustar rendimiento:**  
→ [AZKABAN_BRAIN_SETUP.md#configuración-avanzada](AZKABAN_BRAIN_SETUP.md)  
→ [services/azkabanBrain.js](services/azkabanBrain.js) línea 36

**Cambiar modelo:**  
→ [AZKABAN_BRAIN_SETUP.md#cambiar-modelo](AZKABAN_BRAIN_SETUP.md)

### 🚀 Quiero expandirlo

**Cache de respuestas:**  
→ [ARQUITECTURA_VISUAL.md#escalabilidad](ARQUITECTURA_VISUAL.md)

**Streaming SSE:**  
→ [ARQUITECTURA_VISUAL.md#optimizaciones](ARQUITECTURA_VISUAL.md)

**Autenticación:**  
→ [AZKABAN_BRAIN_SETUP.md#seguridad](AZKABAN_BRAIN_SETUP.md)

**Rate limiting:**  
→ [AZKABAN_BRAIN_SETUP.md#seguridad](AZKABAN_BRAIN_SETUP.md)

---

## 📖 Orden de Lectura Recomendado

### 🆕 Primera Vez (Usuario Nuevo)

1. **[README.md](README.md)** (5 min)  
   → Entender qué es el proyecto

2. **[AZKABAN_QUICK_START.md](AZKABAN_QUICK_START.md)** (5 min)  
   → Ver resumen de capacidades

3. **[AZKABAN_BRAIN_SETUP.md](AZKABAN_BRAIN_SETUP.md)** (20 min)  
   → Instalar siguiendo guía completa

4. **Ejecutar:** `./setup-azkaban-arm.sh` (40 min)

5. **[CHECKLIST_INSTALACION.md](CHECKLIST_INSTALACION.md)** (10 min)  
   → Verificar que todo funcione

6. **Ejecutar:** `./ejemplos-azkaban.sh` (5 min)  
   → Probar el sistema

### 🔧 Ya lo instalé (Configuración)

1. **[CHECKLIST_INSTALACION.md](CHECKLIST_INSTALACION.md)**  
   → Configuración opcional

2. **[ARQUITECTURA_VISUAL.md](ARQUITECTURA_VISUAL.md)**  
   → Entender cómo funciona

3. **[AZKABAN_BRAIN_SETUP.md#personalización](AZKABAN_BRAIN_SETUP.md)**  
   → Ajustar a tus necesidades

### 💻 Desarrollador (Extender el sistema)

1. **[ARQUITECTURA_VISUAL.md](ARQUITECTURA_VISUAL.md)**  
   → Arquitectura completa

2. **[IMPLEMENTACION_COMPLETA.md](IMPLEMENTACION_COMPLETA.md)**  
   → Detalles de implementación

3. **Código fuente:**
   - [services/azkabanBrain.js](services/azkabanBrain.js)
   - [services/ragService.js](services/ragService.js)
   - [services/embeddingService.js](services/embeddingService.js)

---

## 🎯 Atajos Rápidos

| Necesito... | Ir a... |
|-------------|---------|
| **Instalar en 3 pasos** | [AZKABAN_QUICK_START.md#instalación-rápida](AZKABAN_QUICK_START.md) |
| **Resolver error X** | [AZKABAN_BRAIN_SETUP.md#troubleshooting](AZKABAN_BRAIN_SETUP.md) |
| **Ver ejemplos de uso** | [AZKABAN_QUICK_START.md#casos-de-uso](AZKABAN_QUICK_START.md) |
| **Entender arquitectura** | [ARQUITECTURA_VISUAL.md#flujo-de-datos](ARQUITECTURA_VISUAL.md) |
| **API endpoints** | [README.md#azkaban-brain-api](README.md) |
| **Configurar .env** | [AZKABAN_BRAIN_SETUP.md#variables-de-entorno](AZKABAN_BRAIN_SETUP.md) |
| **Optimizar RAM** | [AZKABAN_BRAIN_SETUP.md#optimizar-para-4gb](AZKABAN_BRAIN_SETUP.md) |
| **Cambiar personalidad** | [services/azkabanBrain.js:11](services/azkabanBrain.js) |
| **Métricas rendimiento** | [ARQUITECTURA_VISUAL.md#rendimiento](ARQUITECTURA_VISUAL.md) |
| **Scripts disponibles** | [package.json](package.json) |

---

## 📊 Mapa del Proyecto

```
BiblioKobo/
│
├── 📖 DOCUMENTACIÓN PRINCIPAL
│   ├── README.md                      → Inicio
│   ├── AZKABAN_QUICK_START.md        → Instalación rápida ⭐
│   ├── AZKABAN_BRAIN_SETUP.md        → Guía completa ⭐
│   ├── CHECKLIST_INSTALACION.md      → Verificación ⭐
│   ├── ARQUITECTURA_VISUAL.md        → Diagramas ⭐
│   ├── IMPLEMENTACION_COMPLETA.md    → Resumen técnico ⭐
│   └── INDICE.md                     → Este archivo
│
├── 🔧 SCRIPTS
│   ├── setup-azkaban-arm.sh          → Instalador ⭐
│   ├── validate-install.sh           → Validador ⭐
│   ├── test-azkaban.sh               → Test rápido ⭐
│   └── ejemplos-azkaban.sh           → Ejemplos ⭐
│
├── 🧠 SERVICIOS
│   ├── services/azkabanBrain.js      → Motor IA ⭐
│   ├── services/ragService.js        → RAG ⭐
│   └── services/embeddingService.js  → Embeddings ⭐
│
├── 🌐 FRONTEND
│   └── public/test-azkaban.html      → Interfaz test ⭐
│
└── 📁 DATOS
    └── data/book-chunks.json         → Chunks + embeddings

⭐ = Archivos creados/modificados para Azkaban Brain
```

---

## 🆘 Ayuda Rápida

### No sé por dónde empezar
```bash
# Lee esto primero:
cat AZKABAN_QUICK_START.md | less

# Luego ejecuta:
./setup-azkaban-arm.sh
```

### Ya instalé pero no funciona
```bash
# Valida instalación:
./validate-install.sh

# Si hay errores, lee:
cat CHECKLIST_INSTALACION.md | less
```

### Quiero ejemplos prácticos
```bash
# Script interactivo:
./ejemplos-azkaban.sh

# O abre en navegador:
xdg-open http://localhost:3000/test-azkaban.html
```

### Necesito entender el código
```bash
# Lee arquitectura:
cat ARQUITECTURA_VISUAL.md | less

# Luego revisa código:
code services/azkabanBrain.js
```

---

## 📞 Contacto y Soporte

### Documentación
- 📖 Todos los `.md` en la raíz del proyecto
- 🔍 Busca con: `grep -r "tu_busqueda" *.md`

### Logs
```bash
# Ver logs en vivo:
npm start 2>&1 | tee azkaban.log

# Buscar errores:
grep -i error azkaban.log

# Últimas 50 líneas:
tail -50 azkaban.log
```

### Estado del Sistema
```bash
curl http://localhost:3000/api/azkaban/status
```

---

## ✨ Siguiente Paso

Si acabas de clonar el repo:

```bash
# 1. Lee el quick start (5 min)
less AZKABAN_QUICK_START.md

# 2. Ejecuta setup (40 min)
./setup-azkaban-arm.sh

# 3. Valida (2 min)
./validate-install.sh

# 4. ¡Usa Azkaban Brain!
npm start
```

---

**🎉 ¡Bienvenido a Azkaban Brain!**

*"Las sombras de la documentación te guían... elige tu camino."* 🔮
