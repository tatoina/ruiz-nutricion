import UserSubTabs from './UserSubTabs';

export default function UserTab({ user, onUpdateUser }) {
  return (
    <div>
      <h3>Ficha de {user.nombre} {user.apellidos}</h3>
      <UserSubTabs user={user} onUpdateUser={onUpdateUser} />
    </div>
  );
}
