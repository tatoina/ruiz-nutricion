import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, storage } from "../Firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useDevice } from "../hooks/useDevice";

const CATEGORIAS_DEFAULT = [
  { id: "desayuno", label: "🌅 Desayuno", color: "#fef3c7", borderColor: "#f59e0b" },
  { id: "almuerzo", label: "🥪 Almuerzo", color: "#dbeafe", borderColor: "#3b82f6" },
  { id: "comida", label: "🍽️ Comida", color: "#fecaca", borderColor: "#ef4444" },
  { id: "cena", label: "🌙 Cena", color: "#ccfbf1", borderColor: "#14b8a6" },
  { id: "infusion", label: "☕ Infusión", color: "#fde68a", borderColor: "#eab308" },
];

export default function AdminRecetas() {
  const navigate = useNavigate();
  const { isMobile } = useDevice();
  const [categorias, setCategorias] = useState(CATEGORIAS_DEFAULT);
  const [recetas, setRecetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Formulario nueva receta
  const [nombreReceta, setNombreReceta] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("desayuno");
  const [archivo, setArchivo] = useState(null);
  
  // Edición
  const [editandoId, setEditandoId] = useState(null);
  const [editandoNombre, setEditandoNombre] = useState("");
  const [editandoCategoria, setEditandoCategoria] = useState("");
  
  // Gestión de categorías
  const [mostrarGestionCategorias, setMostrarGestionCategorias] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");

  useEffect(() => {
    loadCategorias();
    loadRecetas();
  }, []);

  const loadCategorias = async () => {
    try {
      const categoriasRef = collection(db, "recetasCategorias");
      const snapshot = await getDocs(categoriasRef);
      if (snapshot.docs.length > 0) {
        const categoriasDB = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCategorias(categoriasDB);
      }
    } catch (err) {
      console.error("Error cargando categorías:", err);
    }
  };

  const loadRecetas = async () => {
    setLoading(true);
    try {
      const recetasRef = collection(db, "recetas");
      const snapshot = await getDocs(recetasRef);
      const recetasList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecetas(recetasList.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
    } catch (err) {
      console.error("Error cargando recetas:", err);
      alert("Error al cargar las recetas");
    } finally {
      setLoading(false);
    }
  };

  const agregarCategoria = async () => {
    if (!nuevaCategoria.trim()) return;
    
    try {
      const categoriasRef = collection(db, "recetasCategorias");
      await addDoc(categoriasRef, {
        label: nuevaCategoria.trim(),
        color: "#e0e0e0",
        borderColor: "#999999",
        createdAt: new Date().toISOString()
      });
      setNuevaCategoria("");
      loadCategorias();
    } catch (err) {
      console.error("Error agregando categoría:", err);
      alert("Error al agregar la categoría");
    }
  };

  const eliminarCategoria = async (catId) => {
    if (!window.confirm("¿Eliminar esta categoría?")) return;
    
    try {
      await deleteDoc(doc(db, "recetasCategorias", catId));
      loadCategorias();
    } catch (err) {
      console.error("Error eliminando categoría:", err);
      alert("Error al eliminar la categoría");
    }
  };

  const agregarReceta = async () => {
    if (!nombreReceta.trim() || !archivo) {
      alert("Por favor ingresa un nombre y selecciona un archivo");
      return;
    }

    setUploading(true);
    try {
      // Subir archivo a Storage
      const timestamp = Date.now();
      const extension = archivo.name.split('.').pop();
      const fileName = `recetas/${timestamp}_${nombreReceta.trim()}.${extension}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, archivo);
      const url = await getDownloadURL(storageRef);
      
      // Determinar tipo de archivo
      const tipoArchivo = archivo.type.includes('video') ? 'video' : 'pdf';
      
      // Guardar en Firestore
      await addDoc(collection(db, "recetas"), {
        nombre: nombreReceta.trim(),
        categoria: categoriaSeleccionada,
        url: url,
        storagePath: fileName,
        tipoArchivo: tipoArchivo,
        createdAt: new Date().toISOString()
      });

      setNombreReceta("");
      setArchivo(null);
      document.getElementById("archivo-input").value = "";
      loadRecetas();
      alert("Receta agregada exitosamente");
    } catch (err) {
      console.error("Error agregando receta:", err);
      alert("Error al agregar la receta");
    } finally {
      setUploading(false);
    }
  };

  const actualizarReceta = async (id) => {
    if (!editandoNombre.trim()) return;
    
    try {
      const recetaRef = doc(db, "recetas", id);
      await updateDoc(recetaRef, {
        nombre: editandoNombre.trim(),
        categoria: editandoCategoria,
        updatedAt: new Date().toISOString()
      });
      setEditandoId(null);
      setEditandoNombre("");
      setEditandoCategoria("");
      loadRecetas();
    } catch (err) {
      console.error("Error actualizando receta:", err);
      alert("Error al actualizar la receta");
    }
  };

  const eliminarReceta = async (receta) => {
    if (!window.confirm(`¿Eliminar "${receta.nombre}"?`)) return;
    
    try {
      // Eliminar archivo de Storage
      if (receta.storagePath) {
        const storageRef = ref(storage, receta.storagePath);
        await deleteObject(storageRef);
      }
      
      // Eliminar de Firestore
      await deleteDoc(doc(db, "recetas", receta.id));
      loadRecetas();
    } catch (err) {
      console.error("Error eliminando receta:", err);
      alert("Error al eliminar la receta");
    }
  };

  const iniciarEdicion = (receta) => {
    setEditandoId(receta.id);
    setEditandoNombre(receta.nombre);
    setEditandoCategoria(receta.categoria);
  };

  const categoriaActual = categorias.find(c => c.id === categoriaSeleccionada) || categorias[0];

  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
      padding: isMobile ? "12px" : "24px",
      paddingBottom: isMobile ? "80px" : "24px"
    }}>
      <div style={{ 
        maxWidth: "1400px",
        margin: "0 auto"
      }}>
        {/* Header */}
        <div style={{
          background: "white",
          borderRadius: isMobile ? "8px" : "12px",
          padding: isMobile ? "16px" : "24px",
          marginBottom: isMobile ? "16px" : "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 style={{ 
                margin: "0 0 8px 0", 
                fontSize: isMobile ? "22px" : "28px", 
                fontWeight: "700", 
                color: "#92400e" 
              }}>
                👨‍🍳 Gestión de Recetas
              </h1>
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                Administra recetas en video y PDF para tus usuarios
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setMostrarGestionCategorias(!mostrarGestionCategorias)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "2px solid #f59e0b",
                  background: mostrarGestionCategorias ? "#f59e0b" : "white",
                  color: mostrarGestionCategorias ? "white" : "#f59e0b",
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                🏷️ Categorías
              </button>
              {!isMobile && (
                <button
                  onClick={() => navigate("/admin")}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "2px solid #92400e",
                    background: "white",
                    color: "#92400e",
                    fontWeight: "600",
                    fontSize: "15px",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  ← Volver
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Gestión de Categorías */}
        {mostrarGestionCategorias && (
          <div style={{
            background: "white",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "700" }}>
              Gestionar Categorías
            </h3>
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              <input
                type="text"
                value={nuevaCategoria}
                onChange={(e) => setNuevaCategoria(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && agregarCategoria()}
                placeholder="Nueva categoría (ej: Postres)"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: "8px",
                  border: "2px solid #e2e8f0",
                  fontSize: "15px"
                }}
              />
              <button
                onClick={agregarCategoria}
                disabled={!nuevaCategoria.trim()}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: nuevaCategoria.trim() ? "#f59e0b" : "#cbd5e1",
                  color: "white",
                  fontWeight: "700",
                  cursor: nuevaCategoria.trim() ? "pointer" : "not-allowed"
                }}
              >
                Agregar
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {categorias.map(cat => (
                <div key={cat.id} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  background: cat.color,
                  border: `2px solid ${cat.borderColor}`,
                  borderRadius: "8px"
                }}>
                  <span style={{ fontWeight: "600" }}>{cat.label}</span>
                  {!CATEGORIAS_DEFAULT.find(c => c.id === cat.id) && (
                    <button
                      onClick={() => eliminarCategoria(cat.id)}
                      style={{
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulario agregar receta */}
        <div style={{
          background: "white",
          borderRadius: isMobile ? "8px" : "12px",
          padding: isMobile ? "16px" : "24px",
          marginBottom: isMobile ? "16px" : "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "700" }}>
            ➕ Agregar Nueva Receta
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input
              type="text"
              value={nombreReceta}
              onChange={(e) => setNombreReceta(e.target.value)}
              placeholder="Nombre de la receta"
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                border: "2px solid #e2e8f0",
                fontSize: "15px"
              }}
            />
            
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {categorias.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaSeleccionada(cat.id)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: categoriaSeleccionada === cat.id ? `3px solid ${cat.borderColor}` : "2px solid #e2e8f0",
                    background: categoriaSeleccionada === cat.id ? cat.color : "white",
                    fontWeight: categoriaSeleccionada === cat.id ? "700" : "600",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div style={{ 
              padding: "20px",
              border: "3px dashed #e2e8f0",
              borderRadius: "8px",
              textAlign: "center",
              background: "#f8fafc"
            }}>
              <input
                id="archivo-input"
                type="file"
                accept=".pdf,video/*"
                onChange={(e) => setArchivo(e.target.files[0])}
                style={{ display: "none" }}
              />
              <label 
                htmlFor="archivo-input"
                style={{
                  display: "inline-block",
                  padding: "12px 24px",
                  background: "#3b82f6",
                  color: "white",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "15px"
                }}
              >
                📁 Seleccionar Archivo (PDF o Video)
              </label>
              {archivo && (
                <p style={{ marginTop: "12px", color: "#16a34a", fontWeight: "600" }}>
                  ✓ {archivo.name}
                </p>
              )}
            </div>

            <button
              onClick={agregarReceta}
              disabled={!nombreReceta.trim() || !archivo || uploading}
              style={{
                padding: "14px 32px",
                borderRadius: "8px",
                border: "none",
                background: (!nombreReceta.trim() || !archivo || uploading) ? "#cbd5e1" : "#f59e0b",
                color: "white",
                fontWeight: "700",
                fontSize: "16px",
                cursor: (!nombreReceta.trim() || !archivo || uploading) ? "not-allowed" : "pointer"
              }}
            >
              {uploading ? "Subiendo..." : "✓ Agregar Receta"}
            </button>
          </div>
        </div>

        {/* Lista de recetas */}
        <div style={{
          background: "white",
          borderRadius: isMobile ? "8px" : "12px",
          padding: isMobile ? "16px" : "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "700" }}>
            Recetas Disponibles ({recetas.length})
          </h3>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
              Cargando...
            </div>
          ) : recetas.length === 0 ? (
            <div style={{ 
              textAlign: "center", 
              padding: "40px", 
              color: "#94a3b8",
              background: "#f8fafc",
              borderRadius: "8px"
            }}>
              No hay recetas. ¡Agrega la primera!
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ 
                width: "100%", 
                borderCollapse: "collapse",
                background: "white"
              }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: isMobile ? "8px" : "12px 16px", textAlign: "left", fontSize: isMobile ? "12px" : "14px", fontWeight: "700", color: "#64748b" }}>Categoría</th>
                    <th style={{ padding: isMobile ? "8px" : "12px 16px", textAlign: "left", fontSize: isMobile ? "12px" : "14px", fontWeight: "700", color: "#64748b" }}>Nombre</th>
                    <th style={{ padding: isMobile ? "8px" : "12px 16px", textAlign: "left", fontSize: isMobile ? "12px" : "14px", fontWeight: "700", color: "#64748b" }}>Tipo</th>
                    <th style={{ padding: isMobile ? "8px" : "12px 16px", textAlign: "center", fontSize: isMobile ? "12px" : "14px", fontWeight: "700", color: "#64748b" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {recetas.map((receta, index) => {
                    const categoria = categorias.find(c => c.id === receta.categoria) || categorias[0];
                    const isEditing = editandoId === receta.id;
                    
                    return (
                      <tr 
                        key={receta.id}
                        style={{ 
                          borderBottom: "1px solid #e2e8f0",
                          background: index % 2 === 0 ? "white" : "#fafafa"
                        }}
                      >
                        {isEditing ? (
                          <>
                            <td style={{ padding: isMobile ? "8px" : "12px 16px" }}>
                              <select
                                value={editandoCategoria}
                                onChange={(e) => setEditandoCategoria(e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  border: "2px solid #e2e8f0",
                                  fontSize: isMobile ? "12px" : "14px"
                                }}
                              >
                                {categorias.map(cat => (
                                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: isMobile ? "8px" : "12px 16px" }} colSpan="2">
                              <input
                                type="text"
                                value={editandoNombre}
                                onChange={(e) => setEditandoNombre(e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  border: "2px solid #3b82f6",
                                  fontSize: isMobile ? "12px" : "14px"
                                }}
                              />
                            </td>
                            <td style={{ padding: isMobile ? "8px" : "12px 16px" }}>
                              <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                                <button
                                  onClick={() => actualizarReceta(receta.id)}
                                  style={{
                                    padding: isMobile ? "6px 10px" : "8px 14px",
                                    borderRadius: "6px",
                                    border: "none",
                                    background: "#16a34a",
                                    color: "white",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    fontSize: isMobile ? "11px" : "13px"
                                  }}
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => {
                                    setEditandoId(null);
                                    setEditandoNombre("");
                                    setEditandoCategoria("");
                                  }}
                                  style={{
                                    padding: isMobile ? "6px 10px" : "8px 14px",
                                    borderRadius: "6px",
                                    border: "none",
                                    background: "#94a3b8",
                                    color: "white",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    fontSize: isMobile ? "11px" : "13px"
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: isMobile ? "8px" : "12px 16px" }}>
                              <span style={{
                                display: "inline-block",
                                padding: isMobile ? "3px 8px" : "4px 10px",
                                background: categoria.color,
                                border: `1px solid ${categoria.borderColor}`,
                                borderRadius: "6px",
                                fontSize: isMobile ? "10px" : "12px",
                                fontWeight: "600",
                                whiteSpace: "nowrap"
                              }}>
                                {categoria.label}
                              </span>
                            </td>
                            <td style={{ padding: isMobile ? "8px" : "12px 16px", fontSize: isMobile ? "12px" : "14px", fontWeight: "600", color: "#1e293b" }}>
                              {receta.nombre}
                            </td>
                            <td style={{ padding: isMobile ? "8px" : "12px 16px", fontSize: isMobile ? "11px" : "13px", color: "#64748b" }}>
                              {receta.tipoArchivo === 'video' ? '🎥 Video' : '📄 PDF'}
                            </td>
                            <td style={{ padding: isMobile ? "8px" : "12px 16px" }}>
                              <div style={{ display: "flex", gap: isMobile ? "4px" : "6px", justifyContent: "center", flexWrap: "wrap" }}>
                                <button
                                  onClick={() => window.open(receta.url, '_blank')}
                                  style={{
                                    padding: isMobile ? "6px 10px" : "8px 14px",
                                    borderRadius: "6px",
                                    border: "none",
                                    background: "#3b82f6",
                                    color: "white",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    fontSize: isMobile ? "11px" : "13px"
                                  }}
                                  title="Ver"
                                >
                                  👁️ Ver
                                </button>
                                <button
                                  onClick={() => iniciarEdicion(receta)}
                                  style={{
                                    padding: isMobile ? "6px 10px" : "8px 12px",
                                    borderRadius: "6px",
                                    border: "1px solid #f59e0b",
                                    background: "white",
                                    color: "#f59e0b",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    fontSize: isMobile ? "11px" : "13px"
                                  }}
                                  title="Editar"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => eliminarReceta(receta)}
                                  style={{
                                    padding: isMobile ? "6px 10px" : "8px 12px",
                                    borderRadius: "6px",
                                    border: "1px solid #ef4444",
                                    background: "white",
                                    color: "#ef4444",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    fontSize: isMobile ? "11px" : "13px"
                                  }}
                                  title="Eliminar"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Navegación inferior para móvil */}
      {isMobile && (
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "white",
          borderTop: "1px solid #e0e0e0",
          boxShadow: "0 -2px 4px rgba(0,0,0,0.1)",
          zIndex: 100,
          display: "flex",
          justifyContent: "space-around",
          padding: "8px 4px"
        }}>
          <button
            onClick={() => navigate("/admin")}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "6px",
              border: "none",
              background: "none",
              color: "#666",
              fontSize: "11px",
              cursor: "pointer"
            }}
          >
            <span style={{ fontSize: "20px" }}>👥</span>
            <span>Usuarios</span>
          </button>
          <button
            onClick={() => navigate("/admin/menus")}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "6px",
              border: "none",
              background: "none",
              color: "#666",
              fontSize: "11px",
              cursor: "pointer"
            }}
          >
            <span style={{ fontSize: "20px" }}>📋</span>
            <span>Menús</span>
          </button>
          <button
            onClick={() => navigate("/admin/recetas")}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "6px",
              border: "none",
              background: "none",
              color: "#f59e0b",
              fontSize: "11px",
              cursor: "pointer"
            }}
          >
            <span style={{ fontSize: "20px" }}>👨‍🍳</span>
            <span>Recetas</span>
          </button>
        </div>
      )}
    </div>
  );
}
