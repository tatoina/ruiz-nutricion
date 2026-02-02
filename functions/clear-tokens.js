const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');

initializeApp();

async function clearTokens() {
  try {
    const userId = 'PjDtrdIPzjViHLXD4P31jlUXkRJ3';
    
    console.log('🧹 Limpiando tokens FCM del admin...\n');
    
    const db = getFirestore();
    const userRef = db.collection('users').doc(userId);
    
    await userRef.set({
      fcmTokens: []
    }, { merge: true });
    
    console.log('✅ Tokens eliminados correctamente');
    console.log('📱 La próxima vez que el admin entre a la app, se registrará un nuevo token limpio\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

clearTokens();
