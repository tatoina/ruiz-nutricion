const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function checkSpecificUser() {
  try {
    console.log('\n🔍 VERIFICANDO USUARIO PjDtrdIPzjViHLXD4P31jlUXkRJ3...\n');
    
    const doc = await admin.firestore()
      .collection('users')
      .doc('PjDtrdIPzjViHLXD4P31jlUXkRJ3')
      .get();
    
    if (!doc.exists) {
      console.log('❌ El usuario no existe');
      process.exit(1);
    }
    
    const data = doc.data();
    
    console.log('📄 Datos del usuario:');
    console.log('  ID:', doc.id);
    console.log('  Email:', data.email);
    console.log('  Nombre:', data.nombre);
    console.log('  Apellidos:', data.apellidos);
    console.log('  Rol:', data.rol);
    console.log('  Role:', data.role);
    console.log('  FCM Tokens:', data.fcmTokens?.length || 0);
    
    if (data.fcmTokens && data.fcmTokens.length > 0) {
      console.log('\n📱 Tokens FCM:');
      data.fcmTokens.forEach((token, i) => {
        console.log(`  ${i + 1}. ${token.substring(0, 50)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

checkSpecificUser();
