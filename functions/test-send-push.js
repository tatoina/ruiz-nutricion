const https = require('https');

// Llamar a sendPushToAdmin para probar notificaciones reales
const url = 'https://us-central1-nutricionapp-b7b7d.cloudfunctions.net/sendPushToAdmin';

const postData = JSON.stringify({ 
  data: {
    title: '🧪 TEST MANUAL',
    body: 'Probando notificación push desde script Node.js',
    usuario: 'Test User'
  }
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

console.log('📤 Enviando notificación push al admin...\n');

const req = https.request(url, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ RESPUESTA:');
      console.log(JSON.stringify(result, null, 2));
      console.log('\n🎯 Verifica si recibiste la notificación en tu PC/móvil\n');
    } catch (e) {
      console.log('Respuesta:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error);
});

req.write(postData);
req.end();
