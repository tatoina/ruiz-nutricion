import React, { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// Usa la URL de tu Apps Script:
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzahXBEkJ1kcc74eDfcxj-YI4u51VRf3AfIvxtU7agk5448tpHy83jEgi95QuDBbXa3/exec";

async function fetchData(action, payload) {
  const params = new URLSearchParams({ action, ...payload });
  const response = await fetch(
    SCRIPT_URL,
    {
      method: "POST",
      body: params,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );
  return response.json();
}

const BASE_TABS = [
  { id: 0, label: "Datos personales" },
  { id: 1, label: "Datos de dieta" },
  { id: 2, label: "Datos de pesaje" },
  { id: 3, label: "Dieta actual" }
];

const DIAS_SEMANA = [
  "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"
];

function getTodayTabIndex() {
  const day = (new Date()).getDay();
  if (day === 0) return 6;
  return day - 1;
}

export default function FichaUsuario({ email }) {
  const [usuario, setUsuario] = useState(null);
  const [tab, setTab] = useState(0);
  const [msg, setMsg] = useState("");
  const [tabDia, setTabDia] = useState(getTodayTabIndex());
  const [mostrarGrafico, setMostrarGrafico] = useState(false);
  const [nuevoPesaje, setNuevoPesaje] = useState({
    fecha: "",
    peso: "",
    medidasPecho: "",
    medidasEstomago: "",
    medidasCintura: ""
  });

  useEffect(() => {
    fetchData("getUser", { email }).then((res) => {
      if (res.ok) setUsuario(res.data);
      else setMsg("No se encontró el usuario.");
    });
  }, [email]);

  if (!usuario) return <div>Cargando...</div>;

  const tieneEjercicios = (usuario.ejercicios || "").trim().toLowerCase() === "si";
  const tieneRecetas = (usuario.recetas || "").trim().toLowerCase() === "si";
  let customTabs = [...BASE_TABS];
  if (tieneEjercicios) customTabs.push({ id: 4, label: "Ejercicios" });
  if (tieneRecetas) customTabs.push({ id: 5, label: "Recetas" });

  function handleChange(e) {
    setUsuario({ ...usuario, [e.target.name]: e.target.value });
  }

  async function handleSave(donde) {
    const { contraseña, ...resto } = usuario;
    const res = await fetchData("updateUser", { ...resto, email: usuario.email });
    setMsg(res.ok ? "Cambios guardados." : "Error al guardar.");
    if (donde === "pesaje") {
      fetchData("getUser", { email: usuario.email }).then((res) => {
        if (res.ok) setUsuario(res.data);
      });
    }
  }

  function handleNuevoPesajeChange(e) {
    setNuevoPesaje({ ...nuevoPesaje, [e.target.name]: e.target.value });
  }

  async function handleAddPesaje(e) {
    e.preventDefault();
    if (!nuevoPesaje.fecha || !nuevoPesaje.peso) {
      setMsg("Completa al menos la fecha y el peso.");
      return;
    }
    const pesajes = Array.isArray(usuario.pesoHistorico) ? usuario.pesoHistorico : [];
    const nuevo = {
      fecha: nuevoPesaje.fecha,
      peso: nuevoPesaje.peso,
      medidasPecho: nuevoPesaje.medidasPecho,
      medidasEstomago: nuevoPesaje.medidasEstomago,
      medidasCintura: nuevoPesaje.medidasCintura
    };
    const nuevoHistorial = [...pesajes, nuevo];
    setUsuario({ ...usuario, pesoHistorico: nuevoHistorial, pesoActual: nuevoPesaje.peso });
    setNuevoPesaje({ fecha: "", peso: "", medidasPecho: "", medidasEstomago: "", medidasCintura: "" });
    const { contraseña, ...resto } = usuario;
    await fetchData("updateUser", {
      ...resto,
      pesoHistorico: JSON.stringify(nuevoHistorial),
      pesoActual: nuevoPesaje.peso,
      email: usuario.email,
    });
    setMsg("Nuevo registro de pesaje añadido.");
    fetchData("getUser", { email: usuario.email }).then((res) => {
      if (res.ok) setUsuario(res.data);
    });
  }

  const ejerciciosDriveLink = "https://drive.google.com/drive/folders/1EN-1h1VcV4K4kG2JgmRpxFSY-izas-9c?usp=sharing";
  const recetasDriveLink = "https://drive.google.com/drive/folders/1FBwJtFBj0gWr0W9asHdGrkR7Q1FzkKK3?usp=sharing";

  const datosGrafico = Array.isArray(usuario.pesoHistorico)
    ? usuario.pesoHistorico
        .filter(item => item.fecha && item.peso)
        .map(p => ({ fecha: p.fecha, peso: parseFloat(p.peso) }))
    : [];

  return (
    <>
      <div className="tabs">
        {customTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={tab === t.id ? "tab tab-active" : "tab"}
          >
            {t.label}
          </button>
        ))}
      </div>
      {msg && <div className="mensaje">{msg}</div>}

      {tab === 0 && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleSave("personales"); }}
        >
          <label>Nombre:
            <input name="nombre" value={usuario.nombre} onChange={handleChange} required />
          </label>
          <label>Apellidos:
            <input name="apellidos" value={usuario.apellidos} onChange={handleChange} />
          </label>
          <label>Email:
            <input name="email" value={usuario.email} readOnly disabled />
          </label>
          <label>Fecha de nacimiento:
            <input name="nacimiento" type="date" value={usuario.nacimiento} onChange={handleChange} />
          </label>
          <button type="submit" className="btn">Guardar</button>
        </form>
      )}

      {tab === 1 && (
        <form
          className="form-ficha-usuario"
          onSubmit={(e) => { e.preventDefault(); handleSave("dieta"); }}
        >
          <label>Objetivo nutricional:
            <input name="objetivoNutricional" value={usuario.objetivoNutricional} onChange={handleChange} />
          </label>
          <label>Restricciones/alergias:
            <input name="restricciones" value={usuario.restricciones} onChange={handleChange} />
          </label>
          <label>Observaciones dieta:
            <input name="observacionesDieta" value={usuario.observacionesDieta} onChange={handleChange} />
          </label>
          <label>Tipo de dieta:
            <input name="tipoDieta" value={usuario.tipoDieta} onChange={handleChange} />
          </label>
          <label htmlFor="ejercicios">¿Ver pestaña Ejercicios?</label>
          <select
            id="ejercicios"
            name="ejercicios"
            value={usuario.ejercicios || "no"}
            onChange={handleChange}
          >
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
          <label htmlFor="recetas">¿Ver pestaña Recetas?</label>
          <select
            id="recetas"
            name="recetas"
            value={usuario.recetas || "no"}
            onChange={handleChange}
          >
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
          <button type="submit" className="btn">Guardar</button>
        </form>
      )}

      {tab === 2 && (
        <div>
          <form onSubmit={handleAddPesaje}>
            <strong>Nuevo registro de pesaje:</strong>
            <label>Fecha:
              <input name="fecha" type="date" value={nuevoPesaje.fecha} onChange={handleNuevoPesajeChange} required />
            </label>
            <label>Peso (kg):
              <input name="peso" type="number" step="0.1" value={nuevoPesaje.peso} onChange={handleNuevoPesajeChange} required />
            </label>
            <label>Medidas pecho (cm):
              <input name="medidasPecho" value={nuevoPesaje.medidasPecho} onChange={handleNuevoPesajeChange} />
            </label>
            <label>Medidas estómago (cm):
              <input name="medidasEstomago" value={nuevoPesaje.medidasEstomago} onChange={handleNuevoPesajeChange} />
            </label>
            <label>Medidas cintura (cm):
              <input name="medidasCintura" value={nuevoPesaje.medidasCintura} onChange={handleNuevoPesajeChange} />
            </label>
            <button type="submit" className="btn">Añadir pesaje</button>
          </form>

          <strong>Histórico de pesaje:</strong>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Peso (kg)</th>
                <th>Pecho (cm)</th>
                <th>Estómago (cm)</th>
                <th>Cintura (cm)</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(usuario.pesoHistorico) && usuario.pesoHistorico.length > 0 ? (
                usuario.pesoHistorico.map((item, i) => (
                  <tr key={i}>
                    <td>{item.fecha}</td>
                    <td>{item.peso}</td>
                    <td>{item.medidasPecho || ""}</td>
                    <td>{item.medidasEstomago || ""}</td>
                    <td>{item.medidasCintura || ""}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>Sin datos aún.</td>
                </tr>
              )}
            </tbody>
          </table>

          <button
            type="button"
            className="btn"
            style={{ marginBottom: 15 }}
            onClick={() => setMostrarGrafico(!mostrarGrafico)}
          >
            {mostrarGrafico ? "Ocultar gráfico de tendencias" : "Ver gráfico de tendencias"}
          </button>

          {mostrarGrafico && (
            <ResponsiveContainer width="99%" height={260}>
              <LineChart data={datosGrafico}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis
                  unit=" kg"
                  domain={[50, 140]}
                  ticks={[
                    50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
                    100, 105, 110, 115, 120, 125, 130, 135, 140
                  ]}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="peso"
                  stroke="#89e03e"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          <div>
            <strong>Peso actual:</strong> {usuario.pesoActual || "No registrado"}
          </div>
        </div>
      )}

      {tab === 3 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <button
              type="button"
              className="btn nav-dia"
              style={{ marginRight: 16 }}
              onClick={() => setTabDia((prev) => (prev - 1 + 7) % 7)}
            >{"<"}</button>
            <div style={{
              minWidth: 320,
              textAlign: "left",
              background: "#f4f4f4",
              borderRadius: 6,
              padding: "12px 28px",
              boxShadow: "0 2px 6px #eee",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start"
            }}>
              <h3 style={{ margin: "0 0 14px 0", textAlign: "left" }}>
                Menú para {DIAS_SEMANA[tabDia].charAt(0).toUpperCase() + DIAS_SEMANA[tabDia].slice(1)}
              </h3>
              {usuario.dietaActual && usuario.dietaActual[DIAS_SEMANA[tabDia]] ? (
                <table style={{ width: "100%", margin: "0", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: "bold", textAlign: "left", padding: "8px 16px 8px 0", width: "120px" }}>Desayuno:</td>
                      <td style={{ textAlign: "left", padding: "8px 0" }}>{usuario.dietaActual[DIAS_SEMANA[tabDia]].desayuno || "No definido"}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold", textAlign: "left", padding: "8px 16px 8px 0" }}>Almuerzo:</td>
                      <td style={{ textAlign: "left", padding: "8px 0" }}>{usuario.dietaActual[DIAS_SEMANA[tabDia]].almuerzo || "No definido"}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold", textAlign: "left", padding: "8px 16px 8px 0" }}>Comida:</td>
                      <td style={{ textAlign: "left", padding: "8px 0" }}>{usuario.dietaActual[DIAS_SEMANA[tabDia]].comida || "No definido"}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold", textAlign: "left", padding: "8px 16px 8px 0" }}>Cena:</td>
                      <td style={{ textAlign: "left", padding: "8px 0" }}>{usuario.dietaActual[DIAS_SEMANA[tabDia]].cena || "No definido"}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div>No hay dieta definida para este día.</div>
              )}
            </div>
            <button
              type="button"
              className="btn nav-dia"
              style={{ marginLeft: 16 }}
              onClick={() => setTabDia((prev) => (prev + 1) % 7)}
            >{">"}</button>
          </div>
        </div>
      )}

      {tab === 4 && tieneEjercicios && (
        <div>
          <h2>Ejercicios</h2>
          <a
            href={ejerciciosDriveLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver recursos de ejercicios
          </a>
        </div>
      )}

      {tab === 5 && tieneRecetas && (
        <div>
          <h2>Recetas</h2>
          <a
            href={recetasDriveLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver recursos de recetas
          </a>
        </div>
      )}
    </>
  );
}
