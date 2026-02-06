const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

async function syncUserClaim(email) {
  try {
    // Buscar usuario por email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Usuario encontrado: ${userRecord.uid}`);
    
    // Verificar campo rol en Firestore
    const userDoc = await db.collection("users").doc(userRecord.uid).get();
    const userData = userDoc.data();
    
    if (!userData) {
      console.log("❌ No existe documento en Firestore para este usuario");
      return;
    }
    
    console.log(`📄 Rol actual en Firestore: ${userData.rol || "sin rol"}`);
    
    // Sincronizar custom claim
    const shouldBeAdmin = userData.rol === "admin";
    const currentClaims = userRecord.customClaims || {};
    
    console.log(`🔒 Custom claim actual: admin=${currentClaims.admin}`);
    
    if (currentClaims.admin !== shouldBeAdmin) {
      await admin.auth().setCustomUserClaims(userRecord.uid, {
        ...currentClaims,
        admin: shouldBeAdmin
      });
      console.log(`✅ Custom claim actualizado: admin=${shouldBeAdmin}`);
      console.log("⚠️ El usuario debe cerrar sesión y volver a entrar para ver los cambios");
    } else {
      console.log("✅ Custom claim ya está sincronizado");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    process.exit();
  }
}

const email = process.argv[2];
if (!email) {
  console.log("❌ Uso: node sync-user-claim.js <email>");
  process.exit(1);
}

syncUserClaim(email);
