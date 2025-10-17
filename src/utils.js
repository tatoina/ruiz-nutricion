// src/utils.js

export async function getAllUsers() {
  // Asegúrate de que la URL termina en /exec (NO /execc)
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyrlpwsfv4aYu5NAiL_xqGXOfo1KTOh7x2LbTpFnsKouLsviJM3qkb9RGgPu1tVz6vf/exec';

  // Crea los parámetros como formulario
  const formData = new URLSearchParams();
  formData.append('action', 'getAllUsers');
  formData.append('email', 'admin@admin.es'); // Solo para permisos, si tu backend lo requiere

  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    // Si la respuesta no es ok, lanza error para depurar más fácilmente
    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }

    const data = await res.json();
    console.log('Usuarios recibidos:', data); // Depuración por consola

    // Cambia "users" o "data" según la estructura real de tu Apps Script:
    return data.users || data.data || [];  // Usa "users", luego "data", si ninguna existe devuelve array vacío

  } catch (err) {
    console.error('Error al obtener usuarios:', err);
    return [];
  }
}
