// Sistema de logging condicional - solo en desarrollo
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args) => {
    if (isDevelopment) console.log(...args);
  },
  debug: (...args) => {
    if (isDevelopment) console.debug(...args);
  },
  warn: (...args) => {
    if (isDevelopment) console.warn(...args);
  },
  error: (...args) => {
    // Errores siempre se muestran (importante para debugging en producción)
    console.error(...args);
  },
  info: (...args) => {
    if (isDevelopment) console.info(...args);
  }
};

// Exportación default para compatibilidad
export default logger;
