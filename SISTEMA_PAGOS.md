# Sistema de Gestión de Pagos

## Descripción General

Sistema completo de gestión de pagos integrado en la aplicación nutri-app. **Solo visible para administradores**.

## Ubicación

- **Componente**: `src/components/AdminPagos.js`
- **Integración**: Tab "💰 Pagos" en `FichaUsuario.js` (después de "Anamnesis")
- **Acceso**: Solo visible cuando `adminMode=true`

## Funcionalidades

### 1. Configuración de Tarifas

El admin puede configurar las tarifas estándar para cada usuario:

- **Primera visita**: Precio fijo para la consulta inicial (solo se puede registrar una vez)
- **Seguimiento**: Precio por cada consulta de seguimiento
- **Tabla de ejercicios**: Precio por elaborar tabla de ejercicios
- **Otros**: Conceptos personalizados (puede añadir múltiples)

**Características**:
- Modo edición/lectura para evitar cambios accidentales
- Guardar tarifas en Firestore
- Añadir/eliminar conceptos "Otros"

### 2. Registro de Pagos

El admin puede registrar cada pago realizado por el cliente:

**Campos**:
- **Tipo de pago**: Primera visita, Seguimiento, Tabla de ejercicios, Otro
- **Cantidad**: Auto-completada según tarifas (editable en "Otro")
- **Fecha**: Fecha del pago
- **Estado**: Pagado o Pendiente
- **Notas**: Información adicional (opcional)

**Validaciones**:
- Primera visita solo se puede registrar una vez
- No se puede registrar pago sin seleccionar tipo
- Conceptos "Otro" requieren descripción y cantidad

### 3. Tabla de Pagos

Visualización completa del historial de pagos:

**Resumen**:
- **Total**: Suma de todos los pagos
- **Pagado**: Suma de pagos con estado "pagado"
- **Pendiente**: Suma de pagos con estado "pendiente"

**Tabla de historial**:
- Fecha, Concepto, Cantidad, Estado, Notas
- Cambiar estado (pagado ↔ pendiente)
- Eliminar pago (con confirmación)
- Indicador especial (⭐) para primera visita

## Estructura de Datos en Firestore

```javascript
// Documento del usuario en colección "users"
{
  // ... otros datos del usuario
  
  pagos: {
    // Tarifas configuradas para este usuario
    tarifas: {
      primeraVisita: 60,      // número (€)
      seguimiento: 35,         // número (€)
      tablaEjercicios: 25,     // número (€)
      otros: [                 // array de objetos
        {
          concepto: "Consulta especial",
          precio: 45
        },
        {
          concepto: "Plan nutricional mensual",
          precio: 80
        }
      ]
    },
    
    // Registro de todos los pagos
    registros: [               // array de objetos
      {
        tipo: "primeraVisita",      // "primeraVisita" | "seguimiento" | "tablaEjercicios" | "otro"
        concepto: "Primera visita",  // string
        cantidad: 60,                // número (€)
        fecha: "2025-01-15",        // ISO date string (YYYY-MM-DD)
        estado: "pagado",           // "pagado" | "pendiente"
        notas: "Pago en efectivo",  // string (opcional)
        timestamp: "2025-01-15T10:30:00Z" // ISO datetime (creación del registro)
      },
      {
        tipo: "seguimiento",
        concepto: "Seguimiento",
        cantidad: 35,
        fecha: "2025-02-01",
        estado: "pendiente",
        notas: "",
        timestamp: "2025-02-01T09:15:00Z"
      },
      {
        tipo: "otro",
        concepto: "Consulta online especial",
        cantidad: 50,
        fecha: "2025-02-10",
        estado: "pagado",
        notas: "Videollamada de 1 hora",
        timestamp: "2025-02-10T14:20:00Z"
      }
    ]
  }
}
```

## Características de Seguridad

✅ **Solo visible para administradores**: El tab "Pagos" solo aparece cuando `adminMode=true`

✅ **El usuario NO ve nada**: Los usuarios normales no tienen acceso a esta información

✅ **Validación de primera visita**: Solo se puede registrar una vez

✅ **Confirmación de eliminación**: Se requiere confirmación antes de eliminar un pago

✅ **Persistencia en Firestore**: Todos los datos se guardan en tiempo real

## Flujo de Uso Típico

1. **Configuración inicial**:
   - Admin abre la ficha del usuario
   - Va al tab "💰 Pagos"
   - Edita las tarifas y las guarda

2. **Primera consulta**:
   - Admin registra "Primera visita"
   - Marca como "Pagado" o "Pendiente"
   - Añade notas si es necesario

3. **Consultas posteriores**:
   - Admin registra cada "Seguimiento" o "Tabla de ejercicios"
   - Puede añadir conceptos personalizados en "Otro"
   - Actualiza el estado según el pago

4. **Seguimiento**:
   - Ve el historial completo
   - Consulta totales (pagado, pendiente, total)
   - Puede cambiar estados o eliminar registros incorrectos

## Ventajas

- ✅ Todo integrado en la misma aplicación
- ✅ Historial completo por usuario
- ✅ Cálculos automáticos de totales
- ✅ Gestión de pagos pendientes
- ✅ Tarifas personalizables por usuario
- ✅ Conceptos flexibles con "Otros"
- ✅ Interfaz intuitiva con colores según estado

## Notas Técnicas

- **Framework**: React con Firebase/Firestore
- **Actualización**: Cambios en tiempo real con `arrayUnion`
- **Validación**: Cliente-side antes de guardar
- **Formato de fecha**: ISO 8601 (YYYY-MM-DD)
- **Moneda**: Euros (€) con 2 decimales

## Futuras Mejoras Posibles

- 📊 Exportar historial a PDF/Excel
- 📧 Notificaciones automáticas de pagos pendientes
- 📈 Estadísticas de ingresos por período
- 🔔 Recordatorios de pagos vencidos
- 💳 Integración con pasarelas de pago online
- 📝 Generar recibos automáticos
