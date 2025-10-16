// src/utils.js

export async function getAllUsers() {
  const SCRIPT_URL = 'TU_URL_DE_APPS_SCRIPT'; // Reemplaza con tu URL real
  const formData = new URLSearchParams();
  formData.append('action', 'getAllUsers');
  formData.append('email', 'admin@admin.es'); // Aquí el mail de administrador real

  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  return data.users; // Ajusta este return si tu backend responde distinto
}
