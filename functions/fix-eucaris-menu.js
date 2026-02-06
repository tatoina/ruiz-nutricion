const admin = require('firebase-admin');

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function fixEucarisMenu() {
  try {
    // Buscar todos los usuarios y filtrar por nombre que contenga "eucaris"
    const usersSnapshot = await db.collection('users').get();

    console.log(`Total de usuarios: ${usersSnapshot.size}`);

    let found = false;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const fullName = `${userData.nombre || ''} ${userData.apellidos || ''}`.toLowerCase();
      
      if (fullName.includes('eucaris') || fullName.includes('martinez')) {
        found = true;
        console.log(`\nUsuario encontrado: ${userData.nombre} ${userData.apellidos || ''}`);
        console.log(`UID: ${doc.id}`);
        
        if (!userData.contenidoManual) {
          console.log('Este usuario no tiene contenidoManual');
          continue;
        }

        let content = userData.contenidoManual;
        
        // Verificar si ya tiene MERIENDA
        if (content.includes('MERIENDA')) {
          console.log('✅ Este usuario ya tiene la fila MERIENDA');
          continue;
        }

        console.log('⚠️  Falta la fila MERIENDA. Añadiendo...');

        // Buscar la posición donde insertar MERIENDA (después de COMIDA y antes de CENA)
        const cenaMatch = content.match(/<tr>\s*<td[^>]*>CENA<\/td>/i);
        
        if (!cenaMatch) {
          console.log('❌ No se encontró la fila CENA');
          continue;
        }

        const cenaIndex = cenaMatch.index;
        
        // Insertar antes de la fila de CENA
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
        
        const beforeCena = content.substring(0, cenaIndex);
        const afterCena = content.substring(cenaIndex);
        
        const newContent = beforeCena + meriendaRow + afterCena;

        // Actualizar en Firestore
        await doc.ref.update({
          contenidoManual: newContent
        });

        console.log(`✅ Fila MERIENDA añadida correctamente`);
      }
    }

    if (!found) {
      console.log('\n❌ No se encontró ningún usuario con nombre Eucaris o Martinez');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

fixEucarisMenu();
