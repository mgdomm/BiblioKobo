# 📚 BiblioKobo - Resumen Global Ejecutivo

## 🎯 ¿Qué es BiblioKobo?

**BiblioKobo** (Azkaban Reads) es una **plataforma web inteligente de gestión de libros + asistente IA conversacional** que permite a los usuarios:

1. ✅ Solicitar libros específicos y recibir notificaciones cuando estén disponibles
2. ✅ Descubrir nuevos libros mediante recomendaciones personalizadas
3. ✅ Interactuar con LUMOS, un asistente que entiende sus intenciones automáticamente
4. ✅ Obtener spoilers (reales + falsos) de libros y personajes
5. ✅ Analizar sus preferencias de lectura mediante tests interactivos

---

## 🏗️ Arquitectura en 30 segundos

```
Frontend (HTML/CSS/JS)
    ↓
Express.js Backend
    ├─ 4 Rutas principales (books, requests, spoilers, admin)
    ├─ 6 Servicios (AI, Email, Ollama, Notifier, etc)
    └─ FileHandler (CRUD JSON)
    ↓
Datos JSON + SendGrid Email + Ollama IA
```

---

## 💡 Características principales

### 1️⃣ **Detección Inteligente de Intents**
LUMOS entiende automáticamente lo que el usuario quiere:

```
"Quiero solicitar Alas de Sangre"        → REQUEST_BOOK
"Recomiéndame algo"                      → RECOMMEND  
"Spoilers de Harry Potter"               → SPOILER
"Notificarme de Colleen Hoover"          → NOTIFY
"Test lector"                            → TEST
```

**Implementación**: Regex patterns en frontend (client-side) + backend (server-side)

### 2️⃣ **Recomendaciones Personalizadas por Tema**
El sistema recomienda libros Y genera razones personalizadas:

```
Usuario: "Recomiéndame algo de dragones"
         ↓
Sistema:
1. Filtra libros que REALMENTE hablen de dragones
2. Selecciona 3 aleatorios
3. Para cada uno genera razón como:
   "Un mundo épico donde los dragones moldean destinos"
   
⭐ Cada tema (dragones, magia, romance, etc.) tiene 8 razones únicas
```

### 3️⃣ **Test de Preferencias del Lector**
Analiza gustos en 3 pasos:

```
1. Usuario da 3 libros favoritos
2. Sistema analiza:
   - Categorías comunes (Fantasy, Romance, etc)
   - Autores preferidos
   - ¿Ama sagas o standlones?
3. Recomienda 3 libros SIN duplicados
```

### 4️⃣ **Generador Inteligente de Spoilers**
4 niveles de búsqueda:

```
1. BD local (spoilers predefinidos)
   ↓ No encontrado
2. Cache (spoilers previos)
   ↓ No encontrado
3. APIs externas (Wikipedia, Google Books, etc)
   ↓ No encontrado
4. Ollama IA (generación local)

+ Genera 2-3 spoilers FALSOS basados en análisis narrativo
```

### 5️⃣ **Sistema de Notificaciones por Email**
5 tipos de emails automáticos:

```
✉️ Confirmación de solicitud → Usuario solicita libro
✉️ Libro capturado → Se sube el libro solicitado
✉️ Confirmación de suscripción → Usuario se suscribe
✉️ Notificación al admin (solicitud) → Log de nuevas solicitudes
✉️ Notificación al admin (suscripción) → Log de nuevas suscripciones

Diseño: LUMOS retro (cyan + terminal)
Compatibility: Gmail, iCloud, Outlook ✅
```

---

## 📊 Stack Tecnológico

| Capa | Tecnología | Detalles |
|------|-----------|----------|
| **Frontend** | HTML5 + CSS3 + Vanilla JS | 2300+ líneas, state machine, detección intents |
| **Backend** | Node.js + Express.js | 4661 líneas, 4 routers, 6 servicios |
| **BD** | Archivos JSON | 193+ libros, solicitudes, notificaciones |
| **Email** | SendGrid API REST | Sin SMTP, plantillas HTML personalizadas |
| **IA** | Ollama + neural-chat | Local, 60s timeout, fallback a templates |
| **Hosting** | Render | Deployment automático desde GitHub |

---

## 🔄 Flujos principales

### Flujo 1: Solicitar un libro
```
Usuario: "Quiero solicitar Alas de Sangre"
   ↓
LUMOS: "¿A qué email te notificamos?"
   ↓
Sistema guarda solicitud + envía 2 emails:
   ├─ Email confirmación → usuario
   └─ Notificación → admin
   
(Cuando admin sube el libro)
   ↓
Email automático: "¡Tu libro está disponible!"
```

### Flujo 2: Obtener recomendaciones
```
Usuario: "Recomiéndame algo de dragones"
   ↓
Sistema:
1. Filtra libros con dragones en título/descripción/categorías
2. Selecciona 3 aleatorios
3. Genera razón personalizada para cada uno
   ↓
LUMOS muestra 3 tarjetas con razones sobre dragones
```

