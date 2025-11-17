# Configuración de Google Calendar API

Para habilitar la sincronización con Google Calendar, sigue estos pasos:

## 1. Crear un proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Asegúrate de que el proyecto esté seleccionado en la parte superior

## 2. Habilitar Google Calendar API

1. En el menú lateral, ve a **APIs & Services** > **Library**
2. Busca "Google Calendar API"
3. Haz clic en "Google Calendar API"
4. Haz clic en el botón **"Enable"** (Habilitar)

## 3. Crear credenciales OAuth 2.0

1. Ve a **APIs & Services** > **Credentials**
2. Haz clic en **"Create Credentials"** > **"OAuth client ID"**
3. Si es la primera vez, necesitarás configurar la pantalla de consentimiento:
   
   **Paso 3.1: OAuth Consent Screen - Configuración básica**
   - Haz clic en **"Configure Consent Screen"**
   - Selecciona **"External"** (para que cualquier usuario con cuenta de Google pueda usarlo)
   - Haz clic en **"Create"**
   
   **Paso 3.2: App information**
   - App name: "Nutrición App"
   - User support email: selecciona tu email del desplegable
   - App logo: (opcional)
   - Application home page: `https://nutricionapp-b7b7d.web.app`
   - Application privacy policy: (opcional, puedes dejarlo vacío por ahora)
   - Application terms of service: (opcional, puedes dejarlo vacío por ahora)
   - Authorized domains: 
     - `nutricionapp-b7b7d.web.app`
     - `nutricionapp-b7b7d.firebaseapp.com`
   - Developer contact information: tu email
   - Haz clic en **"Save and Continue"**
   
   **Paso 3.3: Ámbitos/Permisos (Scopes)**
   - **PUEDES OMITIR ESTE PASO** - Los permisos se solicitarán automáticamente cuando el usuario se conecte
   - Si quieres agregarlos manualmente (opcional):
     - Busca el botón **"AGREGAR O QUITAR PERMISOS"** o **"AÑADIR O QUITAR ÁMBITOS"**
     - Si no lo ves, simplemente haz clic en **"Guardar y continuar"** - no es necesario
   - Haz clic en **"GUARDAR Y CONTINUAR"**
   
   **Paso 3.4: Usuarios de prueba (Test users) - IMPORTANTE**
   - Si tu app está en modo "En prueba" o "Testing", **DEBES** agregar los emails de los usuarios que podrán conectarse
   - Haz clic en **"AGREGAR USUARIOS"** o **"ADD USERS"**
   - Añade tu email (ruiznutricionapp@gmail.com o el que uses para conectar)
   - Haz clic en **"GUARDAR Y CONTINUAR"** o **"SAVE AND CONTINUE"**
   
   **Paso 3.5: Summary**
   - Revisa toda la información
   - Haz clic en **"Back to Dashboard"**

4. Vuelve a **Credentials** > **Create Credentials** > **OAuth client ID**
5. Selecciona **"Web application"**
6. Configura:
   - Name: "Nutrición App Web Client"
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `http://localhost:3001`
     - `http://localhost:3002`
     - `https://nutricionapp-b7b7d.web.app`
     - `https://nutricionapp-b7b7d.firebaseapp.com`
   - Authorized redirect URIs:
     - `http://localhost:3000`
     - `https://nutricionapp-b7b7d.web.app`

7. Haz clic en **"Create"**
8. Copia el **Client ID** y **API Key** que se generan

## 4. Configurar las credenciales en la app

Edita el archivo `src/components/AdminAgenda.js` y reemplaza:

```javascript
const CLIENT_ID = 'TU_CLIENT_ID.apps.googleusercontent.com';
const API_KEY = 'TU_API_KEY';
```

Con tus credenciales reales:

```javascript
const CLIENT_ID = '123456789-abcdefghijk.apps.googleusercontent.com';
const API_KEY = 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
```

## 5. Características implementadas

