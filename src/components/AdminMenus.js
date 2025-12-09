import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../Firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

const CATEGORIAS = [
  { id: "desayuno", label: "🌅 Desayuno", color: "#fef3c7", borderColor: "#f59e0b" },
  { id: "almuerzo", label: "🥪 Almuerzo", color: "#dbeafe", borderColor: "#3b82f6" },
  { id: "comida", label: "🍽️ Comida", color: "#fecaca", borderColor: "#ef4444" },
  { id: "merienda", label: "🍪 Merienda", color: "#e9d5ff", borderColor: "#a855f7" },
  { id: "cena", label: "🌙 Cena", color: "#ccfbf1", borderColor: "#14b8a6" },
  { id: "snacks", label: "🍎 SNACK's", color: "#fed7aa", borderColor: "#fb923c" }
];

export default function AdminMenus() {
  const navigate = useNavigate();
  const [categoriaActiva, setCategoriaActiva] = useState("desayuno");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevoItem, setNuevoItem] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [editandoTexto, setEditandoTexto] = useState("");

  // Cargar items de la categoría activa
  useEffect(() => {
    loadItems();
  }, [categoriaActiva]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const itemsRef = collection(db, "menuItems", categoriaActiva, "items");
      const snapshot = await getDocs(itemsRef);
      const itemsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setItems(itemsList.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
    } catch (err) {
      console.error("Error cargando items:", err);
      alert("Error al cargar los items");
    } finally {
      setLoading(false);
    }
  };

  const agregarItem = async () => {
    if (!nuevoItem.trim()) return;
    
    try {
      const itemsRef = collection(db, "menuItems", categoriaActiva, "items");
      await addDoc(itemsRef, {
        nombre: nuevoItem.trim(),
        categoria: categoriaActiva,
        createdAt: new Date().toISOString()
      });
      setNuevoItem("");
      loadItems();
    } catch (err) {
      console.error("Error agregando item:", err);
      alert("Error al agregar el item");
    }
  };

  const actualizarItem = async (id) => {
    if (!editandoTexto.trim()) return;
    
    try {
      const itemRef = doc(db, "menuItems", categoriaActiva, "items", id);
      await updateDoc(itemRef, {
        nombre: editandoTexto.trim(),
        updatedAt: new Date().toISOString()
      });
      setEditandoId(null);
      setEditandoTexto("");
      loadItems();
    } catch (err) {
      console.error("Error actualizando item:", err);
      alert("Error al actualizar el item");
    }
  };

  const eliminarItem = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar "${nombre}"?`)) return;
    
    try {
      await deleteDoc(doc(db, "menuItems", categoriaActiva, "items", id));
      loadItems();
    } catch (err) {
      console.error("Error eliminando item:", err);
      alert("Error al eliminar el item");
    }
  };

  const iniciarEdicion = (item) => {
    setEditandoId(item.id);
    setEditandoTexto(item.nombre);
  };

  const categoriaSeleccionada = CATEGORIAS.find(c => c.id === categoriaActiva);

  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
      padding: "24px"
    }}>
      <div style={{ 
        maxWidth: "1200px",
        margin: "0 auto"
      }}>
        {/* Header */}
        <div style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ 
                margin: "0 0 8px 0", 
                fontSize: "28px", 
                fontWeight: "700", 
                color: "#15803d" 
              }}>
                📋 Gestión de Menús
              </h1>
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                Administra los productos disponibles para cada categoría de comida
              </p>
            </div>
            <button
              onClick={() => navigate("/admin")}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "2px solid #16a34a",
                background: "white",
                color: "#16a34a",
                fontWeight: "600",
                fontSize: "15px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "#16a34a";
                e.target.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "white";
                e.target.style.color = "#16a34a";
              }}
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* Selector de categorías */}
        <div style={{
          display: "flex",
          gap: "12px",
          marginBottom: "24px",
          flexWrap: "wrap"
        }}>
          {CATEGORIAS.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoriaActiva(cat.id)}
              style={{
                padding: "12px 24px",
                borderRadius: "10px",
                border: categoriaActiva === cat.id ? `3px solid ${cat.borderColor}` : "2px solid #e2e8f0",
                background: categoriaActiva === cat.id ? cat.color : "white",
                color: categoriaActiva === cat.id ? "#1e293b" : "#64748b",
                cursor: "pointer",
                fontWeight: categoriaActiva === cat.id ? "700" : "600",
                fontSize: "16px",
                transition: "all 0.2s",
                boxShadow: categoriaActiva === cat.id ? "0 4px 12px rgba(0,0,0,0.15)" : "0 2px 4px rgba(0,0,0,0.05)"
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Contenido principal */}
        <div style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          {/* Formulario agregar */}
          <div style={{
            background: categoriaSeleccionada.color,
            border: `2px solid ${categoriaSeleccionada.borderColor}`,
            borderRadius: "10px",
            padding: "20px",
            marginBottom: "24px"
          }}>
            <h3 style={{ 
              margin: "0 0 16px 0", 
              fontSize: "18px", 
              fontWeight: "700",
              color: "#1e293b"
            }}>
              ➕ Agregar nuevo item a {categoriaSeleccionada.label}
            </h3>
            <div style={{ display: "flex", gap: "12px" }}>
              <input
                type="text"
                value={nuevoItem}
                onChange={(e) => setNuevoItem(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && agregarItem()}
                placeholder={`Ej: Tostadas integrales con aguacate`}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: "8px",
                  border: "2px solid #e2e8f0",
                  fontSize: "15px",
                  outline: "none"
                }}
              />
              <button
                onClick={agregarItem}
                disabled={!nuevoItem.trim()}
                style={{
                  padding: "12px 32px",
                  borderRadius: "8px",
                  border: "none",
                  background: nuevoItem.trim() ? "#16a34a" : "#cbd5e1",
                  color: "white",
                  fontWeight: "700",
                  fontSize: "15px",
                  cursor: nuevoItem.trim() ? "pointer" : "not-allowed",
                  transition: "all 0.2s"
                }}
              >
                Agregar
              </button>
            </div>
          </div>

          {/* Lista de items */}
          <div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px"
            }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#1e293b" }}>
                Items disponibles ({items.length})
              </h3>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                Cargando...
              </div>
            ) : items.length === 0 ? (
              <div style={{ 
                textAlign: "center", 
                padding: "40px", 
                color: "#94a3b8",
                background: "#f8fafc",
                borderRadius: "8px"
              }}>
                No hay items en esta categoría. ¡Agrega el primero!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {items.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px",
                      background: "#f8fafc",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      transition: "all 0.2s"
                    }}
                  >
                    {editandoId === item.id ? (
                      <>
                        <input
                          type="text"
                          value={editandoTexto}
                          onChange={(e) => setEditandoTexto(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && actualizarItem(item.id)}
                          autoFocus
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "2px solid #3b82f6",
                            fontSize: "15px",
                            outline: "none",
                            marginRight: "12px"
                          }}
                        />
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => actualizarItem(item.id)}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "6px",
                              border: "none",
                              background: "#16a34a",
                              color: "white",
                              fontWeight: "600",
                              cursor: "pointer"
                            }}
                          >
                            ✓ Guardar
                          </button>
                          <button
                            onClick={() => {
                              setEditandoId(null);
                              setEditandoTexto("");
                            }}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "6px",
                              border: "none",
                              background: "#94a3b8",
                              color: "white",
                              fontWeight: "600",
                              cursor: "pointer"
                            }}
                          >
                            ✕ Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span style={{ 
                          flex: 1, 
                          fontSize: "15px", 
                          color: "#1e293b",
                          fontWeight: "500"
                        }}>
                          {item.nombre}
                        </span>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => iniciarEdicion(item)}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "6px",
                              border: "1px solid #3b82f6",
                              background: "white",
                              color: "#3b82f6",
                              fontWeight: "600",
                              cursor: "pointer",
                              fontSize: "14px"
                            }}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => eliminarItem(item.id, item.nombre)}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "6px",
                              border: "1px solid #ef4444",
                              background: "white",
                              color: "#ef4444",
                              fontWeight: "600",
                              cursor: "pointer",
                              fontSize: "14px"
                            }}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
