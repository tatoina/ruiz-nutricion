const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function listAllUsers() {
  try {
    console.log('\n📋 LISTANDO TODOS LOS USUARIOS DE AUTHENTICATION...\n');
    
    const listUsersResult = await admin.auth().listUsers(10);
    
    console.log(`Total de usuarios: ${listUsersResult.users.length}\n`);
    
    for (const userRecord of listUsersResult.users) {
      console.log(`Usuario ${userRecord.uid}:`);
      console.log(`  Email: ${userRecord.email}`);
      console.log(`  Display Name: ${userRecord.displayName || 'N/A'}`);
      console.log(`  Creado: ${userRecord.metadata.creationTime}`);
      
      // Verificar si tiene documento en Firestore
      const firestoreDoc = await admin.firestore()
        .collection('users')
        .doc(userRecord.uid)
        .get();
      
      if (firestoreDoc.exists) {
        const data = firestoreDoc.data();
        console.log(`  ✅ Documento en Firestore: Sí`);
        console.log(`     Rol: ${data.rol || 'no definido'}`);
        console.log(`     Tokens FCM: ${data.fcmTokens?.length || 0}`);
      } else {
        console.log(`  ❌ Documento en Firestore: NO`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

listAllUsers();
