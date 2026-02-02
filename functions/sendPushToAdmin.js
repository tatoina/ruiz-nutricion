const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Cloud Function para enviar notificación push al admin
exports.sendPushToAdmin = onCall(async (request) => {
  const { title, body } = request.data;

  // Validar parámetros
  if (!title || !body) {
    throw new HttpsError('invalid-argument', 'Se requiere title y body');
  }

  try {
    // Obtener el usuario admin - buscar por rol o por email
    let adminSnapshot = await admin.firestore()
      .collection('users')
      .where('rol', '==', 'admin')
      .limit(1)
      .get();

    // Si no se encuentra por rol, buscar por email
    if (adminSnapshot.empty) {
      adminSnapshot = await admin.firestore()
        .collection('users')
        .where('email', '==', 'admin@admin.es')
        .limit(1)
        .get();
    }

    if (adminSnapshot.empty) {
      console.log('No se encontró usuario admin');
      return { success: false, message: 'No se encontró admin' };
    }

    const adminDoc = adminSnapshot.docs[0];
    const adminData = adminDoc.data();
    
    // Obtener tokens (soporta array nuevo y campo viejo)
    let tokens = [];
    if (adminData.fcmTokens && Array.isArray(adminData.fcmTokens)) {
      tokens = adminData.fcmTokens;
    } else if (adminData.fcmToken) {
      tokens = [adminData.fcmToken];
    }
    
    if (tokens.length === 0) {
      console.log('Admin no tiene fcmTokens registrados');
      return { success: false, message: 'Admin sin fcmTokens' };
    }

    console.log(`Enviando push a ${tokens.length} dispositivo(s) del admin`);

    // Enviar notificación push a todos los tokens
    const sendPromises = tokens.map(async (token) => {
      try {
        const message = {
          token: token,
          notification: {
            title: title,
            body: body
          },
          webpush: {
            notification: {
              icon: '/logo192.png',
              badge: '/logo192.png',
              requireInteraction: true
            }
          }
        };
        await admin.messaging().send(message);
        console.log('Push enviado al token:', token.substring(0, 20) + '...');
        return { success: true, token };
      } catch (error) {
        console.error('Error enviando a token:', token.substring(0, 20), error.code);
        // Si el token es inválido, podríamos limpiarlo aquí
        return { success: false, token, error: error.code };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    
    console.log(`Push enviado correctamente a ${successCount}/${tokens.length} dispositivo(s)`);
    
    return { 
      success: successCount > 0,
      totalDevices: tokens.length,
      successDevices: successCount
    };
  } catch (error) {
    console.error('Error enviando push al admin:', error);
    throw new HttpsError('internal', 'Error enviando notificación');
  }
});
