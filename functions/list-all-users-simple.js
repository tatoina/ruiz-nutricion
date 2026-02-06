const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'nutricionapp-b7b7d'
  });
}

const db = admin.firestore();

async function listAllUsers() {
  try {
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`\n📊 Total usuarios en Firestore: ${usersSnapshot.size}\n`);
    
    usersSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const name = data.name || data.nombre || 'SIN NOMBRE';
      const surname = data.surname || data.apellidos || '';
      const email = data.email || 'sin email';
      
      console.log(`${index + 1}. ${name} ${surname} (${email})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

listAllUsers();
