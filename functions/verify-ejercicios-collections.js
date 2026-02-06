const admin = require('firebase-admin');

// Inicializar Admin SDK (reutilizando la app si ya existe)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function verifyCollections() {
  try {
    console.log('\n🔍 VERIFICANDO COLECCIONES DE EJERCICIOS\n');
    console.log('='.repeat(60));
    
    // Verificar colección 'ejercicios'
    console.log('\n📁 Colección: ejercicios');
    const ejerciciosSnapshot = await db.collection('ejercicios').get();
    console.log(`   Total documentos: ${ejerciciosSnapshot.size}`);
    
    if (!ejerciciosSnapshot.empty) {
      console.log('\n   📋 Ejercicios encontrados:');
      ejerciciosSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.nombre || 'Sin nombre'} (${data.categoria || 'Sin categoría'})`);
      });
    }
    
    // Verificar colección 'gym_ejercicios'
    console.log('\n\n📁 Colección: gym_ejercicios');
    const gymEjerciciosSnapshot = await db.collection('gym_ejercicios').get();
    console.log(`   Total documentos: ${gymEjerciciosSnapshot.size}`);
    
    if (!gymEjerciciosSnapshot.empty) {
      console.log('\n   📋 Ejercicios encontrados:');
      gymEjerciciosSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.nombre || 'Sin nombre'} (${data.categoria || 'Sin categoría'})`);
      });
    }
    
    // Verificar colección 'gym_categorias'
    console.log('\n\n📁 Colección: gym_categorias');
    const categoriasSnapshot = await db.collection('gym_categorias').get();
    console.log(`   Total documentos: ${categoriasSnapshot.size}`);
    
    if (!categoriasSnapshot.empty) {
      console.log('\n   🏷️ Categorías encontradas:');
      categoriasSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.nombre || doc.id}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Verificación completada\n');
    
    // Resumen
    console.log('📊 RESUMEN:');
    console.log(`   - ejercicios: ${ejerciciosSnapshot.size} documentos`);
    console.log(`   - gym_ejercicios: ${gymEjerciciosSnapshot.size} documentos`);
    console.log(`   - gym_categorias: ${categoriasSnapshot.size} documentos\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyCollections().then(() => {
  console.log('🏁 Proceso completado\n');
  process.exit(0);
});
