# Sistema de Roles - Nutri App

## 📋 Descripción General

El sistema de roles permite gestionar los permisos de usuarios en la aplicación. Existen dos roles principales:

- **`admin`**: Nutricionistas con acceso completo al panel administrativo
- **`paciente`**: Usuarios regulares con acceso solo a su ficha personal

## 🔧 Implementación Técnica

### 1. Almacenamiento del Rol

El rol de cada usuario se almacena en **tres lugares**:

1. **Campo `rol` en Firestore** (`users/{userId}`)
   - Valor: `"admin"` o `"paciente"`
   - Este es el campo principal que se gestiona desde el panel de administración

2. **Custom Claim en Firebase Auth** (`admin: true/false`)
   - Se sincroniza automáticamente con el campo de Firestore
   - Permite verificaciones rápidas sin consultar Firestore

3. **Emails hardcoded** (fallback)
   - `admin@admin.es`
   - Solo como medida de seguridad adicional

### 2. Verificación de Permisos

La aplicación verifica permisos en varios lugares:

#### Frontend (React)
```javascript
// En AdminUsers.js y AdminAgenda.js
const isAdmin = hasClaimAdmin || byEmail || hasRolAdmin;
```

Se verifica:
1. Custom claim `admin === true`
2. Email en lista de admins hardcoded
3. Campo `rol === "admin"` en Firestore

#### Backend (Firebase Functions)
```javascript
// En index.js
const isAdmin = request.auth.token.admin === true || 
                adminEmails.includes(request.auth.token.email?.toLowerCase());
```

#### Reglas de Seguridad (Firestore)
```javascript
function isAdmin() {
  return request.auth != null && 
         (request.auth.token.email == 'admin@admin.es' ||
          request.auth.token.admin == true ||
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rol == 'admin');
}
```

### 3. Sincronización Automática

Cuando se actualiza el campo `rol` en Firestore, un trigger automáticamente actualiza el custom claim:

```javascript
// Trigger: syncUserRoleClaim
exports.syncUserRoleClaim = onDocumentWritten("users/{userId}", async (event) => {
  const newRol = afterData?.rol || "paciente";
  
  if (newRol === "admin") {
    await getAuth().setCustomUserClaims(userId, { admin: true });
  } else {
    await getAuth().setCustomUserClaims(userId, { admin: false });
  }
});
```

## 👥 Gestión de Roles desde el Panel

### Crear Usuario con Rol

1. Ve a **Panel Administrativo** → **Usuarios**
2. Clic en **➕ Nuevo Cliente**
3. Rellena el formulario
4. En el campo **Rol**, selecciona:
   - `Paciente` (predeterminado): Usuario regular
   - `Administrador`: Nutricionista con permisos completos
5. Clic en **✓ Guardar**

### Modificar Rol de Usuario Existente

1. Ve a **Panel Administrativo** → **Usuarios**
2. Selecciona el usuario de la lista
3. Clic en el botón **✏️ Editar** (junto al nombre)
4. Cambia el campo **Rol**
5. Clic en **✓ Guardar**

**⚠️ Importante**: Cuando cambies el rol de un usuario a `admin`, ese usuario tendrá acceso completo inmediatamente después de cerrar sesión e iniciar sesión nuevamente.

## 🔐 Seguridad

### Protección del Campo `rol`

**✅ Solo administradores pueden modificar roles**

El sistema tiene múltiples capas de seguridad para evitar que usuarios regulares se auto-asignen permisos de administrador:

#### 1. **Reglas de Firestore**
```javascript
// Los usuarios NO pueden modificar su propio campo 'rol'
allow update: if request.auth != null && (
  // Si es admin, puede actualizar todo
  isAdmin() ||
  // Si es el propio usuario, solo puede actualizar si NO cambia el campo 'rol'
  (request.auth.uid == userId && 
   (!request.resource.data.keys().hasAny(['rol']) || 
    request.resource.data.rol == resource.data.rol))
);
```

#### 2. **Cloud Functions con Verificación de Admin**
```javascript
// Función updateUser - Solo admins pueden ejecutarla
exports.updateUser = onCall(async (request) => {
  const isAdmin = request.auth.token.admin === true || 
                  adminEmails.includes(request.auth.token.email?.toLowerCase());
  
  if (!isAdmin) {
    throw new Error("Permisos insuficientes");
  }
  // ... resto del código
});
```

