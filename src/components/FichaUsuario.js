import React, { useEffect, useState, useRef } from "react";
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
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

export default function FichaUsuario() {
  const tabs = [
    { id: "personales", label: "Personales" },
    { id: "dieta", label: "Dieta" },
    { id: "pesaje", label: "Pesaje" },
    { id: "semana", label: "Dieta semanal" },
    { id: "ejercicios", label: "Ejercicios" },
    { id: "recetas", label: "Recetas" },
  ];

  const [uid, setUid] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const [error, setError] = useState(null);

  // pesaje form
  const [peso, setPeso] = useState("");
  const [fechaPeso, setFechaPeso] = useState(() => new Date().toISOString().slice(0, 10));
  const [savingPeso, setSavingPeso] = useState(false);

  // dieta semanal state (example structure)
  const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const [dayIndex, setDayIndex] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1); // 0..6

  // swipe handling
  const startX = useRef(0);
  const currentX = useRef(0);
  const isSwiping = useRef(false);
  const trackRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setError(null);
      if (!u) {
        setUid(null);
        setUserData(null);
        setLoading(false);
        return;
      }
      setUid(u.uid);
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) setUserData(snap.data());
        else {
          // create minimal doc if not exists
          await setDoc(doc(db, "users", u.uid), {
            email: u.email || "",
            createdAt: serverTimestamp(),
            pesoHistorico: [],
          });
          const s2 = await getDoc(doc(db, "users", u.uid));
          setUserData(s2.exists() ? s2.data() : null);
        }
      } catch (err) {
        console.error("fetch user:", err);
        setError("Error al cargar datos.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // touch handlers
  const onTouchStart = (e) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    currentX.current = t.clientX;
    isSwiping.current = true;
    if (trackRef.current) trackRef.current.style.transition = "none";
  };
  const onTouchMove = (e) => {
    if (!isSwiping.current) return;
    currentX.current = e.touches[0].clientX;
    const dx = currentX.current - startX.current;
    const w = trackRef.current?.clientWidth || 1;
    // move track proportionally
    if (trackRef.current) {
      const base = -tabIndex * 100;
      const pct = (dx / w) * 100;
      trackRef.current.style.transform = `translateX(calc(${base}% + ${pct}%))`;
    }
  };
  const onTouchEnd = () => {
    if (!isSwiping.current) return;
    const dx = currentX.current - startX.current;
    const threshold = 50; // px
    let ni = tabIndex;
    if (dx > threshold && tabIndex > 0) ni = tabIndex - 1;
    else if (dx < -threshold && tabIndex < tabs.length - 1) ni = tabIndex + 1;
    setTabIndex(ni);
    if (trackRef.current) {
      trackRef.current.style.transition = "transform .28s cubic-bezier(.2,.9,.2,1)";
      trackRef.current.style.transform = `translateX(-${ni * 100}%)`;
    }
    isSwiping.current = false;
    startX.current = 0;
    currentX.current = 0;
  };

  useEffect(() => {
    // ensure track is positioned when tabIndex changes programmatically
    if (trackRef.current) {
      trackRef.current.style.transition = "transform .28s cubic-bezier(.2,.9,.2,1)";
      trackRef.current.style.transform = `translateX(-${tabIndex * 100}%)`;
    }
  }, [tabIndex]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out:", err);
      setError("No se pudo cerrar sesión.");
    }
  };

  const submitPeso = async (e) => {
    e?.preventDefault();
    if (!uid) return;
    const p = parseFloat(String(peso).replace(",", "."));
    if (!p || Number.isNaN(p)) {
      setError("Introduce un peso válido.");
      return;
    }
    setSavingPeso(true);
    try {
      const entry = { peso: p, fecha: fechaPeso, createdAt: serverTimestamp() };
      await updateDoc(doc(db, "users", uid), {
        pesoHistorico: arrayUnion(entry),
        pesoActual: p,
        updatedAt: serverTimestamp(),
      });
      // re-fetch
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
      setPeso("");
      setError(null);
    } catch (err) {
      console.error("save peso:", err);
      setError("No se pudo guardar el peso.");
    } finally {
      setSavingPeso(false);
    }
  };

  if (loading) return <div className="layout"><div className="card"><p style={{ padding: 16 }}>Cargando...</p></div></div>;
  if (!userData) return <div className="layout"><div className="card"><p style={{ padding: 16 }}>Sin datos de usuario.</p></div></div>;

  // prepare pesaje chart
  const ph = Array.isArray(userData.pesoHistorico) ? [...userData.pesoHistorico] : [];
  const sorted = ph
    .map((p) => ({ ...p, _t: p.fecha ? Date.parse(p.fecha) : (p.createdAt ? (p.createdAt.seconds ? p.createdAt.seconds * 1000 : null) : null) }))
    .sort((a, b) => (a._t || 0) - (b._t || 0));
  const labels = sorted.map((s) => s.fecha || (s._t ? new Date(s._t).toLocaleDateString() : ""));
  const dataPesos = sorted.map((s) => s.peso);

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

  return (
    <div className="layout">
      <div className="card header" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="avatar">{(userData.nombre?.[0] || userData.email?.[0] || "U").toUpperCase()}</div>
          <div className="head-info">
            <div className="title">{userData.nombre ? `${userData.nombre} ${userData.apellidos || ""}` : userData.email}</div>
            <div className="subtitle">{userData.email}</div>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn ghost" onClick={() => setTabIndex(0)}>Perfil</button>
          <button className="btn danger" onClick={handleSignOut}>Cerrar sesión</button>
        </div>
      </div>

      {/* tab buttons */}
      <nav className="tabs" role="tablist" aria-label="Secciones">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            className={i === tabIndex ? "tab tab-active" : "tab"}
            onClick={() => setTabIndex(i)}
            aria-selected={i === tabIndex}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* swipe viewport */}
      <div
        className="swipe-viewport"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ overflow: "hidden" }}
      >
        <div className="swipe-track" ref={trackRef} style={{ width: `${tabs.length * 100}%`, display: "flex" }}>
          {/* personales */}
          <section className="swipe-panel" style={{ width: `${100 / tabs.length}%` }}>
            <h3>Datos personales</h3>
            <div className="panel-section">
              <div className="field"><label>Nombre</label><div className="value">{userData.nombre || "-"}</div></div>
              <div className="field"><label>Apellidos</label><div className="value">{userData.apellidos || "-"}</div></div>
              <div className="field"><label>Fecha de nacimiento</label><div className="value">{userData.nacimiento || "-"}</div></div>
              <div className="field"><label>Teléfono</label><div className="value">{userData.telefono || "-"}</div></div>
            </div>
          </section>

          {/* dieta resumen */}
          <section className="swipe-panel" style={{ width: `${100 / tabs.length}%` }}>
            <h3>Datos de dieta</h3>
            <div className="panel-section">
              <div className="field"><label>Tipo de dieta</label><div className="value">{userData.dietaactual || "-"}</div></div>
              <div className="field"><label>Restricciones / Alergias</label><div className="value">{userData.restricciones || "-"}</div></div>
              <div className="field"><label>Ejercicios</label><div className="value">{userData.ejercicios ? "Sí" : "No"}</div></div>
              <div className="field"><label>Recetas asignadas</label><div className="value">{userData.recetas ? "Sí" : "No"}</div></div>
            </div>
          </section>

          {/* pesaje */}
          <section className="swipe-panel" style={{ width: `${100 / tabs.length}%` }}>
            <h3>Pesaje</h3>
            <div className="panel-section">
              <form onSubmit={submitPeso} style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                <input className="input" type="number" step="0.1" placeholder="Peso (kg)" value={peso} onChange={(e) => setPeso(e.target.value)} />
                <input className="input" type="date" value={fechaPeso} onChange={(e) => setFechaPeso(e.target.value)} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn primary" disabled={savingPeso}>{savingPeso ? "Guardando..." : "Registrar peso"}</button>
                  <button type="button" className="btn ghost" onClick={() => { setPeso(""); setFechaPeso(new Date().toISOString().slice(0, 10)); }}>Limpiar</button>
                </div>
              </form>

              <div style={{ marginTop: 14 }}>
                {dataPesos.length > 0 ? <Line data={chartData} options={chartOptions} /> : <div className="mensaje">No hay registros de peso.</div>}
              </div>

              {sorted.slice().reverse().map((r, i) => (
                <div key={i} style={{ marginTop: 8 }} className="value">
                  <strong>{r.fecha || (r._t ? new Date(r._t).toLocaleDateString() : "-")}</strong> — {r.peso} kg
                </div>
              ))}
            </div>
          </section>

          {/* dieta semanal: one panel, inside buttons per day */}
          <section className="swipe-panel" style={{ width: `${100 / tabs.length}%` }}>
            <h3>Dieta semanal</h3>
            <div className="panel-section">
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
                {days.map((d, i) => (
                  <button key={d} className={i === dayIndex ? "tab tab-active" : "tab"} onClick={() => setDayIndex(i)} style={{ minWidth: 92 }}>
                    {d}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 12 }}>
                {/* sample display: userData.menu?.[dayIndex] expected to be array of meals or string */}
                <div className="value">
                  {userData.menu && userData.menu[dayIndex] ? (
                    Array.isArray(userData.menu[dayIndex]) ? (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {userData.menu[dayIndex].map((m, idx) => <li key={idx}>{m}</li>)}
                      </ul>
                    ) : (
                      <div>{userData.menu[dayIndex]}</div>
                    )
                  ) : (
                    <div>No hay menú asignado para {days[dayIndex]}</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ejercicios */}
          <section className="swipe-panel" style={{ width: `${100 / tabs.length}%` }}>
            <h3>Ejercicios</h3>
            <div className="panel-section">
              <div className="value">{userData.ejerciciosDescripcion || "No hay plan de ejercicios."}</div>
            </div>
          </section>

          {/* recetas */}
          <section className="swipe-panel" style={{ width: `${100 / tabs.length}%` }}>
            <h3>Recetas</h3>
            <div className="panel-section">
              <div className="value">{userData.recetasDescripcion || "No hay recetas asignadas."}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}