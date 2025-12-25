# 🔧 SOLUCIÓN: Email de solicitudes no llega

## ❗ Problema Identificado

El sistema de email funciona correctamente en local, pero NO en producción. Esto indica que:

1. ✅ El código está bien
2. ✅ Las credenciales funcionan
3. ❌ **El servidor de producción NO tiene las variables de entorno configuradas**

## 🎯 Solución

### Paso 1: Verificar que el servidor esté corriendo en producción

Accede a tu servidor de producción y verifica:

```bash
# Verificar si el proceso está corriendo
ps aux | grep node

# O si usas PM2
pm2 list
```

### Paso 2: Configurar variables de entorno en producción

El servidor en producción DEBE tener estas variables configuradas:

```env
EMAIL_USER=azkabanreads@gmail.com
EMAIL_PASS=hdjk booc usrv jtot
SITE_URL=https://bibliokobo.onrender.com
PORT=3000
```

#### Opción A: Si usas Render, Vercel, Netlify, etc.

1. Ve al panel de configuración de tu servicio
2. Busca "Environment Variables" o "Variables de entorno"
3. Agrega estas variables:
   - `EMAIL_USER` = `azkabanreads@gmail.com`
   - `EMAIL_PASS` = `hdjk booc usrv jtot`
   - `SITE_URL` = Tu URL de producción

4. **IMPORTANTE:** Guarda y redespliega la aplicación

#### Opción B: Si usas un servidor VPS (DigitalOcean, AWS, etc.)

1. Conéctate por SSH a tu servidor
2. Navega al directorio de tu aplicación
3. Crea o edita el archivo `.env`:

```bash
cd /ruta/a/tu/aplicacion
nano .env
```

4. Pega este contenido:

```env
EMAIL_USER=azkabanreads@gmail.com
EMAIL_PASS=hdjk booc usrv jtot
SITE_URL=https://tu-dominio.com
PORT=3000
```

5. Guarda (Ctrl+O, Enter, Ctrl+X)
6. Reinicia el servidor:

```bash
# Si usas PM2
pm2 restart server

# Si usas systemd
sudo systemctl restart bibliokobo

# Si lo corres directamente
# Detén el proceso y vuelve a iniciarlo
npm start
```

### Paso 3: Verificar que las variables se cargaron

Después de configurar las variables, verifica que se cargaron:

```bash
# En el servidor, ejecuta:
node -e "require('dotenv').config(); console.log('EMAIL_USER:', process.env.EMAIL_USER); console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Configurado' : 'NO configurado');"
```

Deberías ver:
```
EMAIL_USER: azkabanreads@gmail.com
EMAIL_PASS: Configurado
```

### Paso 4: Probar el envío desde producción

Una vez configurado, puedes probar el endpoint desde tu navegador o con curl:

```bash
curl -X POST https://tu-dominio.com/api/requests/book \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Prueba Email",
    "author": "Sistema",
    "email": "mgdomm@icloud.com"
  }'
```

Deberías recibir:
```json
{
  "success": true,
  "message": "Solicitud registrada..."
}
```

Y en menos de 5 segundos, debería llegar el email a `azkabanreads@gmail.com`.

## 🐛 Diagnóstico adicional

Si después de configurar las variables sigue sin funcionar, ejecuta el script de diagnóstico en el servidor de producción:

```bash
cd /ruta/a/tu/aplicacion
node diagnostico-email.js
```

Esto te dirá exactamente qué está fallando.

## 📝 Logs en producción

Para ver los logs en tiempo real y detectar errores:

```bash
# Con PM2
pm2 logs server --lines 100

# Con systemd
sudo journalctl -u bibliokobo -f

# O directamente los logs de Node
tail -f /var/log/bibliokobo.log
```

Busca estas líneas cuando alguien haga una solicitud:

```
Intentando enviar notificación al admin...
✅ Email de solicitud enviado exitosamente al admin
```

O estos errores:

```
⚠️ ADVERTENCIA: Credenciales de email no configuradas
❌ Error al enviar email al admin: ...
```

## ✅ Checklist final

- [ ] Variables de entorno configuradas en producción
- [ ] Servidor reiniciado después de configurar variables
- [ ] `EMAIL_USER` y `EMAIL_PASS` verificados con el comando de diagnóstico
- [ ] Endpoint probado desde el navegador/curl
- [ ] Logs revisados para verificar que no hay errores
- [ ] Email de prueba recibido en azkabanreads@gmail.com

## 🆘 ¿Sigues teniendo problemas?

Si después de seguir todos los pasos el email sigue sin llegar:

1. **Verifica el firewall del servidor:**
   - El puerto 465 (SMTP seguro) debe estar abierto
   - El puerto 587 (SMTP alternativo) debe estar abierto

2. **Algunos proveedores de hosting bloquean SMTP:**
   - DigitalOcean, AWS, Google Cloud a veces bloquean puertos SMTP por defecto
   - Contacta a soporte para que los desbloqueen
   - O usa un servicio alternativo como SendGrid, Mailgun, etc.

3. **Prueba la contraseña de aplicación:**
   - Genera una nueva contraseña de aplicación en Google
   - Actualiza `EMAIL_PASS` en producción
   - Reinicia el servidor

## 🎯 Resumen

**El problema NO es tu código, es la configuración del servidor de producción.**

La solución es simple:
1. Configurar las variables de entorno en tu servidor de producción
2. Reiniciar el servidor
3. Probar

¡Eso es todo! 🚀
