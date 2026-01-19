import React, { useState, useEffect } from "react";
import { db } from "../Firebase";
import { collection, getDocs } from "firebase/firestore";

const MenuSelector = React.memo(function MenuSelector({ categoria, value, onChange, readOnly = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [platosSeleccionados, setPlatosSeleccionados] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    loadItems();
  }, [categoria]);

  useEffect(() => {
    // Parsear platos seleccionados desde el value
    if (value) {
      const platos = value.split('\n')
        .map(line => line.replace(/^[•\-*]\s*/, '').trim())
        .filter(line => line);
      setPlatosSeleccionados(platos);
    } else {
      setPlatosSeleccionados([]);
    }
  }, [value]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const itemsRef = collection(db, "menuItems", categoria, "items");
      const snapshot = await getDocs(itemsRef);
      const itemsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setItems(itemsList.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
    } catch (err) {
      console.error("Error cargando items:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const agregarPlato = (platoNombre) => {
    if (!platoNombre || platosSeleccionados.includes(platoNombre)) return;
    const nuevosPlatos = [...platosSeleccionados, platoNombre];
    actualizarValue(nuevosPlatos);
  };

  const eliminarPlato = (platoNombre) => {
    const nuevosPlatos = platosSeleccionados.filter(p => p !== platoNombre);
    actualizarValue(nuevosPlatos);
  };

  const actualizarValue = (platos) => {
    const text = platos.map(p => `• ${p}`).join('\n');
    onChange(text);
  };

  const reordenarPlatos = (fromIndex, toIndex) => {
    const nuevosPlatos = [...platosSeleccionados];
    const [removed] = nuevosPlatos.splice(fromIndex, 1);
    nuevosPlatos.splice(toIndex, 0, removed);
    actualizarValue(nuevosPlatos);
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    
    reordenarPlatos(draggedIndex, dropIndex);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (loading) {
    return (
      <div style={{
        padding: "12px",
        background: "#f8fafc",
        borderRadius: "6px",
        border: "1px solid #e2e8f0",
        color: "#64748b",
        fontSize: "14px"
      }}>
        Cargando opciones...
      </div>
    );
  }

  if (readOnly) {
    const platos = platosSeleccionados;
    return (
      <div style={{
        padding: "12px",
        background: "#f8fafc",
        borderRadius: "6px",
        border: "1px solid #e2e8f0",
        minHeight: "44px",
        fontSize: "15px",
        color: "#1e293b"
      }}>
        {platos.length > 0 ? (
          platos.map((plato, idx) => (
            <div key={idx} style={{ marginBottom: "4px" }}>
              • {plato}
            </div>
          ))
        ) : (
          <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin asignar</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Platos ya seleccionados */}
      {platosSeleccionados.length > 0 && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          padding: "10px",
          background: "#f0fdf4",
          borderRadius: "6px",
          border: "1px solid #86efac"
        }}>
          {platosSeleccionados.map((plato, idx) => (
            <div
              key={idx}
              draggable={!readOnly}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              style={{
                display: "flex",
                justifyContent: "space-between",
                cursor: readOnly ? "default" : "move",
                opacity: draggedIndex === idx ? 0.5 : 1,
                transition: "opacity 0.2s",
                alignItems: "center",
                padding: "8px 10px",
                background: "white",
                borderRadius: "4px",
                border: "1px solid #dcfce7"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                {!readOnly && (
                  <span style={{ 
                    fontSize: "16px", 
                    color: "#94a3b8",
                    cursor: "grab",
                    userSelect: "none"
                  }}>⋮⋮</span>
                )}
                <span style={{ fontSize: "14px", color: "#1e293b" }}>• {plato}</span>
              </div>
              <button
                onClick={() => eliminarPlato(plato)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "none",
                  background: "#fee2e2",
                  color: "#dc2626",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600"
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Desplegable para añadir */}
      {items.length > 0 ? (
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select
            onChange={(e) => {
              if (e.target.value) {
                agregarPlato(e.target.value);
                e.target.value = "";
              }
            }}
            defaultValue=""
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "6px",
              border: "2px solid #e2e8f0",
              fontSize: "14px",
              outline: "none",
              cursor: "pointer",
              background: "white"
            }}
          >
            <option value="">➕ Añadir plato...</option>
            {items.filter(item => !platosSeleccionados.includes(item.nombre)).map(item => (
              <option key={item.id} value={item.nombre}>
                {item.nombre}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div style={{
          padding: "12px",
          background: "#fef3c7",
          borderRadius: "6px",
          border: "1px solid #f59e0b",
          fontSize: "13px",
          color: "#92400e"
        }}>
          ⚠️ No hay items en esta categoría. Ve a Menús para agregar opciones.
        </div>
      )}
    </div>
  );
});

export default MenuSelector;
