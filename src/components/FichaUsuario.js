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
import AnamnesisForm from "./AnamnesisForm";
import FileManager from "./FileManager";
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

  const baseTabs = [
    { id: "pesaje", label: "Pesaje" },
    { id: "semana", label: "Dieta semanal" },
    { id: "ejercicios", label: "Ejercicios" },
    { id: "recetas", label: "Recetas" },
  ];
  
  const tabs = adminMode 
    ? [...baseTabs, { id: "anamnesis", label: "Anamnesis" }]
    : baseTabs;

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

  // Estado para controlar qué métricas mostrar en el gráfico
  const [chartMetrics, setChartMetrics] = useState({
    peso: true,
    imc: true,
    masaGrasaPct: false,
    masaGrasaKg: false,
    masaMagraKg: false,
    masaMuscularKg: false,
    aguaTotalKg: false,
    aguaTotalPct: false,
    masaOseaKg: false,
    grasaVisceralNivel: false,
  });

  const [histLimit, setHistLimit] = useState(10);
  const [expandedRowsStateLocal, setExpandedRowsStateLocal] = useState({});

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

    // Usar Date.now() en lugar de serverTimestamp() dentro de arrayUnion
    const now = new Date();
    const entryMedida = { ...cleaned, createdAt: now };
    const entryPeso = { fecha: fechaPeso, peso: measuresPayload.pesoActual, createdAt: now };

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
            medidasHistorico: [{ ...cleaned, createdAt: now }],
            pesoHistorico: [{ fecha: fechaPeso, peso: measuresPayload.pesoActual, createdAt: now }],
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

  // Función para borrar un pesaje del histórico
  const deletePesaje = async (index) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este registro de pesaje?")) {
      return;
    }

    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        setError("No se encontró el usuario.");
        return;
      }

      const data = snap.data();
      const medidasArray = Array.isArray(data?.medidasHistorico) ? [...data.medidasHistorico] : [];
      const pesoArray = Array.isArray(data?.pesoHistorico) ? [...data.pesoHistorico] : [];

      // Eliminar por índice del array ordenado
      if (index >= 0 && index < rowsDesc.length) {
        const recordToDelete = rowsDesc[index];
        
        // Buscar y eliminar en medidasHistorico
        const medidasIndex = medidasArray.findIndex((m) => 
          m.fecha === recordToDelete.fecha && m._t === recordToDelete._t
        );
        if (medidasIndex !== -1) {
          medidasArray.splice(medidasIndex, 1);
        }

        // Buscar y eliminar en pesoHistorico
        const pesoIndex = pesoArray.findIndex((p) => 
          p.fecha === recordToDelete.fecha && p._t === recordToDelete._t
        );
        if (pesoIndex !== -1) {
          pesoArray.splice(pesoIndex, 1);
        }

        // Actualizar Firestore
        await updateDoc(doc(db, "users", uid), {
          medidasHistorico: medidasArray,
          pesoHistorico: pesoArray,
          updatedAt: serverTimestamp(),
        });

        // Recargar datos
        const newSnap = await getDoc(doc(db, "users", uid));
        if (newSnap.exists()) {
          setUserData(newSnap.data());
        }

        alert("Registro eliminado correctamente");
      }
    } catch (err) {
      console.error("Error al eliminar pesaje:", err);
      setError(err?.message || "No se pudo eliminar el registro.");
    }
  };

  // Estado para el modal de edición
  const [editingRecord, setEditingRecord] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);

  // Función para abrir el modal de edición
  const openEditModal = (record, index) => {
    setEditingIndex(index);
    setEditingRecord({
      fecha: record.fecha || "",
      peso: record.peso ?? record.pesoActual ?? "",
      masaGrasaPct: record.masaGrasaPct ?? "",
      masaGrasaKg: record.masaGrasaKg ?? "",
      masaMagraKg: record.masaMagraKg ?? "",
      masaMuscularKg: record.masaMuscularKg ?? "",
      aguaTotalKg: record.aguaTotalKg ?? "",
      aguaTotalPct: record.aguaTotalPct ?? "",
      masaOseaKg: record.masaOseaKg ?? "",
      mbKcal: record.mbKcal ?? "",
      grasaVisceralNivel: record.grasaVisceralNivel ?? "",
      imc: record.imc ?? "",
      edadMetabolica: record.edadMetabolica ?? "",
      indiceCinturaTalla: record.indiceCinturaTalla ?? "",
      circunferenciaBrazoCm: record.circunferenciaBrazoCm ?? "",
      circunferenciaCinturaCm: record.circunferenciaCinturaCm ?? "",
      circunferenciaCaderaCm: record.circunferenciaCaderaCm ?? "",
      circunferenciaPiernaCm: record.circunferenciaPiernaCm ?? "",
      tensionArterial: record.tensionArterial || { sys: "", dia: "" },
      notas: record.notas ?? "",
      _t: record._t,
      createdAt: record.createdAt,
    });
  };

  // Función para guardar la edición
  const saveEditedRecord = async () => {
    if (!editingRecord) return;

    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        setError("No se encontró el usuario.");
        return;
      }

      const data = snap.data();
      const medidasArray = Array.isArray(data?.medidasHistorico) ? [...data.medidasHistorico] : [];
      const pesoArray = Array.isArray(data?.pesoHistorico) ? [...data.pesoHistorico] : [];

      const recordToUpdate = rowsDesc[editingIndex];

      // Actualizar en medidasHistorico
      const medidasIndex = medidasArray.findIndex((m) => 
        m.fecha === recordToUpdate.fecha && m._t === recordToUpdate._t
      );
      if (medidasIndex !== -1) {
        medidasArray[medidasIndex] = {
          ...editingRecord,
          createdAt: recordToUpdate.createdAt,
        };
      }

      // Actualizar en pesoHistorico
      const pesoIndex = pesoArray.findIndex((p) => 
        p.fecha === recordToUpdate.fecha && p._t === recordToUpdate._t
      );
      if (pesoIndex !== -1) {
        pesoArray[pesoIndex] = {
          fecha: editingRecord.fecha,
          peso: editingRecord.peso,
          createdAt: recordToUpdate.createdAt,
        };
      }

      // Actualizar Firestore
      await updateDoc(doc(db, "users", uid), {
        medidasHistorico: medidasArray,
        pesoHistorico: pesoArray,
        updatedAt: serverTimestamp(),
      });

      // Recargar datos
      const newSnap = await getDoc(doc(db, "users", uid));
      if (newSnap.exists()) {
        setUserData(newSnap.data());
      }

      setEditingRecord(null);
      setEditingIndex(null);
      alert("Registro actualizado correctamente");
    } catch (err) {
      console.error("Error al actualizar pesaje:", err);
      setError(err?.message || "No se pudo actualizar el registro.");
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
    })
    // Filtrar solo registros con fecha o peso válidos
    .filter((p) => {
      const hasFecha = p.fecha && p.fecha.trim() !== "";
      const hasPeso = (p.peso !== null && p.peso !== undefined && p.peso !== "") || 
                      (p.pesoActual !== null && p.pesoActual !== undefined && p.pesoActual !== "");
      return hasFecha || hasPeso;
    });
    return mapped.sort((a, b) => (b._t || 0) - (a._t || 0));
  })();

  const mappedForChart = rowsDesc.map((p) => ({ ...p })).sort((a, b) => (a._t || 0) - (b._t || 0));
  const labels = mappedForChart.map((s) => s.fecha || (s._t ? new Date(s._t).toLocaleDateString() : ""));
  
  // Configuración de métricas disponibles para el gráfico
  const metricsConfig = {
    peso: { label: "Peso (kg)", field: (s) => s.peso ?? s.pesoActual ?? null, color: "#16a34a", bgColor: "rgba(34,197,94,0.12)" },
    imc: { label: "IMC", field: (s) => s.imc ?? null, color: "#2563eb", bgColor: "rgba(37,99,235,0.12)" },
    masaGrasaPct: { label: "Masa grasa (%)", field: (s) => s.masaGrasaPct ?? null, color: "#dc2626", bgColor: "rgba(220,38,38,0.12)" },
    masaGrasaKg: { label: "Masa grasa (kg)", field: (s) => s.masaGrasaKg ?? null, color: "#ea580c", bgColor: "rgba(234,88,12,0.12)" },
    masaMagraKg: { label: "Masa magra (kg)", field: (s) => s.masaMagraKg ?? null, color: "#65a30d", bgColor: "rgba(101,163,13,0.12)" },
    masaMuscularKg: { label: "Masa muscular (kg)", field: (s) => s.masaMuscularKg ?? null, color: "#0891b2", bgColor: "rgba(8,145,178,0.12)" },
    aguaTotalKg: { label: "Agua (kg)", field: (s) => s.aguaTotalKg ?? null, color: "#0284c7", bgColor: "rgba(2,132,199,0.12)" },
    aguaTotalPct: { label: "Agua (%)", field: (s) => s.aguaTotalPct ?? null, color: "#0ea5e9", bgColor: "rgba(14,165,233,0.12)" },
    masaOseaKg: { label: "Masa ósea (kg)", field: (s) => s.masaOseaKg ?? null, color: "#64748b", bgColor: "rgba(100,116,139,0.12)" },
    grasaVisceralNivel: { label: "Grasa visceral", field: (s) => s.grasaVisceralNivel ?? null, color: "#dc2626", bgColor: "rgba(220,38,38,0.12)" },
  };

  // Crear datasets dinámicamente según las métricas seleccionadas
  const datasets = Object.keys(chartMetrics)
    .filter(key => chartMetrics[key])
    .map(key => {
      const config = metricsConfig[key];
      return {
        label: config.label,
        data: mappedForChart.map(config.field),
        borderColor: config.color,
        backgroundColor: config.bgColor,
        tension: 0.25,
        fill: false,
        pointRadius: 4,
      };
    });

  const chartData = { labels, datasets };
  const chartOptions = { 
    responsive: true, 
    plugins: { 
      legend: { 
        display: true,
        position: 'top',
      } 
    }, 
    scales: { 
      y: { 
        beginAtZero: false,
        ticks: {
          callback: function(value) {
            return value.toFixed(1);
          }
        }
      } 
    },
    interaction: {
      mode: 'index',
      intersect: false,
    }
  };

  const menuHistoryRaw = Array.isArray(userData?.menuHistorico) ? userData.menuHistorico : [];
  const menuHistoryMapped = menuHistoryRaw.map((m) => ({ ...m, _t: timestampToMs(m?.createdAt || m?.when || m?.fecha) || 0 })).sort((a, b) => (b._t || 0) - (a._t || 0));

  const selDay = Number.isFinite(editable._selectedDay) ? editable._selectedDay : todayIndex;
  const dayName = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][selDay];

  const saveLabel = saveStatus === "pending" ? "Guardando..." : saveStatus === "saving" ? "Guardando..." : saveStatus === "saved" ? "Guardado" : saveStatus === "error" ? "Error al guardar" : "";

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
      {/* Header tipo app de coaching */}
      <div style={{ 
        background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
        borderRadius: "12px",
        padding: "16px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        marginBottom: "12px"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* User info */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.95)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: "700",
              color: "#16a34a",
              flexShrink: 0,
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}>
              {(userData.nombre?.[0] || userData.email?.[0] || "U").toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ 
                fontSize: "16px", 
                fontWeight: "600", 
                color: "white",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                {userData.nombre ? `${userData.nombre} ${userData.apellidos || ""}` : userData.email}
              </div>
              <div style={{ 
                fontSize: "13px", 
                color: "rgba(255,255,255,0.85)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                {userData.pesoActual ? `${userData.pesoActual} kg` : userData.email}
              </div>
            </div>
          </div>

          {/* Actions - iconos */}
          <div style={{ display: "flex", gap: "6px", flexShrink: 0, marginLeft: "12px" }}>
            <button 
              className="btn-icon-header" 
              onClick={() => setShowProfile((s) => !s)} 
              title="Perfil"
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                borderRadius: "8px",
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.background = "rgba(255,255,255,0.3)"}
              onMouseLeave={(e) => e.target.style.background = "rgba(255,255,255,0.2)"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <button 
              className="btn-icon-header" 
              onClick={() => setShowPrintDialog(true)} 
              title="Generar PDF"
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                borderRadius: "8px",
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.background = "rgba(255,255,255,0.3)"}
              onMouseLeave={(e) => e.target.style.background = "rgba(255,255,255,0.2)"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M6 9V3h12v6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6 18H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="6" y="14" width="12" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {(!targetUid || targetUid === authUid) && (
              <button 
                className="btn-icon-header" 
                onClick={handleSignOut} 
                title="Cerrar sesión"
                style={{
                  background: "rgba(239,68,68,0.9)",
                  border: "none",
                  borderRadius: "8px",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.background = "rgba(220,38,38,1)"}
                onMouseLeave={(e) => e.target.style.background = "rgba(239,68,68,0.9)"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
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
          {/* Tabs modernos con iconos */}
          <nav className="tabs" role="tablist" aria-label="Secciones" style={{ 
            display: "flex", 
            gap: "6px", 
            padding: "0",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none"
          }}>
            {tabs.map((t, i) => (
              <button 
                key={t.id} 
                className={i === tabIndex ? "tab-modern tab-modern-active" : "tab-modern"} 
                onClick={() => setTabIndex(i)}
                style={{
                  flex: "1 1 auto",
                  minWidth: "fit-content",
                  padding: "10px 16px",
                  border: "none",
                  borderRadius: "10px",
                  background: i === tabIndex ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" : "#f1f5f9",
                  color: i === tabIndex ? "white" : "#64748b",
                  fontWeight: i === tabIndex ? "600" : "500",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: i === tabIndex ? "0 2px 8px rgba(22,163,74,0.3)" : "none",
                  whiteSpace: "nowrap"
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div style={{ marginTop: "12px", position: "relative", paddingBottom: "80px" }}>
            {tabIndex === 0 && (
              <div className="card pesaje-section-wrapper" style={{ padding: "12px", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "17px", color: "#1e293b" }}>📊 Medidas y Composición</h3>
                <div className="panel-section">
                  {/* Botón flotante de guardar - más compacto */}
                  <div style={{
                    position: "fixed",
                    bottom: "20px",
                    right: "20px",
                    zIndex: 1000,
                    display: "flex",
                    gap: "8px",
                    alignItems: "center"
                  }}>
                    <button 
                      type="button" 
                      onClick={() => { setPeso(""); setFechaPeso(todayISO); }}
                      title="Limpiar formulario"
                      style={{
                        backgroundColor: "#f1f5f9",
                        color: "#64748b",
                        padding: "12px",
                        borderRadius: "50%",
                        border: "none",
                        cursor: "pointer",
                        width: "48px",
                        height: "48px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = "#e2e8f0"}
                      onMouseLeave={(e) => e.target.style.backgroundColor = "#f1f5f9"}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    
                    <button 
                      className="btn primary" 
                      type="button" 
                      disabled={savingPeso} 
                      onClick={(e) => submitPeso(e)}
                      style={{
                        background: savingPeso ? "#94a3b8" : "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                        color: "white",
                        padding: "12px 24px",
                        borderRadius: "24px",
                        border: "none",
                        cursor: savingPeso ? "not-allowed" : "pointer",
                        fontWeight: "600",
                        fontSize: "15px",
                        boxShadow: "0 4px 16px rgba(22, 163, 74, 0.4)",
                        transition: "all 0.3s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      {savingPeso ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Guardando...
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                            <polyline points="17 21 17 13 7 13 7 21" strokeLinecap="round" strokeLinejoin="round"/>
                            <polyline points="7 3 7 8 15 8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Guardar
                        </>
                      )}
                    </button>
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

                  <div style={{ 
                    margin: "16px 0 12px 0", 
                    padding: "10px 14px",
                    background: "linear-gradient(90deg, #f0fdf4 0%, #dcfce7 100%)",
                    borderRadius: "8px",
                    borderLeft: "3px solid #16a34a"
                  }}>
                    <h4 style={{ margin: 0, fontSize: "15px", color: "#15803d", fontWeight: "600" }}>📋 Histórico de medidas</h4>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: "12px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <label style={{ fontSize: 13, color: "#64748b", fontWeight: "500" }}>Mostrar:</label>
                      <select value={histLimit} onChange={(e) => setHistLimit(Number(e.target.value))} className="input" style={{ 
                        width: 80, 
                        padding: "6px 8px", 
                        height: 32,
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        fontSize: "13px"
                      }}>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button 
                        className="btn-compact" 
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                        style={{
                          padding: "6px 12px",
                          fontSize: "13px",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          background: "white",
                          color: "#64748b",
                          cursor: "pointer"
                        }}
                      >
                        ↑ Arriba
                      </button>
                      <button 
                        className="btn-compact" 
                        onClick={exportHistoryCSV} 
                        title="Exportar historial a CSV"
                        style={{
                          padding: "6px 12px",
                          fontSize: "13px",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          background: "white",
                          color: "#64748b",
                          cursor: "pointer"
                        }}
                      >
                        📊 CSV
                      </button>
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
                          <th style={{ width: 120 }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!rowsDesc || rowsDesc.length === 0) ? (
                          <tr><td colSpan={21} style={{ padding: 12 }}>Sin registros</td></tr>
                        ) : (
                          rowsDesc.slice(0, histLimit).map((r, i) => {
                            const ta = r.tensionArterial || {};
                            const key = `${r._t || i}-${i}`;
                            return (
                              <React.Fragment key={key}>
                                <tr className="hist-row">
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
                                  <td style={{ padding: 10, maxWidth: 340, cursor: "pointer" }} onClick={() => toggleExpandRowLocal(i)}>{renderCell(r.notas)}</td>
                                  <td style={{ padding: 10 }}>
                                    <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                      <button 
                                        className="btn ghost" 
                                        onClick={(e) => { e.stopPropagation(); openEditModal(r, i); }}
                                        style={{ padding: "4px 8px", fontSize: "12px" }}
                                        title="Editar registro"
                                      >
                                        ✏️
                                      </button>
                                      <button 
                                        className="btn danger" 
                                        onClick={(e) => { e.stopPropagation(); deletePesaje(i); }}
                                        style={{ padding: "4px 8px", fontSize: "12px" }}
                                        title="Eliminar registro"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {expandedRowsStateLocal[i] && (
                                  <tr className="hist-row-detail">
                                    <td colSpan={21} style={{ padding: 12, background: "rgba(6,95,70,0.02)" }}>
                                      <div style={{ display: "flex", gap: 16, flexDirection: "column" }}>
                                        <div style={{ fontSize: 13, color: "#064e3b", fontWeight: 700 }}>Detalle completo</div>
                                        <div style={{ fontSize: 13, color: "#0f172a", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(r, null, 2)}</div>
                                        <div style={{ display: "flex", gap: 8 }}>
                                          <button className="btn ghost" onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(JSON.stringify(r)).catch(()=>{}); }}>Copiar JSON</button>
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

                  <div style={{ 
                    margin: "16px 0 12px 0", 
                    padding: "10px 14px",
                    background: "linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%)",
                    borderRadius: "8px",
                    borderLeft: "3px solid #3b82f6"
                  }}>
                    <h4 style={{ margin: 0, fontSize: "15px", color: "#1e40af", fontWeight: "600" }}>📈 Gráfico de evolución</h4>
                  </div>
                  
                  <div style={{ marginTop: 6 }}>
                    {/* Checkboxes para seleccionar métricas */}
                    <div style={{ 
                      padding: "10px", 
                      backgroundColor: "#f8fafc", 
                      borderRadius: "8px",
                      marginBottom: "10px",
                      border: "1px solid #e2e8f0"
                    }}>
                      <div style={{ marginBottom: "8px", fontWeight: "600", color: "#475569", fontSize: "12px" }}>
                        Métricas a mostrar:
                      </div>
                      
                      <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", 
                        gap: "10px"
                      }}>
                      
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={chartMetrics.peso} 
                          onChange={(e) => setChartMetrics(prev => ({ ...prev, peso: e.target.checked }))}
                          style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                        />
                        <span style={{ color: "#16a34a", fontWeight: "500", fontSize: "14px" }}>● Peso (kg)</span>
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={chartMetrics.imc} 
                          onChange={(e) => setChartMetrics(prev => ({ ...prev, imc: e.target.checked }))}
                          style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                        />
                        <span style={{ color: "#2563eb", fontWeight: "500", fontSize: "14px" }}>● IMC</span>
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={chartMetrics.masaGrasaPct} 
                          onChange={(e) => setChartMetrics(prev => ({ ...prev, masaGrasaPct: e.target.checked }))}
                          style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                        />
                        <span style={{ color: "#dc2626", fontWeight: "500", fontSize: "14px" }}>● Masa grasa (%)</span>
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={chartMetrics.masaGrasaKg} 
                          onChange={(e) => setChartMetrics(prev => ({ ...prev, masaGrasaKg: e.target.checked }))}
                          style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                        />
                        <span style={{ color: "#ea580c", fontWeight: "500", fontSize: "14px" }}>● Masa grasa (kg)</span>
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={chartMetrics.masaMagraKg} 
                          onChange={(e) => setChartMetrics(prev => ({ ...prev, masaMagraKg: e.target.checked }))}
                          style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                        />
                        <span style={{ color: "#65a30d", fontWeight: "500", fontSize: "14px" }}>● Masa magra (kg)</span>
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={chartMetrics.masaMuscularKg} 
                          onChange={(e) => setChartMetrics(prev => ({ ...prev, masaMuscularKg: e.target.checked }))}
                          style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                        />
                        <span style={{ color: "#0891b2", fontWeight: "500", fontSize: "14px" }}>● Masa muscular (kg)</span>
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={chartMetrics.aguaTotalKg} 
                          onChange={(e) => setChartMetrics(prev => ({ ...prev, aguaTotalKg: e.target.checked }))}
                          style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                        />
                        <span style={{ color: "#0284c7", fontWeight: "500", fontSize: "14px" }}>● Agua (kg)</span>
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={chartMetrics.aguaTotalPct} 
                          onChange={(e) => setChartMetrics(prev => ({ ...prev, aguaTotalPct: e.target.checked }))}
                          style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                        />
                        <span style={{ color: "#0ea5e9", fontWeight: "500", fontSize: "14px" }}>● Agua (%)</span>
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={chartMetrics.masaOseaKg} 
                          onChange={(e) => setChartMetrics(prev => ({ ...prev, masaOseaKg: e.target.checked }))}
                          style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                        />
                        <span style={{ color: "#64748b", fontWeight: "500", fontSize: "14px" }}>● Masa ósea (kg)</span>
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={chartMetrics.grasaVisceralNivel} 
                          onChange={(e) => setChartMetrics(prev => ({ ...prev, grasaVisceralNivel: e.target.checked }))}
                          style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                        />
                        <span style={{ color: "#dc2626", fontWeight: "500", fontSize: "14px" }}>● Grasa visceral</span>
                      </label>
                      </div>
                    </div>

                    <div style={{ 
                      width: "100%", 
                      minHeight: "250px",
                      height: "auto",
                      padding: "12px",
                      backgroundColor: "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0"
                    }} className="chart-container">
                      {datasets.length > 0 ? (
                        <Line ref={chartRef} data={chartData} options={chartOptions} />
                      ) : (
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center", 
                          minHeight: "230px",
                          color: "#94a3b8",
                          fontSize: "13px",
                          textAlign: "center",
                          padding: "16px"
                        }}>
                          Selecciona al menos una métrica para ver el gráfico
                        </div>
                      )}
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

                  {/* Botones flotantes para Dieta Semanal */}
                  <div style={{
                    position: "fixed",
                    bottom: "30px",
                    right: "30px",
                    zIndex: 1000,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "10px"
                  }}>
                    {saveLabel && (
                      <div style={{
                        backgroundColor: saveLabel.includes("✅") || saveLabel.includes("Guardado") ? "#48bb78" : "#718096",
                        color: "white",
                        padding: "8px 16px",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: "500",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                      }}>
                        {saveLabel}
                      </div>
                    )}
                    <button 
                      className="btn primary" 
                      onClick={saveVersionMenu}
                      style={{
                        backgroundColor: "#4299e1",
                        color: "white",
                        padding: "14px 28px",
                        borderRadius: "8px",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "16px",
                        boxShadow: "0 4px 12px rgba(66, 153, 225, 0.4)",
                        transition: "all 0.3s ease",
                      }}
                    >
                      💾 Guardar versión
                    </button>
                    <button 
                      className="btn ghost" 
                      onClick={saveSemana}
                      style={{
                        backgroundColor: "#48bb78",
                        color: "white",
                        padding: "12px 24px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: "500",
                        fontSize: "14px",
                        boxShadow: "0 2px 8px rgba(72, 187, 120, 0.3)",
                      }}
                    >
                      📝 Guardar menú
                    </button>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn ghost" onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.max(0, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) - 1) }))}>Día anterior</button>
                      <button className="btn ghost" onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.min(6, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) + 1) }))}>Siguiente día</button>
                    </div>
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
                  <FileManager userId={uid} type="ejercicios" isAdmin={adminMode} />
                </div>
              </div>
            )}
            {tabIndex === 3 && (
              <div className="card" style={{ padding: 12 }}>
                <h3>Recetas</h3>
                <div className="panel-section">
                  <FileManager userId={uid} type="recetas" isAdmin={adminMode} />
                </div>
              </div>
            )}
            {tabIndex === 4 && adminMode && (
              <div className="card" style={{ padding: 0 }}>
                <AnamnesisForm 
                  user={{ ...userData, uid: uid }} 
                  onUpdateUser={(updatedUser) => {
                    setUserData(updatedUser);
                  }} 
                  isAdmin={adminMode} 
                />
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

      {/* Modal de edición de registro */}
      {editingRecord && (
        <div 
          className="print-modal-backdrop" 
          role="dialog" 
          aria-modal="true"
          onClick={() => {
            setEditingRecord(null);
            setEditingIndex(null);
          }}
        >
          <div 
            className="print-modal" 
            style={{ maxWidth: "900px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: "16px" }}>Editar registro de pesaje</h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="field">
                <label>Fecha</label>
                <input 
                  type="date" 
                  className="input" 
                  value={editingRecord.fecha || ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, fecha: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>Peso (kg)</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.1" 
                  className="input" 
                  value={editingRecord.peso || ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, peso: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>Masa grasa (%)</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.1" 
                  className="input" 
                  value={editingRecord.masaGrasaPct ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, masaGrasaPct: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>Masa grasa (kg)</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.01" 
                  className="input" 
                  value={editingRecord.masaGrasaKg ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, masaGrasaKg: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>Masa magra (kg)</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.01" 
                  className="input" 
                  value={editingRecord.masaMagraKg ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, masaMagraKg: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>Masa muscular (kg)</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.01" 
                  className="input" 
                  value={editingRecord.masaMuscularKg ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, masaMuscularKg: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>Agua total (kg)</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.01" 
                  className="input" 
                  value={editingRecord.aguaTotalKg ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, aguaTotalKg: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>% Agua total</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.1" 
                  className="input" 
                  value={editingRecord.aguaTotalPct ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, aguaTotalPct: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>Masa ósea (kg)</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.01" 
                  className="input" 
                  value={editingRecord.masaOseaKg ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, masaOseaKg: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>MB (kcal)</label>
                <input 
                  type="number" 
                  inputMode="numeric" 
                  step="1" 
                  className="input" 
                  value={editingRecord.mbKcal ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, mbKcal: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>Nivel grasa visceral</label>
                <input 
                  type="number" 
                  inputMode="numeric" 
                  step="1" 
                  className="input" 
                  value={editingRecord.grasaVisceralNivel ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, grasaVisceralNivel: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>IMC</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.1" 
                  className="input" 
                  value={editingRecord.imc ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, imc: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>Edad metabólica</label>
                <input 
                  type="number" 
                  inputMode="numeric" 
                  step="1" 
                  className="input" 
                  value={editingRecord.edadMetabolica ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, edadMetabolica: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>C. Brazo (cm)</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.1" 
                  className="input" 
                  value={editingRecord.circunferenciaBrazoCm ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, circunferenciaBrazoCm: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>C. Cintura (cm)</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.1" 
                  className="input" 
                  value={editingRecord.circunferenciaCinturaCm ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, circunferenciaCinturaCm: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>C. Cadera (cm)</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.1" 
                  className="input" 
                  value={editingRecord.circunferenciaCaderaCm ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, circunferenciaCaderaCm: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>C. Pierna (cm)</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.1" 
                  className="input" 
                  value={editingRecord.circunferenciaPiernaCm ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, circunferenciaPiernaCm: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>Índice cintura / talla</label>
                <input 
                  type="text" 
                  className="input" 
                  value={editingRecord.indiceCinturaTalla ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, indiceCinturaTalla: e.target.value })} 
                />
              </div>

              <div className="field">
                <label>TA (SYS / DIA)</label>
                <div className="tension-group" style={{ display: "flex", gap: "8px" }}>
                  <input 
                    type="number" 
                    className="input" 
                    placeholder="SYS" 
                    value={editingRecord.tensionArterial?.sys ?? ""} 
                    onChange={(e) => setEditingRecord({ 
                      ...editingRecord, 
                      tensionArterial: { ...(editingRecord.tensionArterial || {}), sys: e.target.value } 
                    })} 
                  />
                  <input 
                    type="number" 
                    className="input" 
                    placeholder="DIA" 
                    value={editingRecord.tensionArterial?.dia ?? ""} 
                    onChange={(e) => setEditingRecord({ 
                      ...editingRecord, 
                      tensionArterial: { ...(editingRecord.tensionArterial || {}), dia: e.target.value } 
                    })} 
                  />
                </div>
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Notas</label>
                <textarea 
                  className="input" 
                  rows={3} 
                  value={editingRecord.notas || ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, notas: e.target.value })} 
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button 
                className="btn ghost" 
                onClick={() => {
                  setEditingRecord(null);
                  setEditingIndex(null);
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn primary" 
                onClick={saveEditedRecord}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}