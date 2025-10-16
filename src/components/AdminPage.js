import React, { useEffect, useState } from "react";
import { getAllUsers } from "../utils";

function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllUsers().then((usersData) => {
      setUsers(usersData || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div>Cargando usuarios...</div>;
  }

  if (!users.length) {
    return <div>No hay usuarios registrados.</div>;
  }

  return (
    <div>
      <h2>Panel de administración</h2>
      <ul>
        {users.map((u, idx) => (
          <li key={idx}>
            <strong>{u.nombre} {u.apellidos}</strong> — {u.email}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AdminPage;
