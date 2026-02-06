const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function findUser() {
  try {
    const uid = 'THouwZzkKcfUpJFZSZEhV3ao7t42';
    
    console.log(`Buscando documento con UID: ${uid} en todas las colecciones...\n`);
    
    // Listar todas las colecciones
    const collections = await db.listCollections();
    
    console.log(`Colecciones encontradas: ${collections.map(c => c.id).join(', ')}\n`);
    
    for (const collection of collections) {
      console.log(`Buscando en colección: ${collection.id}...`);
      
      const doc = await collection.doc(uid).get();
      
      if (doc.exists) {
        console.log(`\n✅ ¡ENCONTRADO en colección "${collection.id}"!`);
        const data = doc.data();
        console.log('Campos disponibles:', Object.keys(data));
        console.log('Email:', data.email || 'N/A');
        console.log('Tiene contenidoManual:', !!data.contenidoManual);
        
        if (data.contenidoManual) {
          console.log('Tiene MERIENDA:', data.contenidoManual.includes('MERIENDA') ? '✅' : '❌');
        }
        
        return;
      }
    }
    
    console.log('\n❌ No se encontró el documento en ninguna colección');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

findUser();
