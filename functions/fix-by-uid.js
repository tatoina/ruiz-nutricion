const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function fixByUID() {
  try {
    // UID completo del usuario Eucaris
    const uid = 'THouwZzkKcfUpJFZSZEhV3ao7t42';
    
    console.log(`Buscando usuario con UID: ${uid}...`);
    
    const docRef = db.collection('users').doc(uid);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log('❌ No se encontró el usuario');
      return;
    }
    
    console.log(`✅ Usuario encontrado`);
    
    const userData = doc.data();
    console.log(`Email: ${userData.email || 'N/A'}`);
    console.log(`Name: ${userData.name || userData.nombre || 'N/A'}`);
    
    if (!userData.contenidoManual) {
      console.log('❌ Este usuario no tiene contenidoManual');
      return;
    }

    let content = userData.contenidoManual;

    if (content.includes('MERIENDA')) {
      console.log('✅ Este usuario YA tiene la fila MERIENDA');
      return;
    }

    console.log('⚠️  Falta la fila MERIENDA. Añadiendo...');

    const cenaMatch = content.match(/<tr>\s*<td[^>]*>CENA<\/td>/i);

    if (!cenaMatch) {
      console.log('❌ No se encontró la fila CENA');
      return;
    }

    const cenaIndex = cenaMatch.index;

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

    const newContent = content.substring(0, cenaIndex) + meriendaRow + content.substring(cenaIndex);

    await docRef.update({
      contenidoManual: newContent
    });

    console.log('✅ Fila MERIENDA añadida correctamente');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

fixByUID();
