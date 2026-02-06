// Script para listar usuarios usando Firebase Admin SDK
const admin = require('firebase-admin');
const path = require('path');

// Buscar el service account key en diferentes ubicaciones comunes
const possiblePaths = [
  './serviceAccountKey.json',
  './functions/serviceAccountKey.json',
  '../serviceAccountKey.json',
  process.env.GOOGLE_APPLICATION_CREDENTIALS
].filter(Boolean);

let initialized = false;

// Intentar con Application Default Credentials primero
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'nutricionapp-b7b7d'
    });
    initialized = true;
    console.log('✅ Usando credenciales por defecto de Google Cloud');
  }
} catch (e) {
  // Intentar con service account
  for (const servicePath of possiblePaths) {
    try {
      if (!admin.apps.length && require('fs').existsSync(servicePath)) {
        const serviceAccount = require(servicePath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        initialized = true;
        console.log(`✅ Usando credenciales de: ${servicePath}`);
        break;
      }
    } catch (err) {
      continue;
    }
  }
}

if (!initialized) {
  console.error('❌ No se pudo inicializar Firebase Admin.');
  console.log('\n📝 Para obtener el listado de usuarios, tienes varias opciones:\n');
  console.log('1. Descarga tu service account key desde Firebase Console:');
  console.log('   - Ve a: https://console.firebase.google.com/project/nutricionapp-b7b7d/settings/serviceaccounts/adminsdk');
  console.log('   - Haz clic en "Generar nueva clave privada"');
  console.log('   - Guarda el archivo como serviceAccountKey.json en la raíz del proyecto\n');
  console.log('2. O autentícate con: gcloud auth application-default login\n');
  console.log('3. O ejecuta este script en la consola de Firebase: https://console.firebase.google.com/project/nutricionapp-b7b7d/firestore/data\n');
  process.exit(1);
}

const db = admin.firestore();

async function listAllUsers() {
  try {
    console.log('\n🔍 Consultando base de datos...\n');
    const usersSnapshot = await db.collection('users').get();
    
    console.log('📊 LISTADO DE USUARIOS/PACIENTES');
    console.log('='.repeat(80));
    console.log(`Total: ${usersSnapshot.size} usuarios\n`);
    
    if (usersSnapshot.empty) {
      console.log('⚠️  No hay usuarios registrados en la base de datos.');
      return;
    }
    
    usersSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const nombre = data.nombre || data.name || 'SIN NOMBRE';
      const apellidos = data.apellidos || data.surname || '';
      const email = data.email || 'sin email';
      const telefono = data.telefono || data.phone || '';
      const objetivo = data.objetivoNutricional || '';
      const peso = data.pesoActual || '';
      
      console.log(`\n${index + 1}. ${nombre} ${apellidos}`);
      console.log(`   📧 Email: ${email}`);
      if (telefono) console.log(`   📱 Teléfono: ${telefono}`);
      if (objetivo) console.log(`   🎯 Objetivo: ${objetivo}`);
      if (peso) console.log(`   ⚖️  Peso actual: ${peso} kg`);
      console.log(`   🆔 UID: ${doc.id}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Listado completado: ${usersSnapshot.size} usuarios totales\n`);
    
  } catch (error) {
    console.error('❌ Error al obtener usuarios:', error.message);
    if (error.code === 7) {
      console.log('\n🔐 Error de permisos. Asegúrate de estar autenticado correctamente.');
    }
  } finally {
    process.exit(0);
  }
}

listAllUsers();
