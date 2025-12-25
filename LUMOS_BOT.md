# 🤖 LUMOS - Asistente inteligente de Azkaban Reads

**LUMOS es el guardián oscuro de Azkaban Reads.** Un asistente conversacional impulsado por IA que vive en los muros de la plataforma, ofreciendo búsqueda de libros, revelación de spoilers inteligentes, solicitudes personalizadas y suscripciones a notificaciones.

---

## 🎯 ¿Qué es LUMOS?

LUMOS es un chatbot retro-futurista embebido en la página que:

- 💬 Mantiene conversaciones naturales sobre libros
- 📚 Busca libros en el catálogo
- 🔮 Genera spoilers inteligentes (reales + fake)
- 📝 Registra solicitudes de libros específicos
- 🔔 Gestiona suscripciones a notificaciones
- 📧 Coordina envío automático de emails

**Tema visual**: Terminal retro VT323 con colores cian (#00FFFF) sobre negro (#000)

---

## 🎨 Interfaz y diseño

### Ubicación
- Botón flotante en esquina inferior derecha: **`L⚡MOS`**
- Abre panel chat 400×650px (desktop) o fullscreen (mobile)
- Overlay oscuro para enfoque

### Estructura visual

```
┌─────────────────────────┐
│ 🪄 LUMOS                │ ← Header con logo
│ Guardián de Azkaban     │
├─────────────────────────┤
│                         │
│  [Mensajes del chat]    │ ← Área de mensajes
│                         │
├─────────────────────────┤
│ [Input field] [Send]    │ ← Barra de entrada
└─────────────────────────┘
```

### Colores
- **Texto LUMOS**: #00FFFF (cian)
- **Texto usuario**: #00FFFF (cian claro)
- **Fondo**: #000 (negro puro)
- **Bordes**: #00FFFF (2px)
- **Sombra**: 0 0 15px rgba(0,255,255,0.6)

### Fuente
- **VT323**: Monospace retro estilo terminal
- Importada desde Google Fonts
- 18.5px en desktop, escalada en tablet/mobile

---

## 💬 Cómo usar LUMOS

### Paso 1: Abrir el chat
Click en botón flotante **L⚡MOS** esquina inferior derecha

### Paso 2: Escribir mensaje
El bot entiende múltiples tipos de solicitudes:

#### 📚 Buscar libros
```
"quiero leer alas de sangre"
"libros de colleen hoover"
"busca novelas de fantasía"
"qué novelas de percy jackson hay"
```

#### 🔮 Pedir spoilers
```
"spoilers de crepúsculo"
"qué pasa en alas de sangre"
"cuéntame el final de divergente"
"spoiler de harry potter"
```

#### 👤 Spoilers de personajes
```
"qué le pasa a harry"
"muere bellatrix"
"el destino de frodo"
"qué pasa con katniss"
```

#### 📝 Solicitar un libro
```
"quiero que me avises cuando tengan alas de sangre"
"necesito que busques un libro: el quijote de cervantes"
"solicito la saga de percy jackson"
```

#### 🔔 Suscribirse a notificaciones
```
"notificarme cuando suban libros de J.K. Rowling"
"quiero avisos de nuevos libros de Percy Jackson"
"dame notificación de todas las novedades"
```

#### 🎲 Otras opciones
```
"dame una recomendación"
"test de lectura"
"búsqueda de spoilers"
"necesito ayuda"
```

---

## 🧠 Inteligencia y detección de intents

### Cómo LUMOS entiende tus mensajes

LUMOS utiliza **expresiones regulares** y **análisis semántico** para detectar automáticamente:

| Intención | Palabras clave | Acción |
|-----------|---|---|
| **Búsqueda de libro** | "quiero", "busca", "hay", "tenéis" | Busca en catálogo |
| **Spoiler general** | "spoiler", "qué pasa", "final", "cuéntame" | Genera 3 spoilers (1 real + 2 fake) |
| **Spoiler personaje** | "muere", "le pasa a", "el destino de", "qué hace" | Pide confirmación del libro |
| **Solicitud de libro** | "quiero", "solicito", "busca", "necesito" | Pide título, autor, email |
| **Suscripción autor** | "notificarme", "aviso", "autor", "de" | Pide nombre del autor |
| **Suscripción saga** | "notificarme", "aviso", "saga", "de" | Pide nombre de la saga |
| **Todas las novedades** | "notificarme", "aviso", "todo", "todas" | Pide email |

### Precisión
- ✅ Detecta palabras clave + contexto
- ✅ Pide confirmación si hay ambigüedad
- ✅ Maneja sinónimos (cuéntame ≈ spoiler)
- ✅ Distingue libro vs. personaje

---

## 🔮 Sistema de spoilers

### Cómo funcionan los spoilers

```
Usuario: "spoilers de alas de sangre"
           ↓
LUMOS detecta intent "spoiler"
           ↓
POST /api/spoilers con { title: "alas de sangre" }
           ↓
aiService busca en 4 APIs:
  1. SpoilThePlot
  2. Wikipedia
  3. OpenLibrary
  4. Google Books
           ↓
Extrae fragmentos (máx 150 caracteres)
           ↓
Busca palabras clave: "muere", "traición", "revela", "secreto"
           ↓
Genera 2 spoilers falsos dinámicamente
           ↓
Retorna: 1 real + 2 fake
           ↓
Usuario elige cuál cree que es real
           ↓
LUMOS revela respuesta (sin spam warning)
```

### Características

**Spoiler real:**
- Extraído de APIs públicas
- Máximo 150 caracteres (corto, no sinopsis)
- Contiene spoiler puro sin relleno

**Spoilers falsos:**
- Generados dinámicamente basados en análisis narrativo
- Nunca repiten (cada spoiler genera diferentes fakes)
- ~12 plantillas diferentes
- Analiza: protagonista, antagonista, aliados, stakes, temas

**Ejemplo:**
```
Real:    "La verdadera identidad de Rhysand es más oscura de lo que parece"
Fake 1:  "Feysand tiene que separarse al final de ACOTAR"
Fake 2:  "Tamlin muere en el ataque final a la Corte de Sangre"
```

---

## 📧 Flujos de solicitudes y notificaciones

### Solicitar un libro

```
Usuario: "quiero leer el quijote"
         ↓
LUMOS: ¿Cuál es el autor? / ¿De qué libro hablas?
Usuario: "Cervantes" / "Don Quijote"
         ↓
LUMOS: ¿Cuál es tu correo?
Usuario: usuario@example.com
         ↓
POST /api/requests/book
{
  title: "Don Quijote",
  author: "Cervantes",
  email: "usuario@example.com"
}
         ↓
✅ Se guarda en data/requests.json
✅ Email confirmación → usuario@example.com
✅ Email notificación → admin (azkabanreads@gmail.com)
```

**Cuando el libro se sube:**
```
Admin: POST /api/admin/add-book
notifier.checkPendingRequests()
         ↓
Encuentra solicitud coincidente
         ↓
✅ Email "libro capturado" → usuario@example.com
Status actualizado: pending → notified
```

### Suscribirse a notificaciones

```
Usuario: "notificarme de J.K. Rowling"
         ↓
LUMOS: ¿De qué tipo? 
Opciones: [Autor] [Saga] [Todas]
Usuario: Click en [Autor]
         ↓
LUMOS: ¿Cuál es tu correo?
Usuario: usuario@example.com
         ↓
POST /api/requests/notify
{
  email: "usuario@example.com",
  type: "author",
  filters: { author: "J.K. Rowling" }
}
         ↓
✅ Se guarda en data/notifications.json
✅ Email confirmación → usuario@example.com
✅ Email notificación → admin
```

**Cuando se sube un libro coincidente:**
```
Admin: POST /api/admin/add-book
{
  title: "Harry Potter y el Misterio del Príncipe",
  author: "J.K. Rowling"
}
notifier.notifySubscribers()
         ↓
Encuentra suscriptores a "J.K. Rowling"
         ↓
✅ Email "libro capturado" → todos los interesados
```

---

## 🎨 Mensajes del bot

### Inicial
```
🪄 LUMOS – Asistente de Azkaban Reads

Las sombras me susurran... ¿qué buscas entre estos muros?

[Buscar libro] [Solicitar libro] [Spoilers] [Notificaciones] [Test]
```

### Confirmaciones
- "Tu solicitud ha sido registrada... La sombras estarán atentas."
- "Estaré atento… incluso desde los muros donde los libros permanecen capturados."
- "Las sombras han tomado nota de tu petición..."

### Errores
- "Algo se mueve en las sombras... error al buscar."
- "Error al procesar la solicitud. Las sombras interfieren..."
- "Necesito el título, autor y tu correo..."

### Spoiler revelado
- "Interesante elección. Pero recuerda: en Azkaban, la verdad y la mentira danzan juntas en las sombras."
- "Sabio. Algunos secretos deben preservarse. ¿Qué más deseas?"

---

## 📱 Responsive design

### Desktop (≥1024px)
- Ancho: 400px
- Alto: 650px (62% viewport)
- Tipografía: 18.5px
- Posición: Esquina inferior derecha (24px offset)

### Tablet (768-1023px)
- Ancho: 400px
- Alto: 70% viewport
- Tipografía: 1.725x (31.7px)
- Chips: 1.45x más grandes

### Mobile (<768px)
- Ancho: 100%
- Alto: 100% (fullscreen)
- Tipografía: 1.65x (30.5px)
- Botones: 1.5x más grandes
- Padding: Aumentado para dedos

---

## ⚙️ Configuración técnica

### Archivo principal
`/public/lumos.html` - Contiene HTML + CSS + JavaScript del bot

### Componentes

**Widget externo** (si se usa en otra página):
```html
<script src="/lumos-widget.js"></script>
```

**Estilos CSS**
- Monospace VT323
- Dark mode puro (#000)
- Neon borders (#00FFFF)
- Glow effects: `box-shadow: 0 0 15px rgba(0,255,255,0.6)`

**JavaScript**
- Sin dependencias (Vanilla)
- Event listeners: click, input, keyboard
- Fetch API para requests
- Local storage para estado

### Variables de configuración

```javascript
// En lumos.html línea ~800
const CONFIG = {
  API_BASE: '/api',
  TIMEOUT: 15000,           // ms para esperar respuesta
  DELAY_ALERT: 800,         // ms antes de mostrar alerta
  MAX_HISTORY: 50           // Máximo de mensajes guardados
};
```

---

## 🔗 API que usa LUMOS

### Búsqueda
```javascript
GET /api/books/search?query=alas%20de%20sangre
```

### Spoilers
```javascript
POST /api/spoilers
Body: { title: "Alas de sangre" }
Response: { 
  spoilers: ["real", "fake1", "fake2"],
  success: true 
}
```

### Solicitudes
```javascript
POST /api/requests/book
Body: { 
  title: "...", 
  author: "...", 
  email: "..." 
}
```

### Notificaciones
```javascript
POST /api/requests/notify
Body: { 
  email: "...", 
  type: "author|saga|all",
  filters: { author: "..." }
}
```

---

## 🎨 Personalización

### Cambiar colores

En `public/lumos.html`, busca:

```css
--lumos-cyan: #00FFFF;      /* Color primario */
--lumos-black: #000;         /* Fondo */
--lumos-dark: #0a0a0a;       /* Cajas secundarias */
```

Cambia a tus colores preferidos.

### Cambiar mensajes

En la función `getLumosResponse()` (línea ~1200):

```javascript
const messages = {
  greeting: "Tu mensaje inicial aquí",
  searching: "Buscando entre las sombras...",
  spoiler: "Tu texto de spoiler..."
};
```

### Cambiar fuente

Si VT323 no te gusta:

```css
@import url('https://fonts.googleapis.com/css2?family=Roboto+Mono&display=swap');
font-family: 'Roboto Mono', monospace;
```

---

## 🐛 Troubleshooting

### Bot no aparece
1. Verificar que el navegador soporte ES6+
2. Revisar console: `F12 → Console`
3. Asegurar que `/lumos.html` está en `public/`

### Mensajes se cortan
- Aumentar altura del panel en CSS (línea ~55)
- Cambiar max-height: 650px → 700px

### Spoilers no funcionan
1. Verificar conectividad a internet
2. Revisar que APIs externas estén disponibles
3. Ver logs de servidor: `[SPOILER]`

### Emails no llegan
- Ver sección "Troubleshooting" en README principal
- Revisar spam folder
- Verificar email en SendGrid

### Chat muy lento
1. Limpiar caché (Ctrl+Shift+R)
2. Revisar Performance: `F12 → Performance`
3. Reducir número de libros en búsqueda (limitar a 10)

---

## 📊 Estadísticas y monitoreo

### Qué monitora LUMOS

En los logs del servidor verás:

```
[SPOILER] Buscando spoiler para: Alas de Sangre
[API] Intentando SpoilThePlot...
[CONFIRM] Email enviado: usuario@example.com
[ADMIN] Notificación enviada al admin
```

### Mensajes clave

| Código | Significado |
|--------|------------|
| `[SPOILER]` | Generación de spoiler |
| `[API]` | Llamada a API externa |
| `[CONFIRM]` | Email de confirmación |
| `[ADMIN]` | Notificación al admin |
| `[ALERT]` | Aviso de spam/carpeta spam |

---

## 🔮 Futuras mejoras

- [ ] Memorizar preferencias del usuario
- [ ] Guardar historial entre sesiones
- [ ] Reacciones emoji a mensajes
- [ ] Voz (text-to-speech)
- [ ] Traducciones múltiples idiomas
- [ ] Integración con Goodreads ratings
- [ ] Recomendaciones basadas en ML

---

## 📝 Guía de desarrollo

### Agregar nuevo intent

1. En `aiService.js`, función `detectIntent()`:

```javascript
// Agregar regex para nuevo intent
const spoiler_genre = /spoiler|genero/i;
if (spoiler_genre.test(message)) {
  return { intent: 'spoiler_genre', ... };
}
```

2. En `public/lumos.html`, función `getLumosResponse()`:

```javascript
case 'spoiler_genre':
  addLumosMessage('¿De qué género?');
  state.waitingFor = 'genre_name';
  break;
```

3. Manejar respuesta:

```javascript
if (state.waitingFor === 'genre_name') {
  // Procesar respuesta
}
```

### Agregar nuevo tipo de email

1. En `services/emailService.js`:

```javascript
async sendMyNewEmail(email, data) {
  const mailContent = {
    from: this.fromEmail,
    to: email,
    subject: '📧 My Subject',
    html: `<!-- HTML -->`
  };
  // ... enviar
}
```

2. Llamar desde donde corresponda (routes/requests.js, etc.)

---

## 📞 Contacto y soporte

- **Issues**: GitHub Issues en mgdomm/BiblioKobo
- **Email**: azkabanreads@gmail.com
- **Deploy**: Render

---

**"Incluso desde los muros donde los libros permanecen capturados, nada escapa a mi vigilancia."** 🪄

*LUMOS – Guardián de Azkaban Reads © 2025*
