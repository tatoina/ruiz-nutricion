# Configuración de Envío de Emails Automáticos

## 📧 Sistema de Emails de Bienvenida

Cuando el admin crea una nueva cuenta de usuario, automáticamente se envía un email de bienvenida con:
- ✅ Credenciales de acceso (email del usuario)
- ✅ Link directo a la aplicación
- ✅ Instrucciones para instalar la app en móvil
- ✅ Aviso de cambio obligatorio de contraseña

## 🚀 Instalación y Configuración

### Opción 1: Firebase Extension "Trigger Email" (Recomendado)

Esta es la forma más sencilla y no requiere configurar servidores SMTP.

1. **Instalar la extensión desde Firebase Console:**
   ```bash
   firebase ext:install firebase/firestore-send-email
   ```

2. **Configuración en la consola:**
   - Ve a: https://console.firebase.google.com/project/nutricionapp-b7b7d/extensions
   - Haz clic en "Install Extension"
   - Busca "Trigger Email from Firestore"
   - Configura:
     - **Collection name:** `mail`
     - **SMTP Connection URI:** (ver opciones abajo)

3. **Opciones de SMTP (elige una):**

   **A) Gmail (Gratis, más sencillo):**
   - Formato: `smtps://username:password@smtp.gmail.com:465`
   - Usuario: tu email de Gmail
   - Contraseña: Usa "Contraseñas de Aplicación" (no tu contraseña normal)
     1. Ve a https://myaccount.google.com/security
     2. Activa verificación en 2 pasos
     3. Genera una contraseña de aplicación
   - Ejemplo: `smtps://tunutricion@gmail.com:abcd1234efgh5678@smtp.gmail.com:465`

   **B) SendGrid (Profesional, 100 emails/día gratis):**
   - Regístrate en: https://sendgrid.com
   - Crea una API Key
   - Formato: `smtps://apikey:TU_API_KEY@smtp.sendgrid.net:465`

   **C) Mailgun (Profesional):**
   - Regístrate en: https://www.mailgun.com
   - Formato: `smtps://postmaster@tu-dominio.mailgun.org:PASSWORD@smtp.mailgun.org:465`

4. **Configurar remitente:**
   - **Default FROM:** `Ruiz Nutrición <noreply@nutricionapp-b7b7d.firebaseapp.com>`
   - O tu email personalizado si verificaste el dominio

### Opción 2: Cloud Functions con Nodemailer (Manual)

Si prefieres control total, usa la Cloud Function ya creada en `functions/index.js`.

1. **Instalar dependencias:**
   ```bash
   cd functions
   npm install
   ```

2. **Configurar variables de entorno:**
   ```bash
   firebase functions:config:set gmail.email="tunutricion@gmail.com" gmail.password="tu-password-de-app"
   ```

3. **Modificar `functions/index.js`** para usar nodemailer directamente (necesitas agregar el código SMTP).

4. **Desplegar:**
   ```bash
   firebase deploy --only functions
   ```

## 📋 Pasos para Activar

### 1. Instalar Cloud Functions

```bash
cd functions
npm install
cd ..
```

### 2. Desplegar Functions

```bash
firebase deploy --only functions
```

### 3. Instalar Extension (RECOMENDADO)

```bash
firebase ext:install firebase/firestore-send-email
```

Sigue el asistente y configura:
- Collection: `mail`
- SMTP URI: (usa Gmail o SendGrid como se explica arriba)
- Default FROM: `Ruiz Nutrición <noreply@nutricionapp-b7b7d.firebaseapp.com>`

### 4. Probar

1. Crea un usuario de prueba desde el admin
2. Verifica que se crea el documento en `mail` collection (Firebase Console)
3. El email debería enviarse automáticamente

## 🔍 Verificación

### Ver logs de la función:
```bash
firebase functions:log
```

### Ver emails pendientes en Firestore:
Ve a Firebase Console → Firestore → Colección `mail`

Cada documento tendrá:
- `to`: Email del destinatario
- `subject`: Asunto
- `html`: Contenido HTML
- `delivery`: Estado de entrega (added/processing/sent/error)

## ⚠️ Importante

- **Gmail tiene límite de 500 emails/día**
- **SendGrid ofrece 100 emails/día gratis** (mejor para producción)
- Los emails pueden tardar unos segundos en enviarse
- Revisa spam/correo no deseado la primera vez

## 🎨 Personalización

Edita el template del email en `functions/index.js`:
- Línea ~40: Contenido HTML del email
- Cambia colores, textos, o añade más información
- Añade tu logo si quieres

## 📱 El Email Incluye

✉️ **Contenido del email:**
- Saludo personalizado con nombre del usuario
- Credenciales de acceso (email)
- Link directo a la app: https://nutricionapp-b7b7d.web.app
- Instrucciones para instalar en iOS y Android
- Aviso sobre cambio de contraseña obligatorio
- Diseño profesional con colores de la marca

## 🐛 Troubleshooting

**Problema:** No se envían emails
- **Solución:** Verifica en Firestore que se crean docs en `mail` collection
- Revisa logs: `firebase functions:log`
- Verifica que la extension esté instalada

**Problema:** Emails van a spam
- **Solución:** Usa SendGrid o verifica tu dominio
- Añade SPF y DKIM records a tu dominio

**Problema:** Error de autenticación SMTP
- **Solución:** Usa contraseña de aplicación de Gmail, no tu contraseña normal
- Verifica que el formato del SMTP URI sea correcto
