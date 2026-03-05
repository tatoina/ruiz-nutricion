/**
 * cleanup-user-docs.js
 * 
 * Script de limpieza para eliminar campos grandes de los documentos de usuario:
 *   - dietasHistorico (array antiguo) → migrado a subcolección users/{uid}/dietasHistorico
 *   - menuHistorico (array grande, ya no se usa)
 * 
 * Uso:
 *   cd functions
 *   node cleanup-user-docs.js
 */

const admin = require("firebase-admin");

// Usa Application Default Credentials (firebase CLI ya está autenticado)
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "nutricionapp-b7b7d",
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function cleanupUserDocs() {
  console.log("🔍 Leyendo todos los documentos de usuarios...");
  const usersSnap = await db.collection("users").get();
  console.log(`📋 Total usuarios: ${usersSnap.docs.length}`);

  let totalCleaned = 0;
  let totalMigrated = 0;
  let totalErrors = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();

    let hasChanges = false;
    const updatePayload = {};

    // ── 1. Migrar dietasHistorico (array antiguo) a subcolección ────────────
    if (Array.isArray(data.dietasHistorico) && data.dietasHistorico.length > 0) {
      console.log(`\n👤 ${uid}: tiene ${data.dietasHistorico.length} dietas en array antiguo → migrando...`);

      // Comprobar cuántas ya hay en la subcolección para no duplicar
      const subColSnap = await db.collection("users").doc(uid).collection("dietasHistorico").get();
      const existingNums = new Set(subColSnap.docs.map(d => d.data().numero));

      const batch = db.batch();
      let migratedCount = 0;

      for (const dieta of data.dietasHistorico) {
        if (dieta.numero && existingNums.has(dieta.numero)) {
          // Ya existe en la subcolección, saltar
          continue;
        }
        const newRef = db.collection("users").doc(uid).collection("dietasHistorico").doc();
        batch.set(newRef, {
          ...dieta,
          // Aseguramos createdAt como string ISO si no lo tiene
          createdAt: dieta.createdAt || dieta.fechaDesde || new Date().toISOString(),
        });
        migratedCount++;
      }

      if (migratedCount > 0) {
        await batch.commit();
        console.log(`   ✅ Migradas ${migratedCount} dietas a subcolección`);
        totalMigrated += migratedCount;
      } else {
        console.log(`   ℹ️  Todas ya existían en la subcolección, nada que migrar`);
      }

      updatePayload.dietasHistorico = FieldValue.delete();
      hasChanges = true;
    }

    // ── 2. Eliminar menuHistorico (ya no se usa, puede ser enorme) ───────────
    if (data.menuHistorico !== undefined) {
      console.log(`👤 ${uid}: eliminando menuHistorico...`);
      updatePayload.menuHistorico = FieldValue.delete();
      hasChanges = true;
    }

    // ── 3. Aplicar limpieza si hay cambios ──────────────────────────────────
    if (hasChanges) {
      try {
        await db.collection("users").doc(uid).update(updatePayload);
        console.log(`   ✅ Documento limpiado`);
        totalCleaned++;
      } catch (err) {
        console.error(`   ❌ Error limpiando ${uid}:`, err.message);
        totalErrors++;
      }
    }
  }

  console.log("\n══════════════════════════════════════════");
  console.log(`✅ Documentos limpiados:       ${totalCleaned}`);
  console.log(`📦 Dietas migradas a subcol:   ${totalMigrated}`);
  console.log(`❌ Errores:                    ${totalErrors}`);
  console.log("══════════════════════════════════════════");
  console.log("Limpieza completada.");
  process.exit(0);
}

cleanupUserDocs().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
