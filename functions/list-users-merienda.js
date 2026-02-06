const admin = require('firebase-admin');

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function listUsers() {
  try {
    const usersSnapshot = await db.collection('users').get();

    console.log(`Total de usuarios: ${usersSnapshot.size}\n`);

    console.log('Usuarios con contenidoManual:\n');

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.contenidoManual) {
        console.log(`UID: ${doc.id}`);
        console.log(`Email: ${userData.email || 'N/A'}`);
        console.log(`Name: ${userData.name || userData.nombre || 'N/A'}`);
        console.log(`Surname: ${userData.surname || userData.apellidos || 'N/A'}`);
        const hasMerienda = userData.contenidoManual.includes('MERIENDA');
        console.log(`Tiene MERIENDA: ${hasMerienda ? '✅' : '❌'}`);
        if (!hasMerienda) {
          console.log('⚠️  FALTA MERIENDA');
        }
        console.log('---');
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

listUsers();
