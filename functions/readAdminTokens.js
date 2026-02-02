const {onCall} = require('firebase-functions/v2/https');
const {getFirestore} = require('firebase-admin/firestore');

// Cloud Function para LEER tokens (no escribir)
exports.readAdminTokens = onCall(async (request) => {
  try {
    const userId = 'PjDtrdIPzjViHLXD4P31jlUXkRJ3';
    
    const db = getFirestore();
    const userRef = db.collection('users').doc(userId);
    const snapshot = await userRef.get();
    
    if (!snapshot.exists) {
      return { error: 'Documento no existe' };
    }
    
    const data = snapshot.data();
    const tokens = data.fcmTokens || [];
    
    console.log('📱 Tokens leídos desde Cloud Function:', tokens.length);
    
    return {
      success: true,
      email: data.email,
      rol: data.rol,
      tokenCount: tokens.length,
      tokens: tokens.map(t => t.substring(0, 40) + '...')
    };
  } catch (error) {
    console.error('Error:', error);
    return { error: error.message };
  }
});
