// src/utils.js

export async function getAllUsers() {
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxbJsZneEf-7Dtark58zV3rMlpf2o31AF9nCSyh3_W0FGua0DY9M-9dlSTz4ML3HWVP/execc';
  const formData = new URLSearchParams();
  formData.append('action', 'getAllUsers');
  formData.append('email', 'admin@admin.es'); // Pon aquí el email correcto del administrador

  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  console.log('Usuarios recibidos:', data); // Esto ayuda a depurar en la consola
  return data.data; // Importante: la respuesta está en la propiedad "data"
}
