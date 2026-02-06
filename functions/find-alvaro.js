const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'nutricionapp-b7b7d'
  });
}

const db = admin.firestore();
const storage = admin.storage();

async function findAlvaro() {
  try {
    console.log('Buscando usuario "Alvaro Ruiz de Alda"...\n');
    
    const usersSnapshot = await db.collection('users').get();
    
    let found = false;
    
    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      const fullName = `${data.name || ''} ${data.surname || ''}`.toLowerCase();
      
      if ((fullName.includes('alvaro') && (fullName.includes('ruiz') || fullName.includes('alda'))) || 
          data.email === 'koki-rdea@hotmail.com') {
        found = true;
        console.log('═══════════════════════════════════════');
        console.log('✅ USUARIO ENCONTRADO:');
        console.log(`UID: ${doc.id}`);
        console.log(`Email: ${data.email || 'N/A'}`);
        console.log(`Name: ${data.name || 'N/A'}`);
        console.log(`Surname: ${data.surname || 'N/A'}`);
        console.log(`Phone: ${data.phone || 'N/A'}`);
        console.log('═══════════════════════════════════════\n');
        
        // Verificar estructura de datos
        console.log('📋 Estructura de datos:');
        console.log(`- ejerciciosFiles: ${data.ejerciciosFiles ? JSON.stringify(data.ejerciciosFiles, null, 2) : 'No existe'}`);
        console.log(`- recetasFiles: ${data.recetasFiles ? JSON.stringify(data.recetasFiles, null, 2) : 'No existe'}\n`);
        
        // Verificar archivos en Storage
        console.log('📂 Verificando archivos en Storage...');
        const userId = doc.id;
        
        try {
          const bucket = storage.bucket();
          
          // Verificar carpeta de ejercicios
          const [ejerciciosFiles] = await bucket.getFiles({
            prefix: `users/${userId}/ejercicios/`
          });
          
          console.log(`\n🏋️ Archivos en users/${userId}/ejercicios/:`);
          if (ejerciciosFiles.length === 0) {
            console.log('  ❌ No hay archivos');
          } else {
            ejerciciosFiles.forEach(file => {
              console.log(`  ✅ ${file.name}`);
            });
          }
          
          // Verificar carpeta de recetas
          const [recetasFiles] = await bucket.getFiles({
            prefix: `users/${userId}/recetas/`
          });
          
          console.log(`\n📖 Archivos en users/${userId}/recetas/:`);
          if (recetasFiles.length === 0) {
            console.log('  ❌ No hay archivos');
          } else {
            recetasFiles.forEach(file => {
              console.log(`  ✅ ${file.name}`);
            });
          }
          
          // Verificar permisos
          console.log('\n🔐 Verificando permisos del usuario...');
          console.log(`UID del usuario: ${userId}`);
          
        } catch (storageError) {
          console.error('Error al acceder a Storage:', storageError);
        }
        
        break;
      }
    }
    
    if (!found) {
      console.log('❌ No se encontró ningún usuario con ese nombre');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

findAlvaro();
