# Sistema de Notificaciones

## ⚠️ IMPORTANTE: Notificaciones Push DESACTIVADAS
Las notificaciones push han sido desactivadas. **Solo se usan notificaciones por email**.

## Funcionalidad Implementada

### 📧 Email - 1 día antes
- **Cuándo**: Se envía automáticamente 24 horas antes de la cita (entre 23-25 horas)
- **Contenido**: 
  - Saludo personalizado con nombre del usuario
  - Fecha y hora de la cita
  - Notas de la cita (si existen)
  - Logo de la clínica
  - Diseño profesional en HTML

### ~~🔔 Push Notification - 1 hora antes~~ (DESACTIVADO)
- **Estado**: ❌ DESACTIVADO
- Las notificaciones push han sido eliminadas del sistema
- Solo se utilizan notificaciones por correo electrónico

## Componentes del Sistema

### 1. Cloud Function: `checkAppointmentReminders`
- **Ubicación**: `functions/index.js`
- **Ejecución**: Cada hora automáticamente
- **Proceso**:
  1. Revisa todas las citas de todos los usuarios
  2. Calcula el tiempo hasta cada cita
  3. Envía email si faltan ~24 horas y no se ha enviado
  4. ~~Crea notificación push si falta ~1 hora y no se ha enviado~~ (DESACTIVADO)
  5. Marca cada notificación como enviada para no duplicar

### 2. ~~Listener de Notificaciones en App~~ (DESACTIVADO)
- **Estado**: ❌ DESACTIVADO
- Las notificaciones push han sido eliminadas
- El código relacionado ha sido comentado

### 3. Estructura de Datos

#### Cita en Firestore
```javascript
{
  fecha: "2025-12-15T10:00:00",
  hora: "10:00",
  notas: "Revisión mensual",
  emailSent: false,    // Se marca true cuando se envía email
  // pushSent: false,  // ELIMINADO - Ya no se usan push notifications
  createdAt: "...",
  createdBy: "admin"
}
```

#### ~~Notificación Push en Firestore~~ (DESACTIVADO)
```javascript
// Las notificaciones push han sido desactivadas
// Ya no se crean documentos en la colección 'notifications'
```

## Configuración Requerida

### Firebase Extensions
- **Extensión**: `firestore-send-email`
- **Estado**: ✅ Ya instalada y configurada
- **Función**: Procesa automáticamente los emails de la collection `mail`

### Cloud Scheduler API
- **Estado**: ✅ Habilitada durante el deploy
- **Función**: Permite ejecutar la función cada hora

### Permisos de Notificación
- **Usuario debe activar**: Sí, al entrar a la pestaña "Citas"
- **Botón**: "🔔 Activar notificaciones"
- **Ubicación**: Visible en la pestaña de Citas para usuarios normales

## Índices de Firestore
- ✅ Índice compuesto creado para `notifications`:
  - userId (ASC)
  - read (ASC)  
  - createdAt (DESC)

## T~~Permisos de Notificación~~ (DESACTIVADO)
- **Estado**: ❌ Ya no son necesarios
- Las notificaciones push han sido eliminadas
- Solo se usan notificaciones por email

## ~~Índices de Firestore~~ (YA NO NECESARIOS)
- Los índices para la colección `notifications` ya no son necesarios
- Se pueden eliminar si se deseade notificación en la app
2. C~~Para probar push notifications~~ (DESACTIVADO)
- Las notificaciones push han sido desactivadas
- Ya no es posible probar esta funcionalidad

### Ver logs de Cloud Functions
```bash
firebase functions:log
```

### Ver función específica
```bash
firebase functions:log --only checkAppointmentReminders
```

### Verificar notificaciones en Firestore
- Console Firebase → Firestore → Collection `notifications`
- Filtrar por `userId` para ver notificaciones de un usuario

## Notas Importantes

1. **No duplicación**: Las flags `emailSent` y `pushSent` previenen envíos duplicados
2. **Ventana de tiempo**: Los rangos de tiempo (23-25h para email, 55-65min para push) aseguran que se envíen aunque la función no se ejecute exactamente a la hora
3. **Marcado automático**: Las notificaciones se marcan como leídas automáticamente al mostrarse
4. **Permisos**: Los usua flag `emailSent` previene envíos duplicados
2. **Ventana de tiempo**: El rango de tiempo (23-25h para email) asegura que se envíe aunque la función no se ejecute exactamente a la hora
3. **Solo Email**: Las notificaciones push han sido completamente desactivadas
4. **Archivos desactivados**: 
   - `src/fcm-setup.js` - No se importa
   - `public/firebase-messaging-sw.js` - Código comentado
   - `functions/sendPushToUser.js` - No exportado
   - `functions/sendPushToAdmin.js` - No exportado
   - `functions/saveFcmToken.js` - No exportado