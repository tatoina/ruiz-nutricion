const admin = require('firebase-admin');

// Inicializar Admin SDK (reutilizando la app si ya existe)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function restaurarCategorias() {
  try {
    console.log('\n🔧 RESTAURANDO CATEGORÍAS GYM\n');
    console.log('='.repeat(60));
    
    const categorias = [
      { nombre: "Jaula", orden: 1 },
      { nombre: "Peso Muerto", orden: 2 },
      { nombre: "Press Banca", orden: 3 },
      { nombre: "Cardio", orden: 4 },
      { nombre: "Piernas", orden: 5 },
      { nombre: "Brazos", orden: 6 },
      { nombre: "Espalda", orden: 7 },
      { nombre: "Abdomen", orden: 8 },
      { nombre: "Flexibilidad", orden: 9 },
      { nombre: "Funcional", orden: 10 }
    ];
    
    console.log(`\n📋 Creando ${categorias.length} categorías...\n`);
    
    for (const cat of categorias) {
      const data = {
        nombre: cat.nombre,
        orden: cat.orden,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await db.collection('gym_categorias').add(data);
      console.log(`✅ ${cat.nombre}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Categorías restauradas exitosamente\n');
    
    // Verificar
    const snapshot = await db.collection('gym_categorias').get();
    console.log(`📊 Total categorías en la BD: ${snapshot.size}\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

restaurarCategorias().then(() => {
  console.log('🏁 Proceso completado\n');
  process.exit(0);
});
