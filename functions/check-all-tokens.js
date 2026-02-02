const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function checkAllUserTokens() {
  try {
    console.log('\n🔍 VERIFICANDO TODOS LOS USUARIOS Y SUS TOKENS...\n');
    
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .get();
    
    console.log(`Total usuarios: ${usersSnapshot.size}\n`);
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const isAdmin = data.email === 'admin@admin.es' || data.rol === 'admin';
      
      if (isAdmin) {
        console.log('═══════════════════════════════════════');
        console.log('👤 USUARIO ADMIN ENCONTRADO');
        console.log('═══════════════════════════════════════');
      }
      
      console.log('\nID:', doc.id);
      console.log('Email:', data.email);
      console.log('Rol:', data.rol || '(sin rol)');
      console.log('fcmToken (antiguo):', data.fcmToken ? `✓ ${data.fcmToken.substring(0, 30)}...` : '❌ NO');
      console.log('fcmTokens (array):', data.fcmTokens ? `✓ ${data.fcmTokens.length} token(s)` : '❌ NO');
      
      if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
        console.log('\n📱 Tokens en array:');
        data.fcmTokens.forEach((token, index) => {
          console.log(`  ${index + 1}. ${token.substring(0, 50)}...`);
        });
      }
      
      console.log('\n---');
    });
    
    console.log('\n✅ Verificación completada\n');
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

checkAllUserTokens();
