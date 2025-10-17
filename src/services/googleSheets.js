// src/services/googleSheets.js

const BACKEND_URL = "https://script.google.com/macros/s/AKfycbztIqGZAK502jQKORvw8gTbURIYuV1Lf50uNJyWmXbnxuTCHHtktT_xCgTpOA_8Scs8/exec";

/**
 * Envía una acción y datos al backend de Apps Script vinculado a Google Sheets usando x-www-form-urlencoded.
 * 
 * @param {string} action - Acción a realizar ('getUser', 'register', etc.)
 * @param {object} params - Datos a enviar, por ejemplo { email, nombre, ... }
 * @returns {Promise<{ok: boolean, data: any}>} Resultado del backend
 */
export async function fetchData(action, params) {
  // Convierte el objeto params en una string formateada tipo key1=value1&key2=value2...
  const body = Object.entries({ ...params, action })
    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    .join('&');

  const res = await fetch(
    BACKEND_URL,
    {
      method: "POST",
      body: body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  try {
    return await res.json();
  } catch (e) {
    return { ok: false, error: "Respuesta inválida del backend o error de red.", detalle: e.message };
  }
}
