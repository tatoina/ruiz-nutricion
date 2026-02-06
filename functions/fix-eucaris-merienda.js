const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function fixEucarisMerienda() {
  try {
    const usersSnapshot = await db.collection('users')
      .where('email', '==', 'eucaris1009@hotmail.com')
      .get();

    if (usersSnapshot.empty) {
      console.log('❌ No se encontró usuario con email eucaris1009@hotmail.com');
      console.log('Buscando en todos los usuarios...');
      
      // Buscar en todos
      const allUsers = await db.collection('users').get();
      let found = false;
      allUsers.forEach(doc => {
        const data = doc.data();
        if (data.email && data.email.toLowerCase().includes('eucaris')) {
          console.log(`Encontrado: ${data.email} - UID: ${doc.id}`);
          found = true;
        }
      });
      
      if (!found) {
        console.log('No se encontró ningún usuario con email que contenga "eucaris"');
      }
      return;
    }

    const doc = usersSnapshot.docs[0];
    const userData = doc.data();
    
    console.log(`✅ Usuario encontrado: ${userData.name || userData.nombre || ''} ${userData.surname || userData.apellidos || ''}`);
    console.log(`UID: ${doc.id}`);

    if (!userData.contenidoManual) {
      console.log('❌ Este usuario no tiene contenidoManual');
      return;
    }

    let content = userData.contenidoManual;

    // Verificar si ya tiene MERIENDA
    if (content.includes('MERIENDA')) {
      console.log('✅ Este usuario YA tiene la fila MERIENDA');
      return;
    }

    console.log('⚠️  Falta la fila MERIENDA. Añadiendo...');

    // Buscar la fila de CENA
    const cenaMatch = content.match(/<tr>\s*<td[^>]*>CENA<\/td>/i);

    if (!cenaMatch) {
      console.log('❌ No se encontró la fila CENA');
      return;
    }

    const cenaIndex = cenaMatch.index;

    // Crear la fila de MERIENDA
    const meriendaRow = `          <tr>
            <td contenteditable="false">MERIENDA</td>
            <td><br></td>
            <td><br></td>
            <td><br></td>
            <td><br></td>
            <td><br></td>
            <td><br></td>
            <td><br></td>
          </tr>
`;

    // Insertar MERIENDA antes de CENA
    const newContent = content.substring(0, cenaIndex) + meriendaRow + content.substring(cenaIndex);

    // Actualizar en Firestore
    await doc.ref.update({
      contenidoManual: newContent
    });

    console.log('✅ Fila MERIENDA añadida correctamente');
    console.log('✅ Contenido actualizado en Firestore');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

fixEucarisMerienda();
