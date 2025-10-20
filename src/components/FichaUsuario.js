import React, { useEffect, useState } from "react";
import "./estilos.css";
import { auth, db } from "../Firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import DriveFolderViewer from "./DriveFolderViewer";
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

/**
 * FichaUsuario.jsx
 *
 * - targetUid: si se pasa, carga/edita la ficha de ese usuario (modo admin).
 * - adminMode: si true muestra indicación de admin.
 *
 * Modificado: en la pestaña "Dieta semanal" se muestra ahora un editor
 * diario con dos columnas:
 *  - izquierda: columna fija con las etiquetas (Desayuno, Almuerzo, Comida, Merienda, Cena, Consejos)
 *  - derecha: columna editable con textarea para cada etiqueta, alineadas por fila.
 *
 * Mantiene compatibilidad con el formato antiguo y el guardado en Firestore.
 */

export default function FichaUsuario({ targetUid = null, adminMode = false }) {
  const tabs = [
    { id: "personales", label: "Personales" },
    { id: "dieta", label: "Dieta" },
    { id: "pesaje", label: "Pesaje" },
    { id: "semana", label: "Dieta semanal" },
    { id: "ejercicios", label: "Ejercicios" },
    { id: "recetas", label: "Recetas" },
  ];

  const dietaOptions = [
    { value: "perdida_grasa", label: "Pérdida de grasa" },
    { value: "antiinflamatoria", label: "Antiinflamatoria" },
    { value: "ganancia_muscular", label: "Ganancia muscular" },
    { value: "aprendiendo_a_comer", label: "Aprendiendo a comer" },
    { value: "otros", label: "Otros" },
  ];

  const MEALS = [
    { key: "desayuno", label: "Desayuno" },
    { key: "almuerzo", label: "Almuerzo" },
    { key: "comida", label: "Comida" },
    { key: "merienda", label: "Merienda" },
    { key: "cena", label: "Cena" },
  ];

  const ALL_SECTIONS = [...MEALS, { key: "consejos", label: "Consejos del día" }];

  const DRIVE_FOLDER_EXERCISES = "1EN-1h1VcV4K4kG2JgmRpxFSY-izas-9c";
  const DRIVE_FOLDER_RECIPES = "1FBwJtFBj0gWr0W9asHdGrkR7Q1FzkKK3";

  const [authUser, setAuthUser] = useState(null);
  const [authUid, setAuthUid] = useState(null);
  const [userData, setUserData] = useState(null);
  const [editable, setEditable] = useState({});
  const [loading, setLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const [error, setError] = useState(null);

  const [peso, setPeso] = useState("");
  const todayISO = new Date().toISOString().slice(0, 10);
  const [fechaPeso, setFechaPeso] = useState(() => todayISO);
  const [savingPeso, setSavingPeso] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthUid(u ? u.uid : null);
    });
    return () => unsub();
  }, []);

  const uid = targetUid || authUid;

  const timestampToMs = (t) => {
    if (!t) return null;
    if (typeof t === "number") return t;
    if (t?.seconds != null) return t.seconds * 1000 + (t.nanoseconds ? Math.floor(t.nanoseconds / 1e6) : 0);
    if (typeof t?.toDate === "function") return t.toDate().getTime();
    return null;
  };

  // Helper: create an empty menu object for a day
  const emptyDayMenu = () => ({
    desayuno: "",
    almuerzo: "",
    comida: "",
    merienda: "",
    cena: "",
    consejos: "",
  });

  // Normalize menu data: support legacy array of strings or array of objects
  const normalizeMenu = (rawMenu) => {
    const defaultMenu = Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
    if (!Array.isArray(rawMenu)) return defaultMenu;
    // If items are strings => treat as 'comida' (legacy)
    const isStringArray = rawMenu.every((it) => typeof it === "string" || it == null);
    if (isStringArray) {
      return Array.from({ length: 7 }, (_, i) => {
        const val = rawMenu[i] || "";
        return { ...emptyDayMenu(), comida: val };
      });
    }
    // If items are objects, ensure fields exist
    return Array.from({ length: 7 }, (_, i) => {
      const it = rawMenu[i] || {};
      return {
        desayuno: it.desayuno || "",
        almuerzo: it.almuerzo || "",
        comida: it.comida || (it.menu || "") || "",
        merienda: it.merienda || "",
        cena: it.cena || "",
        consejos: it.consejos || "",
      };
    });
  };

  useEffect(() => {
    const load = async () => {
      if (!uid) {
        setUserData(null);
        setEditable({});
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);
          // Build editable state
          setEditable((prev) => ({
            nombre: data.nombre || "",
            apellidos: data.apellidos || "",
            nacimiento: data.nacimiento || "",
            telefono: data.telefono || "",
            dietaactual: data.dietaactual || "",
            dietaOtros: data.dietaOtros || "",
            restricciones: data.restricciones || "",
            ejercicios: !!data.ejercicios,
            recetas: !!data.recetas,
            ejerciciosDescripcion: data.ejerciciosDescripcion || "",
            recetasDescripcion: data.recetasDescripcion || "",
            menu: normalizeMenu(data.menu),
            _selectedDay: 0,
            _selectedMeal: "comida",
            ...prev,
          }));
        } else {
          setUserData(null);
          setEditable({});
        }
      } catch (err) {
        console.error("load user:", err);
        setError("Error al cargar datos del usuario.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [uid]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out:", err);
      setError("No se pudo cerrar sesión.");
    }
  };

  const savePersonal = async () => {
    if (!uid) {
      setError("Usuario objetivo no disponible.");
      return;
    }
    setError(null);
    try {
      await updateDoc(doc(db, "users", uid), {
        nombre: editable.nombre || "",
        apellidos: editable.apellidos || "",
        nacimiento: editable.nacimiento || "",
        telefono: editable.telefono || "",
        updatedAt: serverTimestamp(),
      });
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
    } catch (err) {
      console.error("save personal:", err);
      setError("No se pudieron guardar los datos personales.");
    }
  };

  const saveDieta = async () => {
    if (!uid) {
      setError("Usuario objetivo no disponible.");
      return;
    }
    setError(null);
    try {
      await updateDoc(doc(db, "users", uid), {
        dietaactual: editable.dietaactual || "",
        dietaOtros: editable.dietaactual === "otros" ? (editable.dietaOtros || "") : "",
        restricciones: editable.restricciones || "",
        ejercicios: !!editable.ejercicios,
        recetas: !!editable.recetas,
        updatedAt: serverTimestamp(),
      });
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
    } catch (err) {
      console.error("save dieta:", err);
      setError(err?.message || "No se pudo guardar la dieta.");
    }
  };

  const saveSemana = async () => {
    if (!uid) {
      setError("Usuario objetivo no disponible.");
      return;
    }
    setError(null);
    try {
      // Ensure menu is an array of 7 objects
      const menuToSave = Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      await updateDoc(doc(db, "users", uid), {
        menu: menuToSave,
        updatedAt: serverTimestamp(),
      });
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
      setError(null);
    } catch (err) {
      console.error("save semana:", err);
      // Fallback to setDoc if updateDoc fails (document missing)
      const notFoundCodes = ["not-found", "notFound", "404"];
      const isNotFound = err?.code ? notFoundCodes.some((c) => String(err.code).toLowerCase().includes(String(c).toLowerCase())) : false;
      if (isNotFound) {
        try {
          await setDoc(doc(db, "users", uid), {
            menu: Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() })),
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          }, { merge: true });
        } catch (err2) {
          console.error("save semana (setDoc) fallback error:", err2);
          setError(err2?.message || "No se pudo guardar el menú semanal (fallback).");
        }
      } else {
        setError(err?.message || "No se pudo guardar el menú semanal.");
      }
    }
  };

  const saveEjerciciosDesc = async () => {
    if (!uid) {
      setError("Usuario objetivo no disponible.");
      return;
    }
    setError(null);
    try {
      await updateDoc(doc(db, "users", uid), {
        ejerciciosDescripcion: editable.ejerciciosDescripcion || "",
        updatedAt: serverTimestamp(),
      });
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
    } catch (err) {
      console.error("save ejercicios desc:", err);
      setError("No se pudo guardar la descripción de ejercicios.");
    }
  };

  const saveRecetasDesc = async () => {
    if (!uid) {
      setError("Usuario objetivo no disponible.");
      return;
    }
    setError(null);
    try {
      await updateDoc(doc(db, "users", uid), {
        recetasDescripcion: editable.recetasDescripcion || "",
        updatedAt: serverTimestamp(),
      });
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
    } catch (err) {
      console.error("save recetas desc:", err);
      setError("No se pudo guardar la descripción de recetas.");
    }
  };

  const submitPeso = async (e) => {
    e?.preventDefault();
    if (!uid) {
      setError("Usuario objetivo no disponible.");
      return;
    }
    const p = parseFloat(String(peso).replace(",", "."));
    if (!Number.isFinite(p) || p <= 0) {
      setError("Introduce un peso válido (> 0).");
      return;
    }
    setSavingPeso(true);
    setError(null);

    const entry = { peso: p, fecha: fechaPeso, createdAt: Date.now() };

    try {
      await updateDoc(doc(db, "users", uid), {
        pesoHistorico: arrayUnion(entry),
        pesoActual: p,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("save peso (updateDoc) error:", err);
      const notFoundCodes = ["not-found", "notFound", "404"];
      const isNotFound = err?.code ? notFoundCodes.some((c) => String(err.code).toLowerCase().includes(String(c).toLowerCase())) : false;
      if (isNotFound) {
        try {
          await setDoc(doc(db, "users", uid), {
            pesoHistorico: [entry],
            pesoActual: p,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (err2) {
          console.error("save peso (setDoc) fallback error:", err2);
          setError(err2?.message || "No se pudo guardar el peso (fallback).");
          setSavingPeso(false);
          return;
        }
      } else {
        setError(err?.message || "No se pudo guardar el peso.");
        setSavingPeso(false);
        return;
      }
    }

    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
      setPeso("");
      setFechaPeso(todayISO);
      setError(null);
      const idx = tabs.findIndex((t) => t.id === "pesaje");
      if (idx >= 0) setTabIndex(idx);
    } catch (err3) {
      console.error("save peso (re-fetch) error:", err3);
      setError("Guardado, pero no se pudo actualizar la vista.");
    } finally {
      setSavingPeso(false);
    }
  };

  const ph = Array.isArray(userData?.pesoHistorico) ? [...userData.pesoHistorico] : [];
  const mapped = ph.map((p) => {
    const msFecha = p?.fecha ? Date.parse(p.fecha) : null;
    const msCreated = timestampToMs(p?.createdAt);
    const _t = msFecha || msCreated || 0;
    return { ...p, _t };
  });
  const sortedAsc = mapped.sort((a, b) => (a._t || 0) - (b._t || 0));
  const labels = sortedAsc.map((s) => s.fecha || (s._t ? new Date(s._t).toLocaleDateString() : ""));
  const dataPesos = sortedAsc.map((s) => s.peso);
  const rowsDesc = [...sortedAsc].reverse();

  const exercisesFolder = (userData && userData.driveEjerciciosFolderId) ? userData.driveEjerciciosFolderId : DRIVE_FOLDER_EXERCISES;
  const recipesFolder = (userData && userData.driveRecetasFolderId) ? userData.driveRecetasFolderId : DRIVE_FOLDER_RECIPES;

  if (loading) return <div className="card"><p style={{ padding: 16 }}>Cargando ficha...</p></div>;
  if (!userData) return <div className="card"><p style={{ padding: 16 }}>Sin datos de usuario (UID: {uid}).</p></div>;

  const chartData = {
    labels,
    datasets: [
      {
        label: "Peso (kg)",
        data: dataPesos,
        borderColor: "#16a34a",
        backgroundColor: "rgba(34,197,94,0.12)",
        tension: 0.25,
        fill: true,
        pointRadius: 4,
      },
    ],
  };
  const chartOptions = { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } };

  // Handlers for weekly menu editing
  const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const selDay = editable._selectedDay || 0;

  const setMenuField = (dayIndex, field, value) => {
    setEditable((s) => {
      const menu = Array.isArray(s.menu) ? [...s.menu] : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      menu[dayIndex] = { ...menu[dayIndex], [field]: value };
      return { ...s, menu };
    });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="avatar">{(userData.nombre?.[0] || userData.email?.[0] || "U").toUpperCase()}</div>
          <div>
            <div className="title">{userData.nombre ? `${userData.nombre} ${userData.apellidos || ""}` : userData.email}</div>
            <div className="subtitle">{userData.email}</div>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn ghost" onClick={() => setTabIndex(0)}>Perfil</button>

          {/* Mostrar "Cerrar sesión" sólo si se está viendo la propia ficha */}
          {(!targetUid || targetUid === authUid) && (
            <button className="btn danger" onClick={handleSignOut}>Cerrar sesión</button>
          )}
        </div>
      </div>

      <nav className="tabs" role="tablist" aria-label="Secciones" style={{ marginTop: 12 }}>
        {tabs.map((t, i) => (
          <button key={t.id} className={i === tabIndex ? "tab tab-active" : "tab"} onClick={() => setTabIndex(i)}>
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ marginTop: 12 }}>
        {tabIndex === 0 && (
          <div className="card">
            <h3>Datos personales</h3>
            <div className="panel-section">
              <div className="field">
                <label>Nombre</label>
                <input className="input" value={editable.nombre || ""} onChange={(e) => setEditable((s) => ({ ...s, nombre: e.target.value }))} />
              </div>
              <div className="field">
                <label>Apellidos</label>
                <input className="input" value={editable.apellidos || ""} onChange={(e) => setEditable((s) => ({ ...s, apellidos: e.target.value }))} />
              </div>
              <div className="field">
                <label>Fecha de nacimiento</label>
                <input className="input" type="date" value={editable.nacimiento || ""} onChange={(e) => setEditable((s) => ({ ...s, nacimiento: e.target.value }))} />
              </div>
              <div className="field">
                <label>Teléfono</label>
                <input className="input" value={editable.telefono || ""} onChange={(e) => setEditable((s) => ({ ...s, telefono: e.target.value }))} />
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn primary" onClick={savePersonal}>Guardar</button>
              </div>
            </div>
          </div>
        )}

        {tabIndex === 1 && (
          <div className="card">
            <h3>Datos de dieta</h3>
            <div className="panel-section">
              <div className="field">
                <label>Tipo de dieta</label>
                <select className="input" value={editable.dietaactual || ""} onChange={(e) => setEditable((s) => ({ ...s, dietaactual: e.target.value }))}>
                  <option value="">-- Selecciona --</option>
                  {dietaOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                {editable.dietaactual === "otros" && (
                  <input className="input" placeholder="Describe la dieta" value={editable.dietaOtros || ""} onChange={(e) => setEditable((s) => ({ ...s, dietaOtros: e.target.value }))} />
                )}
              </div>

              <div className="field">
                <label>Restricciones / Alergias</label>
                <input className="input" value={editable.restricciones || ""} onChange={(e) => setEditable((s) => ({ ...s, restricciones: e.target.value }))} />
              </div>

              <div className="field" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <label style={{ minWidth: 160 }}>¿Ejercicios asignados?</label>
                <select value={editable.ejercicios ? "si" : "no"} onChange={(e) => setEditable((s) => ({ ...s, ejercicios: e.target.value === "si" }))}>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div className="field" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <label style={{ minWidth: 160 }}>¿Recetas asignadas?</label>
                <select value={editable.recetas ? "si" : "no"} onChange={(e) => setEditable((s) => ({ ...s, recetas: e.target.value === "si" }))}>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div style={{ marginTop: 12 }}>
                <button className="btn primary" onClick={saveDieta}>Guardar</button>
              </div>
            </div>
          </div>
        )}

        {tabIndex === 2 && (
          <div className="card">
            <h3>Pesaje</h3>
            <div className="panel-section">
              <form onSubmit={submitPeso} style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                <input className="input" type="number" step="0.1" placeholder="Peso (kg)" value={peso} onChange={(e) => setPeso(e.target.value)} />
                <input className="input" type="date" value={fechaPeso} onChange={(e) => setFechaPeso(e.target.value)} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn primary" disabled={savingPeso}>{savingPeso ? "Guardando..." : "Registrar peso"}</button>
                  <button type="button" className="btn ghost" onClick={() => { setPeso(""); setFechaPeso(todayISO); }}>Limpiar</button>
                </div>
              </form>

              <div style={{ marginTop: 16 }}>
                <h4>Histórico de pesajes</h4>
                {rowsDesc.length === 0 ? <div className="mensaje">No hay registros de peso.</div> : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="hist-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Fecha</th>
                          <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #ddd" }}>Peso (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rowsDesc.map((r, i) => (
                          <tr key={`${r._t || i}-${r.peso}`}>
                            <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>{r.fecha || (r._t ? new Date(r._t).toLocaleDateString() : "-")}</td>
                            <td style={{ padding: 8, textAlign: "right", borderBottom: "1px solid #f2f2f2" }}>{r.peso}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <h4>Tendencia</h4>
                {dataPesos.length > 0 ? <Line data={chartData} options={chartOptions} /> : <div className="mensaje">No hay datos para el gráfico.</div>}
              </div>
            </div>
          </div>
        )}

        {tabIndex === 3 && (
          <div className="card">
            <h3>Dieta semanal</h3>

            {/* Days selector */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
              {dayNames.map((d, i) => (
                <button
                  key={d}
                  className={editable._selectedDay === i ? "tab tab-active" : "tab"}
                  onClick={() => setEditable((s) => ({ ...s, _selectedDay: i }))}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* New daily menu: two columns, left fixed labels, right editable fields aligned per row */}
            <div className="weekly-menu" style={{ marginTop: 16 }}>
              <div className="weekly-day-header" style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{dayNames[selDay]}</strong>
                  <div style={{ fontSize: 13, color: "#666" }}>Edita el menú diario</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn ghost" onClick={() => {
                    // quick clear all fields for current day
                    const cleared = { ...emptyDayMenu() };
                    setEditable((s) => {
                      const menu = Array.isArray(s.menu) ? [...s.menu] : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
                      menu[selDay] = cleared;
                      return { ...s, menu };
                    });
                  }}>Limpiar día</button>
                  <button className="btn primary" onClick={saveSemana}>Guardar día</button>
                </div>
              </div>

              <div className="weekly-menu-grid" role="group" aria-label={`Editor de menú para ${dayNames[selDay]}`}>
                {/* Left column: fixed labels */}
                <div className="weekly-left">
                  {ALL_SECTIONS.map((sec) => (
                    <div key={sec.key} className="weekly-label">{sec.label}</div>
                  ))}
                </div>

                {/* Right column: aligned textareas */}
                <div className="weekly-right">
                  {ALL_SECTIONS.map((sec) => (
                    <div key={sec.key} className="weekly-field">
                      <textarea
                        className="input weekly-textarea"
                        rows={4}
                        value={(Array.isArray(editable.menu) && editable.menu[selDay] ? editable.menu[selDay][sec.key] : "") || ""}
                        onChange={(e) => setMenuField(selDay, sec.key, e.target.value)}
                        placeholder={sec.key === "consejos" ? "Consejos, recomendaciones o notas para el día..." : `Escribe ${sec.label.toLowerCase()}...`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button className="btn ghost" onClick={() => {
                  const prev = Math.max(0, selDay - 1);
                  setEditable((s) => ({ ...s, _selectedDay: prev }));
                }}>Día anterior</button>
                <button className="btn ghost" onClick={() => {
                  const next = Math.min(6, selDay + 1);
                  setEditable((s) => ({ ...s, _selectedDay: next }));
                }}>Siguiente día</button>
              </div>
            </div>
          </div>
        )}

        {tabIndex === 4 && (
          <div className="card">
            <h3>Ejercicios</h3>
            <div className="panel-section">
              {(editable.ejercicios || userData?.ejercicios) ? (
                <DriveFolderViewer folderId={exercisesFolder} height={520} />
              ) : (
                <div className="field">
                  <label>Descripción</label>
                  <textarea className="input" rows={4} value={editable.ejerciciosDescripcion || ""} onChange={(e) => setEditable((s) => ({ ...s, ejerciciosDescripcion: e.target.value }))} />
                  <div style={{ marginTop: 8 }}>
                    <button className="btn primary" onClick={saveEjerciciosDesc}>Guardar descripción</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tabIndex === 5 && (
          <div className="card">
            <h3>Recetas</h3>
            <div className="panel-section">
              {(editable.recetas || userData?.recetas) ? (
                <DriveFolderViewer folderId={recipesFolder} height={520} />
              ) : (
                <div className="field">
                  <label>Descripción</label>
                  <textarea className="input" rows={4} value={editable.recetasDescripcion || ""} onChange={(e) => setEditable((s) => ({ ...s, recetasDescripcion: e.target.value }))} />
                  <div style={{ marginTop: 8 }}>
                    <button className="btn primary" onClick={saveRecetasDesc}>Guardar descripción</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 12 }} className="card">
          <div style={{ padding: 8, color: "var(--danger, #b91c1c)" }}>{error}</div>
        </div>
      )}
    </div>
  );
}