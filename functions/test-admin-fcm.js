const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function checkAdminFcmToken() {
  try {
    // Buscar usuario admin
    const adminSnapshot = await admin.firestore()
      .collection('users')
      .where('rol', '==', 'admin')
      .get();

    console.log('\n=== VERIFICANDO USUARIO ADMIN ===\n');
    
    if (adminSnapshot.empty) {
      console.log('❌ No se encontró ningún usuario con rol="admin"');
      
      // Buscar el usuario admin@admin.es por email
      console.log('\n📧 Buscando admin@admin.es...');
      const allUsers = await admin.firestore()
        .collection('users')
        .get();
      
      allUsers.forEach(doc => {
        const data = doc.data();
        if (data.email === 'admin@admin.es') {
          console.log('\n✓ Usuario encontrado:', doc.id);
          console.log('Email:', data.email);
          console.log('Rol:', data.rol || '❌ NO TIENE CAMPO ROL');
          console.log('fcmToken:', data.fcmToken ? '✓ SÍ tiene token' : '❌ NO tiene token');
          if (data.fcmToken) {
            console.log('Token:', data.fcmToken.substring(0, 50) + '...');
          }
        }
      });
    } else {
      console.log(`✓ Se encontraron ${adminSnapshot.size} usuario(s) con rol="admin"`);
      
      adminSnapshot.forEach(doc => {
        const data = doc.data();
        console.log('\n--- Usuario Admin ---');
        console.log('ID:', doc.id);
        console.log('Email:', data.email);
        console.log('Rol:', data.rol);
        console.log('fcmToken (antiguo):', data.fcmToken ? '✓ SÍ tiene token' : '❌ NO tiene token');
        console.log('fcmTokens (array):', data.fcmTokens ? `✓ SÍ tiene ${data.fcmTokens.length} token(s)` : '❌ NO tiene tokens');
        if (data.fcmToken) {
          console.log('Token antiguo (primeros 50 chars):', data.fcmToken.substring(0, 50) + '...');
        }
        if (data.fcmTokens && data.fcmTokens.length > 0) {
          console.log('Tokens en array:');
          data.fcmTokens.forEach((token, index) => {
            console.log(`  ${index + 1}. ${token.substring(0, 50)}...`);
          });
        }
      });
    }
    
    console.log('\n=== FIN VERIFICACIÓN ===\n');
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkAdminFcmToken();
