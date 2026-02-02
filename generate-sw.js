// Script para generar firebase-messaging-sw.js con la configuración correcta
const fs = require('fs');
const path = require('path');

// Leer las variables de entorno o usar las de .env
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBGxHVwWxI3M0LmON-6QHy7OJvK4zYdZ8I",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "nutricionapp-b7b7d.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "nutricionapp-b7b7d",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "nutricionapp-b7b7d.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "23998467905",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:23998467905:web:YOUR_APP_ID"
};

const serviceWorkerContent = `// Service Worker para Firebase Cloud Messaging
// Generado automáticamente - NO EDITAR MANUALMENTE

importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(firebaseConfig, null, 2)});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Mensaje recibido en background:', payload);
  
  const notificationTitle = payload.notification?.title || '💬 Nuevo mensaje';
  const notificationOptions = {
    body: payload.notification?.body || 'Tienes un mensaje nuevo',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: 'nutri-app-notification',
    requireInteraction: true
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
`;

// Escribir el archivo en public/
const outputPath = path.join(__dirname, 'public', 'firebase-messaging-sw.js');
fs.writeFileSync(outputPath, serviceWorkerContent);
console.log('✅ firebase-messaging-sw.js generado correctamente en public/');
