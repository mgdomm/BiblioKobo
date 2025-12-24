# 🔐 Guía Detallada: Generar Contraseña de Aplicación de Gmail

## Para: azkabanreads@gmail.com

### 📌 Paso a Paso Completo

#### ✅ Paso 1: Verificar que tienes verificación en 2 pasos activa

1. Ve a: **https://myaccount.google.com/security**
2. Busca la sección "Cómo accedes a Google"
3. Debe aparecer "Verificación en 2 pasos" con estado **"Activada"**

---

#### 🔑 Paso 2: Acceder a Contraseñas de Aplicaciones

**OPCIÓN A - Acceso Directo:**

Ve directamente a este enlace:
👉 **https://myaccount.google.com/apppasswords**

**OPCIÓN B - Acceso Manual:**

1. Ve a https://myaccount.google.com/security
2. Baja hasta la sección "Cómo accedes a Google"
3. Busca **"Contraseñas de aplicaciones"**
   - ⚠️ **IMPORTANTE:** Esta opción SOLO aparece si tienes verificación en 2 pasos activa
   - Si no la ves, ve a la Opción C más abajo

**OPCIÓN C - Si no aparece "Contraseñas de aplicaciones":**

A veces Google no muestra esta opción inmediatamente. Prueba:

1. Ve a https://myaccount.google.com/security
2. Haz clic en "Verificación en 2 pasos"
3. Desplázate hasta el final de la página
4. Busca **"Contraseñas de aplicaciones"** al final

---

#### 📝 Paso 3: Crear la Contraseña de Aplicación

1. Una vez en https://myaccount.google.com/apppasswords
2. Google te pedirá tu contraseña nuevamente (por seguridad)
3. En "Seleccionar app" elige: **"Correo"**
4. En "Seleccionar dispositivo" elige: **"Otro (nombre personalizado)"**
5. Escribe: **"LUMOS Azkaban Reads"**
6. Haz clic en **"Generar"**

---

#### 🎯 Paso 4: Copiar la Contraseña

Google te mostrará una contraseña de **16 caracteres** con este formato:

```
xxxx xxxx xxxx xxxx
```

**MUY IMPORTANTE:**
- ✅ Copia TODA la contraseña (con o sin espacios, ambos funcionan)
- ✅ NO cierres esta ventana hasta haberla guardado
- ⚠️ Esta contraseña SOLO se muestra UNA VEZ

---

#### ⚙️ Paso 5: Configurar en tu .env

1. Abre tu archivo `.env` en el proyecto
2. Pega la contraseña en `EMAIL_PASS`:

```env
EMAIL_USER=azkabanreads@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
SITE_URL=http://localhost:3000
PORT=3000
```

**Nota:** Puedes dejar los espacios o quitarlos, ambos funcionan:
- `xxxx xxxx xxxx xxxx` ✅
- `xxxxxxxxxxxxxxxx` ✅

---

### 🆘 Solución de Problemas

#### ❌ Problema 1: "No veo Contraseñas de aplicaciones"

**Posibles causas:**

1. **Verificación en 2 pasos no está activa:**
   - Ve a https://myaccount.google.com/security
   - Activa "Verificación en 2 pasos"
   - Espera 5-10 minutos
   - Vuelve a intentar

2. **Cuenta de Google Workspace (empresarial):**
   - Si tu cuenta es de una organización, el administrador debe habilitar esta función
   - Contacta al administrador de tu dominio

3. **Configuración de seguridad avanzada:**
   - Ve a https://myaccount.google.com/security
   - Revisa si tienes "Llave de seguridad" configurada
   - Algunas configuraciones avanzadas ocultan las contraseñas de aplicaciones

---

#### ❌ Problema 2: "Contraseña de aplicación no funciona"

**Soluciones:**

1. **Verifica que no haya espacios extra:**
   ```env
   # MAL ❌
   EMAIL_PASS= xxxx xxxx xxxx xxxx 
   
   # BIEN ✅
   EMAIL_PASS=xxxx xxxx xxxx xxxx
   ```

2. **Regenera la contraseña:**
   - Elimina la contraseña anterior en https://myaccount.google.com/apppasswords
   - Genera una nueva

3. **Verifica el email:**
   ```env
   EMAIL_USER=azkabanreads@gmail.com
   ```

---

#### ❌ Problema 3: "Error al enviar email"

**Revisa los logs:**

```javascript
// En services/emailService.js, añade debug temporal:
this.transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  debug: true,  // 👈 Añade esto temporalmente
  logger: true  // 👈 Y esto
});
```

---

### 🔗 Enlaces Directos Útiles

- **Seguridad de Google:** https://myaccount.google.com/security
- **Contraseñas de aplicaciones:** https://myaccount.google.com/apppasswords
- **Verificación en 2 pasos:** https://myaccount.google.com/signinoptions/two-step-verification

---

### 📋 Checklist Final

Antes de continuar, verifica:

- [ ] Verificación en 2 pasos está ACTIVA
- [ ] Has generado la contraseña de aplicación
- [ ] Has copiado los 16 caracteres completos
- [ ] Has pegado en `.env` sin espacios extra al inicio/final
- [ ] El archivo `.env` está en la raíz del proyecto
- [ ] Has guardado el archivo `.env`

---

### 🧪 Probar la Configuración

Una vez configurado, prueba con:

```bash
# Verificar que las variables están cargadas
node -e "require('dotenv').config(); console.log('USER:', process.env.EMAIL_USER); console.log('PASS:', process.env.EMAIL_PASS ? '✅ Configurado' : '❌ No configurado')"

# Prueba completa
node test-lumos.js
```

---

### 💡 Alternativa: Usar otro Servicio de Email

Si Gmail te da problemas, puedes usar otros servicios:

**Outlook/Hotmail:**
```env
EMAIL_USER=tu_correo@outlook.com
EMAIL_PASS=tu_contraseña_normal
```

En `services/emailService.js` cambia:
```javascript
this.transporter = nodemailer.createTransport({
  service: 'hotmail',  // 👈 Cambiar aquí
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

**SendGrid (gratis hasta 100 emails/día):**
```env
SENDGRID_API_KEY=tu_api_key
```

---

### 📞 ¿Sigues con problemas?

Si después de seguir estos pasos aún no funciona:

1. Comparte el error exacto que ves
2. Verifica que estás usando `azkabanreads@gmail.com` correctamente
3. Asegúrate de que no es una cuenta de Google Workspace empresarial

---

### ✅ Ejemplo de Configuración Correcta

Tu archivo `.env` debe verse así:

```env
# Configuración de Email para LUMOS
EMAIL_USER=azkabanreads@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
SITE_URL=http://localhost:3000
PORT=3000
```

Reemplaza `abcd efgh ijkl mnop` con la contraseña real de 16 caracteres que Google te dio.

---

🪄 **Una vez configurado, LUMOS podrá enviar correos automáticos cuando los usuarios soliciten libros!**
