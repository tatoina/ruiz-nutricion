const admin = require('firebase-admin');

// Inicializar Admin SDK
admin.initializeApp();

const db = admin.firestore();

async function checkGymEjercicios() {
  try {
    console.log('🔍 Verificando colección gym_ejercicios...');
    
    const snapshot = await db.collection('gym_ejercicios').get();
    
    console.log(`\n📊 Total de ejercicios: ${snapshot.size}\n`);
    
    if (snapshot.empty) {
      console.log('❌ La colección gym_ejercicios está vacía');
      console.log('💡 Necesitas agregar ejercicios desde AdminEjercicios');
      return;
    }
    
    // Agrupar por categoría
    const porCategoria = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const categoria = data.categoria || 'Sin categoría';
      
      if (!porCategoria[categoria]) {
        porCategoria[categoria] = [];
      }
      
      porCategoria[categoria].push({
        id: doc.id,
        nombre: data.nombre,
        videoUrl: data.videoUrl
      });
    });
    
    // Mostrar resumen por categoría
    console.log('📋 Ejercicios por categoría:\n');
    Object.keys(porCategoria).sort().forEach(cat => {
      console.log(`\n🏷️  ${cat} (${porCategoria[cat].length} ejercicios):`);
      porCategoria[cat].forEach(ej => {
        const video = ej.videoUrl ? '🎥' : '  ';
        console.log(`  ${video} ${ej.nombre}`);
      });
    });
    
    console.log('\n✅ Verificación completada');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkGymEjercicios().then(() => {
  console.log('\n🏁 Proceso completado');
  process.exit(0);
});
