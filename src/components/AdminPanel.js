import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../Firebase";
import Layout from "./Layout";

export default function AdminPanel({ onLogout }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cargar todos los usuarios desde Firestore
  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        const lista = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsuarios(lista);
      } catch (err) {
        console.error("Error al obtener usuarios:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsuarios();
  }, []);

  if (loading) return <Layout><p>Cargando usuarios...</p></Layout>;

  return (
    <Layout>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2>Panel de Administración</h2>
        <button onClick={onLogout} className="btn" style={{ marginTop: "10px" }}>
          Cerrar sesión
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          backgroundColor: "#fff",
          borderRadius: "10px",
          boxShadow: "0 0 10px rgba(0,0,0,0.1)",
          fontSize: "14px"
        }}>
          <thead style={{ backgroundColor: "#f0f0f0" }}>
            <tr>
              <th style={th}>Nombre</th>
              <th style={th}>Apellidos</th>
              <th style={th}>Email</th>
              <th style={th}>Nacimiento</th>
              <th style={th}>Rol</th>
              <th style={th}>Ejercicios</th>
              <th style={th}>Recetas</th>
              <th style={th}>Peso Actual</th>
              <th style={th}>Histórico Peso</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td style={td}>{u.nombre}</td>
                <td style={td}>{u.apellidos}</td>
                <td style={td}>{u.email}</td>
                <td style={td}>{u.nacimiento}</td>
                <td style={td}>{u.role}</td>
                <td style={td}>{u.ejercicios}</td>
                <td style={td}>{u.recetas}</td>
                <td style={td}>{u.pesoActual || "-"}</td>
                <td style={td}>
                  {u.pesoHistorico?.length
                    ? u.pesoHistorico.join(", ")
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

const th = {
  border: "1px solid #ddd",
  padding: "8px",
  textAlign: "left",
  fontWeight: "bold",
};

const td = {
  border: "1px solid #ddd",
  padding: "8px",
};
