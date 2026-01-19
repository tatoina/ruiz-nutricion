import React, { useEffect, useState } from "react";
import { db } from "../Firebase";
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc,
  query,
  orderBy 
} from "firebase/firestore";

/**
 * AdminEjercicios - Gestión de ejercicios
 * Permite crear, editar y eliminar ejercicios con categorías
 */
export default function AdminEjercicios() {
  const [ejercicios, setEjercicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroNombre, setFiltroNombre] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" o "edit"
  const [editingEjercicio, setEditingEjercicio] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    categoria: "",
    descripcion: "",
    videoUrl: "",
    imagen: ""
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  // Categorías predefinidas (puedes personalizarlas)
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

  // Cargar ejercicios
  useEffect(() => {
    loadEjercicios();
  }, []);

  const loadEjercicios = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "ejercicios"), orderBy("nombre", "asc"));
      const querySnapshot = await getDocs(q);
      const lista = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEjercicios(lista);
    } catch (err) {
      console.error("Error al cargar ejercicios:", err);
      // Fallback sin orderBy si no existe índice
      try {
        const querySnapshot = await getDocs(collection(db, "ejercicios"));
        const lista = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEjercicios(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      } catch (err2) {
        console.error("Error en fallback:", err2);
      }
    } finally {
      setLoading(false);
    }
  };

  // Filtrar ejercicios
  const ejerciciosFiltrados = ejercicios.filter((ej) => {
    const matchCategoria = !filtroCategoria || ej.categoria === filtroCategoria;
    const matchNombre = !filtroNombre || 
      ej.nombre.toLowerCase().includes(filtroNombre.toLowerCase());
    return matchCategoria && matchNombre;
  });

  // Abrir modal para crear
  const handleNuevoEjercicio = () => {
    setModalMode("create");
    setEditingEjercicio(null);
    setFormData({
      nombre: "",
      categoria: "",
      descripcion: "",
      videoUrl: "",
      imagen: ""
    });
    setModalError("");
    setShowModal(true);
  };

  // Abrir modal para editar
  const handleEditarEjercicio = (ejercicio) => {
    setModalMode("edit");
    setEditingEjercicio(ejercicio);
    setFormData({
      nombre: ejercicio.nombre || "",
      categoria: ejercicio.categoria || "",
      descripcion: ejercicio.descripcion || "",
      videoUrl: ejercicio.videoUrl || "",
      imagen: ejercicio.imagen || ""
    });
    setModalError("");
    setShowModal(true);
  };

  // Eliminar ejercicio
  const handleEliminarEjercicio = async (ejercicioId, nombre) => {
    if (!window.confirm(`¿Eliminar ejercicio "${nombre}"?`)) return;
    
    try {
      await deleteDoc(doc(db, "ejercicios", ejercicioId));
      await loadEjercicios();
    } catch (err) {
      console.error("Error al eliminar ejercicio:", err);
      alert("Error al eliminar ejercicio: " + err.message);
    }
  };

  // Guardar ejercicio (crear o editar)
  const handleGuardarEjercicio = async () => {
    if (!formData.nombre.trim()) {
      setModalError("El nombre es obligatorio");
      return;
    }
    if (!formData.categoria.trim()) {
      setModalError("La categoría es obligatoria");
      return;
    }

    try {
      setModalLoading(true);
      setModalError("");

      const ejercicioData = {
        nombre: formData.nombre.trim(),
        categoria: formData.categoria.trim(),
        descripcion: formData.descripcion.trim(),
        videoUrl: formData.videoUrl.trim(),
        imagen: formData.imagen.trim(),
        updatedAt: new Date().toISOString()
      };

      if (modalMode === "create") {
        ejercicioData.createdAt = new Date().toISOString();
        await addDoc(collection(db, "ejercicios"), ejercicioData);
      } else {
        await updateDoc(doc(db, "ejercicios", editingEjercicio.id), ejercicioData);
      }

      await loadEjercicios();
      setShowModal(false);
    } catch (err) {
      console.error("Error al guardar ejercicio:", err);
      setModalError("Error al guardar: " + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <p>Cargando ejercicios...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>💪 Gestión de Ejercicios</h2>
        <button onClick={handleNuevoEjercicio} style={styles.btnPrimary}>
          ➕ Subir Nuevo
        </button>
      </div>

      {/* Filtros */}
      <div style={styles.filtros}>
        <div style={styles.filtroGroup}>
          <label style={styles.label}>Filtro Categorías:</label>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            style={styles.select}
          >
            <option value="">Todas las categorías</option>
            {categorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div style={styles.filtroGroup}>
          <label style={styles.label}>Filtro nombre:</label>
          <input
            type="text"
            value={filtroNombre}
            onChange={(e) => setFiltroNombre(e.target.value)}
            placeholder="Buscar por nombre..."
            style={styles.input}
          />
        </div>
      </div>

      {/* Lista de ejercicios */}
      <div style={styles.ejerciciosList}>
        {ejerciciosFiltrados.length === 0 ? (
          <p style={styles.noData}>No hay ejercicios que coincidan con los filtros</p>
        ) : (
          <div style={styles.grid}>
            {ejerciciosFiltrados.map((ej) => (
              <div key={ej.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>{ej.nombre}</h3>
                  <span style={styles.badge}>{ej.categoria}</span>
                </div>
                
                {ej.descripcion && (
                  <p style={styles.cardDesc}>{ej.descripcion}</p>
                )}
                
                <div style={styles.cardActions}>
                  <button
                    onClick={() => handleEditarEjercicio(ej)}
                    style={styles.btnEdit}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => handleEliminarEjercicio(ej.id, ej.nombre)}
                    style={styles.btnDelete}
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para crear/editar ejercicio */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>
              {modalMode === "create" ? "Nuevo Ejercicio" : "Editar Ejercicio"}
            </h3>

            {modalError && (
              <div style={styles.error}>{modalError}</div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Nombre *</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                style={styles.input}
                placeholder="Ej: Plancha frontal"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Categoría *</label>
              <select
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                style={styles.select}
              >
                <option value="">Selecciona categoría...</option>
                {categorias.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Descripción</label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                style={styles.textarea}
                rows={3}
                placeholder="Descripción del ejercicio..."
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>URL Video (YouTube, etc.)</label>
              <input
                type="text"
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                style={styles.input}
                placeholder="https://..."
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>URL Imagen</label>
              <input
                type="text"
                value={formData.imagen}
                onChange={(e) => setFormData({ ...formData, imagen: e.target.value })}
                style={styles.input}
                placeholder="https://..."
              />
            </div>

            <div style={styles.modalActions}>
              <button
                onClick={() => setShowModal(false)}
                style={styles.btnSecondary}
                disabled={modalLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarEjercicio}
                style={styles.btnPrimary}
                disabled={modalLoading}
              >
                {modalLoading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: "20px",
    maxWidth: "1400px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "12px",
  },
  title: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "600",
    color: "#333",
  },
  filtros: {
    display: "flex",
    gap: "16px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  filtroGroup: {
    flex: "1",
    minWidth: "200px",
  },
  label: {
    display: "block",
    marginBottom: "6px",
    fontSize: "14px",
    fontWeight: "500",
    color: "#555",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    boxSizing: "border-box",
    backgroundColor: "white",
  },
  ejerciciosList: {
    marginTop: "20px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "20px",
  },
  card: {
    backgroundColor: "white",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "16px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    transition: "box-shadow 0.2s",
    cursor: "pointer",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "12px",
    gap: "12px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  badge: {
    backgroundColor: "#e3f2fd",
    color: "#1976d2",
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "500",
    whiteSpace: "nowrap",
  },
  cardDesc: {
    margin: "0 0 12px 0",
    fontSize: "14px",
    color: "#666",
    lineHeight: "1.5",
  },
  cardActions: {
    display: "flex",
    gap: "8px",
    marginTop: "12px",
  },
  btnPrimary: {
    padding: "10px 20px",
    backgroundColor: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  btnSecondary: {
    padding: "10px 20px",
    backgroundColor: "#f5f5f5",
    color: "#333",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  btnEdit: {
    flex: 1,
    padding: "8px 12px",
    backgroundColor: "#fff3e0",
    color: "#e65100",
    border: "1px solid #ffb74d",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  btnDelete: {
    flex: 1,
    padding: "8px 12px",
    backgroundColor: "#ffebee",
    color: "#c62828",
    border: "1px solid #ef5350",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  noData: {
    textAlign: "center",
    color: "#999",
    padding: "40px",
    fontSize: "16px",
  },
  // Modal styles
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modal: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    maxWidth: "500px",
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
  },
  modalTitle: {
    margin: "0 0 20px 0",
    fontSize: "20px",
    fontWeight: "600",
    color: "#333",
  },
  formGroup: {
    marginBottom: "16px",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    boxSizing: "border-box",
    fontFamily: "inherit",
    resize: "vertical",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
  },
  error: {
    backgroundColor: "#ffebee",
    color: "#c62828",
    padding: "12px",
    borderRadius: "6px",
    marginBottom: "16px",
    fontSize: "14px",
  },
};
