export default function DatosPesoForm({ user }) {
  return (
    <div>
      <p><b>Peso actual:</b> {user.pesoActual}</p>
      <p><b>Peso histórico:</b> {user.pesoHistorico && Array.isArray(user.pesoHistorico)
        ? user.pesoHistorico.join(", ") : user.pesoHistorico}</p>
    </div>
  );
}
