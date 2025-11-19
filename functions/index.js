const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Cloud Function que se dispara cuando se crea un nuevo documento en users/
 * Envía un email de bienvenida con las credenciales y link a la app
 */
exports.sendWelcomeEmail = functions
  .region("europe-west1")
  .firestore.document("users/{userId}")
  .onCreate(async (snap, context) => {
    const userData = snap.data();
    const userId = context.params.userId;

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
              <p style="margin: 10px 0;"><strong>Contraseña temporal:</strong> Tu nutricionista te la proporcionará</p>
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
- Contraseña temporal: Solicítala a tu nutricionista

IMPORTANTE: En tu primer inicio de sesión deberás cambiar tu contraseña temporal por seguridad.

Accede a la aplicación en: ${appUrl}

INSTALACIÓN EN MÓVIL:
- iPhone/iPad: Abre en Safari → Compartir → Añadir a pantalla de inicio
- Android: Abre en Chrome → Menú → Añadir a pantalla de inicio

Si tienes dudas, contacta con tu nutricionista.

¡Bienvenido!
Ruiz Nutrición
      `.trim(),
    };

    try {
      // Guardar el email en una colección para procesarlo
      // (Puedes usar Firebase Extensions "Trigger Email" o tu propio servicio SMTP)
      await admin.firestore().collection("mail").add({
        ...emailData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Welcome email queued for ${email}`);
      return null;
    } catch (error) {
      console.error("Error sending welcome email:", error);
      return null;
    }
  });
