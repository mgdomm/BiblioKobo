# 🎯 Configurar Variables de Entorno en Render

## Problema

El email de solicitudes no llega porque **Render no tiene las variables de entorno configuradas**.

## ✅ Solución paso a paso

### 1. Accede a tu Dashboard de Render

1. Ve a [https://dashboard.render.com](https://dashboard.render.com)
2. Inicia sesión con tu cuenta
3. Busca tu servicio **BiblioKobo** en la lista

### 2. Configura las Variables de Entorno

1. Haz clic en tu servicio **BiblioKobo**
2. En el menú lateral izquierdo, haz clic en **Environment**
3. Verás una sección que dice "Environment Variables"
4. Haz clic en **Add Environment Variable**

### 3. Agrega estas variables UNA POR UNA:

#### Variable 1: EMAIL_USER
- **Key:** `EMAIL_USER`
- **Value:** `azkabanreads@gmail.com`
- Haz clic en **Add**

#### Variable 2: EMAIL_PASS
- **Key:** `EMAIL_PASS`
- **Value:** `hdjk booc usrv jtot`
- Haz clic en **Add**

#### Variable 3: SITE_URL (Opcional pero recomendado)
- **Key:** `SITE_URL`
- **Value:** Tu URL de Render (ejemplo: `https://bibliokobo.onrender.com`)
- Haz clic en **Add**

### 4. Guarda los cambios

Después de agregar las tres variables, deberías ver algo como:

```
EMAIL_USER      azkabanreads@gmail.com
EMAIL_PASS      •••••••••••••••••••    (oculto por seguridad)
SITE_URL        https://bibliokobo.onrender.com
```

### 5. Redespliega la aplicación

**IMPORTANTE:** Render necesita redesplegar para cargar las nuevas variables.

Tienes dos opciones:

#### Opción A: Redespliegue manual (RECOMENDADO)
1. En la página de tu servicio, ve arriba a la derecha
2. Haz clic en **Manual Deploy** → **Deploy latest commit**
3. Espera a que termine el despliegue (verás los logs en pantalla)
4. Cuando veas "Your service is live 🎉" está listo

#### Opción B: Redespliegue automático
1. Haz un pequeño cambio en tu repositorio (por ejemplo, agrega un espacio en el README)
2. Haz commit y push
3. Render detectará el cambio y redespliegará automáticamente

### 6. Verifica que funciona

Una vez redespliegado:

1. Ve a tu sitio: `https://bibliokobo.onrender.com/libros`
2. Abre el widget de LUMOS (botón flotante 🪄)
3. Haz clic en "Imperio en llamas" (o cualquier libro)
4. Escribe tu email: `mgdomm@icloud.com`
5. Haz clic en **Enviar**

**Resultado esperado:**
- ✅ La solicitud se procesa en menos de 1 segundo
- ✅ Recibes confirmación inmediata
- ✅ En menos de 5-10 segundos, llega un email a `azkabanreads@gmail.com` con la solicitud

### 7. Verificar logs (opcional)

Para ver si el email se envió correctamente:

1. En Render, ve a tu servicio
2. Haz clic en **Logs** en el menú lateral
3. Busca líneas como:
   ```
   Intentando enviar notificación al admin...
   ✅ Email de solicitud enviado exitosamente al admin
   ```

## 📸 Captura de pantalla de referencia

Así debería verse la sección de Environment Variables en Render:

```
┌─────────────────────────────────────────────────────────┐
│ Environment Variables                                   │
├─────────────────┬───────────────────────────────────────┤
│ Key             │ Value                                 │
├─────────────────┼───────────────────────────────────────┤
│ EMAIL_USER      │ azkabanreads@gmail.com                │
│ EMAIL_PASS      │ ••••••••••••••••••••                  │
│ SITE_URL        │ https://bibliokobo.onrender.com       │
└─────────────────┴───────────────────────────────────────┘
```

## ❓ ¿Qué pasa si ya tengo variables configuradas?

Si ya tienes variables de entorno configuradas:

1. **NO las borres**, solo agrega las que faltan
2. Verifica que `EMAIL_USER` y `EMAIL_PASS` estén correctos
3. Si ya existen pero no funcionan, edítalas (haz clic en el ícono de lápiz)
4. Redespliega después de hacer cambios

## 🆘 Solución de problemas

### "No veo la opción Environment en mi servicio"

- Asegúrate de estar en el servicio correcto (BiblioKobo)
- Solo los servicios de tipo "Web Service" tienen esta opción
- Si tienes un "Static Site", necesitas convertirlo a "Web Service"

### "Agregué las variables pero el email sigue sin llegar"

1. **¿Redespliegaste?** Las variables solo se cargan después de redesplegar
2. Verifica los logs en Render → Logs
3. Busca errores relacionados con email
4. Asegúrate de que la contraseña de aplicación sea correcta

### "El sitio tarda mucho en responder"

Esto es normal en Render con el plan gratuito:
- Los servicios se "duermen" después de 15 minutos de inactividad
- La primera petición tarda 30-60 segundos en "despertar"
- Las siguientes peticiones son instantáneas

Con las mejoras que hice, el email se envía en segundo plano, así que el usuario no tiene que esperar.

## ✅ Checklist

- [ ] Variables agregadas en Render (EMAIL_USER, EMAIL_PASS)
- [ ] Redespliegue completado
- [ ] Prueba realizada desde el sitio en producción
- [ ] Email recibido en azkabanreads@gmail.com
- [ ] Logs verificados (opcional)

## 🎉 ¡Listo!

Después de seguir estos pasos, el sistema de solicitudes debería funcionar perfectamente.

Si tienes algún problema, revisa los logs en Render o ejecuta el diagnóstico localmente para asegurarte de que las credenciales funcionan.
