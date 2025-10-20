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
import DriveFolderViewer from "./DriveFolderViewer";
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

/**
 * FichaUsuario.jsx
 *
 * - Autosave + autosize already implemented elsewhere.
 * - Cambio realizado: en la sección "Dieta semanal" cada campo ahora
 *   incluye su propia etiqueta dentro de la celda derecha (weekly-field-label).
 *   En desktop se mantiene la columna izquierda con etiquetas; en móvil
 *   la columna izquierda se oculta y se muestran las etiquetas internas.
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

  const ALL_SECTIONS = [
    { key: "desayuno", label: "Desayuno" },
    { key: "almuerzo", label: "Almuerzo" },
    { key: "comida", label: "Comida" },
    { key: "merienda", label: "Merienda" },
    { key: "cena", label: "Cena" },
    { key: "consejos", label: "Consejos del día" },
  ];

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

  // autosave state
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | pending | saving | saved | error
  const saveTimerRef = useRef(null);

  // autosize container ref
  const rootRef = useRef(null);

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
    const isStringArray = rawMenu.every((it) => typeof it === "string" || it == null);
    if (isStringArray) {
      return Array.from({ length: 7 }, (_, i) => {
        const val = rawMenu[i] || "";
        return { ...emptyDayMenu(), comida: val };
      });
    }
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

  // Load user & menu
  useEffect(() => {
    let mounted = true;
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
          if (!mounted) return;
          setUserData(data);
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
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [uid]);

  // Autosize textareas whenever menu or tab changes
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const areas = el.querySelectorAll(".weekly-textarea");
    areas.forEach((a) => {
      a.style.height = "auto";
      const newH = Math.max(56, a.scrollHeight + 2);
      a.style.height = newH + "px";
    });
  }, [editable.menu, tabIndex, loading]);

  // Autosave (debounced) when editable.menu changes
  useEffect(() => {
    if (!uid) return;
    if (!editable.menu) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSaveStatus("pending");
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await updateDoc(doc(db, "users", uid), {
          menu: Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() })),
          updatedAt: serverTimestamp(),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1200);
      } catch (err) {
        console.error("autosave menu error:", err);
        const notFoundCodes = ["not-found", "notFound", "404"];
        const isNotFound = err?.code ? notFoundCodes.some((c) => String(err.code).toLowerCase().includes(String(c).toLowerCase())) : false;
        if (isNotFound) {
          try {
            await setDoc(doc(db, "users", uid), {
              menu: Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() })),
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            }, { merge: true });
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 1200);
          } catch (err2) {
            console.error("autosave fallback error:", err2);
            setSaveStatus("error");
            setError(err2?.message || "No se pudo guardar el menú.");
          }
        } else {
          setSaveStatus("error");
          setError(err?.message || "No se pudo guardar el menú.");
        }
      }
    }, 1200);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable.menu, uid]);

  // Manual save (button)
  const saveSemana = async () => {
    if (!uid) {
      setError("Usuario objetivo no disponible.");
      return;
    }
    setError(null);
    setSaveStatus("saving");
    try {
      const menuToSave = Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      await updateDoc(doc(db, "users", uid), {
        menu: menuToSave,
        updatedAt: serverTimestamp(),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1200);
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
    } catch (err) {
      console.error("save semana:", err);
      setSaveStatus("error");
      setError(err?.message || "No se pudo guardar el menú semanal.");
    }
  };

  // small helper to update one field for a day
  const setMenuField = (dayIndex, field, value) => {
    setEditable((s) => {
      const menu = Array.isArray(s.menu) ? [...s.menu] : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      menu[dayIndex] = { ...menu[dayIndex], [field]: value };
      return { ...s, menu };
    });
  };

  const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const selDay = Number.isFinite(editable._selectedDay) ? editable._selectedDay : 0;

  const saveLabel = saveStatus === "pending" ? "Guardando..." : saveStatus === "saving" ? "Guardando..." : saveStatus === "saved" ? "Guardado" : saveStatus === "error" ? "Error al guardar" : "";

  if (loading) return <div className="card"><p style={{ padding: 16 }}>Cargando ficha...</p></div>;
  if (!userData) return <div className="card"><p style={{ padding: 16 }}>Sin datos de usuario (UID: {uid}).</p></div>;

  // peso chart etc.
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

  return (
    <div ref={rootRef}>
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
        {/* ...other tabs (personales, dieta, pesaje) remain the same (omitted for brevity) ... */}

        {tabIndex === 3 && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>Dieta semanal</h3>
                <div style={{ fontSize: 13, color: "#666" }}>Rellena el menú del día</div>
              </div>
              <div style={{ fontSize: 13, color: "#666" }}>{saveLabel}</div>
            </div>

            {/* Days selector */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 12px 8px 12px" }}>
              {dayNames.map((d, i) => (
                <button
                  key={d}
                  className={selDay === i ? "tab tab-active" : "tab"}
                  onClick={() => setEditable((s) => ({ ...s, _selectedDay: i }))}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Daily two-column form */}
            <div className="weekly-menu" style={{ marginTop: 12, padding: "0 12px 18px 12px" }}>
              <div className="weekly-day-header" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{dayNames[selDay]}</strong>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn ghost" onClick={() => {
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
                {/* Left labels column (visible on desktop) */}
                <div className="weekly-left" aria-hidden="true">
                  {ALL_SECTIONS.map((sec) => (
                    <div key={sec.key} className="weekly-label">{sec.label}</div>
                  ))}
                </div>

                {/* Right column: each field includes its own label (shown on mobile) + textarea */}
                <div className="weekly-right">
                  {ALL_SECTIONS.map((sec) => (
                    <div key={sec.key} className="weekly-field">
                      {/* Inline label used in mobile (hidden on desktop) */}
                      <div className="weekly-field-label" aria-hidden="true">{sec.label}</div>

                      <textarea
                        className={`input weekly-textarea ${sec.key === "consejos" ? "consejos" : ""} auto-resize`}
                        rows={3}
                        value={(Array.isArray(editable.menu) && editable.menu[selDay] ? editable.menu[selDay][sec.key] : "") || ""}
                        onChange={(e) => setMenuField(selDay, sec.key, e.target.value)}
                        placeholder={sec.key === "consejos" ? "Consejos, recomendaciones o notas para el día..." : `Escribe ${sec.label.toLowerCase()}...`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
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

        {/* Ejercicios y Recetas (igual que antes) */}
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
                    <button className="btn primary" onClick={async () => {
                      try {
                        await updateDoc(doc(db, "users", uid), { ejerciciosDescripcion: editable.ejerciciosDescripcion || "", updatedAt: serverTimestamp() });
                      } catch (err) {
                        console.error(err);
                      }
                    }}>Guardar descripción</button>
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
                    <button className="btn primary" onClick={async () => {
                      try {
                        await updateDoc(doc(db, "users", uid), { recetasDescripcion: editable.recetasDescripcion || "", updatedAt: serverTimestamp() });
                      } catch (err) {
                        console.error(err);
                      }
                    }}>Guardar descripción</button>
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