const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'nutricionapp-b7b7d'
  });
}

const db = admin.firestore();

async function checkAlvaro() {
  try {
    const userId = 'nFlu8a4RLBQ5Vn5Zx7S8RqLURgn1';
    
    console.log('📄 Datos completos del usuario Alvaro Ruiz De Alda:\n');
    
    const docRef = db.collection('users').doc(userId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log('❌ Documento no encontrado');
      return;
    }
    
    const data = doc.data();
    
    // Mostrar campos básicos
    console.log('=== INFORMACIÓN BÁSICA ===');
    console.log('UID:', userId);
    console.log('Email:', data.email || 'N/A');
    console.log('Name:', data.name || 'N/A');
    console.log('Surname:', data.surname || 'N/A');
    console.log('Phone:', data.phone || 'N/A');
    console.log('Nombre:', data.nombre || 'N/A');
    console.log('Apellidos:', data.apellidos || 'N/A');
    
    // Verificar archivo de ejercicios
    console.log('\n=== ARCHIVOS DE EJERCICIOS ===');
    if (data.ejerciciosFiles && Array.isArray(data.ejerciciosFiles)) {
      console.log(`Total de archivos: ${data.ejerciciosFiles.length}`);
      data.ejerciciosFiles.forEach((file, index) => {
        console.log(`\nArchivo ${index + 1}:`);
        console.log('  - Nombre:', file.name);
        console.log('  - Nombre original:', file.originalName);
        console.log('  - Fecha subida:', file.uploadedAt);
        console.log('  - Path:', file.path);
        console.log('  - URL:', file.url);
      });
    } else {
      console.log('❌ No hay archivos de ejercicios');
    }
    
    // Verificar plan y permisos
    console.log('\n=== PLAN Y PERMISOS ===');
    console.log('Plan:', data.plan || 'N/A');
    console.log('Activo:', data.activo !== undefined ? data.activo : 'N/A');
    console.log('Fecha inicio:', data.fechaInicio || 'N/A');
    
    // Mostrar todos los campos del documento
    console.log('\n=== TODOS LOS CAMPOS ===');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAlvaro();
