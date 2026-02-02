// Service Worker para Firebase Cloud Messaging
// Generado automáticamente - NO EDITAR MANUALMENTE

importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
  "apiKey": "AIzaSyAPfkczL6ekY_82BQHpMrT5Rd1lwpTrRNQ",
  "authDomain": "nutricionapp-b7b7d.firebaseapp.com",
  "projectId": "nutricionapp-b7b7d",
  "storageBucket": "nutricionapp-b7b7d.firebasestorage.app",
  "messagingSenderId": "23998467905",
  "appId": "1:23998467905:web:c619b3390f5831eccadbc0"
});

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
