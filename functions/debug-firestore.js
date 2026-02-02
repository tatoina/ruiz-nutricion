const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function debugFirestore() {
  try {
    console.log('\n🔍 DEBUG: Verificando estado de Firestore...\n');
    
    const adminId = 'r607SpSO7cY6M9dseOAP1aAEbv73';
    
    // Leer directamente desde Firestore
    const doc = await admin.firestore()
      .collection('users')
      .doc(adminId)
      .get();
    
    const data = doc.data();
    
    console.log('📄 Documento completo del admin:');
    console.log('  - email:', data.email);
    console.log('  - rol:', data.rol);
    console.log('  - fcmTokens:', data.fcmTokens);
    console.log('  - fcmToken:', data.fcmToken);
    console.log('\n📊 Tipo de fcmTokens:', typeof data.fcmTokens);
    console.log('📊 Es array?:', Array.isArray(data.fcmTokens));
    
    if (data.fcmTokens) {
      console.log('📊 Longitud:', data.fcmTokens.length);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

debugFirestore();
