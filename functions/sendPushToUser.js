const {onCall} = require('firebase-functions/v2/https');
const {HttpsError} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// No inicializar aquí, ya está inicializado en index.js

// Cloud Function para enviar notificación push a un usuario
exports.sendPushToUser = onCall(async (request) => {
  // Solo admin puede enviar
  const adminEmails = ["admin@admin.es"];
  const isAdmin = request.auth && (
    request.auth.token.admin === true ||
    adminEmails.includes(request.auth.token.email?.toLowerCase())
  );
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Solo admin puede enviar notificaciones push.');
  }

  const { userId, title, body } = request.data;
  if (!userId || !title || !body) {
    throw new HttpsError('invalid-argument', 'Faltan datos para la notificación.');
  }

  // Obtener token(s) FCM del usuario
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  // Soportar array nuevo y campo viejo
  let tokens = [];
  if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
    tokens = userData.fcmTokens;
  } else if (userData.fcmToken) {
    tokens = [userData.fcmToken];
  }
  
  if (tokens.length === 0) {
    throw new HttpsError('not-found', 'El usuario no tiene tokens FCM.');
  }

  console.log(`Enviando push a ${tokens.length} dispositivo(s) del usuario ${userId}`);

  // Enviar notificación a todos los dispositivos
  const sendPromises = tokens.map(async (token) => {
    try {
      const message = {
        notification: { title, body },
        token: token,
      };
      await admin.messaging().send(message);
      return { success: true };
    } catch (error) {
      console.error('Error enviando a token:', error.code);
      return { success: false, error: error.code };
    }
  });

  const results = await Promise.all(sendPromises);
  const successCount = results.filter(r => r.success).length;
  
  return { 
    success: successCount > 0,
    totalDevices: tokens.length,
    successDevices: successCount
  };
});
