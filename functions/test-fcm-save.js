const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function testSaveToken() {
  try {
    console.log('\n🧪 TEST: Guardando token FCM de prueba...\n');
    
    const adminId = 'r607SpSO7cY6M9dseOAP1aAEbv73';
    const testToken = 'TEST_TOKEN_' + Date.now();
    
    // Guardar directamente un token de prueba
    await admin.firestore()
      .collection('users')
      .doc(adminId)
      .set({
        fcmTokens: [testToken]
      }, { merge: true });
    
    console.log('✅ Token de prueba guardado');
    
    // Leer para verificar
    const doc = await admin.firestore()
      .collection('users')
      .doc(adminId)
      .get();
    
    const data = doc.data();
    console.log('📱 Tokens en Firestore:', data.fcmTokens);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

testSaveToken();
