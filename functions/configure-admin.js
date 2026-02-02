const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function configureAdmin() {
  try {
    console.log('\n🔧 CONFIGURANDO USUARIO ADMIN...\n');
    
    // Buscar el usuario admin@admin.es
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .get();
    
    let adminDocId = null;
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.email === 'admin@admin.es') {
        adminDocId = doc.id;
      }
    });
    
    if (!adminDocId) {
      console.log('❌ No se encontró el usuario admin@admin.es');
      process.exit(1);
    }
    
    console.log('✓ Usuario encontrado:', adminDocId);
    
    // Actualizar documento con el campo rol
    await admin.firestore()
      .collection('users')
      .doc(adminDocId)
      .update({
        rol: 'admin'
      });
    
    console.log('✅ Campo "rol" actualizado a "admin"');
    console.log('\n📱 IMPORTANTE: El admin debe iniciar sesión en la aplicación para registrar su fcmToken');
    console.log('   Después de iniciar sesión, el fcmToken se guardará automáticamente.\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

configureAdmin();