### Flujo 3: Pedir spoilers
```
Usuario: "Spoilers de Harry Potter"
   ↓
Sistema intenta 4 niveles:
1. BD local (rápido)
2. Cache (instantáneo)
3. APIs externas (Wikipedia, etc)
4. Ollama IA (genera fakes)
   ↓
LUMOS muestra 3 spoilers:
├─ 1 real
├─ 2 falsos creíbles
   ↓
Usuario elige cuál cree que es real
```

### Flujo 4: Test de preferencias
```
LUMOS pide 3 libros favoritos
   ↓
Sistema analiza patrones
   ↓
Recomienda 3 libros similares sin duplicados
```

---

## 📈 Números del Proyecto

```
💻 Código:
   - 4661 líneas (server.js)
   - 2327 líneas (lumos.html)
   - 513 líneas (routes/books.js)
   - 800+ líneas de documentación

📚 Datos:
   - 193+ libros en catálogo
   - 7 temas de recomendación (dragones, magia, romance, oscuro, misterio, guerra, genérico)
   - 8 razones por tema × 7 = 56 razones personalizadas
   - 12+ patrones de intent detection

🔌 Integraciones:
   - SendGrid (email)
   - Google Books API
   - Wikipedia API
   - OpenLibrary API
   - Ollama (IA local)
   - Render (hosting)
```

---

## 🎨 Características Únicas

### ✨ Recomendaciones Temáticas
En lugar de recomendaciones genéricas, cada tema tiene razones específicas:

**Dragones**: "Criaturas épicas que moldean destinos"
**Magia**: "Sistemas complejos que son el alma de la historia"
**Romance**: "Profundidad emocional en adversidades imposibles"
**Oscuridad**: "Moralidad gris explorada sin piedad"
**Misterio**: "Preguntas tejidas en cada capítulo"
**Guerra**: "Conflictos militares que definen imperios"

### 💬 Detección Automática de Intents
El usuario no necesita menú. LUMOS entiende:

```
"Hola" → GREETING
"Ayuda" → HELP
"Busca romance" → SEARCH
"Test lector" → TEST
"Spoiler de" → SPOILER
"Recomiéndame" → RECOMMEND
"Solicitar" → REQUEST
"Avísame de" → NOTIFY
```

### 🔮 Spoilers + Juego
No solo devuelve spoilers reales, sino que:
1. Genera 2-3 spoilers FALSOS creíbles
2. El usuario adivina cuál es real
3. Sistema revela y explica

### 📧 Emails Temáticos
Todos los emails tienen diseño LUMOS retro (cyan + terminal) y son compatible con Gmail, iCloud, Outlook.

---

## 🚀 Deployment

### Local
```bash
npm install
npm start
# http://localhost:3000
```

### Producción (Render)
```
Cada push a GitHub → Automático deployment
Variables de entorno: SENDGRID_API_KEY, EMAIL_FROM, SITE_URL
```

---

## ⚙️ Endpoints principales

### 📚 Libros
- `GET /api/books/search` - Buscar por título/autor/saga
- `POST /api/books/recommend` - Recomendaciones personalizadas
- `POST /api/books/test` - Test de preferencias

### 📝 Solicitudes
- `POST /api/requests/book` - Solicitar un libro
- `POST /api/requests/notify` - Suscribirse a notificaciones

### 🔮 Spoilers
- `POST /api/spoilers` - Generar spoilers

### 🤖 Chat
- `POST /lumos-chat` - Asistente conversacional

---

## 🔐 Seguridad

### ⚠️ Problemas conocidos
- ❌ Sin autenticación en admin routes (CRÍTICO)
- ❌ JSON como BD (no escalable)
- ❌ Sin rate limiting (vulnerable a spam)
- ❌ .env en repositorio (expone API keys)

### 📋 Próximas mejoras
- ✅ Implementar JWT autenticación
- ✅ Migrar a PostgreSQL
- ✅ Rate limiting
- ✅ Redis cache para Ollama
- ✅ S3 para portadas

---

## 📚 Documentación

1. **README.md** - Guía de instalación y features
2. **ARQUITECTURA_COMPLETA.md** - Documento técnico detallado (2000+ líneas)
3. **Este archivo** - Resumen ejecutivo

---

## 📊 Última actualización

- **Fecha**: 29 de Diciembre, 2025
- **Versión**: 2.0 - Recomendaciones Inteligentes + Test Lector
- **Commits recientes**:
  - ✅ Fix test lector y recomendaciones por tema
  - ✅ Agregar guerra como tema específico
  - ✅ Documentación completa
  
- **Status en Render**: ✅ Desplegado exitosamente

---

## 🎯 Próximas prioridades

1. ✅ Test exhaustivo del test lector (sin duplicados)
2. ✅ Validación de razones Ollama (rechazo de responses inválidas)
3. 📋 Autenticación admin
4. 📋 Caché mejorado de spoilers
5. 📋 Analytics de usuario

---

## 📞 Contacto

- **GitHub**: https://github.com/mgdomm/BiblioKobo
- **Hosting**: Render
- **Email**: azkabanreads@gmail.com

---

**"Los libros permanecen capturados entre estos muros... y solo los elegidos pueden acceder a ellos."** 🪄

*BiblioKobo © 2025 - Azkaban Reads*
