# 🚀 Inicio Rápido - LUMOS

## ⚡ 3 Pasos para empezar

### 1️⃣ Configurar Email (2 minutos)

```bash
# Copiar plantilla
cp .env.example .env

# Editar .env con tus datos
nano .env
```

En `.env`:
```env
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=contraseña_aplicacion_google
SITE_URL=http://localhost:3000
```

**📧 Generar contraseña de aplicación:**
1. Ve a https://myaccount.google.com/security
2. Activa verificación en 2 pasos
3. Busca "Contraseñas de aplicaciones"
4. Genera una para "Correo"
5. Copia y pega en `EMAIL_PASS`

---

### 2️⃣ Verificar instalación (30 segundos)

```bash
node test-lumos.js
```

Deberías ver:
```
✅ Estructura de archivos: OK
⚠️  Variables de entorno: INCOMPLETO (configúralas)
✅ Archivos JSON: OK
✅ Dependencias: OK
✅ Módulos: OK
```

---

### 3️⃣ Iniciar y probar (1 minuto)

```bash
# Iniciar servidor
npm start

# En tu navegador:
# http://localhost:3000/lumos-demo.html
```

Haz clic en el botón 🪄 y prueba las funciones.

---

## 🎯 Integrar en tu sitio

Añade en cualquier página HTML:

```html
<script src="/lumos-widget.js"></script>
```

**¡Eso es todo!** El botón 🪄 aparecerá automáticamente.

---

## 📚 Documentación completa

- **`RESUMEN_COMPLETO.md`** - Documentación exhaustiva
- **`DEPLOYMENT.md`** - Guía de despliegue
- **`LUMOS_README.md`** - Documentación técnica

---

## 🆘 ¿Problemas?

```bash
# Herramientas de admin
./admin-tools.sh

# Opción 8 para verificar instalación
```

---

## 🎉 ¡Listo!

LUMOS ya está funcionando. Disfruta de tu asistente virtual oscuro y elegante para Azkaban Reads.

**🪄 "Los libros permanecen capturados entre estos muros…"**
