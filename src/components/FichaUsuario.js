// src/components/FichaUsuario.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
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
 * FichaUsuario.jsx — versión corregida
 *
 * Cambios aplicados en esta versión:
 * - handleSignOut está declarado antes de cualquier uso (evita errores eslint no-undef).
 * - La pestaña por defecto es "Dieta semanal" y Perfil se muestra solo si se pulsa "Perfil".
 * - Perfil NO contiene el editor semanal (el editor semanal está en la pestaña "Dieta semanal").
 * - saveProfile no guarda el campo `menu`; saveSemana/autosave siguen encargándose del menú semanal.
 *
 * Sustituye el fichero actual por este contenido.
 */

export default function FichaUsuario({ targetUid = null, adminMode = false }) {
  const tabs = [
    { id: "pesaje", label: "Pesaje" },
    { id: "semana", label: "Dieta semanal" },
    { id: "ejercicios", label: "Ejercicios" },
    { id: "recetas", label: "Recetas" },
  ];

  const dietaOptions = [
    { value: "", label: "-- Selecciona --" },
    { value: "perdida_grasa", label: "Pérdida de grasa" },
    { value: "antiinflamatoria", label: "Antiinflamatoria" },
    { value: "ganancia_muscular", label: "Ganancia muscular" },
    { value: "aprendiendo_a_comer", label: "Aprendiendo a comer" },
    { value: "otros", label: "Otros" },
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
  // Por defecto mostrar Dieta semanal
  const [tabIndex, setTabIndex] = useState(1);
  const [showProfile, setShowProfile] = useState(false);
  const [error, setError] = useState(null);

  const [peso, setPeso] = useState("");
  const todayISO = new Date().toISOString().slice(0, 10);
  const [fechaPeso, setFechaPeso] = useState(() => todayISO);
  const [savingPeso, setSavingPeso] = useState(false);

  // autosave / autosize helpers
  const saveTimerRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | pending | saving | saved | error
  const rootRef = useRef(null);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthUid(u ? u.uid : null);
      console.debug("[FichaUsuario] auth:", u ? { uid: u.uid, email: u.email } : null);
    });
    return () => unsub();
  }, []);

  // Handler de cierre de sesión — declarado aquí (antes de cualquier JSX que lo use)
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("[FichaUsuario] signOut error:", err);
      setError("No se pudo cerrar sesión.");
    }
  };

  const uid = targetUid || authUid;

  const emptyDayMenu = useCallback(() => ({
    desayuno: "",
    almuerzo: "",
    comida: "",
    merienda: "",
    cena: "",
    consejos: "",
  }), []);

  const normalizeMenu = useCallback((rawMenu) => {
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
  }, [emptyDayMenu]);

  // Load user doc (incluye menu)
  const loadUser = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      if (!db) {
        setError("Error interno: Firestore no inicializado.");
        setLoading(false);
        console.error("[FichaUsuario] db missing");
        return;
      }
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        setUserData(null);
        setEditable((prev) => ({ ...prev, menu: Array.from({ length: 7 }, () => ({ ...emptyDayMenu() })), _selectedDay: 0 }));
        setError(`No hay ficha para este usuario (UID: ${uid}).`);
      } else {
        const data = snap.data();
        setUserData(data);
        setEditable((prev) => ({
          nombre: data.nombre || prev.nombre || "",
          apellidos: data.apellidos || prev.apellidos || "",
          nacimiento: data.nacimiento || prev.nacimiento || "",
          telefono: data.telefono || prev.telefono || "",
          dietaactual: data.dietaactual || prev.dietaactual || "",
          dietaOtros: data.dietaOtros || prev.dietaOtros || "",
          restricciones: data.restricciones || prev.restricciones || "",
          ejercicios: !!(prev.ejercicios ?? data.ejercicios),
          recetas: !!(prev.recetas ?? data.recetas),
          ejerciciosDescripcion: data.ejerciciosDescripcion || prev.ejerciciosDescripcion || "",
          recetasDescripcion: data.recetasDescripcion || prev.recetasDescripcion || "",
          menu: normalizeMenu(data.menu),
          _selectedDay: prev._selectedDay ?? 0,

          // Pesaje / composición corporal fields
          pesoActual: data.pesoActual ?? prev.pesoActual ?? "",
          masaGrasaPct: data.masaGrasaPct ?? prev.masaGrasaPct ?? "",
          masaGrasaKg: data.masaGrasaKg ?? prev.masaGrasaKg ?? "",
          masaMagraKg: data.masaMagraKg ?? prev.masaMagraKg ?? "",
          masaMuscularKg: data.masaMuscularKg ?? prev.masaMuscularKg ?? "",
          aguaTotalKg: data.aguaTotalKg ?? prev.aguaTotalKg ?? "",
          aguaTotalPct: data.aguaTotalPct ?? prev.aguaTotalPct ?? "",
          masaOseaKg: data.masaOseaKg ?? prev.masaOseaKg ?? "",
          mbKcal: data.mbKcal ?? prev.mbKcal ?? "",
          grasaVisceralNivel: data.grasaVisceralNivel ?? prev.grasaVisceralNivel ?? "",
          imc: data.imc ?? prev.imc ?? "",
          edadMetabolica: data.edadMetabolica ?? prev.edadMetabolica ?? "",
          indiceCinturaTalla: data.indiceCinturaTalla ?? prev.indiceCinturaTalla ?? "",
          circunferenciaBrazoCm: data.circunferenciaBrazoCm ?? prev.circunferenciaBrazoCm ?? "",
          circunferenciaCinturaCm: data.circunferenciaCinturaCm ?? prev.circunferenciaCinturaCm ?? "",
          circunferenciaCaderaCm: data.circunferenciaCaderaCm ?? prev.circunferenciaCaderaCm ?? "",
          circunferenciaPiernaCm: data.circunferenciaPiernaCm ?? prev.circunferenciaPiernaCm ?? "",
          tensionArterial: data.tensionArterial ?? prev.tensionArterial ?? { sys: "", dia: "" },

          ...prev,
        }));
      }
    } catch (err) {
      console.error("[FichaUsuario] loadUser error:", err);
      setError(err?.message || "Error al cargar la ficha.");
      setUserData(null);
    } finally {
      setLoading(false);
    }
  }, [uid, normalizeMenu, emptyDayMenu]);

  useEffect(() => {
    loadUser();
  }, [uid, loadUser]);

  // Autosize textareas
  const autosizeTextareas = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const areas = root.querySelectorAll(".weekly-textarea");
    areas.forEach((a) => {
      a.style.height = "auto";
      const newH = Math.max(56, a.scrollHeight + 2);
      a.style.height = newH + "px";
    });
  }, []);

  useEffect(() => {
    autosizeTextareas();
  }, [editable.menu, tabIndex, loading, autosizeTextareas]);

  // Update a single field in menu (local)
  const setMenuField = (dayIndex, field, value) => {
    setEditable((s) => {
      const menu = Array.isArray(s.menu) ? [...s.menu] : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      menu[dayIndex] = { ...menu[dayIndex], [field]: value };
      return { ...s, menu };
    });
  };

  // Autosave weekly menu
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
        const menuToSave = Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
        await updateDoc(doc(db, "users", uid), {
          menu: menuToSave,
          updatedAt: serverTimestamp(),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1200);
      } catch (err) {
        console.error("[FichaUsuario] autosave menu error:", err);
        setSaveStatus("error");
        setError(err?.message || "No se pudo guardar el menú.");
      }
    }, 1200);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [editable.menu, uid, emptyDayMenu]);

  // Manual save semana
  const saveSemana = async () => {
    if (!uid) { setError("Usuario objetivo no disponible."); return; }
    setSaveStatus("saving");
    try {
      const menuToSave = Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      await updateDoc(doc(db, "users", uid), { menu: menuToSave, updatedAt: serverTimestamp() });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1200);
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
    } catch (err) {
      console.error("[FichaUsuario] saveSemana error:", err);
      setSaveStatus("error");
      setError(err?.message || "No se pudo guardar el menú semanal.");
    }
  };

  // Save profile (NO incluye menu)
  const saveProfile = async () => {
    if (!uid) { setError("Usuario objetivo no disponible."); return; }
    setError(null);
    try {
      const payload = {
        nombre: editable.nombre || "",
        apellidos: editable.apellidos || "",
        nacimiento: editable.nacimiento || "",
        telefono: editable.telefono || "",
        dietaactual: editable.dietaactual || "",
        dietaOtros: editable.dietaactual === "otros" ? (editable.dietaOtros || "") : "",
        restricciones: editable.restricciones || "",
        ejercicios: !!editable.ejercicios,
        recetas: !!editable.recetas,
        ejerciciosDescripcion: editable.ejerciciosDescripcion || "",
        recetasDescripcion: editable.recetasDescripcion || "",
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "users", uid), payload);
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
      setError(null);
    } catch (err) {
      console.error("[FichaUsuario] saveProfile error:", err);
      setError("No se pudieron guardar los datos del perfil.");
    }
  };

  // Util: safe parse float or null
  const parseNum = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  // Validations for pesaje
  const validateMeasures = (pesoValue, editableState) => {
    const p = parseNum(pesoValue);
    if (p !== null && (p <= 0 || p > 500)) return "Peso fuera de rango (0-500 kg).";
    const mgPct = parseNum(editableState?.masaGrasaPct);
    if (mgPct !== null && (mgPct < 0 || mgPct > 100)) return "Masa grasa (%) debe estar entre 0 y 100.";
    return null;
  };

  // submitPeso (identico a versión anterior)
  const submitPeso = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!uid) { setError("Usuario objetivo no disponible."); return; }
    const ed = { ...editable };
    const pesoValue = parseNum(peso);
    const vError = validateMeasures(pesoValue, ed);
    if (vError) { setError(vError); return; }

    setSavingPeso(true);
    setError(null);

    let masaGrasaKg = parseNum(ed.masaGrasaKg);
    let masaMagraKg = parseNum(ed.masaMagraKg);
    const masaGrasaPct = parseNum(ed.masaGrasaPct);

    if (pesoValue !== null && masaGrasaPct !== null && (masaGrasaKg === null || masaMagraKg === null)) {
      const mgKgCalc = +(pesoValue * (masaGrasaPct / 100));
      masaGrasaKg = Math.round(mgKgCalc * 100) / 100;
      masaMagraKg = Math.round((pesoValue - mgKgCalc) * 100) / 100;
    }

    const measuresPayload = {
      fecha: fechaPeso,
      pesoActual: pesoValue !== null ? pesoValue : null,
      masaGrasaPct: masaGrasaPct,
      masaGrasaKg: masaGrasaKg,
      masaMagraKg: masaMagraKg,
      masaMuscularKg: parseNum(ed.masaMuscularKg),
      aguaTotalKg: parseNum(ed.aguaTotalKg),
      aguaTotalPct: parseNum(ed.aguaTotalPct),
      masaOseaKg: parseNum(ed.masaOseaKg),
      mbKcal: parseNum(ed.mbKcal),
      grasaVisceralNivel: parseNum(ed.grasaVisceralNivel),
      imc: parseNum(ed.imc),
      edadMetabolica: parseNum(ed.edadMetabolica),
      indiceCinturaTalla: parseNum(ed.indiceCinturaTalla),
      circunferenciaBrazoCm: parseNum(ed.circunferenciaBrazoCm),
      circunferenciaCinturaCm: parseNum(ed.circunferenciaCinturaCm),
      circunferenciaCaderaCm: parseNum(ed.circunferenciaCaderaCm),
      circunferenciaPiernaCm: parseNum(ed.circunferenciaPiernaCm),
      tensionArterial: {
        sys: ed.tensionArterial?.sys || "",
        dia: ed.tensionArterial?.dia || "",
      },
      createdAt: serverTimestamp(),
    };

    const cleaned = {};
    Object.keys(measuresPayload).forEach((k) => {
      const v = measuresPayload[k];
      if (v !== null && v !== undefined) cleaned[k] = v;
    });

    const entryMedida = { ...cleaned };
    const entryPeso = { fecha: fechaPeso, peso: measuresPayload.pesoActual, createdAt: serverTimestamp() };

    try {
      await updateDoc(doc(db, "users", uid), {
        ...cleaned,
        medidasHistorico: arrayUnion(entryMedida),
        pesoHistorico: arrayUnion(entryPeso),
        pesoActual: measuresPayload.pesoActual,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("[FichaUsuario] submitPeso update error:", err);
      const notFoundCodes = ["not-found", "notFound", "404"];
      const isNotFound = err?.code ? notFoundCodes.some((c) => String(err.code).toLowerCase().includes(String(c).toLowerCase())) : false;
      if (isNotFound) {
        try {
          await setDoc(doc(db, "users", uid), {
            ...cleaned,
            medidasHistorico: [entryMedida],
            pesoHistorico: [entryPeso],
            pesoActual: measuresPayload.pesoActual,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (err2) {
          console.error("[FichaUsuario] submitPeso fallback error:", err2);
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
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        setEditable((prev) => ({
          ...prev,
          pesoActual: data.pesoActual ?? prev.pesoActual ?? "",
          masaGrasaPct: data.masaGrasaPct ?? prev.masaGrasaPct ?? "",
          masaGrasaKg: data.masaGrasaKg ?? prev.masaGrasaKg ?? "",
          masaMagraKg: data.masaMagraKg ?? prev.masaMagraKg ?? "",
          masaMuscularKg: data.masaMuscularKg ?? prev.masaMuscularKg ?? "",
          aguaTotalKg: data.aguaTotalKg ?? prev.aguaTotalKg ?? "",
          aguaTotalPct: data.aguaTotalPct ?? prev.aguaTotalPct ?? "",
          masaOseaKg: data.masaOseaKg ?? prev.masaOseaKg ?? "",
          mbKcal: data.mbKcal ?? prev.mbKcal ?? "",
          grasaVisceralNivel: data.grasaVisceralNivel ?? prev.grasaVisceralNivel ?? "",
          imc: data.imc ?? prev.imc ?? "",
          edadMetabolica: data.edadMetabolica ?? prev.edadMetabolica ?? "",
          indiceCinturaTalla: data.indiceCinturaTalla ?? prev.indiceCinturaTalla ?? "",
          circunferenciaBrazoCm: data.circunferenciaBrazoCm ?? prev.circunferenciaBrazoCm ?? "",
          circunferenciaCinturaCm: data.circunferenciaCinturaCm ?? prev.circunferenciaCinturaCm ?? "",
          circunferenciaCaderaCm: data.circunferenciaCaderaCm ?? prev.circunferenciaCaderaCm ?? "",
          circunferenciaPiernaCm: data.circunferenciaPiernaCm ?? prev.circunferenciaPiernaCm ?? "",
          tensionArterial: data.tensionArterial ?? prev.tensionArterial ?? { sys: "", dia: "" },
        }));
      }
      setPeso("");
      setFechaPeso(todayISO);
      setError(null);
      const idx = tabs.findIndex((t) => t.id === "pesaje");
      if (idx >= 0) setTabIndex(idx);
    } catch (err3) {
      console.error("[FichaUsuario] submitPeso post-fetch error:", err3);
      setError("Guardado, pero no se pudo actualizar la vista.");
    } finally {
      setSavingPeso(false);
    }
  };

  // Derived data for chart and histórico (use medidasHistorico when available to show full data)
  const timestampToMs = (t) => {
    if (!t) return null;
    if (typeof t === "number") return t;
    if (t?.seconds != null) return t.seconds * 1000 + (t.nanoseconds ? Math.floor(t.nanoseconds / 1e6) : 0);
    if (typeof t?.toDate === "function") return t.toDate().getTime();
    return null;
  };

  const rawHistory = Array.isArray(userData?.medidasHistorico) && userData.medidasHistorico.length > 0
    ? userData.medidasHistorico
    : Array.isArray(userData?.pesoHistorico) ? userData.pesoHistorico : [];

  const mapped = rawHistory.map((p) => {
    const msFecha = p?.fecha ? Date.parse(p.fecha) : null;
    const msCreated = timestampToMs(p?.createdAt);
    const _t = msFecha || msCreated || 0;
    return { ...p, _t };
  });

  const sortedAsc = mapped.sort((a, b) => (a._t || 0) - (b._t || 0));
  const labels = sortedAsc.map((s) => s.fecha || (s._t ? new Date(s._t).toLocaleDateString() : ""));
  const dataPesosClean = sortedAsc.map((s) => {
    const v = s.peso ?? s.pesoActual ?? null;
    return v != null ? Number(v) : null;
  }).filter((v) => v != null);

  const rowsDesc = [...sortedAsc].reverse();

  const exercisesFolder = (userData && userData.driveEjerciciosFolderId) ? userData.driveEjerciciosFolderId : DRIVE_FOLDER_EXERCISES;
  const recipesFolder = (userData && userData.driveRecetasFolderId) ? userData.driveRecetasFolderId : DRIVE_FOLDER_RECIPES;

  const selDay = Number.isFinite(editable._selectedDay) ? editable._selectedDay : 0;
  const saveLabel = saveStatus === "pending" ? "Guardando..." : saveStatus === "saving" ? "Guardando..." : saveStatus === "saved" ? "Guardado" : saveStatus === "error" ? "Error al guardar" : "";

  if (loading) return <div className="card"><p style={{ padding: 16 }}>Cargando ficha...</p></div>;
  if (!userData) {
    return (
      <div className="card" style={{ padding: 12 }}>
        <p style={{ padding: 8, margin: 0 }}>{error ? error : `Sin datos de usuario (UID: ${String(uid)}).`}</p>
        <div style={{ marginTop: 10 }}>
          <button className="btn ghost" onClick={() => window.location.reload()}>Reintentar</button>
          <button className="btn danger" onClick={handleSignOut} style={{ marginLeft: 8 }}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  const chartData = {
    labels,
    datasets: [
      {
        label: "Peso (kg)",
        data: sortedAsc.map((s) => (s.peso ?? s.pesoActual ?? null)),
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
    <div ref={rootRef} className={`ficha-root ${adminMode ? "admin-wide" : ""}`}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", padding: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="avatar">{(userData.nombre?.[0] || userData.email?.[0] || "U").toUpperCase()}</div>
          <div>
            <div className="title">{userData.nombre ? `${userData.nombre} ${userData.apellidos || ""}` : userData.email}</div>
            <div className="subtitle">{userData.email}</div>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn ghost" onClick={() => { setShowProfile(true); }}>Perfil</button>
          {(!targetUid || targetUid === authUid) && (
            <button className="btn danger" onClick={handleSignOut}>Cerrar sesión</button>
          )}
        </div>
      </div>

      <nav className="tabs" role="tablist" aria-label="Secciones" style={{ marginTop: 12 }}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            className={!showProfile && i === tabIndex ? "tab tab-active" : "tab"}
            onClick={() => { setShowProfile(false); setTabIndex(i); }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ marginTop: 12 }}>
        {showProfile ? (
          <div className="card" style={{ padding: 12 }}>
            <h3>Perfil</h3>
            <div className="panel-section">
              <h4 style={{ marginTop: 0 }}>Datos personales</h4>
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
                <input className="input" type="tel" value={editable.telefono || ""} onChange={(e) => setEditable((s) => ({ ...s, telefono: e.target.value }))} />
              </div>

              <hr style={{ margin: "12px 0", border: "none", borderTop: "1px solid #eef7ee" }} />

              <h4>Dieta</h4>
              <div className="field">
                <label>Tipo de dieta</label>
                <select className="input" value={editable.dietaactual || ""} onChange={(e) => setEditable((s) => ({ ...s, dietaactual: e.target.value }))}>
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

              {(editable.ejercicios || userData?.ejercicios) ? null : (
                <div className="field">
                  <label>Descripción ejercicios</label>
                  <textarea className="input" rows={3} value={editable.ejerciciosDescripcion || ""} onChange={(e) => setEditable((s) => ({ ...s, ejerciciosDescripcion: e.target.value }))} />
                </div>
              )}

              {(editable.recetas || userData?.recetas) ? null : (
                <div className="field">
                  <label>Descripción recetas</label>
                  <textarea className="input" rows={3} value={editable.recetasDescripcion || ""} onChange={(e) => setEditable((s) => ({ ...s, recetasDescripcion: e.target.value }))} />
                </div>
              )}

              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button className="btn primary" onClick={saveProfile}>Guardar perfil</button>
                <button className="btn ghost" onClick={() => { loadUser(); }}>Revertir cambios</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Pestañas: Pesaje / Dieta semanal / Ejercicios / Recetas */}
            {tabIndex === 0 && (
              <div className="card" style={{ padding: 12 }}>
                <h3>Pesaje</h3>
                <div className="panel-section">
                  {/* formulario y histórico del pesaje (igual que anteriormente) */}
                  <form onSubmit={submitPeso} style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                      <div style={{ minWidth: 180 }}>
                        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Fecha</label>
                        <input className="input" type="date" value={fechaPeso} onChange={(e) => setFechaPeso(e.target.value)} />
                      </div>

                      <div style={{ minWidth: 180 }}>
                        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Peso (kg)</label>
                        <input className="input" type="number" step="0.1" placeholder="Peso (kg)" value={peso} onChange={(e) => setPeso(e.target.value)} />
                      </div>

                      <div style={{ flex: "1 1 200px", minWidth: 200 }}>
                        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>IMC (opcional)</label>
                        <input className="input" type="number" step="0.1" value={editable.imc || ""} onChange={(e) => setEditable(s => ({ ...s, imc: e.target.value }))} />
                      </div>
                    </div>

                    <div className="pesaje-grid" style={{ marginTop: 12 }}>
                      {/* campos de medidas */}
                      <div className="field">
                        <label>Masa Grasa (%)</label>
                        <input className="input" type="number" step="0.1" value={editable.masaGrasaPct || ""} onChange={(e) => setEditable(s => ({ ...s, masaGrasaPct: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>Masa Grasa (kg)</label>
                        <input className="input" type="number" step="0.01" value={editable.masaGrasaKg || ""} onChange={(e) => setEditable(s => ({ ...s, masaGrasaKg: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>Masa Magra (kg)</label>
                        <input className="input" type="number" step="0.01" value={editable.masaMagraKg || ""} onChange={(e) => setEditable(s => ({ ...s, masaMagraKg: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>Masa Muscular (kg)</label>
                        <input className="input" type="number" step="0.01" value={editable.masaMuscularKg || ""} onChange={(e) => setEditable(s => ({ ...s, masaMuscularKg: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>Masa ósea (kg)</label>
                        <input className="input" type="number" step="0.01" value={editable.masaOseaKg || ""} onChange={(e) => setEditable(s => ({ ...s, masaOseaKg: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>Agua total (kg)</label>
                        <input className="input" type="number" step="0.01" value={editable.aguaTotalKg || ""} onChange={(e) => setEditable(s => ({ ...s, aguaTotalKg: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>% Agua total</label>
                        <input className="input" type="number" step="0.1" value={editable.aguaTotalPct || ""} onChange={(e) => setEditable(s => ({ ...s, aguaTotalPct: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>MB (kcal)</label>
                        <input className="input" type="number" step="1" value={editable.mbKcal || ""} onChange={(e) => setEditable(s => ({ ...s, mbKcal: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>Nivel grasa visceral</label>
                        <input className="input" type="number" step="1" value={editable.grasaVisceralNivel || ""} onChange={(e) => setEditable(s => ({ ...s, grasaVisceralNivel: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>Edad metabólica</label>
                        <input className="input" type="number" step="1" value={editable.edadMetabolica || ""} onChange={(e) => setEditable(s => ({ ...s, edadMetabolica: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>Índice cintura / talla</label>
                        <input className="input" type="number" step="0.01" value={editable.indiceCinturaTalla || ""} onChange={(e) => setEditable(s => ({ ...s, indiceCinturaTalla: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>C. Cintura (cm)</label>
                        <input className="input" type="number" step="0.1" value={editable.circunferenciaCinturaCm || ""} onChange={(e) => setEditable(s => ({ ...s, circunferenciaCinturaCm: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>C. Cadera (cm)</label>
                        <input className="input" type="number" step="0.1" value={editable.circunferenciaCaderaCm || ""} onChange={(e) => setEditable(s => ({ ...s, circunferenciaCaderaCm: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>C. Brazo (cm)</label>
                        <input className="input" type="number" step="0.1" value={editable.circunferenciaBrazoCm || ""} onChange={(e) => setEditable(s => ({ ...s, circunferenciaBrazoCm: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>C. Pierna (cm)</label>
                        <input className="input" type="number" step="0.1" value={editable.circunferenciaPiernaCm || ""} onChange={(e) => setEditable(s => ({ ...s, circunferenciaPiernaCm: e.target.value }))} />
                      </div>
                      <div className="field" style={{ minWidth: 220 }}>
                        <label>TA Sys / Dia (mmHg)</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            className="input"
                            type="number"
                            placeholder="SYS"
                            value={editable.tensionArterial?.sys || ""}
                            onChange={(e) => setEditable(s => ({ ...s, tensionArterial: { ...(s.tensionArterial || {}), sys: e.target.value } }))}
                          />
                          <input
                            className="input"
                            type="number"
                            placeholder="DIA"
                            value={editable.tensionArterial?.dia || ""}
                            onChange={(e) => setEditable(s => ({ ...s, tensionArterial: { ...(s.tensionArterial || {}), dia: e.target.value } }))}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                      <button type="submit" className="btn primary" disabled={savingPeso}>{savingPeso ? "Guardando..." : "Registrar peso y medidas"}</button>
                      <button type="button" className="btn ghost" onClick={() => { setPeso(""); setFechaPeso(todayISO); }}>Limpiar</button>
                    </div>
                  </form>

                  <div style={{ marginTop: 20 }}>
                    <h4>Histórico de medidas</h4>
                    {rowsDesc.length === 0 ? <div className="mensaje">No hay registros.</div> : (
                      <div style={{ overflowX: "auto" }}>
                        <table className="hist-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              <th style={{ padding: 8, borderBottom: "1px solid #ddd" }}>Fecha</th>
                              <th style={{ padding: 8, borderBottom: "1px solid #ddd" }}>Peso (kg)</th>
                              <th style={{ padding: 8, borderBottom: "1px solid #ddd" }}>Masa Gras (%)</th>
                              <th style={{ padding: 8, borderBottom: "1px solid #ddd" }}>Masa Gras (kg)</th>
                              <th style={{ padding: 8, borderBottom: "1px solid #ddd" }}>Masa Magra (kg)</th>
                              <th style={{ padding: 8, borderBottom: "1px solid #ddd" }}>Masa Musc (kg)</th>
                              <th style={{ padding: 8, borderBottom: "1px solid #ddd" }}>Agua (%)</th>
                              <th style={{ padding: 8, borderBottom: "1px solid #ddd" }}>IMC</th>
                              <th style={{ padding: 8, borderBottom: "1px solid #ddd" }}>C. Cintura (cm)</th>
                              <th style={{ padding: 8, borderBottom: "1px solid #ddd" }}>TA (SYS/DIA)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rowsDesc.map((r, i) => (
                              <tr key={`${r._t || i}-${r.peso ?? r.pesoActual ?? i}`}>
                                <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>{r.fecha || (r._t ? new Date(r._t).toLocaleDateString() : "-")}</td>
                                <td style={{ padding: 8, textAlign: "right", borderBottom: "1px solid #f2f2f2" }}>{r.peso ?? r.pesoActual ?? "-"}</td>
                                <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>{r.masaGrasaPct ?? "-"}</td>
                                <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>{r.masaGrasaKg ?? "-"}</td>
                                <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>{r.masaMagraKg ?? "-"}</td>
                                <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>{r.masaMuscularKg ?? "-"}</td>
                                <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>{r.aguaTotalPct ?? "-"}</td>
                                <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>{r.imc ?? "-"}</td>
                                <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>{r.circunferenciaCinturaCm ?? "-"}</td>
                                <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>{r.tensionArterial ? `${r.tensionArterial.sys || "-"} / ${r.tensionArterial.dia || "-"}` : "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <h4>Tendencia (solo peso)</h4>
                    {sortedAsc.length > 0 && dataPesosClean.length > 0 ? <Line data={chartData} options={chartOptions} /> : <div className="mensaje">No hay datos para el gráfico.</div>}
                  </div>
                </div>
              </div>
            )}

            {tabIndex === 1 && (
              <div className="card" style={{ padding: 12 }}>
                <h3>Dieta semanal</h3>
                <div className="panel-section">
                  <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
                    {["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"].map((d, i) => (
                      <button key={d} className={selDay === i ? "tab tab-active" : "tab"} onClick={() => setEditable((s) => ({ ...s, _selectedDay: i }))}>{d}</button>
                    ))}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div className="weekly-menu-grid" style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
                      <div className="weekly-left">
                        {ALL_SECTIONS.map((sec) => <div key={sec.key} className="weekly-label">{sec.label}</div>)}
                      </div>
                      <div className="weekly-right">
                        {ALL_SECTIONS.map((sec) => (
                          <div key={sec.key} className="weekly-field">
                            <textarea
                              className="input weekly-textarea"
                              rows={3}
                              value={(Array.isArray(editable.menu) && editable.menu[selDay] ? editable.menu[selDay][sec.key] : "") || ""}
                              onChange={(e) => {
                                setMenuField(selDay, sec.key, e.target.value);
                                const ta = e.target;
                                ta.style.height = "auto";
                                ta.style.height = Math.max(56, ta.scrollHeight + 2) + "px";
                              }}
                            />
                          </div>
                        ))}
                      </div>
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

            {tabIndex === 2 && (
              <div className="card" style={{ padding: 12 }}>
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
                            setError("No se pudo guardar la descripción de ejercicios.");
                          }
                        }}>Guardar descripción</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tabIndex === 3 && (
              <div className="card" style={{ padding: 12 }}>
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
                            setError("No se pudo guardar la descripción de recetas.");
                          }
                        }}>Guardar descripción</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
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