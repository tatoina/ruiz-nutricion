const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onCall} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");

initializeApp();

/**
 * Cloud Function que se dispara cuando se crea un nuevo documento en users/
 * Envía un email de bienvenida con las credenciales y link a la app
 */
exports.sendWelcomeEmail = onDocumentCreated("users/{userId}", async (event) => {
    const snap = event.data;
    if (!snap) {
      console.log("No data associated with the event");
      return;
    }
    const userData = snap.data();
    const userId = event.params.userId;

    // Solo enviar email si es un usuario nuevo (no admin)
    const email = userData.email;
    if (!email || email === "admin@admin.es") {
      console.log("Skipping email - admin account or no email");
      return null;
    }

    const nombre = userData.nombre || "Usuario";
    const apellidos = userData.apellidos || "";
    const nombreCompleto = `${nombre} ${apellidos}`.trim();

    // URL de la aplicación
    const appUrl = "https://nutricionapp-b7b7d.web.app";

    // Construir el email
    const emailData = {
      to: email,
      message: {
        subject: "Bienvenido a Ruiz Nutrición - Acceso a tu cuenta",
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
            .button {
              display: inline-block;
              background: #16a34a;
              color: white;
              padding: 14px 30px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
            .credentials {
              background: #f8fafc;
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
            .info-box {
              background: #fef3c7;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #f59e0b;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">¡Bienvenido a Ruiz Nutrición!</h1>
          </div>
          
          <div class="content">
            <p>Hola <strong>${nombreCompleto}</strong>,</p>
            
            <p>Tu cuenta ha sido creada exitosamente. Ya puedes acceder a tu área personal para:</p>
            
            <ul>
              <li>📊 Consultar tu plan de dieta semanal personalizado</li>
              <li>⚖️ Registrar tu peso y medidas</li>
              <li>📅 Ver tus citas programadas</li>
              <li>💪 Acceder a ejercicios y recetas</li>
            </ul>

            <div class="info-box">
              <strong>⚠️ Importante:</strong> Por seguridad, en tu primer inicio de sesión se te pedirá que cambies tu contraseña temporal.
            </div>

            <div class="credentials">
              <h3 style="margin-top: 0; color: #15803d;">📧 Tus credenciales de acceso</h3>
              <p style="margin: 10px 0;"><strong>Usuario:</strong> ${email}</p>
              <p style="margin: 10px 0;"><strong>Contraseña temporal:</strong> 000000</p>
            </div>

            <div style="text-align: center;">
              <a href="${appUrl}" class="button">
                🚀 Acceder a la Aplicación
              </a>
            </div>

            <p style="margin-top: 30px;">También puedes copiar y pegar este enlace en tu navegador:</p>
            <p style="background: #f8fafc; padding: 10px; border-radius: 6px; word-break: break-all; font-size: 14px;">
              ${appUrl}
            </p>

            <div style="margin-top: 30px; padding: 20px; background: #f0fdf4; border-radius: 8px;">
              <h4 style="margin-top: 0; color: #15803d;">💡 Instalación en móvil</h4>
              <p><strong>iPhone/iPad:</strong> Abre el enlace en Safari → Toca el botón "Compartir" → "Añadir a la pantalla de inicio"</p>
              <p><strong>Android:</strong> Abre el enlace en Chrome → Menú (⋮) → "Añadir a la pantalla de inicio"</p>
            </div>

            <p style="margin-top: 30px;">Si tienes alguna duda, no dudes en contactar con tu nutricionista.</p>
            
            <p style="margin-top: 20px;">
              ¡Estamos aquí para ayudarte a alcanzar tus objetivos! 💪
            </p>
          </div>

          <div class="footer">
            <p><strong>Ruiz Nutrición</strong></p>
            <p>Este correo fue enviado automáticamente. Por favor, no respondas a este mensaje.</p>
          </div>
        </body>
        </html>
        `,
        text: `
Hola ${nombreCompleto},

Tu cuenta en Ruiz Nutrición ha sido creada exitosamente.

CREDENCIALES DE ACCESO:
- Usuario: ${email}
- Contraseña temporal: 000000

IMPORTANTE: En tu primer inicio de sesión deberás cambiar tu contraseña temporal por seguridad.

Accede a la aplicación en: ${appUrl}

INSTALACIÓN EN MÓVIL:
- iPhone/iPad: Abre en Safari → Compartir → Añadir a pantalla de inicio
- Android: Abre en Chrome → Menú → Añadir a pantalla de inicio

Si tienes dudas, contacta con tu nutricionista.

¡Bienvenido!
Ruiz Nutrición
        `.trim(),
      },
    };

    try {
      // Guardar el email en una colección para procesarlo
      // (Puedes usar Firebase Extensions "Trigger Email" o tu propio servicio SMTP)
      const db = getFirestore();
      await db.collection("mail").add({
        ...emailData,
        createdAt: new Date(),
      });

      console.log(`Welcome email queued for ${email}`);
    } catch (error) {
      console.error("Error sending welcome email:", error);
    }
});

/**
 * Cloud Function callable para crear usuarios sin autenticarse
 * Solo accesible por administradores
 */
exports.createUser = onCall(async (request) => {
  // Verificar que el usuario está autenticado
  if (!request.auth) {
    throw new Error("No autenticado");
  }

  // Verificar que es admin (por email o custom claim)
  const adminEmails = ["admin@admin.es"];
  const isAdmin = request.auth.token.admin === true || 
                  adminEmails.includes(request.auth.token.email?.toLowerCase());

  if (!isAdmin) {
    throw new Error("Permisos insuficientes");
  }

  const { email, password, nombre, apellidos, nacimiento, telefono } = request.data;

  if (!email || !password) {
    throw new Error("Email y contraseña son requeridos");
  }

  try {
    // Crear usuario en Firebase Auth sin autenticarlo
    const userRecord = await getAuth().createUser({
      email: email.trim(),
      password: password,
      displayName: `${nombre || ""} ${apellidos || ""}`.trim() || undefined,
    });

    // Crear documento en Firestore
    const db = getFirestore();
    await db.collection("users").doc(userRecord.uid).set({
      nombre: nombre || "",
      apellidos: apellidos || "",
      email: email.trim(),
      nacimiento: nacimiento || "",
      telefono: telefono || "",
      createdAt: new Date(),
      pesoActual: null,
      pesoHistorico: [],
      medidas: {},
      ejercicios: false,
      recetas: false,
      mustChangePassword: true,
    });

    return {
      success: true,
      uid: userRecord.uid,
      email: userRecord.email,
    };
  } catch (error) {
    console.error("Error creating user:", error);
    throw new Error(`Error al crear usuario: ${error.message}`);
  }
});

/**
 * Función programada que se ejecuta cada hora para verificar citas
 * y enviar notificaciones/emails
 */
exports.checkAppointmentReminders = onSchedule("every 1 hours", async (event) => {
  const db = getFirestore();
  const now = new Date();
  
  // Obtener todos los usuarios con citas
  const usersSnapshot = await db.collection("users").get();
  
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const citas = userData.citas || [];
    const userEmail = userData.email;
    const userName = `${userData.nombre || ''} ${userData.apellidos || ''}`.trim() || 'Usuario';
    
    for (const cita of citas) {
      const citaDate = new Date(cita.fecha);
      const timeDiff = citaDate.getTime() - now.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      
      // Email 1 día antes (entre 23 y 25 horas antes)
      if (daysDiff > 0.95 && daysDiff < 1.05 && !cita.emailSent) {
        try {
          await db.collection("mail").add({
            to: userEmail,
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
                      <p style="margin: 10px 0;"><strong>📅 Fecha:</strong> ${citaDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      <p style="margin: 10px 0;"><strong>🕐 Hora:</strong> ${citaDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                      ${cita.notas ? `<p style="margin: 10px 0;"><strong>📝 Notas:</strong> ${cita.notas}</p>` : ''}
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

📅 Fecha: ${citaDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
🕐 Hora: ${citaDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
${cita.notas ? `📝 Notas: ${cita.notas}` : ''}

Por favor, confirma tu asistencia o avisa si necesitas cancelar.

¡Nos vemos mañana!
Ruiz Nutrición
              `.trim(),
            },
            createdAt: new Date(),
          });
          
          // Marcar email como enviado
          const citaIndex = citas.indexOf(cita);
          citas[citaIndex].emailSent = true;
          await userDoc.ref.update({ citas });
          
          console.log(`Email reminder sent to ${userEmail} for appointment on ${citaDate}`);
        } catch (error) {
          console.error(`Error sending email to ${userEmail}:`, error);
        }
      }
      
      // Push notification 1 hora antes (entre 55 y 65 minutos antes)
      if (hoursDiff > 0.9 && hoursDiff < 1.1 && !cita.pushSent) {
        try {
          // Guardar notificación en Firestore para que la app la detecte
          await db.collection("notifications").add({
            userId: userDoc.id,
            type: "appointment_reminder",
            title: "🔔 Recordatorio de Cita",
            body: `Tu cita es en 1 hora - ${citaDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
            data: {
              citaFecha: cita.fecha,
              citaNotas: cita.notas || '',
            },
            createdAt: new Date(),
            read: false,
          });
          
          // Marcar push como enviado
          const citaIndex = citas.indexOf(cita);
          citas[citaIndex].pushSent = true;
          await userDoc.ref.update({ citas });
          
          console.log(`Push notification queued for ${userDoc.id} for appointment on ${citaDate}`);
        } catch (error) {
          console.error(`Error queueing push for ${userDoc.id}:`, error);
        }
      }
    }
  }
  
  console.log("Appointment reminders check completed");
});
