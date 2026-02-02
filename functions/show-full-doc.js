const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function showFullDocument() {
  try {
    console.log('\n📄 MOSTRANDO DOCUMENTO COMPLETO...\n');
    
    const userId = 'PjDtrdIPzjViHLXD4P31jlUXkRJ3';
    
    const doc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();
    
    if (!doc.exists) {
      console.log('❌ El documento no existe');
      process.exit(1);
    }
    
    const data = doc.data();
    
    console.log('Documento completo (JSON):');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

showFullDocument();
