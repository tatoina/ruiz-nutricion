const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');

// Inicializar EXACTAMENTE igual que en las Cloud Functions
initializeApp();

async function readDirectly() {
  try {
    const userId = 'PjDtrdIPzjViHLXD4P31jlUXkRJ3';
    
    console.log('\n🔍 Leyendo con getFirestore() igual que Cloud Functions...\n');
    
    const db = getFirestore();
    const userRef = db.collection('users').doc(userId);
    const snapshot = await userRef.get();
    
    if (!snapshot.exists) {
      console.log('❌ El documento NO existe');
      return;
    }
    
    const data = snapshot.data();
    
    console.log('✅ Documento encontrado');
    console.log('📧 Email:', data.email);
    console.log('👤 Rol:', data.rol);
    console.log('📱 fcmTokens:', data.fcmTokens);
    console.log('📊 Cantidad de tokens:', data.fcmTokens?.length || 0);
    
    if (data.fcmTokens && data.fcmTokens.length > 0) {
      console.log('\n🎯 Primeros 3 tokens:');
      data.fcmTokens.slice(0, 3).forEach((token, idx) => {
        console.log(`   ${idx + 1}. ${token.substring(0, 40)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

readDirectly();
