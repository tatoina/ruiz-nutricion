import React, { useState, useEffect } from "react";

async function fetchData(action, payload) {
  const params = new URLSearchParams({ action, ...payload });
  const response = await fetch(
    "https://script.google.com/macros/s/AKfycbw1kn_hJ-UBaa1Y8mLJShVlVpsGEEhcfzdSyM7X3lY3rWTBEZadoYV4S8nGLiPh98hn/exec",
    {
      method: "POST",
      body: params,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );
  return response.json();
}

const TABS = [
  { id: 0, label: "Datos personales" },
  { id: 1, label: "Datos de dieta" },
  { id: 2, label: "Datos de pesaje" },
];

export default function FichaUsuario({ email }) {
  const [usuario, setUsuario] = useState(null);
  const [tab, setTab] = useState(0);
  const [msg, setMsg] = useState("");
  const [nuevoPesaje, setNuevoPesaje] = useState({
    fecha: "",
    peso: "",
    medidas: "",
  });

  useEffect(() => {
    fetchData("getUser", { email }).then((res) => {
      if (res.ok) setUsuario(res.data);
      else setMsg("No se encontró el usuario.");
    });
  }, [email]);

  if (!usuario) return <div>Cargando...</div>;

  function handleChange(e) {
    setUsuario({ ...usuario, [e.target.name]: e.target.value });
  }

  async function handleSave(donde) {
    const res = await fetchData("updateUser", { ...usuario, email: usuario.email });
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
      medidas: nuevoPesaje.medidas,
    };
    const nuevoHistorial = [...pesajes, nuevo];
    setUsuario({ ...usuario, pesoHistorico: nuevoHistorial, pesoActual: nuevoPesaje.peso });
    setNuevoPesaje({ fecha: "", peso: "", medidas: "" });
    await fetchData("updateUser", {
      ...usuario,
      pesoHistorico: JSON.stringify(nuevoHistorial),
      pesoActual: nuevoPesaje.peso,
      email: usuario.email,
    });
    setMsg("Nuevo registro de pesaje añadido.");
    fetchData("getUser", { email: usuario.email }).then((res) => {
      if (res.ok) setUsuario(res.data);
    });
  }

  return (
    <>
      <div className="tabs">
        {TABS.map((t) => (
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
            <label>Medidas (cm o texto):
              <input name="medidas" value={nuevoPesaje.medidas} onChange={handleNuevoPesajeChange} />
            </label>
            <button type="submit" className="btn">Añadir pesaje</button>
          </form>
          <strong>Histórico de pesaje:</strong>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Peso (kg)</th>
                <th>Medidas</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(usuario.pesoHistorico) && usuario.pesoHistorico.length > 0 ? (
                usuario.pesoHistorico.map((item, i) => (
                  <tr key={i}>
                    <td>{item.fecha}</td>
                    <td>{item.peso}</td>
                    <td>{item.medidas}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>Sin datos aún.</td>
                </tr>
              )}
            </tbody>
          </table>
          <div>
            <strong>Peso actual:</strong> {usuario.pesoActual || "No registrado"}
          </div>
        </div>
      )}
    </>
  );
}
