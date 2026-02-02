const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function clearTokens() {
  try {
    console.log('\n🧹 LIMPIANDO TOKENS FCM DEL ADMIN...\n');
    
    const adminId = 'r607SpSO7cY6M9dseOAP1aAEbv73';
    
    // Borrar todos los tokens
    await admin.firestore()
      .collection('users')
      .doc(adminId)
      .update({
        fcmTokens: []
      });
    
    console.log('✅ Tokens eliminados correctamente');
    console.log('\n📱 Ahora puedes iniciar sesión en PC y móvil para registrar los tokens reales\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

clearTokens();
