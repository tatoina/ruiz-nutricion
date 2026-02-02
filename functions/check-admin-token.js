const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function checkAdminToken() {
  try {
    console.log('\n🔍 VERIFICANDO TOKEN FCM DEL ADMIN...\n');
    
    // Buscar todos los posibles usuarios admin
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .get();
    
    let adminDocs = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.email === 'admin@admin.es' || data.rol === 'admin') {
        adminDocs.push({ id: doc.id, data });
      }
    });
    
    if (adminDocs.length === 0) {
      console.log('❌ No se encontró el usuario admin');
      process.exit(1);
    }
    
    // Mostrar todos los admins encontrados
    console.log(`✓ Encontrados ${adminDocs.length} usuario(s) admin:\n`);
    
    let totalTokens = 0;
    
    adminDocs.forEach((adminDoc, index) => {
      console.log(`Admin ${index + 1}:`);
      console.log('  ID:', adminDoc.id);
      console.log('  Email:', adminDoc.data.email);
      console.log('  Rol:', adminDoc.data.rol || 'no definido');
      
      // Verificar tokens FCM
      const tokens = [];
      if (adminDoc.data.fcmTokens && Array.isArray(adminDoc.data.fcmTokens)) {
        tokens.push(...adminDoc.data.fcmTokens);
      }
      if (adminDoc.data.fcmToken && !tokens.includes(adminDoc.data.fcmToken)) {
        tokens.push(adminDoc.data.fcmToken);
      }
      
      totalTokens += tokens.length;
      
      if (tokens.length === 0) {
        console.log('  ❌ Sin tokens FCM\n');
      } else {
        console.log(`  ✅ ${tokens.length} token(s) FCM:`);
        tokens.forEach((token, i) => {
          console.log(`     ${i + 1}. ${token.substring(0, 40)}...`);
        });
        console.log('');
      }
    });
    
    if (totalTokens === 0) {
      console.log('❌ NINGÚN ADMIN TIENE TOKENS FCM REGISTRADOS\n');
      console.log('📱 SOLUCIÓN:');
      console.log('   1. Inicia sesión en la app como admin');
      console.log('   2. Acepta los permisos de notificaciones');
      console.log('   3. El token se guardará automáticamente\n');
    } else {
      console.log(`✅ Total: ${totalTokens} token(s) FCM registrado(s)`);
      console.log('✅ Las notificaciones push deberían funcionar correctamente\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

checkAdminToken();
