export default function DietaActualForm({ user }) {
  return (
    <div>
      <p><b>Dieta actual:</b> {user.dietaActual && Array.isArray(user.dietaActual)
        ? JSON.stringify(user.dietaActual, null, 2) : user.dietaActual}</p>
    </div>
  );
}
