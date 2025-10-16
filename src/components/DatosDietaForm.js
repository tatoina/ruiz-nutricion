export default function DatosDietaForm({ user }) {
  return (
    <div>
      <p><b>Objetivo nutricional:</b> {user.objetivoNutricional}</p>
      <p><b>Restricciones:</b> {user.restricciones}</p>
      <p><b>Observaciones dieta:</b> {user.observacionesDieta}</p>
      <p><b>Tipo de dieta:</b> {user.tipoDieta}</p>
    </div>
  );
}
