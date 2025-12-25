# Configuración de SendGrid para Render

## ¿Por qué SendGrid?
Render bloquea conexiones SMTP directas a Gmail (puertos 465, 587). SendGrid es un servicio específico para hosting y es **gratuito hasta 100 emails/día**.

## Pasos:

### 1. Crear cuenta en SendGrid
- Ve a https://sendgrid.com/
- Click en "Sign Up"
- Completa el formulario básico
- Verifica tu email

### 2. Obtener API Key
- En el dashboard, ve a **Settings → API Keys**
- Click en "Create API Key"
- Dale un nombre (ej: "BiblioKobo-Render")
- Selecciona "Restricted Access" (es más seguro)
- Dale permisos a "Mail Send"
- Copia la key (solo aparece una vez)

### 3. Configurar en Render
En https://dashboard.render.com → Tu servicio → Environment:

```
SENDGRID_API_KEY=<tu-api-key-aqui>
EMAIL_FROM=noreply@azkaban.com
```

**Nota:** Puedes usar `noreply@azkaban.com` aunque no verifiques el dominio (para pruebas rápidas). Para producción, deberías verificar tu dominio.

### 4. Verificar Sender Identity (Opcional pero recomendado)
- En SendGrid dashboard → Settings → Sender Authentication
- Agrega tu email/dominio
- Sigue los pasos de verificación

## Límites gratuitos:
- **100 emails/día**
- **30 emails/minuto**
- **No hay límite de días**

Para más emails, usa el tier $9.95/mes (30,000/mes).

## Testing local:
Para probar localmente, agrega a `.env`:
```
SENDGRID_API_KEY=<tu-api-key-aqui>
EMAIL_FROM=test@example.com
```

Luego reinicia el servidor.
