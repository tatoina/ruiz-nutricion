const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function createAdminDocument() {
  try {
    console.log('\n📝 CREANDO/ACTUALIZANDO DOCUMENTO DE ADMIN...\n');
    
    const adminUID = 'PjDtrdIPzjViHLXD4P31jlUXkRJ3';
    
    // Crear documento con rol admin
    await admin.firestore()
      .collection('users')
      .doc(adminUID)
      .set({
        email: 'admin@admin.es',
        rol: 'admin',
        nombre: 'Admin',
        apellidos: '',
        createdAt: new Date(),
        fcmTokens: [] // Inicializar array vacío, se llenará al login
      }, { merge: true });
    
    console.log('✅ Documento de admin creado/actualizado correctamente');
    console.log('   UID:', adminUID);
    console.log('   Email: admin@admin.es');
    console.log('   Rol: admin');
    console.log('\n💡 Ahora inicia sesión de nuevo para registrar los tokens FCM\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

createAdminDocument();
