import React, { useState, useEffect } from "react";
import { db } from "../Firebase";
import { collection, getDocs } from "firebase/firestore";

export default function MenuSelector({ categoria, value, onChange, readOnly = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    loadItems();
  }, [categoria]);

  useEffect(() => {
    // Parsear el valor actual para extraer items seleccionados
    if (value && items.length > 0) {
      const lines = value.split('\n').filter(line => line.trim());
      const selected = [];
      let custom = [];
      
      lines.forEach(line => {
        const cleaned = line.replace(/^[•\-*]\s*/, '').trim();
        const found = items.find(item => item.nombre === cleaned);
        if (found) {
          selected.push(found.nombre);
        } else if (cleaned) {
          custom.push(cleaned);
        }
      });
      
      setSelectedItems(selected);
      if (custom.length > 0) {
        setCustomText(custom.join('\n'));
        setShowCustomInput(true);
      }
    } else if (!value) {
      setSelectedItems([]);
      setCustomText("");
      setShowCustomInput(false);
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

  const toggleItem = (itemNombre) => {
    const newSelected = selectedItems.includes(itemNombre)
      ? selectedItems.filter(i => i !== itemNombre)
      : [...selectedItems, itemNombre];
    
    setSelectedItems(newSelected);
    updateValue(newSelected, customText);
  };

  const updateValue = (selected, custom) => {
    const lines = [
      ...selected.map(item => `• ${item}`),
      ...custom.split('\n').filter(line => line.trim()).map(line => `• ${line}`)
    ];
    onChange(lines.join('\n'));
  };

  const handleCustomTextChange = (text) => {
    setCustomText(text);
    updateValue(selectedItems, text);
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
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Lista con checkboxes */}
      {items.length > 0 && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          maxHeight: "200px",
          overflowY: "auto",
          padding: "8px",
          background: "#f8fafc",
          borderRadius: "6px",
          border: "1px solid #e2e8f0"
        }}>
          {items.map(item => (
            <label
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 8px",
                borderRadius: "4px",
                cursor: "pointer",
                background: selectedItems.includes(item.nombre) ? "#dcfce7" : "white",
                border: selectedItems.includes(item.nombre) ? "1px solid #16a34a" : "1px solid #e2e8f0",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                if (!selectedItems.includes(item.nombre)) {
                  e.currentTarget.style.background = "#f1f5f9";
                }
              }}
              onMouseLeave={(e) => {
                if (!selectedItems.includes(item.nombre)) {
                  e.currentTarget.style.background = "white";
                }
              }}
            >
              <input
                type="checkbox"
                checked={selectedItems.includes(item.nombre)}
                onChange={() => toggleItem(item.nombre)}
                style={{
                  width: "18px",
                  height: "18px",
                  cursor: "pointer",
                  accentColor: "#16a34a"
                }}
              />
              <span style={{
                fontSize: "14px",
                color: "#1e293b",
                fontWeight: selectedItems.includes(item.nombre) ? "600" : "400"
              }}>
                {item.nombre}
              </span>
            </label>
          ))}
        </div>
      )}

      {/* Botón para agregar texto personalizado */}
      {!showCustomInput && (
        <button
          onClick={() => setShowCustomInput(true)}
          style={{
            padding: "10px 16px",
            borderRadius: "6px",
            border: "2px dashed #cbd5e1",
            background: "white",
            color: "#64748b",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = "#3b82f6";
            e.target.style.color = "#3b82f6";
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = "#cbd5e1";
            e.target.style.color = "#64748b";
          }}
        >
          ✏️ Agregar texto personalizado
        </button>
      )}

      {/* Textarea personalizado */}
      {showCustomInput && (
        <div>
          <textarea
            value={customText}
            onChange={(e) => handleCustomTextChange(e.target.value)}
            placeholder="Escribe opciones personalizadas (una por línea)..."
            rows={3}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "6px",
              border: "2px solid #3b82f6",
              fontSize: "14px",
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box"
            }}
          />
          <button
            onClick={() => {
              setShowCustomInput(false);
              setCustomText("");
              updateValue(selectedItems, "");
            }}
            style={{
              marginTop: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #ef4444",
              background: "white",
              color: "#ef4444",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "13px"
            }}
          >
            ✕ Quitar texto personalizado
          </button>
        </div>
      )}

      {/* Indicador de items seleccionados */}
      {selectedItems.length > 0 && (
        <div style={{
          padding: "8px 12px",
          background: "#dcfce7",
          borderRadius: "6px",
          border: "1px solid #16a34a",
          fontSize: "13px",
          color: "#15803d",
          fontWeight: "600"
        }}>
          ✓ {selectedItems.length} plato{selectedItems.length !== 1 ? 's' : ''} seleccionado{selectedItems.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
