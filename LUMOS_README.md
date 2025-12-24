# 🪄 LUMOS – Asistente de Azkaban Reads

**"Los libros permanecen capturados entre estos muros… y solo los elegidos pueden acceder a ellos."**

## 📌 Descripción

LUMOS es un asistente virtual inteligente para Azkaban Reads que ofrece:

- 🔍 **Búsqueda avanzada** por título, autor o saga
- ❤️ **Recomendaciones personalizadas** de lectura
- 🧪 **Test lector** basado en tus 3 libros favoritos
- 📩 **Solicitud de libros** no disponibles
- 🔔 **Notificaciones automáticas** por email cuando se añaden libros

## 🏗️ Arquitectura

```
/azkaban-reads
├── server.js                 # Servidor principal
├── routes/
│   ├── books.js             # Endpoints de búsqueda y recomendaciones
│   └── requests.js          # Endpoints de solicitudes y notificaciones
├── services/
│   ├── emailService.js      # Servicio de envío de correos
│   └── notifier.js          # Servicio de notificaciones
├── utils/
│   └── fileHandler.js       # Utilidad para manejar archivos JSON
├── data/
│   ├── requests.json        # Solicitudes de libros
│   └── notifications.json   # Suscripciones a notificaciones
└── public/
    ├── lumos.html           # Interfaz del chatbot
    └── lumos-widget.js      # Widget para integrar en cualquier página
```

## ⚙️ Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y configura las variables:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=tu_contraseña_de_aplicacion
SITE_URL=http://localhost:3000
PORT=3000
```

**Nota sobre Gmail**: Necesitas crear una "Contraseña de aplicación" en tu cuenta de Google:
1. Ve a tu cuenta de Google → Seguridad
2. Activa la verificación en dos pasos
3. Genera una "Contraseña de aplicación" para "Correo"
4. Usa esa contraseña en `EMAIL_PASS`

### 3. Iniciar el servidor

```bash
npm start
```

## 🔌 Integración en tu sitio

### Opción 1: Página completa

Accede a `/lumos.html` para ver la interfaz completa del chatbot.

### Opción 2: Widget flotante

Añade este script en cualquier página de tu sitio:

```html
<script src="/lumos-widget.js"></script>
```

Esto mostrará un botón flotante 🪄 en la esquina inferior derecha que abre LUMOS.

### API Pública del Widget

```javascript
// Abrir LUMOS programáticamente
LumosWidget.open();

// Cerrar LUMOS
LumosWidget.close();

// Toggle (abrir/cerrar)
LumosWidget.toggle();
```

## 📡 API Endpoints

### Búsqueda de libros

```http
GET /api/books/search?query=nombre_del_libro
```

**Respuesta:**
```json
{
  "success": true,
  "found": true,
  "message": "He encontrado 3 libros capturados:",
  "books": [...]
}
```

### Recomendación

```http
GET /api/books/recommend?category=fiction&type=saga
```

**Parámetros:**
- `category`: Categoría del libro (opcional)
- `type`: `saga`, `standalone` o `all`

### Test Lector

```http
POST /api/books/test
Content-Type: application/json

{
  "favoriteBooks": [
    { "id": "...", "title": "...", "author": "..." },
    { "id": "...", "title": "...", "author": "..." },
    { "id": "...", "title": "...", "author": "..." }
  ]
}
```

### Solicitar libro

```http
POST /api/requests/book
Content-Type: application/json

{
  "title": "La quinta ola",
  "author": "Rick Yancey",
  "email": "usuario@email.com"
}
```

### Suscribirse a notificaciones

```http
POST /api/requests/notify
Content-Type: application/json

{
  "email": "usuario@email.com",
  "type": "all",
  "filters": {}
}
```

**Tipos de notificación:**
- `all`: Todos los libros nuevos
- `author`: Libros de un autor específico (requiere `filters.author`)
- `saga`: Libros de una saga específica (requiere `filters.saga`)
- `requested`: Libros solicitados por el usuario

## 📧 Sistema de Correos Automáticos

Cuando se añade un libro nuevo:

1. El sistema verifica si hay solicitudes pendientes que coincidan
2. Envía correos automáticos a los usuarios que solicitaron ese libro
3. Actualiza el estado de las solicitudes a `notified`
4. También notifica a usuarios suscritos según sus preferencias

### Ejemplo de correo enviado:

**Asunto:** Un libro capturado ahora está a tu alcance

**Cuerpo:** HTML con narrativa oscura, información del libro y botón para descargarlo.

## 🎨 Personalización

### Cambiar el tema visual

Edita los colores en `/public/lumos.html` y `/public/lumos-widget.js`:

```css
/* Color principal dorado */
#c9a961

/* Fondo oscuro */
#1a1a1a
```

### Modificar mensajes narrativos

Los mensajes están en las funciones de `/routes/books.js` y `/routes/requests.js`.

Ejemplo:
```javascript
message: 'No está disponible… aún.'
```

### Personalizar correos

Edita las plantillas HTML en `/services/emailService.js`.

## 📊 Administración

### Ver solicitudes pendientes

```http
GET /api/requests/pending
```

### Ver estadísticas

```http
GET /api/requests/stats
```

Devuelve:
- Total de solicitudes
- Solicitudes pendientes
- Solicitudes notificadas
- Libros más solicitados

## 🔐 Seguridad

- Las contraseñas de email están en `.env` (no subir al repositorio)
- Validación de formato de email
- Protección contra solicitudes duplicadas
- Rate limiting recomendado para producción

## 🧪 Características del Test Lector

El test analiza:
- Categorías de los libros favoritos
- Autores preferidos
- Preferencia por sagas vs. autoconclusivos

Y devuelve 3 recomendaciones personalizadas basadas en puntuación de similitud.

## 📚 Narrativa

LUMOS mantiene una narrativa **oscura y adulta** coherente en todos los puntos de contacto:

- Los libros están "capturados" y "encerrados"
- El usuario es un "elegido" que puede "liberar" los libros
- Tono serio, misterioso y sofisticado
- Sin infantilismos ni lenguaje casual

## 🐛 Troubleshooting

### Los correos no se envían

1. Verifica que `EMAIL_USER` y `EMAIL_PASS` están correctamente configurados
2. Asegúrate de usar una contraseña de aplicación de Google, no tu contraseña normal
3. Revisa los logs de la consola para errores de Nodemailer

### El widget no aparece

1. Verifica que `/lumos-widget.js` está correctamente cargado
2. Comprueba la consola del navegador para errores
3. Asegúrate de que no hay conflictos de CSS con otros elementos

### Las búsquedas no funcionan

1. Verifica que `books.json` existe y tiene el formato correcto
2. Comprueba que las rutas están correctamente registradas en `server.js`
3. Revisa los logs del servidor para errores

## 📝 Licencia

MIT

---

**LUMOS no es solo un asistente; es un guía entre los libros capturados de Azkaban, entregando acceso solo a quienes lo buscan con atención.** 🔒📚