✅ **Conexión con Google Calendar**: Botón para conectar/desconectar
✅ **Sincronización bidireccional**: Las citas creadas en la app se añaden a Google Calendar
✅ **Sincronización automática**: Al conectar, sincroniza todas las citas existentes
✅ **Notificaciones**: Email 24h antes y popup 30min antes
✅ **Duración de citas**: 1 hora por defecto
✅ **Zona horaria**: Europe/Madrid

## 6. Uso

1. En la vista de Agenda, haz clic en **"🔗 Conectar Google Calendar"**
2. Se abrirá una ventana de Google para iniciar sesión
3. Selecciona tu cuenta de Google
4. Autoriza los permisos de calendario
5. Una vez conectado, el botón mostrará **"✅ Google Calendar"**
6. Todas las citas nuevas se sincronizarán automáticamente

## 7. Desconectar

Para desconectar Google Calendar:
1. Haz clic en **"✅ Google Calendar"**
2. Se desconectará la cuenta

## 8. Próximas mejoras

- [ ] Sincronización desde Google Calendar hacia la app
- [ ] Seleccionar calendario específico (si tienes varios)
- [ ] Editar/eliminar eventos desde la app
- [ ] Sincronización en tiempo real con webhooks
- [ ] Configurar duración personalizada de citas
- [ ] Recordatorios personalizados

## Notas importantes

- Las credenciales deben mantenerse seguras
- No subas el Client ID y API Key a repositorios públicos
- Considera usar variables de entorno en producción
- La sincronización es unidireccional: App → Google Calendar

---

## 📸 Guía Rápida - LO MÍNIMO NECESARIO

### Resumen: Solo necesitas 3 cosas

1. **Habilitar Google Calendar API** (Paso 2 arriba)
2. **Crear Client ID** con las URLs correctas (Paso 3.1 y 4)
3. **Agregar tu email en "Test users"** (Paso 3.4) ⚠️ MUY IMPORTANTE

### En la Pantalla de Consentimiento:

**Lo que SÍ es obligatorio:**
- ✅ Nombre de la app
- ✅ Email de soporte
- ✅ Agregar tu email en "Usuarios de prueba" / "Test users"

**Lo que NO es obligatorio:**
- ❌ Logo
- ❌ Política de privacidad
- ❌ Agregar scopes/ámbitos manualmente (se solicitan automáticamente)
- ❌ Dominios autorizados (opcional)

### Ruta rápida:

1. **APIs y servicios** → **Pantalla de consentimiento de OAuth**
2. Rellena: Nombre app + Email
3. Click **"Guardar y continuar"** en cada paso (sin agregar nada más)
4. En **"Usuarios de prueba"**: Agregar tu email
5. **APIs y servicios** → **Credenciales** → **Crear credenciales** → **ID de cliente de OAuth**
6. Tipo: **Aplicación web**
7. Agregar las URLs (localhost y firebase)
8. Copiar el **Client ID**

### Estado de publicación

- **Testing**: Solo los usuarios que agregues en "Test users" podrán usar la app
- **In Production**: Cualquier usuario con cuenta de Google podrá usarla
  - Para publicar, necesitarás completar la verificación de Google (puede tardar días)
  - Para desarrollo/uso personal, el modo "Testing" es suficiente

### Troubleshooting común

**Error: "Access blocked: This app's request is invalid"**
- Asegúrate de que has agregado todos los "Authorized JavaScript origins" y "Authorized redirect URIs"
- Verifica que el CLIENT_ID en el código coincida con el de Google Cloud Console

**Error: "This app isn't verified"**
- Es normal en modo Testing
- Haz clic en "Advanced" → "Go to [App name] (unsafe)"
- Solo aparece la primera vez que conectas

**No aparece el scope de Calendar**
- Verifica que Google Calendar API esté habilitada en **APIs & Services > Library**
- Busca exactamente: `https://www.googleapis.com/auth/calendar`
