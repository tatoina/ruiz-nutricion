// src/components/PanelAdmin.js
import React, { useEffect, useState } from "react";
import { auth, db } from "../Firebase";
import { collection, getDocs } from "firebase/firestore";

export default function PanelAdmin({ onLogout }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  // Trae todos los usuarios de Firestore
  useEffect(() => {
    async function fetchUsuarios() {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        const users = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsuarios(users);
      } catch (err) {
        console.error("Error al cargar usuarios:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsuarios();
  }, []);

  if (loading) return <div>Cargando usuarios...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Panel Admin</h2>
      <button
        onClick={onLogout}
        style={{ marginBottom: 20, padding: "8px 16px", cursor: "pointer" }}
      >
        Cerrar sesión
      </button>

      <h3>Usuarios registrados:</h3>
      {usuarios.length === 0 ? (
        <div>No hay usuarios registrados.</div>
      ) : (
        <table border="1" cellPadding="8" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Objetivo</th>
              <th>Último peso</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre} {u.apellidos}</td>
                <td>{u.email}</td>
                <td>{u.objetivoNutricional || "-"}</td>
                <td>{u.pesoActual || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
