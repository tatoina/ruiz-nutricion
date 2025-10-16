export default function DatosPersonalesForm({ user }) {
  return (
    <div>
      <p><b>Nombre:</b> {user.nombre}</p>
      <p><b>Apellidos:</b> {user.apellidos}</p>
      <p><b>Email:</b> {user.email}</p>
      <p><b>Nacimiento:</b> {user.nacimiento}</p>
    </div>
  );
}
