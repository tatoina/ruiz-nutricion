import React, { useState, useEffect } from "react";
import { db } from "../Firebase";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useDevice } from "../hooks/useDevice";
import "./estilos.css";

/**
 * AdminPagosGlobal.js
 * 
 * Panel administrativo para gestión global de pagos
 * 
 * Funcionalidades:
 * - Configurar tarifas globales (primera visita, seguimiento, tabla ejercicios, otros)
 * - Ver todos los pagos de todos los usuarios
 * - Filtrar por usuario, estado (pagado/pendiente), rango de fechas
 * - Ver totales generales y por usuario
 */

export default function AdminPagosGlobal() {
  const navigate = useNavigate();
  const { isMobile } = useDevice();
  
  // Tarifas globales
  const [tarifas, setTarifas] = useState({
    primeraVisita: 0,
    seguimiento: 0,
    tablaEjercicios: 0,
    otros: [],
  });
  
  // Estado para el formulario de "otros"
  const [nuevoOtro, setNuevoOtro] = useState({ concepto: "", precio: 0 });
  
  // Todos los pagos de todos los usuarios
  const [todosLosPagos, setTodosLosPagos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  
  // Filtros
  const todayISO = new Date().toISOString().slice(0, 10);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos"); // "todos", "pagado", "pendiente"
  const [filtroFechaDesde, setFiltroFechaDesde] = useState(todayISO);
  const [filtroFechaHasta, setFiltroFechaHasta] = useState(todayISO);
  
  // Estados UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editandoTarifas, setEditandoTarifas] = useState(false);
  const [tarifasColapsadas, setTarifasColapsadas] = useState(true);
  const [filtrosColapsados, setFiltrosColapsados] = useState(isMobile);
  
  // Cargar tarifas globales
  useEffect(() => {
    const loadTarifas = async () => {
      try {
        const settingsRef = doc(db, "settings", "tarifas");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setTarifas({
            primeraVisita: data.primeraVisita || 0,
            seguimiento: data.seguimiento || 0,
            tablaEjercicios: data.tablaEjercicios || 0,
            otros: data.otros || [],
          });
        }
      } catch (err) {
        console.error("Error al cargar tarifas:", err);
        setError("❌ Error al cargar las tarifas: " + err.message);
      }
    };
    loadTarifas();
  }, []);
  
  // Cargar todos los usuarios y sus pagos
  useEffect(() => {
    const loadPagos = async () => {
      try {
        setLoading(true);
        const usersRef = collection(db, "users");
        const usersSnap = await getDocs(usersRef);
        
        const usuariosData = [];
        const pagosData = [];
        
        usersSnap.forEach((userDoc) => {
          const userData = userDoc.data();
          const userId = userDoc.id;
          const nombreCompleto = `${userData.apellidos || ""} ${userData.nombre || ""}`.trim() || userData.email || "Sin nombre";
          
          usuariosData.push({
            id: userId,
            nombre: nombreCompleto,
            email: userData.email,
          });
          
          if (userData.pagos?.registros) {
            userData.pagos.registros.forEach((pago) => {
              pagosData.push({
                ...pago,
                userId: userId,
                userName: nombreCompleto,
                userEmail: userData.email,
              });
            });
          }
        });
        
        // Ordenar usuarios alfabéticamente
        usuariosData.sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        // Ordenar pagos por fecha (más recientes primero)
        pagosData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        setUsuarios(usuariosData);
        setTodosLosPagos(pagosData);
      } catch (err) {
        console.error("Error al cargar pagos:", err);
        setError("❌ Error al cargar los pagos: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    loadPagos();
  }, []);
  
  // Guardar tarifas globales
  const handleGuardarTarifas = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const settingsRef = doc(db, "settings", "tarifas");
      await setDoc(settingsRef, tarifas);
      setSuccess("✅ Tarifas globales actualizadas correctamente");
      setEditandoTarifas(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error al guardar tarifas:", err);
      setError("❌ Error al guardar las tarifas: " + err.message);
    } finally {
      setSaving(false);
    }
  };
  
  // Añadir concepto "otros"
  const handleAñadirOtro = () => {
    if (!nuevoOtro.concepto.trim() || nuevoOtro.precio <= 0) {
      setError("❌ Introduce un concepto y un precio válido");
      setTimeout(() => setError(null), 3000);
      return;
    }
    setTarifas({
      ...tarifas,
      otros: [...tarifas.otros, { ...nuevoOtro }],
    });
    setNuevoOtro({ concepto: "", precio: 0 });
  };
  
  // Eliminar concepto "otros"
  const handleEliminarOtro = (index) => {
    const nuevosOtros = tarifas.otros.filter((_, i) => i !== index);
    setTarifas({ ...tarifas, otros: nuevosOtros });
  };
  
  // Aplicar filtros
  const pagosFiltrados = todosLosPagos.filter((pago) => {
    // Filtro por usuario
    if (filtroUsuario && pago.userId !== filtroUsuario) {
      return false;
    }
    
    // Filtro por estado
    if (filtroEstado !== "todos" && pago.estado !== filtroEstado) {
      return false;
    }
    
    // Filtro por fecha desde
    if (filtroFechaDesde && pago.fecha < filtroFechaDesde) {
      return false;
    }
    
    // Filtro por fecha hasta
    if (filtroFechaHasta && pago.fecha > filtroFechaHasta) {
      return false;
    }
    
    return true;
  });
  
  // Calcular totales
  const calcularTotales = () => {
    const totalPagado = pagosFiltrados
      .filter((p) => p.estado === "pagado")
      .reduce((sum, p) => sum + p.cantidad, 0);
    const totalPendiente = pagosFiltrados
      .filter((p) => p.estado === "pendiente")
      .reduce((sum, p) => sum + p.cantidad, 0);
    const total = totalPagado + totalPendiente;
    return { totalPagado, totalPendiente, total };
  };
  
  const { totalPagado, totalPendiente, total } = calcularTotales();
  
  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltroUsuario("");
    setFiltroEstado("todos");
    setFiltroFechaDesde(todayISO);
    setFiltroFechaHasta(todayISO);
  };
  
  // Cambiar estado de un pago
  const handleCambiarEstadoPago = async (pago, nuevoEstado, e) => {
    e.stopPropagation(); // Evitar que se active el onClick de la fila
    
    if (pago.estado === nuevoEstado) return; // Ya está en ese estado
    
    setSaving(true);
    setError(null);
    
    try {
      // Obtener el documento del usuario
      const userRef = doc(db, "users", pago.userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        throw new Error("Usuario no encontrado");
      }
      
      const userData = userSnap.data();
      const pagosRegistros = userData.pagos?.registros || [];
      
      // Encontrar y actualizar el pago específico
      const pagoIndex = pagosRegistros.findIndex(
        (p) => 
          p.fecha === pago.fecha && 
          p.concepto === pago.concepto && 
          p.cantidad === pago.cantidad &&
          p.timestamp === pago.timestamp
      );
      
      if (pagoIndex === -1) {
        throw new Error("Pago no encontrado en el registro del usuario");
      }
      
      // Actualizar el estado
      pagosRegistros[pagoIndex].estado = nuevoEstado;
      
      // Guardar en Firestore
      await updateDoc(userRef, {
        "pagos.registros": pagosRegistros,
      });
      
      // Actualizar estado local
      setTodosLosPagos((prevPagos) =>
        prevPagos.map((p) =>
          p.userId === pago.userId &&
          p.fecha === pago.fecha &&
          p.concepto === pago.concepto &&
          p.cantidad === pago.cantidad &&
          p.timestamp === pago.timestamp
            ? { ...p, estado: nuevoEstado }
            : p
        )
      );
      
      setSuccess(`✅ Estado actualizado a: ${nuevoEstado}`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      setError("❌ Error al cambiar el estado: " + err.message);
    } finally {
      setSaving(false);
    }
  };
  
  // Eliminar un pago
  const handleEliminarPago = async (pago, e) => {
    e.stopPropagation(); // Evitar que se active el onClick de la fila
    
    const confirmMsg = `¿Estás seguro de eliminar este pago?\n\nUsuario: ${pago.userName}\nConcepto: ${pago.concepto}\nCantidad: ${pago.cantidad.toFixed(2)} €\nFecha: ${new Date(pago.fecha).toLocaleDateString("es-ES")}\n\n⚠️ Esta acción no se puede deshacer.`;
    
    if (!window.confirm(confirmMsg)) {
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      // Obtener el documento del usuario
      const userRef = doc(db, "users", pago.userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        throw new Error("Usuario no encontrado");
      }
      
      const userData = userSnap.data();
      const pagosRegistros = userData.pagos?.registros || [];
      
      // Filtrar para eliminar el pago específico
      const nuevosPagos = pagosRegistros.filter(
        (p) => !(
          p.fecha === pago.fecha && 
          p.concepto === pago.concepto && 
          p.cantidad === pago.cantidad &&
          p.timestamp === pago.timestamp
        )
      );
      
      // Guardar en Firestore
      await updateDoc(userRef, {
        "pagos.registros": nuevosPagos,
      });
      
      // Actualizar estado local
      setTodosLosPagos((prevPagos) =>
        prevPagos.filter((p) => !(
          p.userId === pago.userId &&
          p.fecha === pago.fecha &&
          p.concepto === pago.concepto &&
          p.cantidad === pago.cantidad &&
          p.timestamp === pago.timestamp
        ))
      );
      
      setSuccess("✅ Pago eliminado correctamente");
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error("Error al eliminar pago:", err);
      setError("❌ Error al eliminar el pago: " + err.message);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="admin-fullscreen" style={{ overflowY: "auto", height: "100vh" }}>
      {/* Cabecera */}
      {!isMobile && (
        <div className="card header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="title">💰 Gestión Global de Pagos</div>
            <div className="subtitle">Configuración de tarifas y vista de todos los pagos</div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn ghost" onClick={() => navigate("/admin")}>
              ← Volver al Panel
            </button>
          </div>
        </div>
      )}
      
      <div style={{ padding: isMobile ? "8px" : "20px", width: "100%", flex: 1, overflowY: "auto" }}>
        {/* Mensajes */}
        {error && (
          <div
            style={{
              padding: "12px",
              marginBottom: "16px",
              background: "#fee",
              color: "#c00",
              borderRadius: "6px",
              border: "1px solid #fcc",
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              padding: "12px",
              marginBottom: "16px",
              background: "#efe",
              color: "#060",
              borderRadius: "6px",
              border: "1px solid #cfc",
            }}
          >
            {success}
          </div>
        )}
        
        {/* Configuración de Tarifas Globales */}
        <div
          style={{
            background: "#f9fafb",
            padding: isMobile ? (tarifasColapsadas ? "8px" : "10px") : "20px",
            borderRadius: "8px",
            marginBottom: isMobile ? "10px" : "24px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: tarifasColapsadas ? "0" : (isMobile ? "8px" : "16px") }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={() => setTarifasColapsadas(!tarifasColapsadas)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: isMobile ? "16px" : "20px",
                  padding: "0",
                  display: "flex",
                  alignItems: "center",
                }}
                title={tarifasColapsadas ? "Expandir" : "Colapsar"}
              >
                {tarifasColapsadas ? "▶" : "▼"}
              </button>
              <h3 style={{ margin: 0, fontSize: isMobile ? "13px" : "16px" }}>⚙️ Configuración de Tarifas Globales</h3>
            </div>
            {!tarifasColapsadas && (
              !editandoTarifas ? (
                <button
                  className="btn ghost"
                  onClick={() => setEditandoTarifas(true)}
                  style={{ fontSize: isMobile ? "12px" : "14px", padding: isMobile ? "6px 12px" : "8px 16px" }}
                >
                  ✏️ Editar
                </button>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="btn primary"
                    onClick={handleGuardarTarifas}
                    disabled={saving}
                    style={{ fontSize: isMobile ? "12px" : "14px", padding: isMobile ? "6px 12px" : "8px 16px" }}
                  >
                    {saving ? "Guardando..." : "💾 Guardar"}
                  </button>
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      setEditandoTarifas(false);
                      // Recargar tarifas originales
                      const settingsRef = doc(db, "settings", "tarifas");
                      const settingsSnap = await getDoc(settingsRef);
                      if (settingsSnap.exists()) {
                        const data = settingsSnap.data();
                        setTarifas({
                          primeraVisita: data.primeraVisita || 0,
                          seguimiento: data.seguimiento || 0,
                          tablaEjercicios: data.tablaEjercicios || 0,
                          otros: data.otros || [],
                        });
                      }
                    }}
                  >
                    ✖️ Cancelar
                  </button>
                </div>
              )
            )}
          </div>
          
          {!tarifasColapsadas && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginTop: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "14px" }}>
                    Primera visita (€)
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={tarifas.primeraVisita}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setTarifas({ ...tarifas, primeraVisita: val === "" ? "" : val });
                      }
                    }}
                    onBlur={(e) => {
                      const num = parseFloat(e.target.value) || 0;
                      setTarifas({ ...tarifas, primeraVisita: num });
                    }}
                    disabled={!editandoTarifas}
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "14px" }}>
                    Seguimiento (€)
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={tarifas.seguimiento}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setTarifas({ ...tarifas, seguimiento: val === "" ? "" : val });
                      }
                    }}
                    onBlur={(e) => {
                      const num = parseFloat(e.target.value) || 0;
                      setTarifas({ ...tarifas, seguimiento: num });
                    }}
                    disabled={!editandoTarifas}
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "14px" }}>
                    Tabla de ejercicios (€)
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={tarifas.tablaEjercicios}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setTarifas({ ...tarifas, tablaEjercicios: val === "" ? "" : val });
                      }
                    }}
                    onBlur={(e) => {
                      const num = parseFloat(e.target.value) || 0;
                      setTarifas({ ...tarifas, tablaEjercicios: num });
                    }}
                    disabled={!editandoTarifas}
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              {/* Conceptos "Otros" - siempre visible */}
              <div style={{ marginTop: "20px" }}>
                <h4 style={{ marginBottom: "12px", fontSize: "16px" }}>
                  {editandoTarifas ? "➕ Otras tarifas personalizadas" : "📋 Otras tarifas configuradas"}
                </h4>
                
                {tarifas.otros.length > 0 && (
                  <div style={{ marginBottom: editandoTarifas ? "12px" : "0" }}>
                    {tarifas.otros.map((otro, index) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          background: "white",
                          borderRadius: "4px",
                          marginBottom: "6px",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <span>
                          <strong>{otro.concepto}</strong>: {otro.precio.toFixed(2)} €
                        </span>
                        {editandoTarifas && (
                          <button
                            onClick={() => handleEliminarOtro(index)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#dc2626",
                              cursor: "pointer",
                              fontSize: "18px",
                            }}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {editandoTarifas && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>Concepto</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Ej: Consulta especial, Plan nutricional..."
                        value={nuevoOtro.concepto}
                        onChange={(e) => setNuevoOtro({ ...nuevoOtro, concepto: e.target.value })}
                      />
                    </div>
                    <div style={{ width: "120px" }}>
                      <label style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>Precio (€)</label>
                      <input
                        type="text"
                        className="input"
                        value={nuevoOtro.precio}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setNuevoOtro({ ...nuevoOtro, precio: val === "" ? 0 : parseFloat(val) });
                          }
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <button className="btn primary" onClick={handleAñadirOtro} style={{ whiteSpace: "nowrap" }}>
                      ➕ Añadir Tarifa
                    </button>
                  </div>
                )}
                
                {!editandoTarifas && tarifas.otros.length === 0 && (
                  <p style={{ fontSize: "13px", color: "#999", fontStyle: "italic" }}>
                    No hay tarifas personalizadas configuradas
                  </p>
                )}
              </div>
            </>
          )}
        </div>
        
        {/* Filtros */}
        <div
          style={{
            background: "#f9fafb",
            padding: isMobile ? (filtrosColapsados ? "8px" : "10px") : "20px",
            borderRadius: "8px",
            marginBottom: isMobile ? "10px" : "24px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: filtrosColapsados ? "0" : (isMobile ? "8px" : "16px") }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={() => setFiltrosColapsados(!filtrosColapsados)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: isMobile ? "16px" : "20px",
                  padding: "0",
                  display: "flex",
                  alignItems: "center",
                }}
                title={filtrosColapsados ? "Expandir" : "Colapsar"}
              >
                {filtrosColapsados ? "▶" : "▼"}
              </button>
              <h3 style={{ margin: 0, fontSize: isMobile ? "13px" : "16px" }}>🔍 Filtros</h3>
            </div>
          </div>
          
          {!filtrosColapsados && (
            <>
              <div style={{ display: isMobile ? "flex" : "grid", flexDirection: isMobile ? "column" : undefined, gridTemplateColumns: isMobile ? undefined : "repeat(auto-fit, minmax(200px, 1fr))", gap: isMobile ? "8px" : "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: isMobile ? "12px" : "14px" }}>
                    Usuario
                  </label>
                  <select
                    className="input"
                    value={filtroUsuario}
                    onChange={(e) => setFiltroUsuario(e.target.value)}
                    style={{ fontSize: isMobile ? "14px" : "16px", padding: isMobile ? "6px" : "8px" }}
                  >
                    <option value="">Todos los usuarios</option>
                    {usuarios.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: isMobile ? "12px" : "14px" }}>
                    Estado
                  </label>
                  <select
                    className="input"
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    style={{ fontSize: isMobile ? "14px" : "16px", padding: isMobile ? "6px" : "8px" }}
                  >
                    <option value="todos">Todos</option>
                    <option value="pagado">✅ Pagado</option>
                    <option value="pendiente">⏳ Pendiente</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: isMobile ? "12px" : "14px" }}>
                    Desde
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={filtroFechaDesde}
                    onChange={(e) => setFiltroFechaDesde(e.target.value)}
                    style={{ fontSize: isMobile ? "14px" : "16px", padding: isMobile ? "6px" : "8px" }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: isMobile ? "12px" : "14px" }}>
                    Hasta
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={filtroFechaHasta}
                    onChange={(e) => setFiltroFechaHasta(e.target.value)}
                    style={{ fontSize: isMobile ? "14px" : "16px", padding: isMobile ? "6px" : "8px" }}
                  />
                </div>
              </div>
              
              <div style={{ marginTop: isMobile ? "8px" : "16px" }}>
                <button className="btn ghost" onClick={limpiarFiltros} style={{ fontSize: isMobile ? "12px" : "14px", padding: isMobile ? "6px 12px" : "8px 16px" }}>
                  ✖️ Limpiar filtros
                </button>
              </div>
            </>
          )}
        </div>
        
        {/* Resumen de Totales */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "2px solid #16a34a", textAlign: "center" }}>
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>Total</div>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: "#16a34a" }}>
              {total.toFixed(2)} €
            </div>
            <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
              {pagosFiltrados.length} pagos
            </div>
          </div>
          
          <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "2px solid #059669", textAlign: "center" }}>
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>Pagado</div>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: "#059669" }}>
              {totalPagado.toFixed(2)} €
            </div>
            <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
              {pagosFiltrados.filter(p => p.estado === "pagado").length} pagos
            </div>
          </div>
          
          <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "2px solid #dc2626", textAlign: "center" }}>
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>Pendiente</div>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: "#dc2626" }}>
              {totalPendiente.toFixed(2)} €
            </div>
            <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
              {pagosFiltrados.filter(p => p.estado === "pendiente").length} pagos
            </div>
          </div>
        </div>
        
        {/* Tabla de Pagos */}
        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
          }}
        >
          <h3 style={{ marginBottom: "16px" }}>📊 Historial de Pagos</h3>
          
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
              Cargando pagos...
            </div>
          ) : pagosFiltrados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
              No se encontraron pagos con los filtros aplicados.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: "12px", textAlign: "left", fontSize: "14px", fontWeight: "600" }}>
                      Usuario
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", fontSize: "14px", fontWeight: "600" }}>
                      Fecha
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", fontSize: "14px", fontWeight: "600" }}>
                      Concepto
                    </th>
                    <th style={{ padding: "12px", textAlign: "right", fontSize: "14px", fontWeight: "600" }}>
                      Cantidad
                    </th>
                    <th style={{ padding: "12px", textAlign: "center", fontSize: "14px", fontWeight: "600" }}>
                      Estado
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", fontSize: "14px", fontWeight: "600" }}>
                      Notas
                    </th>
                    <th style={{ padding: "12px", textAlign: "center", fontSize: "14px", fontWeight: "600", width: "80px" }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagosFiltrados.map((pago, index) => (
                    <tr
                      key={index}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        background: pago.estado === "pendiente" ? "#fef2f2" : "white",
                        cursor: "pointer",
                      }}
                      onClick={() => navigate(`/admin`)}
                      title="Clic para ver la ficha del usuario"
                    >
                      <td style={{ padding: "12px", fontSize: "14px" }}>
                        <div style={{ fontWeight: "600" }}>{pago.userName}</div>
                        <div style={{ fontSize: "12px", color: "#666" }}>{pago.userEmail}</div>
                      </td>
                      <td style={{ padding: "12px", fontSize: "14px" }}>
                        {new Date(pago.fecha).toLocaleDateString("es-ES")}
                      </td>
                      <td style={{ padding: "12px", fontSize: "14px" }}>
                        <strong>{pago.concepto}</strong>
                        {pago.tipo === "primeraVisita" && (
                          <span style={{ marginLeft: "6px", fontSize: "12px", color: "#16a34a" }}>⭐</span>
                        )}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", fontSize: "14px", fontWeight: "600" }}>
                        {pago.cantidad.toFixed(2)} €
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <select
                          value={pago.estado}
                          onChange={(e) => handleCambiarEstadoPago(pago, e.target.value, e)}
                          disabled={saving}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "12px",
                            border: "1px solid #e5e7eb",
                            fontSize: "13px",
                            background: pago.estado === "pagado" ? "#d1fae5" : "#fee2e2",
                            color: pago.estado === "pagado" ? "#065f46" : "#991b1b",
                            fontWeight: "600",
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          <option value="pagado">✅ Pagado</option>
                          <option value="pendiente">⏳ Pendiente</option>
                        </select>
                      </td>
                      <td style={{ padding: "12px", fontSize: "13px", color: "#666" }}>
                        {pago.notas || "-"}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <button
                          onClick={(e) => handleEliminarPago(pago, e)}
                          disabled={saving}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#dc2626",
                            cursor: "pointer",
                            fontSize: "18px",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(220, 38, 38, 0.1)";
                            e.currentTarget.style.transform = "scale(1.1)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                          title="Eliminar pago"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
