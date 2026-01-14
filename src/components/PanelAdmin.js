// src/components/PanelAdmin.js
import React, { useEffect, useState } from "react";
import { auth, db, functions } from "../Firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

export default function PanelAdmin({ onLogout }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" o "edit"
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    apellidos: "",
    email: "",
    password: "000000",
    nacimiento: "",
    telefono: "",
    objetivoNutricional: "",
    pesoActual: ""
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  // Trae todos los usuarios de Firestore
  const fetchUsuarios = async () => {
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
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  // Abrir modal para crear nuevo cliente
  const handleNuevoCliente = () => {
    setModalMode("create");
    setSelectedUser(null);
    setFormData({
      nombre: "",
      apellidos: "",
      email: "",
      password: "000000",
      nacimiento: "",
      telefono: "",
      objetivoNutricional: "",
      pesoActual: ""
    });
    setModalError("");
    setShowModal(true);
  };

  // Abrir modal para editar cliente
  const handleEditarCliente = (usuario) => {
    setModalMode("edit");
    setSelectedUser(usuario);
    setFormData({
      nombre: usuario.nombre || "",
      apellidos: usuario.apellidos || "",
      email: usuario.email || "",
      password: "", // No mostramos la contraseña
      nacimiento: usuario.nacimiento || "",
      telefono: usuario.telefono || "",
      objetivoNutricional: usuario.objetivoNutricional || "",
      pesoActual: usuario.pesoActual || ""
    });
    setModalError("");
    setShowModal(true);
  };

  // Eliminar cliente
  const handleEliminarCliente = async (usuario) => {
    const confirmar = window.confirm(
      `¿Estás seguro de eliminar a ${usuario.nombre} ${usuario.apellidos}?\nEsta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "usuarios", usuario.id));
      alert("Cliente eliminado correctamente");
      fetchUsuarios(); // Recargar lista
    } catch (err) {
      console.error("Error al eliminar cliente:", err);
      alert("Error al eliminar el cliente: " + err.message);
    }
  };

  // Guardar (crear o editar)
  const handleGuardar = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError("");

    try {
      if (modalMode === "create") {
        // Crear nuevo usuario usando Cloud Function
        const createUser = httpsCallable(functions, "createUser");
        await createUser({
          nombre: formData.nombre,
          apellidos: formData.apellidos,
          email: formData.email,
          password: formData.password,
          nacimiento: formData.nacimiento,
          telefono: formData.telefono,
          objetivoNutricional: formData.objetivoNutricional,
          pesoActual: formData.pesoActual ? parseFloat(formData.pesoActual) : null
        });
        alert("Cliente creado correctamente");
      } else {
        // Editar usuario existente
        const userRef = doc(db, "usuarios", selectedUser.id);
        const updateData = {
          nombre: formData.nombre,
          apellidos: formData.apellidos,
          nacimiento: formData.nacimiento,
          telefono: formData.telefono,
          objetivoNutricional: formData.objetivoNutricional,
          pesoActual: formData.pesoActual ? parseFloat(formData.pesoActual) : null
        };
        await updateDoc(userRef, updateData);
        alert("Cliente actualizado correctamente");
      }

      setShowModal(false);
      fetchUsuarios(); // Recargar lista
    } catch (err) {
      console.error("Error al guardar:", err);
      setModalError(err.message || "Error al guardar el cliente");
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) return <div>Cargando usuarios...</div>;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2>Panel Admin - Gestión de Clientes</h2>
        <button
          onClick={onLogout}
          style={{ padding: "8px 16px", cursor: "pointer" }}
        >
          Cerrar sesión
        </button>
      </div>

      <button
        onClick={handleNuevoCliente}
        style={{
          marginBottom: 20,
          padding: "10px 20px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "16px",
          fontWeight: "bold"
        }}
      >
        + Nuevo Cliente
      </button>

      <h3>Usuarios registrados: ({usuarios.length})</h3>
      {usuarios.length === 0 ? (
        <div>No hay usuarios registrados.</div>
      ) : (
        <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead style={{ backgroundColor: "#f0f0f0" }}>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Nacimiento</th>
              <th>Objetivo</th>
              <th>Último peso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre} {u.apellidos}</td>
                <td>{u.email}</td>
                <td>{u.telefono || "-"}</td>
                <td>{u.nacimiento || "-"}</td>
                <td>{u.objetivoNutricional || "-"}</td>
                <td>{u.pesoActual || "-"}</td>
                <td>
                  <button
                    onClick={() => handleEditarCliente(u)}
                    style={{
                      marginRight: 5,
                      padding: "5px 10px",
                      backgroundColor: "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "3px",
                      cursor: "pointer"
                    }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleEliminarCliente(u)}
                    style={{
                      padding: "5px 10px",
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "3px",
                      cursor: "pointer"
                    }}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal para crear/editar */}
      {showModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            padding: 30,
            borderRadius: 8,
            width: "90%",
            maxWidth: 500,
            maxHeight: "90vh",
            overflowY: "auto"
          }}>
            <h2>{modalMode === "create" ? "Nuevo Cliente" : "Editar Cliente"}</h2>
            
            {modalError && (
              <div style={{ color: "red", marginBottom: 10, padding: 10, backgroundColor: "#ffebee", borderRadius: 4 }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleGuardar}>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: "block", marginBottom: 5 }}>Nombre *</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  style={{ width: "100%", padding: 8, fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 15 }}>
                <label style={{ display: "block", marginBottom: 5 }}>Apellidos *</label>
                <input
                  type="text"
                  required
                  value={formData.apellidos}
                  onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                  style={{ width: "100%", padding: 8, fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 15 }}>
                <label style={{ display: "block", marginBottom: 5 }}>Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={modalMode === "edit"}
                  style={{ width: "100%", padding: 8, fontSize: 14 }}
                />
              </div>

              {modalMode === "create" && (
                <div style={{ marginBottom: 15 }}>
                  <label style={{ display: "block", marginBottom: 5 }}>Contraseña *</label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{ width: "100%", padding: 8, fontSize: 14 }}
                  />
                  <small style={{ color: "#666" }}>Por defecto: 000000</small>
                </div>
              )}

              <div style={{ marginBottom: 15 }}>
                <label style={{ display: "block", marginBottom: 5 }}>Fecha de Nacimiento</label>
                <input
                  type="date"
                  value={formData.nacimiento}
                  onChange={(e) => setFormData({ ...formData, nacimiento: e.target.value })}
                  style={{ width: "100%", padding: 8, fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 15 }}>
                <label style={{ display: "block", marginBottom: 5 }}>Teléfono</label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  style={{ width: "100%", padding: 8, fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 15 }}>
                <label style={{ display: "block", marginBottom: 5 }}>Objetivo Nutricional</label>
                <input
                  type="text"
                  value={formData.objetivoNutricional}
                  onChange={(e) => setFormData({ ...formData, objetivoNutricional: e.target.value })}
                  style={{ width: "100%", padding: 8, fontSize: 14 }}
                  placeholder="Ej: Pérdida de peso, ganar masa muscular..."
                />
              </div>

              <div style={{ marginBottom: 15 }}>
                <label style={{ display: "block", marginBottom: 5 }}>Peso Actual (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.pesoActual}
                  onChange={(e) => setFormData({ ...formData, pesoActual: e.target.value })}
                  style={{ width: "100%", padding: 8, fontSize: 14 }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  type="submit"
                  disabled={modalLoading}
                  style={{
                    flex: 1,
                    padding: "10px 20px",
                    backgroundColor: modalLoading ? "#ccc" : "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: modalLoading ? "not-allowed" : "pointer",
                    fontSize: "16px"
                  }}
                >
                  {modalLoading ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={modalLoading}
                  style={{
                    flex: 1,
                    padding: "10px 20px",
                    backgroundColor: "#666",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: modalLoading ? "not-allowed" : "pointer",
                    fontSize: "16px"
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
