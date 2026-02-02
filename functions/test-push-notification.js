const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

async function testPushNotification() {
  try {
    console.log('\n📱 PROBANDO NOTIFICACIÓN PUSH AL ADMIN...\n');
    
    // Buscar admin
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .get();
    
    let adminDoc = null;
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.email === 'admin@admin.es' && doc.id === 'PjDtrdIPzjViHLXD4P31jlUXkRJ3') {
        adminDoc = { id: doc.id, data };
      }
    });
    
    if (!adminDoc) {
      console.log('❌ No se encontró el admin');
      process.exit(1);
    }
    
    console.log('✓ Admin encontrado:', adminDoc.id);
    
    const tokens = adminDoc.data.fcmTokens || [];
    console.log('  Tokens disponibles:', tokens.length);
    
    if (tokens.length === 0) {
      console.log('\n❌ No hay tokens para enviar\n');
      process.exit(1);
    }
    
    // Enviar notificación de prueba
    console.log('\n📤 Enviando notificación push...\n');
    
    const message = {
      notification: {
        title: '🧪 TEST DE NOTIFICACIÓN',
        body: 'Si recibes esto, las notificaciones funcionan correctamente!'
      },
      webpush: {
        notification: {
          icon: '/logo192.png',
          badge: '/logo192.png',
          requireInteraction: true
        }
      },
      tokens: tokens
    };
    
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log('✅ Resultado:');
    console.log('   Exitosas:', response.successCount);
    console.log('   Fallidas:', response.failureCount);
    
    if (response.failureCount > 0) {
      console.log('\n❌ Errores:');
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.log(`   Token ${idx + 1}: ${resp.error?.code || 'Error desconocido'}`);
        }
      });
    }
    
    console.log('\n✅ ¡Verifica tu navegador/móvil para ver si llegó la notificación!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

testPushNotification();
