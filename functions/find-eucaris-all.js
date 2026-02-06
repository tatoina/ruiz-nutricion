const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function findEucaris() {
  try {
    console.log('Listando TODOS los usuarios de Firestore...\n');
    
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`Total documentos en users: ${usersSnapshot.size}\n`);
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const email = (data.email || '').toLowerCase();
      
      // Buscar por email que contenga eucaris
      if (email.includes('eucaris')) {
        console.log('═══════════════════════════════════════');
        console.log('✅ ENCONTRADO:');
        console.log(`UID: ${doc.id}`);
        console.log(`Email: ${data.email}`);
        console.log(`Name: ${data.name || data.nombre || 'N/A'}`);
        console.log(`Surname: ${data.surname || data.apellidos || 'N/A'}`);
        console.log(`Tiene contenidoManual: ${!!data.contenidoManual}`);
        
        if (data.contenidoManual) {
          const hasMerienda = data.contenidoManual.includes('MERIENDA');
          console.log(`Tiene MERIENDA: ${hasMerienda ? '✅ SÍ' : '❌ NO - FALTA'}`);
          
          if (!hasMerienda) {
            console.log('\n🔧 Reparando...');
            
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
              
              doc.ref.update({ contenidoManual: newContent })
                .then(() => console.log('✅ ¡MERIENDA AÑADIDA CORRECTAMENTE!'))
                .catch(err => console.error('❌ Error al actualizar:', err));
            }
          }
        }
        console.log('═══════════════════════════════════════\n');
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findEucaris();
