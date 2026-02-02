import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFunctions, httpsCallable } from "firebase/functions";
import app from "./Firebase";

const messaging = getMessaging(app);

// Clave pública VAPID
const VAPID_KEY = "BNVbjpwoO4qNs8mjJ2ZWTNCGRKylyR_UqpnWtwZa6BGqda70H6qcwYc50jSX5Oyq8QDFJn4qvgNE-xNw0kA5eL0";

export async function requestNotificationPermissionAndSaveToken(userId) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Permiso de notificaciones denegado");
      return;
    }
    
    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!currentToken) {
      console.warn("No se pudo obtener el token FCM");
      return;
    }
    
    console.log("✅ Token FCM obtenido:", currentToken.substring(0, 30) + "...");
    
    try {
      console.log("💾 Guardando token usando Cloud Function...");
      console.log("   userId:", userId);
      console.log("   token:", currentToken.substring(0, 50) + "...");
      
      // Usar Cloud Function para guardar el token
      const functions = getFunctions();
      const saveFcmToken = httpsCallable(functions, 'saveFcmToken');
      const result = await saveFcmToken({ token: currentToken });
      
      console.log("✅ Token FCM guardado en Firestore via Cloud Function");
      console.log("📱 Total de dispositivos:", result.data.totalTokens);
      console.log("🔑 Token guardado:", currentToken.substring(0, 30) + "...");
    } catch (saveError) {
      console.error("❌ Error al guardar token:", saveError);
      console.error("Código:", saveError.code);
      console.error("Mensaje:", saveError.message);
      console.error("Stack:", saveError.stack);
    }
    
  } catch (err) {
    console.error("❌ Error obteniendo token FCM:", err);
  }
}

// Escuchar mensajes cuando la app está en primer plano
onMessage(messaging, (payload) => {
  console.log("Notificación recibida en primer plano:", payload);
  // Mostrar notificación personalizada en primer plano
  if (payload.notification) {
    new Notification(payload.notification.title, {
      body: payload.notification.body,
      icon: '/logo192.png'
    });
  }
});
