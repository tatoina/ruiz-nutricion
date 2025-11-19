import React, { useState, useEffect } from "react";
import { db } from "../Firebase";
import { collection, getDocs } from "firebase/firestore";

export default function MenuSelector({ categoria, value, onChange, readOnly = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    loadItems();
  }, [categoria]);

  useEffect(() => {
    // Parsear el valor actual para extraer items seleccionados
    if (value && items.length > 0) {
      const lines = value.split('\n').filter(line => line.trim());
      const selected = [];
      
      lines.forEach(line => {
        const cleaned = line.replace(/^[•\-*]\s*/, '').trim();
        const found = items.find(item => item.nombre === cleaned);
        if (found) {
          selected.push(found.nombre);
        }
      });
      
      setSelectedItems(selected);
    } else if (!value) {
      setSelectedItems([]);
    }
  }, [value, items]);

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

  const handleSelectionChange = (e) => {
    const options = Array.from(e.target.selectedOptions);
    const selected = options.map(opt => opt.value);
    setSelectedItems(selected);
    
    const lines = selected.map(item => `• ${item}`);
    onChange(lines.join('\n'));
  };

  if (readOnly) {
    // Mostrar con bullets para mejor lectura
    const lines = value ? value.split('\n').filter(line => line.trim()) : [];
    return (
      <div style={{
        padding: "12px",
        background: "#f8fafc",
        borderRadius: "6px",
        border: "1px solid #e2e8f0",
        minHeight: "44px",
        fontSize: "15px",
        color: "#1e293b",
        whiteSpace: "pre-line"
      }}>
        {lines.length > 0 ? (
          lines.map((line, idx) => (
            <div key={idx} style={{ marginBottom: "4px" }}>
              {line.startsWith('•') ? line : `• ${line}`}
            </div>
          ))
        ) : (
          <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin asignar</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Select múltiple compacto */}
      {items.length > 0 ? (
        <>
          <select
            multiple
            value={selectedItems}
            onChange={handleSelectionChange}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "2px solid #e2e8f0",
              fontSize: "14px",
              outline: "none",
              cursor: "pointer",
              background: "white",
              minHeight: "100px",
              maxHeight: "150px"
            }}
          >
            {items.map(item => (
              <option key={item.id} value={item.nombre} style={{ padding: "4px 8px" }}>
                {item.nombre}
              </option>
            ))}
          </select>
          <div style={{
            fontSize: "12px",
            color: "#64748b",
            fontStyle: "italic"
          }}>
            💡 Mantén Ctrl (Cmd en Mac) para seleccionar varios
          </div>
          {selectedItems.length > 0 && (
            <div style={{
              padding: "6px 10px",
              background: "#dcfce7",
              borderRadius: "6px",
              border: "1px solid #16a34a",
              fontSize: "12px",
              color: "#15803d",
              fontWeight: "600"
            }}>
              ✓ {selectedItems.length} seleccionado{selectedItems.length !== 1 ? 's' : ''}
            </div>
          )}
        </>
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
}
