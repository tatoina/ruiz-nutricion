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

import { useNavigate } from "react-router-dom";

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
 * src/components/FichaUsuario.js
 *
 * Basado en la versión 79 que proporcionaste, con:
 * - botón "Nuevo cliente" en cabecera (solo visible para admin@admin.es)
 * - uso de useNavigate para navegar a /register
 * - ajuste del contenedor del gráfico (clase .chart-container)
 *
 * Esta es la versión completa listada línea a línea (sin omisiones).
 */

export default function FichaUsuario({ targetUid = null, adminMode = false }) {
  const navigate = useNavigate();

  const DEFAULT_CLINIC_LOGO =
    "https://raw.githubusercontent.com/tatoina/ruiz-nutricion/564ee270d5f1a4c692bdd730ce055dd6aab0bfae/public/logoclinica-512.png";

  const tabs = [
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

  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printOptions, setPrintOptions] = useState({ dietaMensual: true, datosPesaje: true });

  const [showProfile, setShowProfile] = useState(false);

  const [peso, setPeso] = useState("");
  const todayISO = new Date().toISOString().slice(0, 10);
  const [fechaPeso, setFechaPeso] = useState(() => todayISO);
  const [savingPeso, setSavingPeso] = useState(false);

  const saveTimerRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  const rootRef = useRef(null);

  const chartRef = useRef(null);

  const todayIndex = (() => {
    const d = new Date();
    const day = d.getDay();
    return day === 0 ? 6 : day - 1;
  })();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthUid(u ? u.uid : null);
    });
    return () => unsub();
  }, []);

  // handleSignOut defined as function to be available in JSX
  async function handleSignOut() {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("[FichaUsuario] signOut error:", err);
      setError("No se pudo cerrar sesión.");
    }
  }

  const uid = targetUid || authUid;

  const emptyDayMenu = useCallback(() => ({
    desayuno: "", almuerzo: "", comida: "", merienda: "", cena: "", consejos: ""
  }), []);

  const normalizeMenu = useCallback((rawMenu) => {
    const defaultMenu = Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
    if (!Array.isArray(rawMenu)) return defaultMenu;
    const isStringArray = rawMenu.every((it) => typeof it === "string" || it == null);
    if (isStringArray) {
      return Array.from({ length: 7 }, (_, i) => ({ ...emptyDayMenu(), comida: rawMenu[i] || "" }));
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

  // load user
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        if (!uid) { setLoading(false); return; }
        if (!db) { setError("Error interno: Firestore no inicializado."); setLoading(false); return; }
        const snap = await getDoc(doc(db, "users", uid));
        if (!mounted) return;
        if (!snap.exists()) {
          setUserData(null);
          setEditable((prev) => ({ ...prev, menu: Array.from({ length: 7 }, () => ({ ...emptyDayMenu() })), _selectedDay: todayIndex }));
          setError(`No hay ficha para este usuario (UID: ${uid}).`);
        } else {
          const data = snap.data();
          setUserData(data);
          setEditable((prev) => ({
            nombre: data.nombre || "", apellidos: data.apellidos || "", nacimiento: data.nacimiento || "",
            telefono: data.telefono || "", dietaactual: data.dietaactual || "", dietaOtros: data.dietaOtros || "",
            restricciones: data.restricciones || "", ejercicios: !!data.ejercicios, recetas: !!data.recetas,
            ejerciciosDescripcion: data.ejerciciosDescripcion || "", recetasDescripcion: data.recetasDescripcion || "",
            menu: normalizeMenu(data.menu),
            _selectedDay: typeof data._selectedDay === "number" ? data._selectedDay : todayIndex,

            pesoActual: data.pesoActual ?? prev.pesoActual ?? "",
            masaGrasaPct: data.masaGrasaPct ?? prev.masaGrasaPct ?? "",
            masaGrasaKg: data.masaGrasaKg ?? prev.masaGrasaKg ?? "",
            masaMagraKg: data.masaMagraKg ?? prev.masaMagraKg ?? "",
            masaMuscularKg: data.masaMuscularKg ?? prev.masaMuscularKg ?? "",
            aguaTotalKg: data.aguaTotalKg ?? prev.aguaTotalKg ?? "",
            aguaTotalPct: data.aguaTotalPct ?? prev.aguaTotalPct ?? "",
            masaOseaKg: data.masaOseaKg ?? prev.masaOseaKg ?? "",
            mbKcal: data.mbKcal ?? prev.mbKcal ?? "", grasaVisceralNivel: data.grasaVisceralNivel ?? prev.grasaVisceralNivel ?? "",
            imc: data.imc ?? prev.imc ?? "", edadMetabolica: data.edadMetabolica ?? prev.edadMetabolica ?? "",
            indiceCinturaTalla: data.indiceCinturaTalla ?? prev.indiceCinturaTalla ?? "",
            circunferenciaBrazoCm: data.circunferenciaBrazoCm ?? prev.circunferenciaBrazoCm ?? "",
            circunferenciaCinturaCm: data.circunferenciaCinturaCm ?? prev.circunferenciaCinturaCm ?? "",
            circunferenciaCaderaCm: data.circunferenciaCaderaCm ?? prev.circunferenciaCaderaCm ?? "",
            circunferenciaPiernaCm: data.circunferenciaPiernaCm ?? prev.circunferenciaPiernaCm ?? "",
            tensionArterial: data.tensionArterial ?? prev.tensionArterial ?? { sys: "", dia: "" },
            notas: data.notas ?? prev.notas ?? "",
            ...prev,
          }));
          setError(null);
        }
      } catch (err) {
        console.error("[FichaUsuario] load error:", err);
        setError(err?.message || "Error al cargar la ficha.");
        setUserData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [uid, normalizeMenu, emptyDayMenu, todayIndex]);

  // autosize weekly textareas
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

  useEffect(() => { autosizeTextareas(); }, [editable.menu, tabIndex, loading, autosizeTextareas]);

  const setMenuField = (dayIndex, field, value) => {
    setEditable((s) => {
      const menu = Array.isArray(s.menu) ? [...s.menu] : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      menu[dayIndex] = { ...menu[dayIndex], [field]: value };
      return { ...s, menu };
    });
  };

  // autosave menu
  useEffect(() => {
    if (!uid) return;
    if (!editable.menu) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }

    setSaveStatus("pending");
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const menuToSave = Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
        await updateDoc(doc(db, "users", uid), { menu: menuToSave, updatedAt: serverTimestamp() });
        setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 1200);
      } catch (err) {
        console.error("[FichaUsuario] autosave error:", err);
        const notFoundCodes = ["not-found", "notFound", "404"];
        const isNotFound = err?.code ? notFoundCodes.some((c) => String(err.code).toLowerCase().includes(String(c).toLowerCase())) : false;
        if (isNotFound) {
          try {
            await setDoc(doc(db, "users", uid), { menu: Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() })), updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
            setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 1200);
          } catch (err2) {
            console.error("[FichaUsuario] autosave fallback error:", err2);
            setSaveStatus("error"); setError(err2?.message || "No se pudo guardar el menú.");
          }
        } else {
          setSaveStatus("error"); setError(err?.message || "No se pudo guardar el menú.");
        }
      }
    }, 1200);

    return () => { if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; } };
  }, [editable.menu, uid, emptyDayMenu]);

  const saveSemana = async () => {
    if (!uid) { setError("Usuario objetivo no disponible."); return; }
    setSaveStatus("saving");
    try {
      const menuToSave = Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      await updateDoc(doc(db, "users", uid), { menu: menuToSave, updatedAt: serverTimestamp() });
      setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 1200);
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
    } catch (err) {
      console.error("[FichaUsuario] saveSemana error:", err);
      setSaveStatus("error"); setError(err?.message || "No se pudo guardar el menú semanal.");
    }
  };

  const saveVersionMenu = async () => {
    if (!uid) { setError("Usuario objetivo no disponible."); return; }
    try {
      const menuToSave = Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      await updateDoc(doc(db, "users", uid), { menuHistorico: arrayUnion({ createdAt: serverTimestamp(), menu: menuToSave }), updatedAt: serverTimestamp() });
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
    } catch (err) {
      console.error("[FichaUsuario] saveVersionMenu error:", err);
      setError(err?.message || "No se pudo guardar la versión del menú.");
    }
  };

  const saveProfile = async () => {
    if (!uid) { setError("Usuario objetivo no disponible."); return; }
    setError(null);
    try {
      const payload = {
        nombre: editable.nombre || "", apellidos: editable.apellidos || "", nacimiento: editable.nacimiento || "",
        telefono: editable.telefono || "", dietaactual: editable.dietaactual || "", dietaOtros: editable.dietaOtros || "",
        restricciones: editable.restricciones || "", ejercicios: !!editable.ejercicios, recetas: !!editable.recetas,
        ejerciciosDescripcion: editable.ejerciciosDescripcion || "", recetasDescripcion: editable.recetasDescripcion || "",
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "users", uid), payload);
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
      setShowProfile(false);
    } catch (err) {
      console.error("[FichaUsuario] saveProfile error:", err);
      setError("No se pudieron guardar los datos del perfil.");
    }
  };

  // parse & submit peso
  const parseNum = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const validateMeasures = (pesoValue, editableState) => {
    const p = parseNum(pesoValue);
    if (p !== null && (p <= 0 || p > 500)) return "Peso fuera de rango (0-500 kg).";
    const mgPct = parseNum(editableState?.masaGrasaPct);
    if (mgPct !== null && (mgPct < 0 || mgPct > 100)) return "Masa grasa (%) debe estar entre 0 y 100.";
    return null;
  };

  const submitPeso = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!uid) { setError("Usuario objetivo no disponible."); return; }
    const ed = { ...editable };
    const pesoValue = parseNum(peso);
    const vError = validateMeasures(pesoValue, ed);
    if (vError) { setError(vError); return; }

    setSavingPeso(true); setError(null);
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
      masaGrasaPct, masaGrasaKg, masaMagraKg,
      masaMuscularKg: parseNum(ed.masaMuscularKg),
      aguaTotalKg: parseNum(ed.aguaTotalKg),
      aguaTotalPct: parseNum(ed.aguaTotalPct),
      masaOseaKg: parseNum(ed.masaOseaKg),
      mbKcal: parseNum(ed.mbKcal),
      grasaVisceralNivel: parseNum(ed.grasaVisceralNivel),
      imc: parseNum(ed.imc),
      edadMetabolica: parseNum(ed.edadMetabolica),
      indiceCinturaTalla: ed.indiceCinturaTalla || "",
      circunferenciaBrazoCm: parseNum(ed.circunferenciaBrazoCm),
      circunferenciaCinturaCm: parseNum(ed.circunferenciaCinturaCm),
      circunferenciaCaderaCm: parseNum(ed.circunferenciaCaderaCm),
      circunferenciaPiernaCm: parseNum(ed.circunferenciaPiernaCm),
      tensionArterial: { sys: ed.tensionArterial?.sys || "", dia: ed.tensionArterial?.dia || "" },
      notas: ed.notas || "", createdAt: serverTimestamp(),
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
          notas: data.notas ?? prev.notas ?? "",
        }));
      }
      setPeso(""); setFechaPeso(todayISO); setError(null);
      setTabIndex(tabs.findIndex((t) => t.id === "pesaje"));
    } catch (err3) {
      console.error("[FichaUsuario] submitPeso post-fetch error:", err3);
      setError("Guardado, pero no se pudo actualizar la vista.");
    } finally {
      setSavingPeso(false);
    }
  };

  // chart helpers
  const timestampToMs = (t) => {
    if (!t) return null;
    if (typeof t === "number") return t;
    if (t?.seconds != null) return t.seconds * 1000 + (t.nanoseconds ? Math.floor(t.nanoseconds / 1e6) : 0);
    if (typeof t?.toDate === "function") return t.toDate().getTime();
    return null;
  };

  const formatDate = (tMs) => {
    if (!tMs) return "";
    const d = new Date(Number(tMs));
    return d.toLocaleString();
  };

  const rowsDesc = (() => {
    const rawHistory =
      Array.isArray(userData?.medidasHistorico) && userData.medidasHistorico.length > 0
        ? userData.medidasHistorico
        : Array.isArray(userData?.pesoHistorico)
        ? userData.pesoHistorico
        : [];
    const mapped = rawHistory.map((p) => {
      let msFecha = null;
      if (p?.fecha) {
        if (typeof p.fecha === "string") msFecha = Date.parse(p.fecha) || null;
        else msFecha = timestampToMs(p.fecha);
      }
      const msCreated = timestampToMs(p?.createdAt);
      const _t = msFecha || msCreated || 0;
      return { ...p, _t };
    });
    return mapped.sort((a, b) => (b._t || 0) - (a._t || 0));
  })();

  const mappedForChart = rowsDesc.map((p) => ({ ...p })).sort((a, b) => (a._t || 0) - (b._t || 0));
  const labels = mappedForChart.map((s) => s.fecha || (s._t ? new Date(s._t).toLocaleDateString() : ""));
  const chartData = { labels, datasets: [{ label: "Peso (kg)", data: mappedForChart.map((s) => (s.peso ?? s.pesoActual ?? null)), borderColor: "#16a34a", backgroundColor: "rgba(34,197,94,0.12)", tension: 0.25, fill: true, pointRadius: 4 }] };
  const chartOptions = { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } };

  const menuHistoryRaw = Array.isArray(userData?.menuHistorico) ? userData.menuHistorico : [];
  const menuHistoryMapped = menuHistoryRaw.map((m) => ({ ...m, _t: timestampToMs(m?.createdAt || m?.when || m?.fecha) || 0 })).sort((a, b) => (b._t || 0) - (a._t || 0));

  const selDay = Number.isFinite(editable._selectedDay) ? editable._selectedDay : todayIndex;
  const dayName = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][selDay];

  const saveLabel = saveStatus === "pending" ? "Guardando..." : saveStatus === "saving" ? "Guardando..." : saveStatus === "saved" ? "Guardado" : saveStatus === "error" ? "Error al guardar" : "";

  const [histLimit, setHistLimit] = useState(10);
  const [expandedRowsStateLocal, setExpandedRowsStateLocal] = useState({});

  const toggleExpandRowLocal = (idx) => setExpandedRowsStateLocal((s) => ({ ...s, [idx]: !s[idx] }));

  const renderCell = (val) => {
    if (val === null || val === undefined || val === "") return "—";
    const s = String(val);
    if (s.length <= 200) return s;
    return s.slice(0, 200) + "…";
  };

  const exportHistoryCSV = () => {
    try {
      if (!Array.isArray(rowsDesc) || rowsDesc.length === 0) return;
      const headers = ["Fecha","Peso","Masa grasa %","Masa grasa (kg)","Masa magra (kg)","Masa muscular (kg)","Agua (kg)","% Agua","Masa ósea (kg)","MB (kcal)","Grasa visceral","IMC","Edad metabólica","C. Brazo (cm)","C. Cintura (cm)","C. Cadera (cm)","C. Pierna (cm)","Índice C/T","TA (SYS/DIA)","Notas"];
      const rows = rowsDesc.map((r) => {
        const ta = r.tensionArterial || {};
        return [ r.fecha || (r._t ? new Date(r._t).toLocaleString() : ""), r.peso ?? r.pesoActual ?? "", r.masaGrasaPct ?? "", r.masaGrasaKg ?? "", r.masaMagraKg ?? "", r.masaMuscularKg ?? "", r.aguaTotalKg ?? "", r.aguaTotalPct ?? "", r.masaOseaKg ?? "", r.mbKcal ?? "", r.grasaVisceralNivel ?? "", r.imc ?? "", r.edadMetabolica ?? "", r.circunferenciaBrazoCm ?? "", r.circunferenciaCinturaCm ?? "", r.circunferenciaCaderaCm ?? "", r.circunferenciaPiernaCm ?? "", r.indiceCinturaTalla ?? "", `${ta.sys || ""}${ta.dia ? ` / ${ta.dia}` : ""}`, (r.notas || "").replace(/\n/g, " ") ];
      });
      const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `historial_medidas_${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (err) { console.error("Export CSV error:", err); }
  };

  /* ============================
     PRINT / PDF helpers
     ============================ */

  const escapeHtmlForInject = (unsafe) => {
    if (unsafe === null || unsafe === undefined) return "";
    return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };

  const imgUrlToDataUrl = async (url) => {
    if (!url) return null;
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("Fetch failed: " + res.status);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn("No se pudo convertir la URL del logo a dataURL:", err);
      return null;
    }
  };

  const buildDietaWeeklyHTML = () => {
    const menuTemplate = Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
    const dayNames = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
    const esc = (s) => escapeHtmlForInject(s || "");

    let html = `<div class="print-section dieta-week">
      <h2 style="margin:0 0 12px 0;color:#064e3b">Dieta semanal — Plantilla</h2>
      <table class="print-calendar" border="0" cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:24px 16px;background:#f7fff9;border:1px solid #e6f3ea">Comida / Día</th>`;
    for (let d = 0; d < 7; d++) html += `<th style="text-align:center;padding:24px 16px;background:#f7fff9;border:1px solid #e6f3ea">${dayNames[d]}</th>`;
    html += `</tr></thead><tbody>`;

    for (let r = 0; r < ALL_SECTIONS.length; r++) {
      const sec = ALL_SECTIONS[r];
      html += `<tr>
        <td style="vertical-align:top;padding:20px;border:1px solid #eef6ee;font-weight:700;width:18%;background:#fff">${escapeHtmlForInject(sec.label)}</td>`;
      for (let d = 0; d < 7; d++) {
        const m = (menuTemplate[d] && menuTemplate[d][sec.key]) ? menuTemplate[d][sec.key] : "";
        html += `<td style="vertical-align:top;padding:20px;border:1px solid #eef6ee;min-height:160px;word-break:break-word">${esc(m)}</td>`;
      }
      html += `</tr>`;
    }

    html += `</tbody></table></div>`;
    return html;
  };

  const buildPesajeHTML = async () => {
    let chartImg = "";
    try {
      if (chartRef.current) {
        if (typeof chartRef.current.toBase64Image === "function") chartImg = chartRef.current.toBase64Image();
        else if (chartRef.current.chartInstance && typeof chartRef.current.chartInstance.toBase64Image === "function") chartImg = chartRef.current.chartInstance.toBase64Image();
        else if (chartRef.current.chart && typeof chartRef.current.chart.toBase64Image === "function") chartImg = chartRef.current.chart.toBase64Image();
        else if (chartRef.current.canvas && typeof chartRef.current.canvas.toDataURL === "function") chartImg = chartRef.current.canvas.toDataURL("image/png");
      }
      if (!chartImg) {
        const root = rootRef.current || document;
        const canvas = root.querySelector("canvas");
        if (canvas && typeof canvas.toDataURL === "function") {
          try { chartImg = canvas.toDataURL("image/png"); } catch (e) { console.warn("toDataURL falló (canvas puede estar tainted):", e); chartImg = ""; }
        }
      }
    } catch (err) {
      console.warn("No se pudo generar imagen del gráfico para impresión:", err);
      chartImg = "";
    }

    const rows = rowsDesc.map((r) => {
      const ta = r.tensionArterial || {};
      return `<tr>
        <td>${escapeHtmlForInject(r.fecha || (r._t ? new Date(r._t).toLocaleString() : ""))}</td>
        <td>${escapeHtmlForInject(r.peso ?? r.pesoActual ?? "")}</td>
        <td>${escapeHtmlForInject(r.masaGrasaPct ?? "")}</td>
        <td>${escapeHtmlForInject(r.masaGrasaKg ?? "")}</td>
        <td>${escapeHtmlForInject(r.masaMagraKg ?? "")}</td>
        <td>${escapeHtmlForInject(r.masaMuscularKg ?? "")}</td>
        <td>${escapeHtmlForInject(r.aguaTotalKg ?? "")}</td>
        <td>${escapeHtmlForInject(r.aguaTotalPct ?? "")}</td>
        <td>${escapeHtmlForInject(r.masaOseaKg ?? "")}</td>
        <td>${escapeHtmlForInject(r.mbKcal ?? "")}</td>
        <td>${escapeHtmlForInject(r.grasaVisceralNivel ?? "")}</td>
        <td>${escapeHtmlForInject(r.imc ?? "")}</td>
        <td>${escapeHtmlForInject(r.edadMetabolica ?? "")}</td>
        <td>${escapeHtmlForInject(r.circunferenciaBrazoCm ?? "")}</td>
        <td>${escapeHtmlForInject(r.circunferenciaCinturaCm ?? "")}</td>
        <td>${escapeHtmlForInject(r.circunferenciaCaderaCm ?? "")}</td>
        <td>${escapeHtmlForInject(r.circunferenciaPiernaCm ?? "")}</td>
        <td>${escapeHtmlForInject(r.indiceCinturaTalla ?? "")}</td>
        <td>${escapeHtmlForInject(`${ta.sys || ""}${ta.dia ? ` / ${ta.dia}` : ""}`)}</td>
        <td>${escapeHtmlForInject(r.notas || "")}</td>
      </tr>`;
    }).join("");

    const tableHtml = `<div class="print-section pesaje-historico">
      <h2 style="margin:0 0 12px 0;color:#064e3b">Histórico de medidas</h2>
      ${chartImg ? `<div class="chart-print" style="margin:12px 0"><img src="${chartImg}" alt="Gráfico de peso" style="max-width:100%;height:auto;border:1px solid #eee;padding:6px;background:#fff" /></div>` : ""}
      <table class="print-hist-table" style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th>Fecha</th><th>Peso</th><th>Masa grasa %</th><th>Masa grasa (kg)</th><th>Masa magra (kg)</th>
            <th>Masa muscular (kg)</th><th>Agua (kg)</th><th>% Agua</th><th>Masa ósea (kg)</th><th>MB (kcal)</th>
            <th>Grasa visceral</th><th>IMC</th><th>Edad metab.</th><th>C. Brazo</th><th>C. Cintura</th><th>C. Cadera</th><th>C. Pierna</th><th>Índice C/T</th><th>TA (SYS/DIA)</th><th>Notas</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="20">Sin registros</td></tr>'}
        </tbody>
      </table>
    </div>`;
    return tableHtml;
  };

  const ensureHtml2Pdf = () => {
    return new Promise((resolve, reject) => {
      if (window && window.html2pdf) return resolve();
      const existing = document.querySelector('script[data-html2pdf]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", (e) => reject(e));
        return;
      }
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.3/html2pdf.bundle.min.js";
      s.setAttribute("data-html2pdf", "1");
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  };

  // generate PDF in-page (no popup)
  const handlePrint = async () => {
    setShowPrintDialog(false);
    try {
      const parts = [];
      if (printOptions.dietaMensual) parts.push(buildDietaWeeklyHTML());
      if (printOptions.datosPesaje) {
        const p = await buildPesajeHTML();
        parts.push(p);
      }

      const headerName = escapeHtmlForInject(userData ? (userData.nombre ? `${userData.nombre} ${userData.apellidos || ""}` : userData.email || "Usuario") : "Usuario");
      const headerDate = new Date().toLocaleString();
      const filenameSafe = (userData && userData.nombre ? userData.nombre.replace(/\s+/g, "_") : "ficha") + "_" + new Date().toISOString().slice(0,10);

      const printCSS = `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; color:#062017; background: #fff; margin:0; }
        #pdf-root { padding: 18px; }
        .pdf-header { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
        .pdf-logo { width:64px; height:64px; flex:0 0 64px; display:flex; align-items:center; justify-content:center; background:#064e3b; border-radius:8px; color:#fff; font-weight:700; }
        h1 { margin:0; font-size:18px; color:#064e3b; }
        .pdf-meta { font-size:13px; color:#374151; }
        .print-calendar th, .print-calendar td { padding:24px 16px; }
        .print-calendar td { min-height:160px; vertical-align:top; word-break:break-word; }
        .print-hist-table th, .print-hist-table td { padding:8px; font-size:11px; vertical-align:top; }
        table { page-break-inside:auto; }
        tr { page-break-inside:avoid; page-break-after:auto; }
        .page { page-break-after: always; break-after: page; }
        .page:last-child { page-break-after: auto; break-after: auto; }
        @media print { #pdf-root { padding: 8mm; } }
      `;

      const logoUrl = DEFAULT_CLINIC_LOGO;
      let logoData = null;
      try { logoData = await imgUrlToDataUrl(logoUrl); } catch (e) { logoData = null; }

      const logoHtml = logoData ? `<img src="${logoData}" alt="Logo" style="width:64px;height:64px;object-fit:contain;border-radius:8px" />` : `<img src="${escapeHtmlForInject(logoUrl)}" alt="Logo" style="width:64px;height:64px;object-fit:contain;border-radius:8px" onerror="this.style.display='none'" />`;

      const firstPart = parts[0] || "";
      const secondPart = parts.slice(1).join("<hr style='margin:18px 0;border:none;border-top:1px solid #eee'/>") || "";

      const pdfInner = `
        <div id="pdf-root">
          <div class="pdf-header">
            ${logoHtml}
            <div style="flex:1">
              <h1>${headerName}</h1>
              <div class="pdf-meta">Generado: ${headerDate}</div>
            </div>
            <div style="text-align:right;font-size:12px;color:#374151">Ficha imprimible</div>
          </div>

          <div class="page">
            ${firstPart}
          </div>

          <div class="page">
            ${secondPart}
          </div>
        </div>
      `;

      const container = document.createElement("div");
      container.id = "pdf-temp-root";
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "210mm";
      container.style.height = "297mm";
      container.style.overflow = "hidden";
      container.innerHTML = `<style>${printCSS}</style>${pdfInner}`;
      document.body.appendChild(container);

      await ensureHtml2Pdf();

      const element = container.querySelector("#pdf-root");
      const opt = {
        margin: 8,
        filename: `${filenameSafe}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      };

      try {
        await window.html2pdf().set(opt).from(element).save();
      } catch (err) {
        console.error("html2pdf error:", err);
        alert("Ocurrió un error generando el PDF. Mira la consola para más detalles.");
      } finally {
        setTimeout(() => {
          try { document.body.removeChild(container); } catch (e) {}
        }, 600);
      }
    } catch (err) {
      console.error("handlePrint error:", err);
      alert("No se pudo generar el PDF. Revisa la consola.");
    }
  };

  // Render UI
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

        <div className="header-actions" style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" onClick={() => setShowProfile((s) => !s)} aria-expanded={showProfile}>Perfil</button>

          

          <button className="btn ghost" title="Generar PDF" onClick={() => setShowPrintDialog(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
              <path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 18H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="6" y="14" width="12" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            PDF
          </button>

          {(!targetUid || targetUid === authUid) && <button className="btn danger" onClick={handleSignOut}>Cerrar sesión</button>}
        </div>
      </div>

      {showPrintDialog && (
        <div className="print-modal-backdrop" role="dialog" aria-modal="true">
          <div className="print-modal">
            <h3>Generar PDF</h3>
            <p style={{ marginTop: 6, color: "#374151" }}>Elige qué deseas incluir en el PDF:</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={printOptions.dietaMensual} onChange={(e) => setPrintOptions((s) => ({ ...s, dietaMensual: e.target.checked }))} />
                Dieta semanal (plantilla)
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                <input type="checkbox" checked={printOptions.datosPesaje} onChange={(e) => setPrintOptions((s) => ({ ...s, datosPesaje: e.target.checked }))} />
                Datos de pesaje (histórico + gráfico)
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button className="btn ghost" onClick={() => setShowPrintDialog(false)}>Cancelar</button>
              <button className="btn primary" onClick={handlePrint} disabled={!printOptions.dietaMensual && !printOptions.datosPesaje}>Generar PDF</button>
            </div>
          </div>
        </div>
      )}

      {showProfile && (
        <div className="card" style={{ padding: 12, margin: "0 12px 12px 12px" }}>
          <h3>Perfil</h3>
          <div className="panel-section">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Nombre</label><input className="input" value={editable.nombre || ""} onChange={(e) => setEditable((s) => ({ ...s, nombre: e.target.value }))} /></div>
              <div className="field"><label>Apellidos</label><input className="input" value={editable.apellidos || ""} onChange={(e) => setEditable((s) => ({ ...s, apellidos: e.target.value }))} /></div>
              <div className="field"><label>Fecha de nacimiento</label><input className="input" type="date" value={editable.nacimiento || ""} onChange={(e) => setEditable((s) => ({ ...s, nacimiento: e.target.value }))} /></div>
              <div className="field"><label>Teléfono</label><input className="input" type="tel" inputMode="tel" value={editable.telefono || ""} onChange={(e) => setEditable((s) => ({ ...s, telefono: e.target.value }))} /></div>
            </div>

            <hr style={{ margin: "12px 0" }} />

            <h4>Datos de dieta</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field">
                <label>Tipo de dieta</label>
                <select className="input" value={editable.dietaactual || ""} onChange={(e) => setEditable((s) => ({ ...s, dietaactual: e.target.value }))}>
                  <option value="">-- Selecciona --</option>
                  <option value="perdida_grasa">Pérdida de grasa</option>
                  <option value="antiinflamatoria">Antiinflamatoria</option>
                  <option value="ganancia_muscular">Ganancia muscular</option>
                  <option value="aprendiendo_a_comer">Aprendiendo a comer</option>
                  <option value="otros">Otros</option>
                </select>
                {editable.dietaactual === "otros" && <input className="input" placeholder="Describe la dieta" value={editable.dietaOtros || ""} onChange={(e) => setEditable((s) => ({ ...s, dietaOtros: e.target.value }))} />}
              </div>

              <div className="field"><label>Restricciones / Alergias</label><input className="input" value={editable.restricciones || ""} onChange={(e) => setEditable((s) => ({ ...s, restricciones: e.target.value }))} /></div>

              <div className="field" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <label style={{ minWidth: 160 }}>¿Ejercicios asignados?</label>
                <select value={editable.ejercicios ? "si" : "no"} onChange={(e) => setEditable((s) => ({ ...s, ejercicios: e.target.value === "si" }))}><option value="si">Sí</option><option value="no">No</option></select>
              </div>

              <div className="field" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <label style={{ minWidth: 160 }}>¿Recetas asignadas?</label>
                <select value={editable.recetas ? "si" : "no"} onChange={(e) => setEditable((s) => ({ ...s, recetas: e.target.value === "si" }))}><option value="si">Sí</option><option value="no">No</option></select>
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}><label>Descripción ejercicios</label><textarea className="input" rows={3} value={editable.ejerciciosDescripcion || ""} onChange={(e) => setEditable((s) => ({ ...s, ejerciciosDescripcion: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: "1 / -1" }}><label>Descripción recetas</label><textarea className="input" rows={3} value={editable.recetasDescripcion || ""} onChange={(e) => setEditable((s) => ({ ...s, recetasDescripcion: e.target.value }))} /></div>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button className="btn primary" onClick={saveProfile}>Guardar perfil y dieta</button>
              <button className="btn ghost" onClick={() => { setEditable((prev) => ({ ...prev, nombre: userData.nombre || "", apellidos: userData.apellidos || "", nacimiento: userData.nacimiento || "", telefono: userData.telefono || "", dietaactual: userData.dietaactual || "", dietaOtros: userData.dietaOtros || "", restricciones: userData.restricciones || "", ejercicios: !!userData.ejercicios, recetas: !!userData.recetas, ejerciciosDescripcion: userData.ejerciciosDescripcion || "", recetasDescripcion: userData.recetasDescripcion || "" })); setShowProfile(false); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Main content (pesaje, dieta, etc.) */}
      {!showProfile && (
        <>
          <nav className="tabs" role="tablist" aria-label="Secciones" style={{ marginTop: 12 }}>
            {tabs.map((t, i) => (<button key={t.id} className={i === tabIndex ? "tab tab-active" : "tab"} onClick={() => setTabIndex(i)}>{t.label}</button>))}
          </nav>

          <div style={{ marginTop: 12 }}>
            {tabIndex === 0 && (
              <div className="card pesaje-section-wrapper" style={{ padding: 12 }}>
                <h3>Pesaje / Composición</h3>
                <div className="panel-section">
                  <div className="pesaje-actions" style={{ marginBottom: 12 }}>
                    <button className="btn primary" type="submit" disabled={savingPeso} onClick={submitPeso}>{savingPeso ? "Guardando..." : "Guardar medidas"}</button>
                    <button type="button" className="btn ghost" onClick={() => { setPeso(""); setFechaPeso(todayISO); }}>Limpiar</button>
                    <div style={{ marginLeft: 8, color: "#6b7280" }}>{saveLabel}</div>
                  </div>

                  <div className="pesaje-container">
                    <div className="pesaje-grid">
                      <div><label>Fecha</label><input type="date" className="input" value={fechaPeso} onChange={(e) => setFechaPeso(e.target.value)} /></div>
                      <div><label>Peso (kg)</label><input type="number" inputMode="decimal" step="0.1" className="input" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder={String(userData.pesoActual ?? "")} /></div>
                      <div><label>Masa grasa (%)</label><input type="number" inputMode="decimal" step="0.1" className="input" value={editable.masaGrasaPct ?? ""} onChange={(e) => setEditable((s) => ({ ...s, masaGrasaPct: e.target.value }))} /></div>
                      <div><label>Masa grasa (kg)</label><input type="number" inputMode="decimal" step="0.01" className="input" value={editable.masaGrasaKg ?? ""} onChange={(e) => setEditable((s) => ({ ...s, masaGrasaKg: e.target.value }))} /></div>
                      <div><label>Masa magra (kg)</label><input type="number" inputMode="decimal" step="0.01" className="input" value={editable.masaMagraKg ?? ""} onChange={(e) => setEditable((s) => ({ ...s, masaMagraKg: e.target.value }))} /></div>
                      <div><label>Masa muscular (kg)</label><input type="number" inputMode="decimal" step="0.01" className="input" value={editable.masaMuscularKg ?? ""} onChange={(e) => setEditable((s) => ({ ...s, masaMuscularKg: e.target.value }))} /></div>
                      <div><label>Agua total (kg)</label><input type="number" inputMode="decimal" step="0.01" className="input" value={editable.aguaTotalKg ?? ""} onChange={(e) => setEditable((s) => ({ ...s, aguaTotalKg: e.target.value }))} /></div>
                      <div><label>% Agua total</label><input type="number" inputMode="decimal" step="0.1" className="input" value={editable.aguaTotalPct ?? ""} onChange={(e) => setEditable((s) => ({ ...s, aguaTotalPct: e.target.value }))} /></div>
                      <div><label>Masa ósea (kg)</label><input type="number" inputMode="decimal" step="0.01" className="input" value={editable.masaOseaKg ?? ""} onChange={(e) => setEditable((s) => ({ ...s, masaOseaKg: e.target.value }))} /></div>
                      <div><label>MB (kcal)</label><input type="number" inputMode="numeric" step="1" className="input" value={editable.mbKcal ?? ""} onChange={(e) => setEditable((s) => ({ ...s, mbKcal: e.target.value }))} /></div>
                      <div><label>Nivel grasa visceral</label><input type="number" inputMode="numeric" step="1" className="input" value={editable.grasaVisceralNivel ?? ""} onChange={(e) => setEditable((s) => ({ ...s, grasaVisceralNivel: e.target.value }))} /></div>
                      <div><label>IMC</label><input type="number" inputMode="decimal" step="0.1" className="input" value={editable.imc ?? ""} onChange={(e) => setEditable((s) => ({ ...s, imc: e.target.value }))} /></div>
                      <div><label>Edad metabólica</label><input type="number" inputMode="numeric" step="1" className="input" value={editable.edadMetabolica ?? ""} onChange={(e) => setEditable((s) => ({ ...s, edadMetabolica: e.target.value }))} /></div>
                      <div><label>C. Brazo (cm)</label><input type="number" inputMode="decimal" step="0.1" className="input" value={editable.circunferenciaBrazoCm ?? ""} onChange={(e) => setEditable((s) => ({ ...s, circunferenciaBrazoCm: e.target.value }))} /></div>
                      <div><label>C. Cintura (cm)</label><input type="number" inputMode="decimal" step="0.1" className="input" value={editable.circunferenciaCinturaCm ?? ""} onChange={(e) => setEditable((s) => ({ ...s, circunferenciaCinturaCm: e.target.value }))} /></div>
                      <div><label>C. Cadera (cm)</label><input type="number" inputMode="decimal" step="0.1" className="input" value={editable.circunferenciaCaderaCm ?? ""} onChange={(e) => setEditable((s) => ({ ...s, circunferenciaCaderaCm: e.target.value }))} /></div>
                      <div><label>C. Pierna (cm)</label><input type="number" inputMode="decimal" step="0.1" className="input" value={editable.circunferenciaPiernaCm ?? ""} onChange={(e) => setEditable((s) => ({ ...s, circunferenciaPiernaCm: e.target.value }))} /></div>
                      <div><label>Índice cintura / talla</label><input type="text" className="input" value={editable.indiceCinturaTalla ?? ""} onChange={(e) => setEditable((s) => ({ ...s, indiceCinturaTalla: e.target.value }))} /></div>
                      <div><label>TA (SYS / DIA)</label><div className="tension-group"><input type="number" className="input" placeholder="SYS" value={editable.tensionArterial?.sys ?? ""} onChange={(e) => setEditable((s) => ({ ...s, tensionArterial: { ...(s.tensionArterial || {}), sys: e.target.value } }))} /><input type="number" className="input" placeholder="DIA" value={editable.tensionArterial?.dia ?? ""} onChange={(e) => setEditable((s) => ({ ...s, tensionArterial: { ...(s.tensionArterial || {}), dia: e.target.value } }))} /></div></div>
                      <div className="full-row"><label>Notas</label><textarea className="input" rows={2} value={editable.notas || ""} onChange={(e) => setEditable((s) => ({ ...s, notas: e.target.value }))} /></div>
                    </div>
                  </div>

                  <hr style={{ margin: "12px 0" }} />
                  <h4>Histórico de medidas</h4>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <label style={{ fontSize: 13, color: "#6b7280" }}>Mostrar</label>
                      <select value={histLimit} onChange={(e) => setHistLimit(Number(e.target.value))} className="input" style={{ width: 90, padding: "6px 8px", height: 36 }}>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn ghost" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Ir arriba</button>
                      <button className="btn ghost" onClick={exportHistoryCSV} title="Exportar historial a CSV">Exportar CSV</button>
                    </div>
                  </div>

                  <div style={{ overflowX: "auto", marginTop: 8 }} className="hist-table-wrapper">
                    <table className="table hist-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th className="col-fixed">Fecha</th>
                          <th>Peso</th>
                          <th>Masa grasa %</th>
                          <th>Masa grasa (kg)</th>
                          <th>Masa magra (kg)</th>
                          <th>Masa muscular (kg)</th>
                          <th>Agua (kg)</th>
                          <th>% Agua</th>
                          <th>Masa ósea (kg)</th>
                          <th>MB (kcal)</th>
                          <th>Grasa visceral</th>
                          <th>IMC</th>
                          <th>Edad metab.</th>
                          <th>C. Brazo</th>
                          <th>C. Cintura</th>
                          <th>C. Cadera</th>
                          <th>C. Pierna</th>
                          <th>Índice C/T</th>
                          <th>TA (SYS/DIA)</th>
                          <th style={{ width: 220 }}>Notas / Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!rowsDesc || rowsDesc.length === 0) ? (
                          <tr><td colSpan={20} style={{ padding: 12 }}>Sin registros</td></tr>
                        ) : (
                          rowsDesc.slice(0, histLimit).map((r, i) => {
                            const ta = r.tensionArterial || {};
                            const key = `${r._t || i}-${i}`;
                            return (
                              <React.Fragment key={key}>
                                <tr className="hist-row" style={{ cursor: "pointer" }} onClick={() => toggleExpandRowLocal(i)}>
                                  <td className="col-fixed" style={{ whiteSpace: "nowrap", padding: 10 }}>{r.fecha || (r._t ? new Date(r._t).toLocaleString() : "")}</td>
                                  <td style={{ padding: 10 }}>{r.peso ?? r.pesoActual ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.masaGrasaPct ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.masaGrasaKg ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.masaMagraKg ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.masaMuscularKg ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.aguaTotalKg ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.aguaTotalPct ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.masaOseaKg ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.mbKcal ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.grasaVisceralNivel ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.imc ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.edadMetabolica ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.circunferenciaBrazoCm ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.circunferenciaCinturaCm ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.circunferenciaCaderaCm ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.circunferenciaPiernaCm ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{r.indiceCinturaTalla ?? "—"}</td>
                                  <td style={{ padding: 10 }}>{`${ta.sys || ""}${ta.dia ? ` / ${ta.dia}` : ""}`}</td>
                                  <td style={{ padding: 10, maxWidth: 340 }}>{renderCell(r.notas)}</td>
                                </tr>

                                {expandedRowsStateLocal[i] && (
                                  <tr className="hist-row-detail">
                                    <td colSpan={20} style={{ padding: 12, background: "rgba(6,95,70,0.02)" }}>
                                      <div style={{ display: "flex", gap: 16, flexDirection: "column" }}>
                                        <div style={{ fontSize: 13, color: "#064e3b", fontWeight: 700 }}>Detalle completo</div>
                                        <div style={{ fontSize: 13, color: "#0f172a", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(r, null, 2)}</div>
                                        <div style={{ display: "flex", gap: 8 }}>
                                          <button className="btn ghost" onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(JSON.stringify(r)).catch(()=>{}); }}>Copiar JSON</button>
                                          <button className="btn ghost" onClick={(e) => { e.stopPropagation(); /* placeholder */ }}>Restaurar valores</button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                    <button className="btn ghost" onClick={() => setHistLimit((s) => Math.max(10, s - 10))}>Mostrar menos</button>
                    <button className="btn ghost" onClick={() => setHistLimit((s) => s + 10)}>Mostrar más</button>
                    <div style={{ marginLeft: "auto", color: "#6b7280", fontSize: 13 }}>{rowsDesc.length} registros totales</div>
                  </div>

                  <hr style={{ margin: "12px 0" }} />
                  <div style={{ marginTop: 8 }}>
                    <h4>Gráfico de peso</h4>
                    <div style={{ width: "100%", minHeight: 380 }} className="chart-container">
                      <Line ref={chartRef} data={chartData} options={chartOptions} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tabIndex === 1 && (
              <div className="card" style={{ padding: 12 }}>
                <h3>Dieta semanal</h3>
                <div className="panel-section">
                  <div className="day-nav" style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 12 }}>
                    <button className="btn ghost" onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.max(0, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) - 1) }))}>←</button>
                    <div className="day-label" style={{ fontWeight: 800, color: "var(--accent-600)" }}>{dayName}</div>
                    <button className="btn ghost" onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.min(6, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) + 1) }))}>→</button>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <div className="weekly-menu-grid">
                      {ALL_SECTIONS.map((sec) => (
                        <div key={sec.key} className="weekly-field">
                          <label>{sec.label}</label>
                          <textarea className="input weekly-textarea" rows={3} value={(Array.isArray(editable.menu) && editable.menu[selDay] ? editable.menu[selDay][sec.key] : "") || ""} onChange={(e) => { setMenuField(selDay, sec.key, e.target.value); const ta = e.target; ta.style.height = "auto"; ta.style.height = Math.max(72, ta.scrollHeight + 2) + "px"; }} placeholder={sec.key === "consejos" ? "Consejos o notas..." : ""} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn ghost" onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.max(0, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) - 1) }))}>Día anterior</button>
                      <button className="btn ghost" onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.min(6, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) + 1) }))}>Siguiente día</button>
                    </div>
                    <div style={{ marginLeft: 8, color: "#6b7280" }}>{saveLabel}</div>
                    <div style={{ flex: 1 }} />
                    <button className="btn ghost" onClick={saveSemana}>Guardar menú</button>
                    <button className="btn primary" onClick={saveVersionMenu}>Guardar versión</button>
                  </div>

                  <hr style={{ margin: "12px 0" }} />
                  <h4>Histórico de menús ({dayName})</h4>
                  <div style={{ overflowX: "auto", marginTop: 8 }}>
                    {menuHistoryMapped.length === 0 ? (
                      <div style={{ padding: 12, color: "#374151" }}>No hay versiones históricas guardadas. Pulsa "Guardar versión" para crear un registro.</div>
                    ) : (
                      <table className="menu-hist-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", padding: 8 }}>Fecha</th>
                            <th style={{ textAlign: "left", padding: 8 }}>Desayuno</th>
                            <th style={{ textAlign: "left", padding: 8 }}>Almuerzo</th>
                            <th style={{ textAlign: "left", padding: 8 }}>Comida</th>
                            <th style={{ textAlign: "left", padding: 8 }}>Merienda</th>
                            <th style={{ textAlign: "left", padding: 8 }}>Cena</th>
                            <th style={{ textAlign: "left", padding: 8 }}>Consejos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {menuHistoryMapped.map((entry, i) => {
                            const dayMenu = Array.isArray(entry.menu) ? (entry.menu[selDay] || {}) : (entry.menu || {});
                            return (
                              <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                                <td style={{ whiteSpace: "nowrap", padding: 8, verticalAlign: "top" }}>{formatDate(entry._t)}</td>
                                <td style={{ padding: 8, verticalAlign: "top" }}>{renderCell(dayMenu.desayuno)}</td>
                                <td style={{ padding: 8, verticalAlign: "top" }}>{renderCell(dayMenu.almuerzo)}</td>
                                <td style={{ padding: 8, verticalAlign: "top" }}>{renderCell(dayMenu.comida)}</td>
                                <td style={{ padding: 8, verticalAlign: "top" }}>{renderCell(dayMenu.merienda)}</td>
                                <td style={{ padding: 8, verticalAlign: "top" }}>{renderCell(dayMenu.cena)}</td>
                                <td style={{ padding: 8, verticalAlign: "top" }}>{renderCell(dayMenu.consejos)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}
            {tabIndex === 2 && (
              <div className="card" style={{ padding: 12 }}>
                <h3>Ejercicios</h3>
                <div className="panel-section">
                  {(editable.ejercicios || userData?.ejercicios) ? (
                    <DriveFolderViewer folderId={DRIVE_FOLDER_EXERCISES} height={520} />
                  ) : (
                    <div className="field">
                      <label>Descripción</label>
                      <textarea className="input" rows={4} value={editable.ejerciciosDescripcion || ""} onChange={(e) => setEditable((s) => ({ ...s, ejerciciosDescripcion: e.target.value }))} />
                      <div style={{ marginTop: 8 }}>
                        <button className="btn primary" onClick={async () => {
                          try { await updateDoc(doc(db, "users", uid), { ejerciciosDescripcion: editable.ejerciciosDescripcion || "", updatedAt: serverTimestamp() }); }
                          catch (err) { console.error(err); setError("No se pudo guardar la descripción de ejercicios."); }
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
                    <DriveFolderViewer folderId={DRIVE_FOLDER_RECIPES} height={520} />
                  ) : (
                    <div className="field">
                      <label>Descripción</label>
                      <textarea className="input" rows={4} value={editable.recetasDescripcion || ""} onChange={(e) => setEditable((s) => ({ ...s, recetasDescripcion: e.target.value }))} />
                      <div style={{ marginTop: 8 }}>
                        <button className="btn primary" onClick={async () => {
                          try { await updateDoc(doc(db, "users", uid), { recetasDescripcion: editable.recetasDescripcion || "", updatedAt: serverTimestamp() }); }
                          catch (err) { console.error(err); setError("No se pudo guardar la descripción de recetas."); }
                        }}>Guardar descripción</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {error && (
        <div style={{ marginTop: 12 }} className="card">
          <div style={{ padding: 8, color: "var(--danger, #b91c1c)" }}>{error}</div>
        </div>
      )}
    </div>
  );
}