import React, { useState, useEffect } from "react";
import { doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "../Firebase";
import "./estilos.css";

/**
 * AdminPagos.js
 * 
 * Componente para gestión de pagos de usuarios (solo visible para admin)
 * 
 * Funcionalidades:
 * - Registrar pagos: marcar primera visita (solo una vez), seguimientos, tablas, otros
 * - Visualizar tabla de pagos: realizados, pendientes, totales
 * - Las tarifas se configuran globalmente desde AdminPagosGlobal
 */

export default function AdminPagos({ userId, userData }) {
  // Configuración de tarifas globales (se cargan desde settings)
  const [tarifas, setTarifas] = useState({
    primeraVisita: 0,
    seguimiento: 0,
    tablaEjercicios: 0,
    otros: [],
  });

  // Estado para nuevo pago
  const [nuevoPago, setNuevoPago] = useState({
    tipo: "",
    concepto: "",
    cantidad: 0,
    fecha: new Date().toISOString().slice(0, 10),
    estado: "pagado", // "pagado" o "pendiente"
    notas: "",
  });

  // Lista de pagos existentes
  const [pagos, setPagos] = useState([]);

  // Control de primera visita
  const [primeraVisitaRealizada, setPrimeraVisitaRealizada] = useState(false);

  // Estados de UI
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Cargar tarifas globales
  useEffect(() => {
    const loadTarifasGlobales = async () => {
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
        console.error("Error al cargar tarifas globales:", err);
      }
    };
    loadTarifasGlobales();
  }, []);

  // Cargar pagos del usuario
  useEffect(() => {
    if (userData?.pagos) {
      // Cargar pagos
      if (userData.pagos.registros) {
        setPagos(userData.pagos.registros);
        // Verificar si ya se realizó la primera visita
        const tieneprimeraVisita = userData.pagos.registros.some(
          (p) => p.tipo === "primeraVisita"
        );
        setPrimeraVisitaRealizada(tieneprimeraVisita);
      }
    }
  }, [userData]);

  // Registrar nuevo pago
  const handleRegistrarPago = async () => {
    if (!userId) return;
    if (!nuevoPago.tipo) {
      setError("❌ Selecciona el tipo de pago");
      return;
    }

    // Validación: si es primera visita y ya se realizó
    if (nuevoPago.tipo === "primeraVisita" && primeraVisitaRealizada) {
      setError("❌ La primera visita ya fue registrada");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Determinar la cantidad según el tipo
      let cantidad = nuevoPago.cantidad;
      let concepto = nuevoPago.concepto;

      if (nuevoPago.tipo === "primeraVisita") {
        cantidad = tarifas.primeraVisita;
        concepto = "Primera visita";
      } else if (nuevoPago.tipo === "seguimiento") {
        cantidad = tarifas.seguimiento;
        concepto = "Seguimiento";
      } else if (nuevoPago.tipo === "tablaEjercicios") {
        cantidad = tarifas.tablaEjercicios;
        concepto = "Tabla de ejercicios";
      } else if (nuevoPago.tipo === "otro") {
        // Para "otros", usar el concepto y cantidad personalizados
        if (!concepto.trim() || cantidad <= 0) {
          setError("❌ Introduce un concepto y cantidad válida para 'Otros'");
          setSaving(false);
          return;
        }
      }

      const pagoData = {
        tipo: nuevoPago.tipo,
        concepto: concepto,
        cantidad: parseFloat(cantidad),
        fecha: nuevoPago.fecha,
        estado: nuevoPago.estado,
        notas: nuevoPago.notas,
        timestamp: new Date().toISOString(),
      };

      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        "pagos.registros": arrayUnion(pagoData),
      });

      // Actualizar estado local
      setPagos([...pagos, pagoData]);
      if (nuevoPago.tipo === "primeraVisita") {
        setPrimeraVisitaRealizada(true);
      }

      // Resetear formulario
      setNuevoPago({
        tipo: "",
        concepto: "",
        cantidad: 0,
        fecha: new Date().toISOString().slice(0, 10),
        estado: "pagado",
        notas: "",
      });

      setSuccess("✅ Pago registrado correctamente");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error al registrar pago:", err);
      setError("❌ Error al registrar el pago: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Calcular totales
  const calcularTotales = () => {
    const totalPagado = pagos
      .filter((p) => p.estado === "pagado")
      .reduce((sum, p) => sum + p.cantidad, 0);
    const totalPendiente = pagos
      .filter((p) => p.estado === "pendiente")
      .reduce((sum, p) => sum + p.cantidad, 0);
    const total = totalPagado + totalPendiente;
    return { totalPagado, totalPendiente, total };
  };

  const { totalPagado, totalPendiente, total } = calcularTotales();

  // Marcar pago como pagado/pendiente
  const handleCambiarEstado = async (index, nuevoEstado) => {
    if (!userId) return;
    setSaving(true);
    setError(null);

    try {
      const nuevosPagos = [...pagos];
      nuevosPagos[index].estado = nuevoEstado;

      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        "pagos.registros": nuevosPagos,
      });

      setPagos(nuevosPagos);
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
  const handleEliminarPago = async (index) => {
    if (!window.confirm("¿Estás seguro de eliminar este pago?")) return;

    setSaving(true);
    setError(null);

    try {
      const nuevosPagos = pagos.filter((_, i) => i !== index);
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        "pagos.registros": nuevosPagos,
      });

      setPagos(nuevosPagos);
      
      // Si se elimina la primera visita, permitir registrarla de nuevo
      const tieneprimeraVisita = nuevosPagos.some(
        (p) => p.tipo === "primeraVisita"
      );
      setPrimeraVisitaRealizada(tieneprimeraVisita);

      setSuccess("✅ Pago eliminado");
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error("Error al eliminar pago:", err);
      setError("❌ Error al eliminar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "20px", color: "#16a34a" }}>💰 Gestión de Pagos</h2>

      {/* Mensajes de error y éxito */}
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

      {/* Sección 1: Registrar nuevo pago */}
      <div
        style={{
          background: "#f9fafb",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "24px",
          border: "1px solid #e5e7eb",
        }}
      >
        <h3 style={{ marginBottom: "16px" }}>� Registrar Pago</h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          {/* Tipo de pago */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "14px" }}>
              Tipo de pago *
            </label>
            <select
              className="input"
              value={nuevoPago.tipo}
              onChange={(e) => {
                const tipo = e.target.value;
                let cantidad = 0;
                let concepto = "";

                if (tipo === "primeraVisita") {
                  cantidad = tarifas.primeraVisita;
                  concepto = "Primera visita";
                } else if (tipo === "seguimiento") {
                  cantidad = tarifas.seguimiento;
                  concepto = "Seguimiento";
                } else if (tipo === "tablaEjercicios") {
                  cantidad = tarifas.tablaEjercicios;
                  concepto = "Tabla de ejercicios";
                }

                setNuevoPago({ ...nuevoPago, tipo, cantidad, concepto });
              }}
            >
              <option value="">-- Seleccionar --</option>
              <option value="primeraVisita" disabled={primeraVisitaRealizada}>
                Primera visita {primeraVisitaRealizada ? "(ya registrada)" : ""}
              </option>
              <option value="seguimiento">Seguimiento</option>
              <option value="tablaEjercicios">Tabla de ejercicios</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          {/* Cantidad */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "14px" }}>
              Cantidad (€) *
            </label>
            <input
              type="number"
              className="input"
              value={nuevoPago.cantidad}
              onChange={(e) => setNuevoPago({ ...nuevoPago, cantidad: parseFloat(e.target.value) || 0 })}
              min="0"
              step="0.01"
              disabled={nuevoPago.tipo !== "otro"}
            />
          </div>

          {/* Fecha */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "14px" }}>
              Fecha *
            </label>
            <input
              type="date"
              className="input"
              value={nuevoPago.fecha}
              onChange={(e) => setNuevoPago({ ...nuevoPago, fecha: e.target.value })}
            />
          </div>

          {/* Estado */}
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "14px" }}>
              Estado *
            </label>
            <select
              className="input"
              value={nuevoPago.estado}
              onChange={(e) => setNuevoPago({ ...nuevoPago, estado: e.target.value })}
            >
              <option value="pagado">✅ Pagado</option>
              <option value="pendiente">⏳ Pendiente</option>
            </select>
          </div>
        </div>

        {/* Concepto (solo si es "otro") */}
        {nuevoPago.tipo === "otro" && (
          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "14px" }}>
              Concepto *
            </label>
            <input
              type="text"
              className="input"
              placeholder="Describe el concepto del pago"
              value={nuevoPago.concepto}
              onChange={(e) => setNuevoPago({ ...nuevoPago, concepto: e.target.value })}
            />
          </div>
        )}

        {/* Notas */}
        <div style={{ marginTop: "16px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "14px" }}>
            Notas (opcional)
          </label>
          <textarea
            className="input"
            rows="3"
            placeholder="Añade notas adicionales sobre este pago..."
            value={nuevoPago.notas}
            onChange={(e) => setNuevoPago({ ...nuevoPago, notas: e.target.value })}
          />
        </div>

        <button
          className="btn primary"
          onClick={handleRegistrarPago}
          disabled={saving || !nuevoPago.tipo}
          style={{ marginTop: "16px" }}
        >
          {saving ? "Registrando..." : "✅ Registrar Pago"}
        </button>
      </div>

      {/* Sección 2: Tabla de pagos */}
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
        }}
      >
        <h3 style={{ marginBottom: "16px" }}>📊 Historial de Pagos</h3>

        {/* Resumen de totales */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
            padding: "16px",
            background: "#f9fafb",
            borderRadius: "6px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Total</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#16a34a" }}>
              {total.toFixed(2)} €
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Pagado</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#059669" }}>
              {totalPagado.toFixed(2)} €
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Pendiente</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#dc2626" }}>
              {totalPendiente.toFixed(2)} €
            </div>
          </div>
        </div>

        {/* Tabla de pagos */}
        {pagos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
            No hay pagos registrados todavía.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #e5e7eb" }}>
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
                  <th style={{ padding: "12px", textAlign: "center", fontSize: "14px", fontWeight: "600" }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((pago, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                      background: pago.estado === "pendiente" ? "#fef2f2" : "white",
                    }}
                  >
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
                        onChange={(e) => handleCambiarEstado(index, e.target.value)}
                        disabled={saving}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: "1px solid #e5e7eb",
                          fontSize: "13px",
                          background: pago.estado === "pagado" ? "#d1fae5" : "#fee2e2",
                          color: pago.estado === "pagado" ? "#065f46" : "#991b1b",
                          fontWeight: "600",
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
                        onClick={() => handleEliminarPago(index)}
                        disabled={saving}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#dc2626",
                          cursor: "pointer",
                          fontSize: "16px",
                          padding: "4px 8px",
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
  );
}
