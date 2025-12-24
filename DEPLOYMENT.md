# 🚀 Guía de Despliegue de LUMOS

## Pasos para poner LUMOS en producción

### 1. Verificar instalación de dependencias

```bash
npm install
```

Asegúrate de que `nodemailer` está instalado:
```bash
npm list nodemailer
```

### 2. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales reales:

```env
# Gmail para envío de correos
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=tu_contraseña_de_aplicacion_de_google

# URL de tu sitio en producción
SITE_URL=https://azkabanreads.com

# Puerto (usa variable de entorno del hosting si está disponible)
PORT=3000
```

### 3. Generar contraseña de aplicación de Gmail

1. Ve a [myaccount.google.com](https://myaccount.google.com)
2. Seguridad → Verificación en 2 pasos (actívala si no está activa)
3. Contraseñas de aplicaciones → Generar nueva
4. Selecciona "Correo" y "Otro dispositivo personalizado"
5. Copia la contraseña de 16 caracteres generada
6. Pégala en `EMAIL_PASS` en tu archivo `.env`

### 4. Estructura de archivos verificada

Asegúrate de que tienes esta estructura:

```
/azkaban-reads
├── server.js
├── package.json
├── .env (creado por ti, NO subir a git)
├── .env.example
├── routes/
│   ├── books.js
│   ├── requests.js
│   └── admin.js
├── services/
│   ├── emailService.js
│   └── notifier.js
├── utils/
│   └── fileHandler.js
├── data/
│   ├── requests.json
│   └── notifications.json
├── books.json
└── public/
    ├── lumos.html
    ├── lumos-widget.js
    └── lumos-demo.html
```

### 5. Iniciar el servidor

```bash
npm start
```

O en modo desarrollo con auto-reload:
```bash
npm run dev
```

### 6. Probar LUMOS localmente

1. Abre tu navegador en `http://localhost:3000/lumos-demo.html`
2. Haz clic en el botón flotante 🪄
3. Prueba las diferentes funcionalidades
4. Verifica que las búsquedas funcionan
5. Prueba solicitar un libro con tu email

### 7. Integrar en tus páginas

En cualquier página HTML donde quieras LUMOS, añade:

```html
<script src="/lumos-widget.js"></script>
```

Por ejemplo, en tu `dashboard.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Tu código existente -->
</head>
<body>
  <!-- Tu contenido existente -->
  
  <!-- LUMOS Widget -->
  <script src="/lumos-widget.js"></script>
</body>
</html>
```

### 8. Proteger rutas de administración (IMPORTANTE)

Las rutas en `/api/admin/*` deben estar protegidas. Añade middleware de autenticación:

```javascript
// En server.js, ANTES de las rutas de admin:
const adminAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey === process.env.ADMIN_API_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'No autorizado' });
  }
};

app.use('/api/admin', adminAuth, adminRouter);
```

Y en tu `.env`:
```env
ADMIN_API_KEY=tu_clave_secreta_muy_segura
```

### 9. Optimizaciones para producción

#### 9.1 Habilitar CORS si es necesario

```bash
npm install cors
```

En `server.js`:
```javascript
const cors = require('cors');
app.use(cors({
  origin: 'https://azkabanreads.com',
  credentials: true
}));
```

#### 9.2 Rate Limiting

```bash
npm install express-rate-limit
```

En `server.js`:
```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máximo 100 requests por IP
});

app.use('/api/', apiLimiter);
```

#### 9.3 Variables de entorno adicionales

```env
# Modo producción
NODE_ENV=production

# Logs
LOG_LEVEL=info

# Seguridad
ADMIN_API_KEY=clave_muy_segura_aqui
```

### 10. Probar envío de correos

Crea un archivo `test-email.js`:

```javascript
require('dotenv').config();
const emailService = require('./services/emailService');

async function test() {
  await emailService.sendBookCapturedEmail(
    'tu_email_de_prueba@gmail.com',
    'Libro de Prueba',
    'Autor de Prueba',
    'http://localhost:3000/libros'
  );
  console.log('Correo de prueba enviado');
}

test();
```

Ejecuta:
```bash
node test-email.js
```

### 11. Monitoreo y logs

Para producción, considera usar un servicio de logging como:

- **Winston**: Para logs estructurados
- **PM2**: Para gestión de procesos y auto-reinicio
- **Sentry**: Para tracking de errores

Instalación de PM2:
```bash
npm install -g pm2
pm2 start server.js --name "azkaban-reads"
pm2 save
pm2 startup
```

### 12. Backup de datos

Configura backups automáticos de:
- `data/requests.json`
- `data/notifications.json`
- `books.json`

Ejemplo de script de backup:

```bash
#!/bin/bash
BACKUP_DIR="./backups/$(date +%Y-%m-%d)"
mkdir -p $BACKUP_DIR
cp data/requests.json $BACKUP_DIR/
cp data/notifications.json $BACKUP_DIR/
cp books.json $BACKUP_DIR/
echo "Backup completado en $BACKUP_DIR"
```

### 13. SSL/HTTPS

Si usas HTTPS (recomendado para producción), actualiza `SITE_URL`:

```env
SITE_URL=https://azkabanreads.com
```

### 14. Testing

Verifica estos escenarios:

- [ ] Búsqueda de libros funciona
- [ ] Recomendaciones se generan correctamente
- [ ] Test lector procesa 3 libros
- [ ] Solicitudes se guardan en `requests.json`
- [ ] Correos se envían correctamente
- [ ] Notificaciones funcionan al añadir libro nuevo
- [ ] Widget aparece en todas las páginas
- [ ] Responsive en móviles

### 15. Solución de problemas comunes

#### Los correos no se envían
```bash
# Verificar configuración
node -e "console.log(process.env.EMAIL_USER, process.env.EMAIL_PASS)"

# Ver logs de Nodemailer
# Añadir en emailService.js:
# debug: true
```

#### El widget no aparece
- Verifica que `/lumos-widget.js` es accesible
- Abre la consola del navegador para ver errores
- Verifica que no hay conflictos de CSS/JS

#### Errores 404 en las rutas API
- Verifica que las rutas están registradas en `server.js`
- Revisa que los archivos de rutas exportan correctamente

### 16. Actualizar cuando se añade un libro

Cuando añades un libro manualmente a `books.json`, también puedes usar el endpoint:

```bash
curl -X POST http://localhost:3000/api/admin/add-book \
  -H "Content-Type: application/json" \
  -H "x-api-key: tu_clave_secreta" \
  -d '{
    "title": "Nuevo Libro",
    "author": "Autor",
    "coverUrl": "http://...",
    "description": "...",
    "saga": {
      "name": "Saga",
      "number": 1
    }
  }'
```

Esto automáticamente:
- Añade el libro a `books.json`
- Verifica solicitudes pendientes
- Envía correos a usuarios que lo solicitaron
- Notifica a suscriptores

### 17. Métricas y analytics

Considera añadir tracking de:
- Búsquedas más comunes
- Libros más solicitados
- Tasa de conversión de solicitudes
- Emails enviados/abiertos

### 18. Seguridad adicional

```bash
# Instalar helmet para seguridad HTTP
npm install helmet

# En server.js:
const helmet = require('helmet');
app.use(helmet());
```

---

## ✅ Checklist final antes de lanzar

- [ ] Variables de entorno configuradas
- [ ] Contraseña de aplicación de Gmail generada
- [ ] Correo de prueba enviado exitosamente
- [ ] Widget probado en navegador
- [ ] Rutas de admin protegidas
- [ ] SSL/HTTPS configurado
- [ ] Backups automatizados
- [ ] Rate limiting habilitado
- [ ] Logs configurados
- [ ] Monitoreo activo

---

**¡LUMOS está listo para capturar libros en las sombras de Azkaban Reads!** 🪄📚
