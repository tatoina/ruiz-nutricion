# 🔄 Guía de Actualización de Versión

## Cómo actualizar la versión de la app

Cuando hagas cambios importantes en la aplicación, actualiza la versión siguiendo estos pasos:

### 1. Actualizar el archivo de versión

Edita el archivo: `src/config/version.js`

```javascript
export const APP_VERSION = "1.1"; // ← Cambia aquí la versión

export const VERSION_HISTORY = [
  {
    version: "1.1", // ← Nueva versión
    date: "2026-01-15", // ← Fecha del cambio
    changes: [
      "Descripción de los cambios realizados",
      "Otra mejora importante",
      "Corrección de errores"
    ]
  },
  {
    version: "1.0",
    date: "2026-01-10",
    changes: [
      "Versión inicial",
      // ...
    ]
  }
];
```

### 2. Tipos de cambios de versión

Usa este esquema de versionado:

- **X.0** → Cambios mayores (nueva funcionalidad importante)
  - Ejemplo: 1.0 → 2.0 (rediseño completo, nuevas características principales)

- **1.X** → Cambios menores (mejoras, nuevas funciones pequeñas)
  - Ejemplo: 1.0 → 1.1 (agregar función de notificaciones)

- **1.1.X** → Parches (correcciones de bugs, ajustes menores)
  - Ejemplo: 1.1.0 → 1.1.1 (corregir error en formulario)

### 3. Dónde se muestra la versión

La versión aparece automáticamente en:
- ✅ Pantalla de login (esquina superior derecha)
- ✅ Muestra icono 📱 para móvil o 💻 para PC
- ✅ Muestra "v1.0" con la versión actual

### 4. Ejemplo de actualización

Si hoy agregas una nueva funcionalidad importante:

```javascript
// src/config/version.js
export const APP_VERSION = "1.1";

export const VERSION_HISTORY = [
  {
    version: "1.1",
    date: "2026-01-15",
    changes: [
      "Nuevo sistema de pagos con Stripe",
      "Mejoras en la interfaz móvil del admin",
      "Corrección de errores en la agenda"
    ]
  },
  {
    version: "1.0",
    date: "2026-01-10",
    changes: [
      "Versión inicial",
      // ...
    ]
  }
];
```

### 5. Desplegar los cambios

Después de actualizar la versión:

```bash
npm run build
firebase deploy --only hosting
```

## 📋 Checklist de actualización

- [ ] Actualizar `APP_VERSION` en `src/config/version.js`
- [ ] Agregar entrada en `VERSION_HISTORY` con los cambios
- [ ] Probar que la versión se muestra correctamente en el login
- [ ] Hacer build de producción
- [ ] Desplegar en Firebase Hosting
- [ ] Verificar en la app desplegada

---

**Nota:** La versión se actualiza automáticamente en toda la app al cambiar el archivo `src/config/version.js`. No necesitas modificar ningún otro archivo.
