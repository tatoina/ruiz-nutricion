// Script simple para probar el formato de hora en el email
// NO se conecta a Firebase, solo muestra cómo se formatea

console.log('🕐 Probando formato de hora para email de recordatorio\n');

// Datos de ejemplo de la cita
const cita = {
  fecha: '2026-01-21',
  hora: '17:00',
  notas: '1ª revision'
};

console.log('Datos de la cita:');
console.log(`  Fecha: ${cita.fecha}`);
console.log(`  Hora: ${cita.hora}`);
console.log(`  Notas: ${cita.notas}\n`);

// ❌ FORMA INCORRECTA (la antigua):
const citaDateIncorrecto = new Date(cita.fecha);
console.log('❌ INCORRECTO (solo fecha):');
console.log(`  new Date(cita.fecha) = new Date("${cita.fecha}")`);
console.log(`  Resultado: ${citaDateIncorrecto.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })}`);
console.log(`  ❌ Muestra: 01:00 (medianoche)\n`);

// ✅ FORMA CORRECTA (la nueva):
const citaDateCorrecto = new Date(`${cita.fecha}T${cita.hora}:00`);
console.log('✅ CORRECTO (fecha + hora combinadas):');
console.log(`  new Date(\`\${cita.fecha}T\${cita.hora}:00\`) = new Date("${cita.fecha}T${cita.hora}:00")`);
console.log(`  Resultado: ${citaDateCorrecto.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })}`);
console.log(`  ✅ Muestra: 17:00 (hora correcta)\n`);

console.log('📧 Cómo se vería en el email:\n');
console.log('  📅 Fecha: ' + citaDateCorrecto.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Madrid' }));
console.log('  🕐 Hora: ' + citaDateCorrecto.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }));
console.log('  📝 Notas: ' + cita.notas);
