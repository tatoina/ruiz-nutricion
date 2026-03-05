/**
 * diagnose-user-size.js
 * Muestra el tamaño aproximado de cada campo de un documento de usuario
 * 
 * Uso: node diagnose-user-size.js
 */
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "nutricionapp-b7b7d",
});
const db = admin.firestore();

async function diagnose() {
  const usersSnap = await db.collection("users").get();
  console.log(`Total usuarios: ${usersSnap.docs.length}\n`);

  const results = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();
    const totalJson = JSON.stringify(data);
    const totalBytes = Buffer.byteLength(totalJson, "utf8");

    if (totalBytes > 100_000) { // Solo mostrar docs > 100KB
      const fields = Object.entries(data).map(([key, val]) => {
        const size = Buffer.byteLength(JSON.stringify(val) || "", "utf8");
        return { key, size };
      }).sort((a, b) => b.size - a.size);

      results.push({ uid, totalBytes, fields });
    }
  }

  results.sort((a, b) => b.totalBytes - a.totalBytes);

  if (results.length === 0) {
    console.log("✅ Ningún documento supera 100KB. Todo está bien.");
    process.exit(0);
  }

  for (const { uid, totalBytes, fields } of results) {
    console.log(`\n🔴 Usuario: ${uid}`);
    console.log(`   Tamaño total: ${(totalBytes / 1024).toFixed(1)} KB`);
    console.log(`   Campos grandes:`);
    for (const { key, size } of fields.slice(0, 10)) {
      if (size > 1000) {
        console.log(`     - ${key}: ${(size / 1024).toFixed(1)} KB`);
      }
    }
  }

  process.exit(0);
}

diagnose().catch(err => { console.error(err); process.exit(1); });
