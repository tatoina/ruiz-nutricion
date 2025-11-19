# Instrucciones para Desplegar Cloud Functions

## Problema
El despliegue de Cloud Functions requiere permisos de propietario del proyecto para otorgar roles IAM a las cuentas de servicio.

## Solución

### Opción 1: Ejecutar con cuenta de propietario (RECOMENDADO)

Necesitas ejecutar estos comandos con una cuenta que tenga rol de **Owner** o **Editor** en el proyecto Firebase.

1. **Iniciar sesión con la cuenta correcta:**
   ```powershell
   gcloud auth login
   ```
   Selecciona la cuenta que tiene permisos de propietario del proyecto.

2. **Verificar la cuenta activa:**
   ```powershell
   gcloud auth list
   ```

3. **Configurar el proyecto:**
   ```powershell
   gcloud config set project nutricionapp-b7b7d
   ```

4. **Ejecutar los comandos IAM:**
   ```powershell
   gcloud projects add-iam-policy-binding nutricionapp-b7b7d --member=serviceAccount:service-23998467905@gcp-sa-pubsub.iam.gserviceaccount.com --role=roles/iam.serviceAccountTokenCreator

   gcloud projects add-iam-policy-binding nutricionapp-b7b7d --member=serviceAccount:23998467905-compute@developer.gserviceaccount.com --role=roles/run.invoker

   gcloud projects add-iam-policy-binding nutricionapp-b7b7d --member=serviceAccount:23998467905-compute@developer.gserviceaccount.com --role=roles/eventarc.eventReceiver
   ```

5. **Desplegar las funciones:**
   ```powershell
   cd c:\Users\usuario\nutri-app
   firebase deploy --only functions
   ```

### Opción 2: Otorgar permisos desde Firebase Console

Si no tienes acceso a gcloud, puedes otorgar permisos desde la consola:

1. Ve a [Firebase Console](https://console.firebase.google.com/project/nutricionapp-b7b7d/settings/iam)

2. Asegúrate de que tu cuenta (`inaviciba@gmail.com`) tiene el rol de **Owner** o **Editor**

3. Ve a [Google Cloud Console - IAM](https://console.cloud.google.com/iam-admin/iam?project=nutricionapp-b7b7d)

4. Agrega los siguientes roles a las cuentas de servicio:

   **Cuenta:** `service-23998467905@gcp-sa-pubsub.iam.gserviceaccount.com`
   - Rol: `Service Account Token Creator`

   **Cuenta:** `23998467905-compute@developer.gserviceaccount.com`
   - Rol: `Cloud Run Invoker`
   - Rol: `Eventarc Event Receiver`

5. Intenta desplegar nuevamente:
   ```powershell
   firebase deploy --only functions
   ```

### Opción 3: Usar Firebase Console directamente

Alternativamente, puedes desplegar las funciones desde Firebase Console:

1. Ve a [Firebase Console - Functions](https://console.firebase.google.com/project/nutricionapp-b7b7d/functions)

2. Haz clic en "Create function" o "Deploy"

3. Sube el código manualmente desde la carpeta `functions/`

## Verificación

Una vez desplegado correctamente, deberías ver:
```
✓ functions[sendWelcomeEmail(us-central1)] Successful create operation.
```

## Prueba

Para probar que funciona:

1. Crea un nuevo usuario desde el panel de administración
2. Verifica en Firebase Console → Firestore → Colección `mail` que se creó un documento
3. El usuario debería recibir el email de bienvenida en su bandeja de entrada

## Notas

- La función se dispara automáticamente cuando se crea un documento en la colección `users`
- Los emails se procesan a través de la extensión Firebase "Trigger Email from Firestore"
- La configuración SMTP ya está configurada con Gmail
- Los emails incluyen el enlace a la app y las instrucciones de instalación
