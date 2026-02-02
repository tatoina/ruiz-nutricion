const admin = require('firebase-admin');

// Inicializar Admin SDK
admin.initializeApp();

const db = admin.firestore();

async function clearAdminTokens() {
  try {
    console.log('🔍 Buscando usuario administrador...');
    
    // Buscar el admin por UID
    const adminUID = 'PjDtrdIPzjViHLXD4P31jlUXkRJ3';
    const userRef = db.collection('users').doc(adminUID);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log('❌ Usuario admin no encontrado');
      return;
    }
    
    const userData = userDoc.data();
    console.log(`✅ Admin encontrado: ${userData.email || userData.nombre || adminUID}`);
    console.log(`📱 Tokens actuales: ${(userData.fcmTokens || []).length}`);
    
    // Limpiar tokens
    await userRef.update({
      fcmTokens: []
    });
    
    console.log('✅ Todos los tokens FCM del admin han sido eliminados');
    console.log('💡 Ahora el admin puede registrar solo su dispositivo actual al entrar a la app');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

clearAdminTokens().then(() => {
  console.log('🏁 Proceso completado');
  process.exit(0);
});
