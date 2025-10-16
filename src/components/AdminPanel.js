// AdminPanel.js
import UserTabs from './UserTabs';

export default function AdminPanel({ users, onUpdateUser }) {
  // users: array de objetos usuario, onUpdateUser: callback para guardar cambios en un usuario
  return (
    <div>
      <h1>Panel de Administración</h1>
      <UserTabs users={users} onUpdateUser={onUpdateUser} />
    </div>
  );
}
