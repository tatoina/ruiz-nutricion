# Sistema de Notificaciones de Citas

## Funcionalidad Implementada

### 📧 Email - 1 día antes
- **Cuándo**: Se envía automáticamente 24 horas antes de la cita (entre 23-25 horas)
- **Contenido**: 
  - Saludo personalizado con nombre del usuario
  - Fecha y hora de la cita
  - Notas de la cita (si existen)
  - Logo de la clínica
  - Diseño profesional en HTML

### 🔔 Push Notification - 1 hora antes
- **Cuándo**: Se envía automáticamente 1 hora antes de la cita (entre 55-65 minutos)
- **Contenido**:
  - Título: "🔔 Recordatorio de Cita"
  - Mensaje: Hora de la cita
  - Se muestra en el navegador si el usuario ha dado permisos

## Componentes del Sistema

### 1. Cloud Function: `checkAppointmentReminders`
- **Ubicación**: `functions/index.js`
- **Ejecución**: Cada hora automáticamente
- **Proceso**:
  1. Revisa todas las citas de todos los usuarios
  2. Calcula el tiempo hasta cada cita
  3. Envía email si faltan ~24 horas y no se ha enviado
  4. Crea notificación push si falta ~1 hora y no se ha enviado
  5. Marca cada notificación como enviada para no duplicar

### 2. Listener de Notificaciones en App
- **Ubicación**: `FichaUsuario.js` líneas 650-688
- **Función**: Escucha notificaciones nuevas en tiempo real
- **Proceso**:
  1. Se conecta a Firestore collection `notifications`
  2. Filtra por usuario actual y notificaciones no leídas
  3. Muestra notificación del navegador automáticamente
  4. Marca la notificación como leída

### 3. Estructura de Datos

#### Cita en Firestore
```javascript
{
  fecha: "2025-12-15T10:00:00",
  hora: "10:00",
  notas: "Revisión mensual",
  emailSent: false,    // Se marca true cuando se envía email
  pushSent: false,     // Se marca true cuando se envía push
  createdAt: "...",
  createdBy: "admin"
}
```

#### Notificación Push en Firestore
```javascript
{
  userId: "user123",
  type: "appointment_reminder",
  title: "🔔 Recordatorio de Cita",
  body: "Tu cita es en 1 hora - 10:00",
  data: {
    citaFecha: "2025-12-15T10:00:00",
    citaNotas: "Revisión mensual"
  },
  createdAt: timestamp,
  read: false,
  readAt: null  // Se actualiza cuando el usuario ve la notificación
}
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

## Testing

### Para probar emails
1. Crear una cita para mañana a cualquier hora
2. Esperar a que la función se ejecute (cada hora)
3. Verificar que `emailSent: true` se añade a la cita
4. Revisar el email en la bandeja de entrada

### Para probar push notifications
1. Activar permisos de notificación en la app
2. Crear una cita dentro de 1 hora
3. Esperar a que la función se ejecute
4. Verificar notificación del navegador
5. Verificar que `pushSent: true` se añade a la cita

## Logs y Debugging

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
4. **Permisos**: Los usuarios deben dar permiso para recibir notificaciones del navegador
