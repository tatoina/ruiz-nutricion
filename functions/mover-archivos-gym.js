/**
 * Script para mover archivos de gym/videos/ a recursos/
 * y actualizar las referencias en Firestore
 */

const admin = require('firebase-admin');

// Inicializar con credenciales por defecto (usa GOOGLE_APPLICATION_CREDENTIALS)
admin.initializeApp();

const bucket = admin.storage().bucket('nutricionapp-b7b7d.firebasestorage.app');
const db = admin.firestore();

async function moverArchivos() {
  try {
    console.log('🔍 Buscando archivos en gym/videos/...\n');
    
    // Listar archivos en gym/videos/
    const [files] = await bucket.getFiles({ prefix: 'gym/videos/' });
    
    if (files.length === 0) {
      console.log('✓ No hay archivos para mover');
      return;
    }
    
    console.log(`📦 Encontrados ${files.length} archivos\n`);
    
    for (const file of files) {
      const oldPath = file.name;
      const fileName = oldPath.split('/').pop();
      const newPath = `recursos/${fileName}`;
      
      console.log(`📤 Moviendo: ${oldPath}`);
      console.log(`   → ${newPath}`);
      
      // Copiar archivo a nueva ubicación
      await bucket.file(oldPath).copy(bucket.file(newPath));
      console.log('   ✓ Copiado');
      
      // Obtener URL nueva
      const [url] = await bucket.file(newPath).getSignedUrl({
        action: 'read',
        expires: '01-01-2500'
      });
      
      // Buscar y actualizar referencias en Firestore
      const usersSnapshot = await db.collection('users').get();
      let actualizaciones = 0;
      
      for (const userDoc of usersSnapshot.docs) {
        const tablaGym = userDoc.data().tablaGym;
        
        if (tablaGym && Array.isArray(tablaGym)) {
          let actualizado = false;
          
          const tablaActualizada = tablaGym.map(ejercicio => {
            if (ejercicio.videoUrl && ejercicio.videoUrl.includes(oldPath)) {
              actualizado = true;
              return {
                ...ejercicio,
                videoUrl: ejercicio.videoUrl.replace(
                  /gym%2Fvideos%2F/g,
                  'recursos%2F'
                ).replace(
                  /gym\/videos\//g,
                  'recursos/'
                )
              };
            }
            return ejercicio;
          });
          
          if (actualizado) {
            await db.collection('users').doc(userDoc.id).update({
              tablaGym: tablaActualizada
            });
            actualizaciones++;
            console.log(`   ✓ Actualizado usuario: ${userDoc.data().nombre || userDoc.id}`);
          }
        }
      }
      
      // Eliminar archivo antiguo
      await bucket.file(oldPath).delete();
      console.log('   ✓ Eliminado de ubicación antigua');
      console.log(`   ✓ Referencias actualizadas: ${actualizaciones}\n`);
    }
    
    console.log('✅ ¡Migración completada!\n');
    console.log(`Total archivos movidos: ${files.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

// Ejecutar
moverArchivos();
