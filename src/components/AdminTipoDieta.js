import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./estilos.css";

/**
 * AdminTipoDieta
 * - Pantalla con dos botones: "Menu Sencillo" y "Menu Tipos"
 * - Cada botón abrirá una imagen (a definir más adelante)
 */
export default function AdminTipoDieta() {
  const navigate = useNavigate();
  const [selectedMenu, setSelectedMenu] = useState(null);

  const handleMenuSencillo = () => {
    setSelectedMenu("sencillo");
    // Aquí más adelante mostraremos la imagen correspondiente
    alert("Menu Sencillo - Imagen a configurar");
  };

  const handleMenuTipos = () => {
    setSelectedMenu("tipos");
    // Aquí más adelante mostraremos la imagen correspondiente
    alert("Menu Tipos - Imagen a configurar");
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      width: "100vw",
      background: "linear-gradient(135deg, #eef6ee 0%, #f0f9f0 100%)",
      padding: "24px",
      boxSizing: "border-box"
    }}>
      {/* Header */}
      <div className="card" style={{ marginBottom: "24px", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="title">🍽️ Tipo de Dieta</div>
            <div className="subtitle">Selecciona el tipo de menú para visualizar</div>
          </div>
          <button className="btn ghost" onClick={() => navigate("/admin")}>
            ← Volver al panel
          </button>
        </div>
      </div>

      {/* Botones principales */}
      <div className="card" style={{ padding: "32px" }}>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
            gap: "24px",
            marginBottom: "32px"
          }}>
            {/* Botón Menu Sencillo */}
            <button
              onClick={handleMenuSencillo}
              style={{
                padding: "32px 24px",
                borderRadius: "12px",
                border: selectedMenu === "sencillo" ? "3px solid #16a34a" : "2px solid #e2e8f0",
                background: selectedMenu === "sencillo" ? "rgba(22,163,74,0.08)" : "white",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "center",
                fontSize: "18px",
                fontWeight: "600",
                color: "#064e3b",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📋</div>
              <div>Menu Sencillo</div>
            </button>

            {/* Botón Menu Tipos */}
            <button
              onClick={handleMenuTipos}
              style={{
                padding: "32px 24px",
                borderRadius: "12px",
                border: selectedMenu === "tipos" ? "3px solid #16a34a" : "2px solid #e2e8f0",
                background: selectedMenu === "tipos" ? "rgba(22,163,74,0.08)" : "white",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "center",
                fontSize: "18px",
                fontWeight: "600",
                color: "#064e3b",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>🍱</div>
              <div>Menu Tipos</div>
            </button>
          </div>

          {/* Área para mostrar la imagen seleccionada (placeholder) */}
          {selectedMenu && (
            <div style={{
              marginTop: "32px",
              padding: "24px",
              background: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              textAlign: "center"
            }}>
              <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
                {selectedMenu === "sencillo" ? "Menu Sencillo seleccionado" : "Menu Tipos seleccionado"}
              </p>
              <div style={{
                minHeight: "300px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "white",
                borderRadius: "6px",
                border: "1px dashed #cbd5e1"
              }}>
                <p style={{ color: "#94a3b8" }}>Imagen del menú se mostrará aquí</p>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
