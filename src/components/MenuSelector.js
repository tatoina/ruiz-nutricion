import React, { useState, useEffect } from "react";
import { db } from "../Firebase";
import { collection, getDocs } from "firebase/firestore";

export default function MenuSelector({ categoria, value, onChange, readOnly = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    loadItems();
  }, [categoria]);

  useEffect(() => {
    // Verificar si el valor actual está en la lista
    if (value && items.length > 0) {
      const existe = items.some(item => item.nombre === value);
      setIsCustom(!existe && value.trim() !== "");
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

  if (readOnly) {
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
        {value || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin asignar</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <select
        value={isCustom ? "__custom__" : value}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "__custom__") {
            setIsCustom(true);
          } else {
            setIsCustom(false);
            onChange(val);
          }
        }}
        style={{
          padding: "12px",
          borderRadius: "6px",
          border: "2px solid #e2e8f0",
          fontSize: "15px",
          outline: "none",
          cursor: "pointer",
          background: "white"
        }}
      >
        <option value="">-- Seleccionar --</option>
        {items.map(item => (
          <option key={item.id} value={item.nombre}>
            {item.nombre}
          </option>
        ))}
        <option value="__custom__">✏️ Escribir personalizado</option>
      </select>

      {isCustom && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe un menú personalizado..."
          rows={3}
          style={{
            padding: "12px",
            borderRadius: "6px",
            border: "2px solid #3b82f6",
            fontSize: "15px",
            outline: "none",
            resize: "vertical",
            fontFamily: "inherit"
          }}
        />
      )}
    </div>
  );
}