#### 3. **UI Restringida**
- El formulario de edición solo es accesible desde el panel administrativo
- El panel administrativo solo es accesible para usuarios con permisos de admin
- Los usuarios regulares ni siquiera ven la opción de cambiar roles

### Múltiples Capas de Verificación

1. **Frontend**: Oculta elementos UI según permisos
2. **Backend**: Valida permisos antes de ejecutar operaciones
3. **Firestore Rules**: Bloquea lecturas/escrituras no autorizadas
4. **Custom Claims**: Verificación rápida sin consultas adicionales

### Permisos de Administrador

Los usuarios con rol `admin` pueden:
- ✅ Ver y editar todas las fichas de usuarios/pacientes
- ✅ Crear nuevos usuarios
- ✅ Gestionar la agenda de citas
- ✅ Administrar menús y ejercicios
- ✅ Ver estadísticas y pagos
- ✅ Cambiar el rol de otros usuarios
- ✅ Acceder al panel de GYM y mensajes

### Permisos de Paciente

Los usuarios con rol `paciente` pueden:
- ✅ Ver solo su propia ficha
- ✅ Actualizar sus propios datos (nombre, teléfono, etc.)
- ✅ Ver sus citas
- ✅ Enviar mensajes al admin
- ❌ **NO pueden cambiar su propio rol** (protegido por reglas de Firestore)
- ❌ No pueden acceder al panel administrativo
- ❌ No pueden ver datos de otros usuarios

### ⚠️ Intentos de Escalada de Privilegios

Si un usuario intenta modificar su campo `rol` directamente:
- **Firestore rechazará la operación** (Error: "Missing or insufficient permissions")
- **El frontend usa Cloud Functions** que verifican permisos antes de cualquier modificación
- **Los custom claims solo pueden ser modificados** por Firebase Admin SDK (backend)

**Ejemplo de ataque bloqueado:**
```javascript
// ❌ Esto FALLARÁ para usuarios normales
await updateDoc(doc(db, "users", currentUser.uid), {
  rol: "admin"  // Error: Missing or insufficient permissions
});
```

## 🚀 Despliegue

### Después de hacer cambios

1. **Actualizar Functions**:
   ```bash
   cd functions
   firebase deploy --only functions
   ```

2. **Actualizar Reglas de Firestore**:
   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Actualizar Frontend**:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

## 🐛 Solución de Problemas

### Usuario no tiene permisos después de cambiar rol

1. El usuario debe **cerrar sesión** y volver a iniciar sesión
2. Esto fuerza la recarga del token con los nuevos custom claims

### Error "Permisos insuficientes"

Verifica:
1. Que el usuario tenga `rol: "admin"` en Firestore
2. Que el custom claim `admin: true` esté configurado
3. Que las reglas de Firestore estén desplegadas

### Ver custom claims de un usuario

Desde Firebase Console:
1. Authentication → Users
2. Selecciona el usuario
3. Clic en "Edit user"
4. Verás los custom claims en la sección inferior

O usando el CLI:
```bash
cd functions
node check-admin-token.js
```

## 📝 Notas Adicionales

- Por defecto, todos los nuevos usuarios se crean con rol `"paciente"`
- El sistema es retrocompatible: usuarios sin campo `rol` se consideran `"paciente"`
- Los cambios de rol se sincronizan automáticamente entre Firestore y Auth
- No es necesario eliminar los emails hardcoded, funcionan como capa adicional de seguridad

## 🔄 Migración de Usuarios Existentes

Si tienes usuarios existentes sin el campo `rol`, puedes ejecutar:

```javascript
// Script de migración (ejecutar en Firebase Console o con Admin SDK)
const users = await db.collection('users').get();
const batch = db.batch();

users.forEach(doc => {
  if (!doc.data().rol) {
    batch.update(doc.ref, { 
      rol: 'paciente' 
    });
  }
});

await batch.commit();
```

---

**Versión**: 1.0  
**Última actualización**: Febrero 2026
