const https = require('https');

// Llamar a la Cloud Function usando HTTP directo
const url = 'https://us-central1-nutricionapp-b7b7d.cloudfunctions.net/readAdminTokens';

const postData = JSON.stringify({ data: {} });

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

console.log('📞 Llamando a readAdminTokens Cloud Function...\n');

const req = https.request(url, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ RESPUESTA DE LA CLOUD FUNCTION:');
      console.log(JSON.stringify(result, null, 2));
      console.log('\n📊 Tokens encontrados:', result.result?.tokenCount || 0);
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
