const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function findByPhone() {
  try {
    const phone = '692712898';
    console.log(`Buscando usuario con teléfono: ${phone}...\n`);
    
    const usersSnapshot = await db.collection('users').get();
    
    let found = false;
    
    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      const userPhone = (data.phone || '').replace(/\s/g, '');
      
      if (userPhone.includes(phone) || phone.includes(userPhone)) {
        found = true;
        console.log('═══════════════════════════════════════');
        console.log('✅ USUARIO ENCONTRADO:');
        console.log(`UID: ${doc.id}`);
        console.log(`Email: ${data.email || 'N/A'}`);
        console.log(`Name: ${data.name || data.nombre || 'N/A'}`);
        console.log(`Surname: ${data.surname || data.apellidos || 'N/A'}`);
        console.log(`Phone: ${data.phone || 'N/A'}`);
        console.log(`Tiene contenidoManual: ${!!data.contenidoManual}`);
        
        if (data.contenidoManual) {
          const hasMerienda = data.contenidoManual.includes('MERIENDA');
          console.log(`Tiene MERIENDA: ${hasMerienda ? '✅ SÍ' : '❌ NO - FALTA'}`);
          
          if (!hasMerienda) {
            console.log('\n🔧 Añadiendo fila MERIENDA...');
            
            const content = data.contenidoManual;
            const cenaMatch = content.match(/<tr>\s*<td[^>]*>CENA<\/td>/i);
            
            if (cenaMatch) {
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
              
              await doc.ref.update({ contenidoManual: newContent });
              console.log('✅ ¡MERIENDA AÑADIDA CORRECTAMENTE!');
            } else {
              console.log('❌ No se encontró la fila CENA en el contenido');
            }
          }
        } else {
          console.log('ℹ️  Este usuario no tiene contenidoManual');
        }
        console.log('═══════════════════════════════════════\n');
      }
    }
    
    if (!found) {
      console.log('❌ No se encontró usuario con ese teléfono');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

findByPhone();
