const {onCall} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Cloud Function para guardar token FCM
exports.saveFcmToken = onCall(async (request) => {
  const { token } = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new Error('No autenticado');
  }

  if (!token) {
    throw new Error('Token requerido');
  }

  try {
    console.log('Guardando token FCM para usuario:', userId);
    console.log('Token:', token.substring(0, 30) + '...');

    const userRef = admin.firestore().collection('users').doc(userId);
    
    // Leer documento actual
    const snapshot = await userRef.get();
    
    if (!snapshot.exists) {
      throw new Error('El documento del usuario no existe');
    }
    
    const currentData = snapshot.data();
    let currentTokens = currentData.fcmTokens || [];
    
    // Asegurar que es un array
    if (!Array.isArray(currentTokens)) {
      currentTokens = [];
    }
    
    // Solo agregar si no existe
    if (!currentTokens.includes(token)) {
      currentTokens.push(token);
      
      // Guardar directamente el array completo con set + merge
      await userRef.set({
        fcmTokens: currentTokens
      }, { merge: true });
      
      console.log('Token FCM guardado exitosamente');
      
      // Verificar que se guardó leyendo de nuevo
      const verifySnapshot = await userRef.get();
      const verifyData = verifySnapshot.data();
      console.log('Tokens en documento:', verifyData.fcmTokens?.length || 0);
      
      return { 
        success: true, 
        message: 'Token guardado correctamente',
        totalTokens: verifyData.fcmTokens?.length || 0
      };
    } else {
      console.log('Token ya existe, no se agregó');
      return { 
        success: true, 
        message: 'Token ya existía',
        totalTokens: currentTokens.length
      };
    }
  } catch (error) {
    console.error('Error guardando token:', error);
    throw new Error('Error al guardar token: ' + error.message);
  }
});
