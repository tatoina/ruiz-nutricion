const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function findAllAdmins() {
  try {
    console.log('\n🔍 BUSCANDO TODOS LOS USUARIOS ADMIN...\n');
    
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .get();
    
    let admins = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.email === 'admin@admin.es' || data.rol === 'admin' || data.role === 'admin') {
        admins.push({
          id: doc.id,
          email: data.email,
          rol: data.rol,
          role: data.role,
          fcmTokens: data.fcmTokens || []
        });
      }
    });
    
    console.log(`✓ Encontrados ${admins.length} usuario(s) admin:\n`);
    
    admins.forEach((admin, index) => {
      console.log(`Admin ${index + 1}:`);
      console.log(`  ID: ${admin.id}`);
      console.log(`  Email: ${admin.email}`);
      console.log(`  Rol: ${admin.rol || 'no definido'}`);
      console.log(`  Tokens FCM: ${admin.fcmTokens.length}`);
      if (admin.fcmTokens.length > 0) {
        admin.fcmTokens.forEach((token, i) => {
          console.log(`    Token ${i + 1}: ${token.substring(0, 30)}...`);
        });
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

findAllAdmins();
