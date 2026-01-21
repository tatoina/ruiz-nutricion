const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();

async function sendTestEmail() {
  try {
    console.log('📧 Enviando email de prueba a inaviciba@gmail.com...\n');
    
    // Datos de la cita según la imagen
    const citaMañana = {
      fecha: '2026-01-21', // mañana
      hora: '17:00',
      notas: '1ª revision'
    };
    
    const targetEmail = 'inaviciba@gmail.com';
    const userName = 'Ignacio Vicente Ibarrola';
    
    // Crear el objeto Date combinando fecha y hora
    const citaDate = new Date(`${citaMañana.fecha}T${citaMañana.hora}:00`);
    
    console.log(`📅 Fecha cita: ${citaMañana.fecha}`);
    console.log(`🕐 Hora cita: ${citaMañana.hora}`);
    console.log(`📝 Notas: ${citaMañana.notas}`);
    console.log(`\n🕐 Hora formateada: ${citaDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })}`);
    console.log(``);
    
    // Crear el email
    const emailData = {
      to: targetEmail,
      message: {
        subject: "Recordatorio: Cita mañana en Ruiz Nutrición",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
                color: white;
                padding: 30px 20px;
                border-radius: 10px 10px 0 0;
                text-align: center;
              }
              .content {
                background: #ffffff;
                padding: 30px;
                border: 1px solid #e2e8f0;
                border-top: none;
              }
              .cita-box {
                background: #f0fdf4;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #16a34a;
              }
              .footer {
                text-align: center;
                color: #64748b;
                font-size: 14px;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">📅 Recordatorio de Cita</h1>
            </div>
            
            <div class="content">
              <p>Hola <strong>${userName}</strong>,</p>
              
              <p>Te recordamos que <strong>mañana</strong> tienes una cita programada:</p>

              <div class="cita-box">
                <h3 style="margin-top: 0; color: #15803d;">📋 Detalles de la cita</h3>
                <p style="margin: 10px 0;"><strong>📅 Fecha:</strong> ${citaDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Madrid' })}</p>
                <p style="margin: 10px 0;"><strong>🕐 Hora:</strong> ${citaDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })}</p>
                ${citaMañana.notas ? `<p style="margin: 10px 0;"><strong>📝 Notas:</strong> ${citaMañana.notas}</p>` : ''}
              </div>

              <p style="margin-top: 30px;">Por favor, confirma tu asistencia o avisa con antelación si necesitas cancelar o reprogramar.</p>
              
              <p style="margin-top: 20px;">
                ¡Nos vemos mañana! 💪
              </p>
            </div>

            <div class="footer">
              <p><strong>Ruiz Nutrición</strong></p>
              <p>Este correo fue enviado automáticamente.</p>
            </div>
          </body>
          </html>
        `,
        text: `
Hola ${userName},

Te recordamos que MAÑANA tienes una cita programada:

📅 Fecha: ${citaDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Madrid' })}
🕐 Hora: ${citaDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })}
${citaMañana.notas ? `📝 Notas: ${citaMañana.notas}` : ''}

Por favor, confirma tu asistencia o avisa si necesitas cancelar.

¡Nos vemos mañana!
Ruiz Nutrición
        `.trim(),
      },
    };
    
    // Enviar el email
    console.log('\n📤 Enviando email...');
    await db.collection('mail').add(emailData);
    console.log('✅ Email enviado correctamente a la cola de mail');
    console.log(`\n📧 Destinatario: ${targetEmail}`);
    console.log(`📅 Fecha en email: ${citaDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Madrid' })}`);
    console.log(`🕐 Hora en email: ${citaDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

sendTestEmail();
