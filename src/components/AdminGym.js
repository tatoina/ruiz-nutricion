import React, { useEffect, useState } from "react";
import { db } from "../Firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  query,
  orderBy 
} from "firebase/firestore";

/**
 * AdminGym - Asignación de ejercicios a usuarios
 * Permite seleccionar un usuario y asignarle ejercicios con orden modificable
 */
export default function AdminGym() {
  const [usuarios, setUsuarios] = useState([]);
  const [ejercicios, setEjercicios] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [userEjercicios, setUserEjercicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroNombre, setFiltroNombre] = useState("");

  // Categorías
  const categorias = [
    "Jaula",
    "Peso Muerto",
    "Press Banca",
    "Cardio",
    "Piernas",
    "Brazos",
    "Espalda",
    "Abdomen",
    "Flexibilidad",
    "Funcional"
  ];

  // Cargar usuarios y ejercicios
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar usuarios
      const usersSnapshot = await getDocs(collection(db, "usuarios"));
      const usersList = usersSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((u) => u.role !== "admin") // Excluir admins
        .sort((a, b) => {
          const nombreA = `${a.apellidos || ""} ${a.nombre || ""}`.toLowerCase();
          const nombreB = `${b.apellidos || ""} ${b.nombre || ""}`.toLowerCase();
          return nombreA.localeCompare(nombreB);
        });
      setUsuarios(usersList);

      // Cargar ejercicios
      try {
        const q = query(collection(db, "ejercicios"), orderBy("nombre", "asc"));
        const ejSnapshot = await getDocs(q);
        const ejList = ejSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEjercicios(ejList);
      } catch (err) {
        // Fallback sin orderBy
        const ejSnapshot = await getDocs(collection(db, "ejercicios"));
        const ejList = ejSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEjercicios(ejList.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
    } catch (err) {
      console.error("Error al cargar datos:", err);
      alert("Error al cargar datos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cuando se selecciona un usuario
  useEffect(() => {
    if (selectedUser) {
      const user = usuarios.find((u) => u.id === selectedUser);
      setUserEjercicios(user?.ejerciciosAsignados || []);
    } else {
      setUserEjercicios([]);
    }
  }, [selectedUser, usuarios]);

  // Filtrar ejercicios disponibles
  const ejerciciosFiltrados = ejercicios.filter((ej) => {
    const matchCategoria = !filtroCategoria || ej.categoria === filtroCategoria;
    const matchNombre = !filtroNombre || 
      ej.nombre.toLowerCase().includes(filtroNombre.toLowerCase());
    return matchCategoria && matchNombre;
  });

  // Añadir ejercicio a la lista del usuario
  const handleAgregarEjercicio = (ejercicio) => {
    if (!selectedUser) {
      alert("Selecciona un usuario primero");
      return;
    }

    // Verificar si ya está asignado
    const yaAsignado = userEjercicios.some((ej) => ej.id === ejercicio.id);
    if (yaAsignado) {
      alert("Este ejercicio ya está asignado");
      return;
    }

    const nuevoEjercicio = {
      id: ejercicio.id,
      nombre: ejercicio.nombre,
      categoria: ejercicio.categoria,
      orden: userEjercicios.length + 1,
    };

    setUserEjercicios([...userEjercicios, nuevoEjercicio]);
  };

  // Eliminar ejercicio de la lista del usuario
  const handleEliminarEjercicio = (ejercicioId) => {
    const nuevaLista = userEjercicios
      .filter((ej) => ej.id !== ejercicioId)
      .map((ej, idx) => ({ ...ej, orden: idx + 1 })); // Re-ordenar
    setUserEjercicios(nuevaLista);
  };

  // Subir ejercicio en el orden
  const handleSubir = (index) => {
    if (index === 0) return;
    const nuevaLista = [...userEjercicios];
    [nuevaLista[index - 1], nuevaLista[index]] = [nuevaLista[index], nuevaLista[index - 1]];
    // Actualizar orden
    setUserEjercicios(nuevaLista.map((ej, idx) => ({ ...ej, orden: idx + 1 })));
  };

  // Bajar ejercicio en el orden
  const handleBajar = (index) => {
    if (index === userEjercicios.length - 1) return;
    const nuevaLista = [...userEjercicios];
    [nuevaLista[index], nuevaLista[index + 1]] = [nuevaLista[index + 1], nuevaLista[index]];
    // Actualizar orden
    setUserEjercicios(nuevaLista.map((ej, idx) => ({ ...ej, orden: idx + 1 })));
  };

  // Guardar ejercicios asignados
  const handleGuardar = async () => {
    if (!selectedUser) {
      alert("Selecciona un usuario");
      return;
    }

    try {
      setSaving(true);
      const userRef = doc(db, "usuarios", selectedUser);
      await updateDoc(userRef, {
        ejerciciosAsignados: userEjercicios,
        updatedAt: new Date().toISOString(),
      });
      alert("Ejercicios guardados correctamente");
      
      // Recargar usuarios para actualizar la lista
      await loadData();
    } catch (err) {
      console.error("Error al guardar ejercicios:", err);
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🏋️ GYM - Asignar Ejercicios</h2>

      {/* Selector de usuario */}
      <div style={styles.section}>
        <label style={styles.labelBig}>Asignar a:</label>
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          style={styles.selectUser}
        >
          <option value="">-- Lista de Usuario despegable --</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.apellidos} {u.nombre} ({u.email})
            </option>
          ))}
        </select>
      </div>

      <div style={styles.mainContent}>
        {/* Panel izquierdo: Lista de ejercicios disponibles */}
        <div style={styles.leftPanel}>
          <h3 style={styles.subtitle}>📋 Ejercicios</h3>

          {/* Filtros */}
          <div style={styles.filtros}>
            <div style={styles.filtroGroup}>
              <label style={styles.label}>Filtro Categorías</label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                style={styles.select}
              >
                <option value="">Todas</option>
                {categorias.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div style={styles.filtroGroup}>
              <label style={styles.label}>Filtro nombre</label>
              <input
                type="text"
                value={filtroNombre}
                onChange={(e) => setFiltroNombre(e.target.value)}
                placeholder="Buscar..."
                style={styles.input}
              />
            </div>
          </div>

          {/* Lista de ejercicios */}
          <div style={styles.ejerciciosList}>
            {ejerciciosFiltrados.length === 0 ? (
              <p style={styles.noData}>No hay ejercicios</p>
            ) : (
              ejerciciosFiltrados.map((ej) => (
                <div key={ej.id} style={styles.ejercicioItem}>
                  <div style={styles.ejercicioInfo}>
                    <div style={styles.ejercicioNombre}>{ej.nombre}</div>
                    <div style={styles.ejercicioCategoria}>{ej.categoria}</div>
                  </div>
                  <button
                    onClick={() => handleAgregarEjercicio(ej)}
                    style={styles.btnAdd}
                    disabled={!selectedUser}
                  >
                    ➕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel derecho: Ejercicios asignados al usuario */}
        <div style={styles.rightPanel}>
          <div style={styles.rightHeader}>
            <h3 style={styles.subtitle}>
              {selectedUser ? "✅ Ejercicios Asignados" : "⚠️ Selecciona un usuario"}
            </h3>
            {selectedUser && userEjercicios.length > 0 && (
              <button
                onClick={handleGuardar}
                style={styles.btnSave}
                disabled={saving}
              >
                {saving ? "Guardando..." : "💾 Guardar"}
              </button>
            )}
          </div>

          {!selectedUser ? (
            <p style={styles.noData}>Selecciona un usuario para asignar ejercicios</p>
          ) : userEjercicios.length === 0 ? (
            <p style={styles.noData}>No hay ejercicios asignados</p>
          ) : (
            <div style={styles.asignadosList}>
              {userEjercicios.map((ej, index) => (
                <div key={ej.id} style={styles.asignadoItem}>
                  <div style={styles.ordenNum}>{index + 1}.</div>
                  <div style={styles.asignadoInfo}>
                    <div style={styles.asignadoNombre}>{ej.nombre}</div>
                    <div style={styles.asignadoCategoria}>{ej.categoria}</div>
                  </div>
                  <div style={styles.asignadoActions}>
                    <button
                      onClick={() => handleSubir(index)}
                      style={styles.btnOrden}
                      disabled={index === 0}
                      title="Subir"
                    >
                      ⬆️
                    </button>
                    <button
                      onClick={() => handleBajar(index)}
                      style={styles.btnOrden}
                      disabled={index === userEjercicios.length - 1}
                      title="Bajar"
                    >
                      ⬇️
                    </button>
                    <button
                      onClick={() => handleEliminarEjercicio(ej.id)}
                      style={styles.btnRemove}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "20px",
    maxWidth: "1600px",
    margin: "0 auto",
  },
  title: {
    margin: "0 0 24px 0",
    fontSize: "24px",
    fontWeight: "600",
    color: "#333",
  },
  section: {
    marginBottom: "24px",
  },
  labelBig: {
    display: "block",
    marginBottom: "8px",
    fontSize: "16px",
    fontWeight: "600",
    color: "#333",
  },
  selectUser: {
    width: "100%",
    maxWidth: "500px",
    padding: "12px 16px",
    fontSize: "16px",
    border: "2px solid #1976d2",
    borderRadius: "8px",
    backgroundColor: "white",
    cursor: "pointer",
  },
  mainContent: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
    "@media (max-width: 1024px)": {
      gridTemplateColumns: "1fr",
    },
  },
  leftPanel: {
    backgroundColor: "white",
    border: "1px solid #e0e0e0",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  rightPanel: {
    backgroundColor: "white",
    border: "1px solid #e0e0e0",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  rightHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    gap: "12px",
  },
  subtitle: {
    margin: "0 0 16px 0",
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
  },
  filtros: {
    marginBottom: "16px",
  },
  filtroGroup: {
    marginBottom: "12px",
  },
  label: {
    display: "block",
    marginBottom: "6px",
    fontSize: "13px",
    fontWeight: "500",
    color: "#555",
  },
  select: {
    width: "100%",
    padding: "8px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    backgroundColor: "white",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    boxSizing: "border-box",
  },
  ejerciciosList: {
    maxHeight: "500px",
    overflowY: "auto",
  },
  ejercicioItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    marginBottom: "8px",
    backgroundColor: "#f9f9f9",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    transition: "background-color 0.2s",
  },
  ejercicioInfo: {
    flex: 1,
  },
  ejercicioNombre: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#333",
    marginBottom: "4px",
  },
  ejercicioCategoria: {
    fontSize: "12px",
    color: "#1976d2",
    backgroundColor: "#e3f2fd",
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "10px",
  },
  btnAdd: {
    padding: "6px 12px",
    backgroundColor: "#4caf50",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "16px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  asignadosList: {
    maxHeight: "500px",
    overflowY: "auto",
  },
  asignadoItem: {
    display: "flex",
    alignItems: "center",
    padding: "12px",
    marginBottom: "8px",
    backgroundColor: "#f0f7ff",
    border: "1px solid #bbdefb",
    borderRadius: "8px",
    gap: "12px",
  },
  ordenNum: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#1976d2",
    minWidth: "30px",
  },
  asignadoInfo: {
    flex: 1,
  },
  asignadoNombre: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#333",
    marginBottom: "4px",
  },
  asignadoCategoria: {
    fontSize: "12px",
    color: "#1976d2",
  },
  asignadoActions: {
    display: "flex",
    gap: "6px",
  },
  btnOrden: {
    padding: "6px 10px",
    backgroundColor: "white",
    color: "#333",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  btnRemove: {
    padding: "6px 10px",
    backgroundColor: "#ffebee",
    color: "#c62828",
    border: "1px solid #ef5350",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  btnSave: {
    padding: "10px 20px",
    backgroundColor: "#4caf50",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  noData: {
    textAlign: "center",
    color: "#999",
    padding: "40px 20px",
    fontSize: "14px",
  },
};
