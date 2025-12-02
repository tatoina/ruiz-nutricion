import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
import MenuSelector from "./MenuSelector";
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
    { id: "citas", label: "📅 Citas" },
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
  const [nextAppointment, setNextAppointment] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [newAppointmentDate, setNewAppointmentDate] = useState("");
  const [newAppointmentTime, setNewAppointmentTime] = useState("");
  const [newAppointmentNotes, setNewAppointmentNotes] = useState("");
  const [printOptions, setPrintOptions] = useState({ dietaMensual: true, datosPesaje: true });

  const [showProfile, setShowProfile] = useState(false);

  const [peso, setPeso] = useState("");
  const todayISO = new Date().toISOString().slice(0, 10);
  const [fechaPeso, setFechaPeso] = useState(() => todayISO);
  const [savingPeso, setSavingPeso] = useState(false);

  // Estados para notificaciones
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifiedAppointments, setNotifiedAppointments] = useState(new Set());

  // Calcular tabs filtradas según el plan del usuario
  const tabs = useMemo(() => {
    const esPlanSeguimiento = userData?.anamnesis?.eligePlan === "Seguimiento";
    const tabsFiltradas = esPlanSeguimiento 
      ? baseTabs.filter(tab => tab.id === "pesaje" || tab.id === "citas")
      : baseTabs;
    
    return adminMode 
      ? [...tabsFiltradas, { id: "anamnesis", label: "Anamnesis" }]
      : tabsFiltradas;
  }, [userData, adminMode, baseTabs]);

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
  const [transposeTable, setTransposeTable] = useState(false);
  const [tableZoom, setTableZoom] = useState(100); // Zoom level percentage

  // Estados para controlar secciones colapsables
  const [showFormulario, setShowFormulario] = useState(true);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showGrafico, setShowGrafico] = useState(false);

  // Estado para el orden de los campos de pesaje (solo para admin)
  const [fieldsLocked, setFieldsLocked] = useState(false); // Controla si los campos están bloqueados
  const [fieldsOrder, setFieldsOrder] = useState([
    "masaGrasaPct", "masaGrasaKg", "aguaTotalPct", "aguaTotalKg",
    "masaOseaKg", "masaMuscularKg", "masaMagraKg", "mbKcal", "grasaVisceralNivel",
    "imc", "edadMetabolica", "circunferenciaBrazoCm", "circunferenciaCinturaCm",
    "circunferenciaCaderaCm", "circunferenciaPiernaCm", "indiceCinturaTalla", "tensionArterial"
  ]);
  const [draggedIndex, setDraggedIndex] = useState(null);

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
          
          // Limpiar el campo peso antes de establecer userData
          setPeso("");
          setUserData(data);
          
          // Cargar orden de campos si existe
          if (data.fieldsOrder && Array.isArray(data.fieldsOrder)) {
            setFieldsOrder(data.fieldsOrder);
          }
          
          // Cargar estado de bloqueo si existe
          if (typeof data.fieldsLocked === 'boolean') {
            setFieldsLocked(data.fieldsLocked);
          }
          
          setEditable((prev) => ({
            nombre: data.nombre || "", apellidos: data.apellidos || "", nacimiento: data.nacimiento || "",
            telefono: data.telefono || "", dietaactual: data.dietaactual || "", dietaOtros: data.dietaOtros || "",
            restricciones: data.restricciones || "", ejercicios: !!data.ejercicios,
            ejerciciosDescripcion: data.ejerciciosDescripcion || "",
            menu: normalizeMenu(data.menu),
            _selectedDay: typeof data._selectedDay === "number" ? data._selectedDay : todayIndex,

            // Los campos de pesaje siempre empiezan vacíos
            masaGrasaPct: "",
            masaGrasaKg: "",
            masaMagraKg: "",
            masaMuscularKg: "",
            aguaTotalKg: "",
            aguaTotalPct: "",
            masaOseaKg: "",
            mbKcal: "",
            grasaVisceralNivel: "",
            imc: "",
            edadMetabolica: "",
            indiceCinturaTalla: "",
            circunferenciaBrazoCm: "",
            circunferenciaCinturaCm: "",
            circunferenciaCaderaCm: "",
            circunferenciaPiernaCm: "",
            tensionArterial: { sys: "", dia: "" },
            notas: "",
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
        restricciones: editable.restricciones || "", ejercicios: !!editable.ejercicios,
        ejerciciosDescripcion: editable.ejerciciosDescripcion || "",
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

  // Funciones para gestión de citas
  const loadAppointments = useCallback(async () => {
    if (!uid) return;
    setLoadingAppointments(true);
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        const appts = data.citas || [];
        setAppointments(appts);
        
        // Encontrar próxima cita
        const now = new Date();
        const futureAppts = appts
          .filter(apt => new Date(apt.fecha + 'T' + apt.hora) > now)
          .sort((a, b) => new Date(a.fecha + 'T' + a.hora) - new Date(b.fecha + 'T' + b.hora));
        
        setNextAppointment(futureAppts[0] || null);
      }
    } catch (err) {
      console.error("Error loading appointments:", err);
    } finally {
      setLoadingAppointments(false);
    }
  }, [uid]);

  useEffect(() => {
    if (tabs[tabIndex]?.id === "citas") { // Tab de citas
      loadAppointments();
    }
  }, [tabIndex, tabs, loadAppointments]);

  // Solicitar permisos de notificación
  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.log("Este navegador no soporta notificaciones");
      return false;
    }

    if (Notification.permission === "granted") {
      setNotificationsEnabled(true);
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationsEnabled(true);
        return true;
      }
    }

    return false;
  }, []);

  // Verificar citas próximas y enviar notificaciones
  const checkUpcomingAppointments = useCallback(() => {
    if (!notificationsEnabled || appointments.length === 0) return;

    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    appointments.forEach((apt) => {
      const appointmentDateTime = new Date(apt.fecha + 'T' + apt.hora);
      const appointmentId = `${apt.fecha}-${apt.hora}`;

      // Si la cita es en exactamente 1 hora (±2 minutos) y no se ha notificado
      if (
        appointmentDateTime > now &&
        appointmentDateTime <= oneHourLater &&
        !notifiedAppointments.has(appointmentId)
      ) {
        const timeUntil = Math.round((appointmentDateTime - now) / (60 * 1000));
        
        if (timeUntil >= 58 && timeUntil <= 62) { // Entre 58 y 62 minutos
          new Notification("🔔 Recordatorio de cita", {
            body: `Tienes una cita en ${timeUntil} minutos (${apt.hora})${apt.notas ? '\n' + apt.notas : ''}`,
            icon: DEFAULT_CLINIC_LOGO,
            badge: DEFAULT_CLINIC_LOGO,
            requireInteraction: true,
            tag: appointmentId
          });

          setNotifiedAppointments(prev => new Set([...prev, appointmentId]));
        }
      }
    });
  }, [notificationsEnabled, appointments, notifiedAppointments, DEFAULT_CLINIC_LOGO]);

  // Verificar permisos al cargar el componente
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  // Comprobar citas cada minuto
  useEffect(() => {
    if (!notificationsEnabled) return;

    const interval = setInterval(() => {
      checkUpcomingAppointments();
    }, 60000); // Cada 60 segundos

    return () => clearInterval(interval);
  }, [notificationsEnabled, checkUpcomingAppointments]);

  const addAppointment = async () => {
    if (!uid || !newAppointmentDate || !newAppointmentTime) {
      setError("Por favor completa fecha y hora de la cita.");
      return;
    }

    try {
      const newAppt = {
        fecha: newAppointmentDate,
        hora: newAppointmentTime,
        notas: newAppointmentNotes,
        createdAt: new Date().toISOString(),
        createdBy: authUid || "admin"
      };

      await updateDoc(doc(db, "users", uid), {
        citas: arrayUnion(newAppt),
        updatedAt: serverTimestamp()
      });

      setNewAppointmentDate("");
      setNewAppointmentTime("");
      setNewAppointmentNotes("");
      loadAppointments();
    } catch (err) {
      console.error("Error adding appointment:", err);
      setError("No se pudo agregar la cita.");
    }
  };

  const deleteAppointment = async (appointment) => {
    if (!uid || !window.confirm("¿Eliminar esta cita?")) return;

    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        const updatedCitas = (data.citas || []).filter(apt => 
          !(apt.fecha === appointment.fecha && apt.hora === appointment.hora)
        );

        await updateDoc(doc(db, "users", uid), {
          citas: updatedCitas,
          updatedAt: serverTimestamp()
        });

        loadAppointments();
      }
    } catch (err) {
      console.error("Error deleting appointment:", err);
      setError("No se pudo eliminar la cita.");
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

    // Leer los arrays existentes primero
    try {
      const userDocRef = doc(db, "users", uid);
      const userSnapshot = await getDoc(userDocRef);
      
      if (!userSnapshot.exists()) {
        setError("Usuario no encontrado.");
        setSavingPeso(false);
        return;
      }

      const currentData = userSnapshot.data();
      const existingMedidas = Array.isArray(currentData?.medidasHistorico) ? currentData.medidasHistorico : [];
      const existingPeso = Array.isArray(currentData?.pesoHistorico) ? currentData.pesoHistorico : [];

      // Crear nuevas entradas
      const now = new Date();
      const entryMedida = { ...cleaned, createdAt: now };
      const entryPeso = { fecha: fechaPeso, peso: measuresPayload.pesoActual, createdAt: now };

      // Agregar las nuevas entradas a los arrays existentes
      const updatedMedidas = [...existingMedidas, entryMedida];
      const updatedPeso = [...existingPeso, entryPeso];

      // Actualizar con los arrays completos
      await updateDoc(userDocRef, {
        medidasHistorico: updatedMedidas,
        pesoHistorico: updatedPeso,
        pesoActual: measuresPayload.pesoActual,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("[FichaUsuario] submitPeso error:", err);
      setError(err?.message || "No se pudo guardar el peso.");
      setSavingPeso(false);
      return;
    }

    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
      }
      // Limpiar todos los campos del formulario después de guardar
      setPeso("");
      setFechaPeso(todayISO);
      setEditable({
        masaGrasaPct: "",
        masaGrasaKg: "",
        masaMagraKg: "",
        masaMuscularKg: "",
        aguaTotalKg: "",
        aguaTotalPct: "",
        masaOseaKg: "",
        mbKcal: "",
        grasaVisceralNivel: "",
        imc: "",
        edadMetabolica: "",
        indiceCinturaTalla: "",
        circunferenciaBrazoCm: "",
        circunferenciaCinturaCm: "",
        circunferenciaCaderaCm: "",
        circunferenciaPiernaCm: "",
        tensionArterial: { sys: "", dia: "" },
        notas: "",
      });
      setError(null);
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

      console.log("Intentando borrar índice:", index);
      console.log("Total registros en rowsDesc:", rowsDesc.length);
      console.log("Registro a borrar:", rowsDesc[index]);

      // Eliminar por índice del array ordenado
      if (index >= 0 && index < rowsDesc.length) {
        const recordToDelete = rowsDesc[index];
        
        // Buscar y eliminar en medidasHistorico usando múltiples criterios
        const medidasIndex = medidasArray.findIndex((m) => {
          // Comparar por fecha y peso/pesoActual si existen
          const sameDate = m.fecha === recordToDelete.fecha;
          const samePeso = (m.peso === recordToDelete.peso) || (m.pesoActual === recordToDelete.pesoActual) || (m.peso === recordToDelete.pesoActual);
          
          // También intentar comparar por timestamp
          const mTimestamp = timestampToMs(m.createdAt);
          const sameTimestamp = mTimestamp === recordToDelete._t;
          
          console.log("Comparando medida:", { sameDate, samePeso, sameTimestamp, m, recordToDelete });
          
          return (sameDate && samePeso) || sameTimestamp;
        });
        
        console.log("Índice encontrado en medidasHistorico:", medidasIndex);
        
        if (medidasIndex !== -1) {
          medidasArray.splice(medidasIndex, 1);
          console.log("Eliminado de medidasHistorico");
        }

        // Buscar y eliminar en pesoHistorico
        const pesoIndex = pesoArray.findIndex((p) => {
          const sameDate = p.fecha === recordToDelete.fecha;
          const samePeso = p.peso === recordToDelete.peso || p.peso === recordToDelete.pesoActual;
          const pTimestamp = timestampToMs(p.createdAt);
          const sameTimestamp = pTimestamp === recordToDelete._t;
          
          console.log("Comparando peso:", { sameDate, samePeso, sameTimestamp, p, recordToDelete });
          
          return (sameDate && samePeso) || sameTimestamp;
        });
        
        console.log("Índice encontrado en pesoHistorico:", pesoIndex);
        
        if (pesoIndex !== -1) {
          pesoArray.splice(pesoIndex, 1);
          console.log("Eliminado de pesoHistorico");
        }

        // Actualizar Firestore
        await updateDoc(doc(db, "users", uid), {
          medidasHistorico: medidasArray,
          pesoHistorico: pesoArray,
          updatedAt: serverTimestamp(),
        });

        console.log("Actualización en Firestore completada");

        // Actualizar el estado local inmediatamente con los arrays actualizados
        setUserData((prevData) => ({
          ...prevData,
          medidasHistorico: medidasArray,
          pesoHistorico: pesoArray,
        }));

        console.log("Estado local actualizado");
        alert("Registro eliminado correctamente");
      } else {
        console.error("Índice fuera de rango:", index, "de", rowsDesc.length);
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

  // Drag and drop handlers (solo para admin)
  const handleDragStart = (e, index) => {
    if (!adminMode || fieldsLocked) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    if (!adminMode || fieldsLocked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, dropIndex) => {
    if (!adminMode || fieldsLocked) return;
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newOrder = [...fieldsOrder];
    const [draggedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedItem);
    
    setFieldsOrder(newOrder);
    setDraggedIndex(null);
    
    // Guardar el nuevo orden en Firestore
    try {
      if (uid && db) {
        await updateDoc(doc(db, "users", uid), {
          fieldsOrder: newOrder,
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Error al guardar orden de campos:", err);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
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
  
  // Calcular valores de campos calculados
  const masaGrasaKgCalc = (() => {
    const p = parseFloat(peso);
    const mgPct = parseFloat(editable.masaGrasaPct);
    if (!isNaN(p) && !isNaN(mgPct) && p > 0 && mgPct >= 0) {
      return (Math.round((p * mgPct / 100) * 100) / 100).toString();
    }
    return "";
  })();

  const aguaTotalKgCalc = (() => {
    const p = parseFloat(peso);
    const atPct = parseFloat(editable.aguaTotalPct);
    if (!isNaN(p) && !isNaN(atPct) && p > 0 && atPct >= 0) {
      return (Math.round((p * atPct / 100) * 100) / 100).toString();
    }
    return "";
  })();

  const masaMuscularKgCalc = (() => {
    const p = parseFloat(peso);
    const mgKg = parseFloat(masaGrasaKgCalc);
    const atKg = parseFloat(aguaTotalKgCalc);
    const moKg = parseFloat(editable.masaOseaKg);
    if (!isNaN(p) && !isNaN(mgKg) && !isNaN(atKg) && !isNaN(moKg) && p > 0) {
      return (Math.round((p - mgKg - atKg - moKg) * 100) / 100).toString();
    }
    return "";
  })();

  // Función para renderizar cada campo de pesaje dinámicamente
  const renderPesajeField = (fieldKey) => {
    const baseStyle = {
      padding: "9px 12px",
      borderRadius: "6px",
      border: "1px solid #e2e8f0",
      fontSize: "15px",
      fontWeight: "500"
    };

    const calculatedStyle = {
      ...baseStyle,
      background: "#d1fae5"
    };

    switch (fieldKey) {
      case "peso":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.3px" }}>Peso (kg)</label>
            <input type="number" inputMode="decimal" step="0.1" className="input" value={peso} onChange={(e) => setPeso(e.target.value)} style={baseStyle} />
          </div>
        );
      
      case "masaGrasaPct":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Masa grasa (%)</label>
            <input type="number" inputMode="decimal" step="0.1" className="input" value={editable.masaGrasaPct ?? ""} onChange={(e) => setEditable((s) => ({ ...s, masaGrasaPct: e.target.value }))} style={baseStyle} />
          </div>
        );
      
      case "masaGrasaKg":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Masa grasa (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              className="input"
              value={masaGrasaKgCalc}
              readOnly
              tabIndex={-1}
              style={calculatedStyle}
            />
          </div>
        );
      
      case "aguaTotalPct":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>% Agua total</label>
            <input type="number" inputMode="decimal" step="0.1" className="input" value={editable.aguaTotalPct ?? ""} onChange={(e) => setEditable((s) => ({ ...s, aguaTotalPct: e.target.value }))} style={baseStyle} />
          </div>
        );
      
      case "aguaTotalKg":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Agua total (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              className="input"
              value={aguaTotalKgCalc}
              readOnly
              tabIndex={-1}
              style={calculatedStyle}
            />
          </div>
        );
      
      case "masaOseaKg":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Masa ósea (kg)</label>
            <input type="number" inputMode="decimal" step="0.01" className="input" value={editable.masaOseaKg ?? ""} onChange={(e) => setEditable((s) => ({ ...s, masaOseaKg: e.target.value }))} style={baseStyle} />
          </div>
        );
      
      case "masaMuscularKg":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Masa muscular (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              className="input"
              value={masaMuscularKgCalc}
              readOnly
              tabIndex={-1}
              style={calculatedStyle}
            />
          </div>
        );
      
      case "masaMagraKg":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Masa magra (kg)</label>
            <input type="number" inputMode="decimal" step="0.01" className="input" value={editable.masaMagraKg ?? ""} onChange={(e) => setEditable((s) => ({ ...s, masaMagraKg: e.target.value }))} style={baseStyle} />
          </div>
        );
      
      case "mbKcal":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>MB (kcal)</label>
            <input type="number" inputMode="numeric" step="1" className="input" value={editable.mbKcal ?? ""} onChange={(e) => setEditable((s) => ({ ...s, mbKcal: e.target.value }))} style={baseStyle} />
          </div>
        );
      
      case "grasaVisceralNivel":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Grasa visceral</label>
            <input type="number" inputMode="numeric" step="1" className="input" value={editable.grasaVisceralNivel ?? ""} onChange={(e) => setEditable((s) => ({ ...s, grasaVisceralNivel: e.target.value }))} style={baseStyle} />
          </div>
        );
      
      case "imc":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>IMC</label>
            <input type="number" inputMode="decimal" step="0.1" className="input" value={editable.imc ?? ""} onChange={(e) => setEditable((s) => ({ ...s, imc: e.target.value }))} style={baseStyle} />
          </div>
        );
      
      case "edadMetabolica":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Edad metabólica</label>
            <input type="number" inputMode="numeric" step="1" className="input" value={editable.edadMetabolica ?? ""} onChange={(e) => setEditable((s) => ({ ...s, edadMetabolica: e.target.value }))} style={baseStyle} />
          </div>
        );
      
      case "circunferenciaBrazoCm":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>C. Brazo (cm)</label>
            <input type="number" inputMode="decimal" step="0.1" className="input" value={editable.circunferenciaBrazoCm ?? ""} onChange={(e) => setEditable((s) => ({ ...s, circunferenciaBrazoCm: e.target.value }))} style={baseStyle} />
          </div>
        );
      
      case "circunferenciaCinturaCm":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>C. Cintura (cm)</label>
            <input type="number" inputMode="decimal" step="0.1" className="input" value={editable.circunferenciaCinturaCm ?? ""} onChange={(e) => setEditable((s) => ({ ...s, circunferenciaCinturaCm: e.target.value }))} style={baseStyle} />
          </div>
        );
      
      case "circunferenciaCaderaCm":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>C. Cadera (cm)</label>
            <input type="number" inputMode="decimal" step="0.1" className="input" value={editable.circunferenciaCaderaCm ?? ""} onChange={(e) => setEditable((s) => ({ ...s, circunferenciaCaderaCm: e.target.value }))} style={baseStyle} />
          </div>
        );
      
      case "circunferenciaPiernaCm":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>C. Pierna (cm)</label>
            <input type="number" inputMode="decimal" step="0.1" className="input" value={editable.circunferenciaPiernaCm ?? ""} onChange={(e) => setEditable((s) => ({ ...s, circunferenciaPiernaCm: e.target.value }))} style={baseStyle} />
          </div>
        );
      
      case "indiceCinturaTalla":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Índice cintura/talla</label>
            <input type="text" className="input" value={editable.indiceCinturaTalla ?? ""} onChange={(e) => setEditable((s) => ({ ...s, indiceCinturaTalla: e.target.value }))} style={baseStyle} />
          </div>
        );
      
      case "tensionArterial":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>TA (SYS / DIA)</label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input type="number" className="input" placeholder="SYS" value={editable.tensionArterial?.sys ?? ""} onChange={(e) => setEditable((s) => ({ ...s, tensionArterial: { ...(s.tensionArterial || {}), sys: e.target.value } }))} style={{ flex: "1", padding: "9px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "14px", textAlign: "center" }} />
              <input type="number" className="input" placeholder="DIA" value={editable.tensionArterial?.dia ?? ""} onChange={(e) => setEditable((s) => ({ ...s, tensionArterial: { ...(s.tensionArterial || {}), dia: e.target.value } }))} style={{ flex: "1", padding: "9px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "14px", textAlign: "center" }} />
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };
  
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
        borderRadius: adminMode ? "0" : "12px",
        padding: "16px 20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        marginBottom: "12px",
        width: "100%"
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
                {userData?.anamnesis?.eligePlan && (
                  <span style={{
                    marginLeft: "8px",
                    padding: "2px 8px",
                    fontSize: "11px",
                    fontWeight: "500",
                    backgroundColor: "rgba(255,255,255,0.25)",
                    borderRadius: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    {userData.anamnesis.eligePlan}
                  </span>
                )}
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
        <div className="print-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setShowPrintDialog(false)}>
          <div className="print-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "20px", color: "#064e3b", fontWeight: "600" }}>📄 Generar PDF</h3>
              <button 
                onClick={() => setShowPrintDialog(false)}
                style={{ 
                  background: "transparent", 
                  border: "none", 
                  cursor: "pointer", 
                  padding: "4px",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <p style={{ marginBottom: "20px", color: "#64748b", fontSize: "14px" }}>Selecciona qué contenido deseas incluir en el documento PDF:</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "12px",
                  padding: "14px 16px",
                  background: printOptions.dietaMensual ? "rgba(22,163,74,0.08)" : "#f8fafc",
                  border: `2px solid ${printOptions.dietaMensual ? "#16a34a" : "#e2e8f0"}`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (!printOptions.dietaMensual) {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!printOptions.dietaMensual) {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                  }
                }}
              >
                <input 
                  type="checkbox" 
                  checked={printOptions.dietaMensual} 
                  onChange={(e) => setPrintOptions((s) => ({ ...s, dietaMensual: e.target.checked }))}
                  style={{ 
                    width: "20px", 
                    height: "20px", 
                    cursor: "pointer",
                    accentColor: "#16a34a"
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "15px", marginBottom: "2px" }}>📋 Dieta Semanal</div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>Incluye el menú semanal completo con todas las comidas</div>
                </div>
              </label>

              <label 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "12px",
                  padding: "14px 16px",
                  background: printOptions.datosPesaje ? "rgba(22,163,74,0.08)" : "#f8fafc",
                  border: `2px solid ${printOptions.datosPesaje ? "#16a34a" : "#e2e8f0"}`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (!printOptions.datosPesaje) {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!printOptions.datosPesaje) {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                  }
                }}
              >
                <input 
                  type="checkbox" 
                  checked={printOptions.datosPesaje} 
                  onChange={(e) => setPrintOptions((s) => ({ ...s, datosPesaje: e.target.checked }))}
                  style={{ 
                    width: "20px", 
                    height: "20px", 
                    cursor: "pointer",
                    accentColor: "#16a34a"
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "15px", marginBottom: "2px" }}>⚖️ Datos de Pesaje</div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>Histórico de medidas, composición corporal y gráfico de evolución</div>
                </div>
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button 
                className="btn ghost" 
                onClick={() => setShowPrintDialog(false)}
                style={{ padding: "10px 20px" }}
              >
                Cancelar
              </button>
              <button 
                className="btn primary" 
                onClick={handlePrint} 
                disabled={!printOptions.dietaMensual && !printOptions.datosPesaje}
                style={{ 
                  padding: "10px 24px",
                  opacity: (!printOptions.dietaMensual && !printOptions.datosPesaje) ? 0.5 : 1,
                  cursor: (!printOptions.dietaMensual && !printOptions.datosPesaje) ? "not-allowed" : "pointer"
                }}
              >
                📥 Generar PDF
              </button>
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

              <div className="field" style={{ gridColumn: "1 / -1" }}><label>Descripción ejercicios</label><textarea className="input" rows={3} value={editable.ejerciciosDescripcion || ""} onChange={(e) => setEditable((s) => ({ ...s, ejerciciosDescripcion: e.target.value }))} /></div>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button className="btn primary" onClick={saveProfile}>Guardar perfil y dieta</button>
              <button className="btn ghost" onClick={() => { setEditable((prev) => ({ ...prev, nombre: userData.nombre || "", apellidos: userData.apellidos || "", nacimiento: userData.nacimiento || "", telefono: userData.telefono || "", dietaactual: userData.dietaactual || "", dietaOtros: userData.dietaOtros || "", restricciones: userData.restricciones || "", ejercicios: !!userData.ejercicios, ejerciciosDescripcion: userData.ejerciciosDescripcion || "" })); setShowProfile(false); }}>Cancelar</button>
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
            padding: adminMode ? "0 20px" : "0",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            width: "100%"
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
            {tabs[tabIndex]?.id === "pesaje" && (
              <div className="card pesaje-section-wrapper" style={{ padding: "12px", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                {/* Sección 1: Formulario de medidas - Colapsable */}
                <div 
                  onClick={() => setShowFormulario(!showFormulario)}
                  style={{ 
                    margin: "0 0 12px 0", 
                    padding: "12px 16px",
                    background: "linear-gradient(90deg, #f0fdf4 0%, #dcfce7 100%)",
                    borderRadius: "10px",
                    borderLeft: "4px solid #16a34a",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "translateX(2px)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "translateX(0)"}
                >
                  <h3 style={{ margin: 0, fontSize: "16px", color: "#15803d", fontWeight: "600" }}>📊 Medidas y Composición</h3>
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#15803d" 
                    strokeWidth="2"
                    style={{ 
                      transform: showFormulario ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.3s"
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                {showFormulario && (
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
                    {/* Fecha y Peso en la misma fila */}
                    <div style={{ marginBottom: "16px", display: "grid", gridTemplateColumns: "200px 200px", gap: "16px", alignItems: "end" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "6px", fontWeight: "500" }}>Fecha</label>
                        <input type="date" className="input" value={fechaPeso} onChange={(e) => setFechaPeso(e.target.value)} style={{ width: "100%" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "6px", fontWeight: "500" }}>Peso (kg)</label>
                        <input type="number" step="0.1" className="input" value={editable.peso || ""} onChange={(e) => setEditable((s) => ({ ...s, peso: e.target.value }))} style={{ width: "100%" }} />
                      </div>
                    </div>

                    {/* Grid compacto para campos de medidas - organizados por tipo */}
                    {adminMode && (
                      <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                        <div style={{ padding: "8px 12px", background: "#fef3c7", borderRadius: "6px", fontSize: "13px", color: "#92400e", flex: 1 }}>
                          {fieldsLocked ? "🔒 Campos bloqueados" : "ℹ️ Arrastra los campos para reordenarlos"}
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const newLockedState = !fieldsLocked;
                            setFieldsLocked(newLockedState);
                            // Guardar estado en Firestore
                            try {
                              if (uid && db) {
                                await updateDoc(doc(db, "users", uid), {
                                  fieldsLocked: newLockedState,
                                  updatedAt: serverTimestamp()
                                });
                              }
                            } catch (err) {
                              console.error("Error al guardar estado de bloqueo:", err);
                            }
                          }}
                          style={{
                            padding: "8px 16px",
                            fontSize: "13px",
                            borderRadius: "8px",
                            border: fieldsLocked ? "2px solid #dc2626" : "2px solid #16a34a",
                            background: fieldsLocked ? "#fee2e2" : "#dcfce7",
                            color: fieldsLocked ? "#991b1b" : "#166534",
                            cursor: "pointer",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            transition: "all 0.2s"
                          }}
                        >
                          {fieldsLocked ? (
                            <>
                              🔓 Desbloquear
                            </>
                          ) : (
                            <>
                              🔒 Bloquear orden
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    <div className="medidas-grid-custom">
                      {fieldsOrder.map((fieldKey, index) => (
                        <div
                          key={fieldKey}
                          draggable={adminMode && !fieldsLocked}
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          style={{
                            cursor: adminMode && !fieldsLocked ? "grab" : "default",
                            opacity: draggedIndex === index ? 0.6 : 1,
                            transition: "opacity 0.2s, transform 0.2s, box-shadow 0.2s",
                            position: "relative",
                            background: draggedIndex === index ? "#fef3c7" : "transparent",
                            borderRadius: "8px",
                            padding: "4px",
                            border: draggedIndex === index ? "2px dashed #f59e0b" : "2px solid transparent",
                            boxShadow: draggedIndex === index ? "0 4px 12px rgba(0,0,0,0.15)" : "none"
                          }}
                          onMouseDown={(e) => {
                            if (adminMode && !fieldsLocked) e.currentTarget.style.cursor = "grabbing";
                          }}
                          onMouseUp={(e) => {
                            if (adminMode && !fieldsLocked) e.currentTarget.style.cursor = "grab";
                          }}
                        >
                          {renderPesajeField(fieldKey)}
                        </div>
                      ))}
                    </div>

                    {/* Notas - ancho completo */}
                    <div style={{ marginTop: "16px" }}>
                      <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "6px", fontWeight: "500" }}>Notas</label>
                      <textarea className="input" rows={2} value={editable.notas || ""} onChange={(e) => setEditable((s) => ({ ...s, notas: e.target.value }))} style={{ width: "100%" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Sección 2: Histórico - Colapsable */}
                  <div 
                    onClick={() => setShowHistorico(!showHistorico)}
                    style={{ 
                      margin: "8px 0 12px 0", 
                      padding: "12px 16px",
                      background: "linear-gradient(90deg, #fef3c7 0%, #fde68a 100%)",
                      borderRadius: "10px",
                      borderLeft: "4px solid #f59e0b",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = "translateX(2px)"}
                    onMouseLeave={(e) => e.currentTarget.style.transform = "translateX(0)"}
                  >
                    <h4 style={{ margin: 0, fontSize: "15px", color: "#92400e", fontWeight: "600" }}>📋 Histórico de medidas</h4>
                    <svg 
                      width="20" 
                      height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="#92400e" 
                      strokeWidth="2"
                      style={{ 
                        transform: showHistorico ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.3s"
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

              {showHistorico && (
                <div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: "12px" }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
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
                      
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input 
                          type="checkbox" 
                          id="transpose-check" 
                          checked={transposeTable} 
                          onChange={(e) => setTransposeTable(e.target.checked)}
                          style={{ cursor: "pointer" }}
                        />
                        <label htmlFor="transpose-check" style={{ fontSize: 13, color: "#64748b", fontWeight: "500", cursor: "pointer" }}>
                          🔄 Transponer (fechas en columnas)
                        </label>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <label style={{ fontSize: 13, color: "#64748b", fontWeight: "500" }}>🔍 Zoom:</label>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <button 
                            onClick={() => setTableZoom(Math.max(80, tableZoom - 10))}
                            style={{
                              padding: "4px 8px",
                              fontSize: "14px",
                              borderRadius: "6px",
                              border: "1px solid #e2e8f0",
                              background: "white",
                              color: "#64748b",
                              cursor: "pointer",
                              fontWeight: "600"
                            }}
                            title="Reducir zoom"
                          >
                            −
                          </button>
                          <span style={{ fontSize: 12, color: "#64748b", minWidth: "45px", textAlign: "center", fontWeight: "500" }}>
                            {tableZoom}%
                          </span>
                          <button 
                            onClick={() => setTableZoom(Math.min(150, tableZoom + 10))}
                            style={{
                              padding: "4px 8px",
                              fontSize: "14px",
                              borderRadius: "6px",
                              border: "1px solid #e2e8f0",
                              background: "white",
                              color: "#64748b",
                              cursor: "pointer",
                              fontWeight: "600"
                            }}
                            title="Aumentar zoom"
                          >
                            +
                          </button>
                          <button 
                            onClick={() => setTableZoom(100)}
                            style={{
                              padding: "4px 8px",
                              fontSize: "11px",
                              borderRadius: "6px",
                              border: "1px solid #e2e8f0",
                              background: "white",
                              color: "#64748b",
                              cursor: "pointer"
                            }}
                            title="Resetear zoom"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button 
                        className="btn-compact" 
                        onClick={() => {
                          const container = document.querySelector('.admin-right') || document.querySelector('.main-container') || window;
                          if (container === window) {
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          } else {
                            container.scrollTo({ top: 0, behavior: "smooth" });
                          }
                        }}
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

                  <div style={{ overflowX: "auto", marginTop: 8, zoom: `${tableZoom}%` }} className="hist-table-wrapper">
                    {!transposeTable ? (
                      <table className="table hist-table" style={{ borderCollapse: "collapse", fontSize: "11px", width: "auto" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th className="col-fixed" style={{ padding: "6px 8px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", whiteSpace: "nowrap", position: "sticky", left: 0, background: "#f8fafc", zIndex: 10, borderRight: "3px solid #cbd5e1", boxShadow: "2px 0 3px rgba(0,0,0,0.1)" }}>Fecha</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "50px" }}>Peso</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "45px" }}>MG %</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "45px" }}>MG kg</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "50px" }}>Magra</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "55px" }}>Muscular</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "50px" }}>Agua kg</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "45px" }}>Agua %</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "45px" }}>Ósea</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "45px" }}>MB</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "40px" }}>GV</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "45px" }}>IMC</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "40px" }}>EM</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "45px" }}>Brazo</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "50px" }}>Cintura</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "50px" }}>Cadera</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "45px" }}>Pierna</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "40px" }}>IC/T</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "60px" }}>TA</th>
                            <th style={{ padding: "6px 8px", fontSize: "10.5px", fontWeight: "600", textAlign: "left", width: "150px", maxWidth: "150px" }}>Notas</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "70px" }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(!rowsDesc || rowsDesc.length === 0) ? (
                            <tr><td colSpan={21} style={{ padding: 12, textAlign: "center", color: "#94a3b8" }}>Sin registros</td></tr>
                          ) : (
                            rowsDesc.slice(0, histLimit).map((r, i) => {
                              const ta = r.tensionArterial || {};
                              const key = `${r._t || i}-${i}`;
                              const formatShortDate = (dateStr) => {
                                if (!dateStr) return "";
                                const d = new Date(dateStr);
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const year = String(d.getFullYear()).slice(-2);
                                return `${day}/${month}/${year}`;
                              };
                              return (
                                <React.Fragment key={key}>
                                  <tr className="hist-row">
                                    <td className="col-fixed" style={{ whiteSpace: "nowrap", padding: "5px 8px", fontSize: "10.5px", textAlign: "center", position: "sticky", left: 0, background: "#fff", borderRight: "3px solid #cbd5e1", fontWeight: "500", boxShadow: "2px 0 3px rgba(0,0,0,0.1)" }}>{r.fecha ? formatShortDate(r.fecha) : (r._t ? formatShortDate(new Date(r._t).toISOString()) : "")}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center", fontWeight: "500" }}>{r.peso ?? r.pesoActual ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.masaGrasaPct ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.masaGrasaKg ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.masaMagraKg ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.masaMuscularKg ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.aguaTotalKg ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.aguaTotalPct ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.masaOseaKg ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.mbKcal ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.grasaVisceralNivel ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.imc ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.edadMetabolica ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.circunferenciaBrazoCm ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.circunferenciaCinturaCm ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.circunferenciaCaderaCm ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.circunferenciaPiernaCm ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.indiceCinturaTalla ?? "—"}</td>
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center", whiteSpace: "nowrap" }}>{`${ta.sys || ""}${ta.dia ? `/${ta.dia}` : ""}`}</td>
                                    <td style={{ padding: "5px 8px", fontSize: "10.5px", textAlign: "left", maxWidth: "150px", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} onClick={() => toggleExpandRowLocal(i)}>{renderCell(r.notas)}</td>
                                    <td style={{ padding: "5px 4px" }}>
                                      <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                                        <button 
                                          className="btn ghost" 
                                          onClick={(e) => { e.stopPropagation(); openEditModal(r, i); }}
                                          style={{ padding: "3px 6px", fontSize: "11px", minWidth: "32px" }}
                                          title="Editar registro"
                                        >
                                          ✏️
                                        </button>
                                        <button 
                                          className="btn danger" 
                                          onClick={(e) => { e.stopPropagation(); deletePesaje(i); }}
                                          style={{ padding: "3px 6px", fontSize: "11px", minWidth: "32px" }}
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
                    ) : (
                      <table className="table hist-table" style={{ borderCollapse: "collapse", fontSize: "10.5px", width: "auto" }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9" }}>
                            <th style={{ position: "sticky", left: 0, background: "#f1f5f9", zIndex: 10, padding: "8px", fontSize: "10.5px", width: "100px", minWidth: "100px", border: "1px solid #cbd5e1", boxShadow: "3px 0 4px rgba(0,0,0,0.1)", fontWeight: "600", color: "#334155", textAlign: "left", borderRight: "3px solid #cbd5e1" }}>Medida</th>
                            {(!rowsDesc || rowsDesc.length === 0) ? (
                              <th style={{ padding: 8, border: "1px solid #cbd5e1", textAlign: "center", color: "#94a3b8" }}>Sin datos</th>
                            ) : (
                              rowsDesc.slice(0, histLimit).map((r, i) => {
                                const formatShortDate = (dateStr) => {
                                  if (!dateStr) return "";
                                  const d = new Date(dateStr);
                                  const day = String(d.getDate()).padStart(2, '0');
                                  const month = String(d.getMonth() + 1).padStart(2, '0');
                                  const year = String(d.getFullYear()).slice(-2);
                                  return `${day}/${month}/${year}`;
                                };
                                const key = `header-${r._t || i}-${i}`;
                                return (
                                  <th key={key} style={{ whiteSpace: "nowrap", padding: "8px 4px", fontSize: "10px", border: "1px solid #cbd5e1", textAlign: "center", width: "50px", minWidth: "50px", maxWidth: "50px", background: "#f8fafc", fontWeight: "600", color: "#475569" }}>
                                    {r.fecha ? formatShortDate(r.fecha) : (r._t ? formatShortDate(new Date(r._t).toISOString()) : "")}
                                  </th>
                                );
                              })
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {(!rowsDesc || rowsDesc.length === 0) ? (
                            <tr><td style={{ padding: 12, border: "1px solid #cbd5e1", textAlign: "center", color: "#94a3b8" }}>Sin registros</td></tr>
                          ) : (
                            [
                              { label: "Peso", key: "peso", alt: "pesoActual", important: true },
                              { label: "MG %", key: "masaGrasaPct" },
                              { label: "MG kg", key: "masaGrasaKg" },
                              { label: "Magra", key: "masaMagraKg" },
                              { label: "Muscular", key: "masaMuscularKg" },
                              { label: "Agua kg", key: "aguaTotalKg" },
                              { label: "Agua %", key: "aguaTotalPct" },
                              { label: "Ósea", key: "masaOseaKg" },
                              { label: "MB", key: "mbKcal" },
                              { label: "GV", key: "grasaVisceralNivel" },
                              { label: "IMC", key: "imc" },
                              { label: "EM", key: "edadMetabolica" },
                              { label: "Brazo", key: "circunferenciaBrazoCm" },
                              { label: "Cintura", key: "circunferenciaCinturaCm" },
                              { label: "Cadera", key: "circunferenciaCaderaCm" },
                              { label: "Pierna", key: "circunferenciaPiernaCm" },
                              { label: "IC/T", key: "indiceCinturaTalla" },
                              { label: "TA", key: "tensionArterial", isTa: true },
                              { label: "Notas", key: "notas" }
                            ].map((field, fieldIdx) => (
                              <tr key={`row-${fieldIdx}`} style={{ background: fieldIdx % 2 === 0 ? "#fefefe" : "#fafafa" }}>
                                <td style={{ position: "sticky", left: 0, background: fieldIdx % 2 === 0 ? "#fff" : "#fafafa", fontWeight: 500, padding: "6px 8px", fontSize: "10.5px", width: "100px", minWidth: "100px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", border: "1px solid #cbd5e1", boxShadow: "3px 0 4px rgba(0,0,0,0.1)", color: "#1e293b", borderRight: "3px solid #cbd5e1" }}>
                                  {field.label}
                                </td>
                                {rowsDesc.slice(0, histLimit).map((r, i) => {
                                  const key = `cell-${fieldIdx}-${i}`;
                                  let value = "—";
                                  if (field.isTa) {
                                    const ta = r.tensionArterial || {};
                                    value = `${ta.sys || ""}${ta.dia ? `/${ta.dia}` : ""}`;
                                  } else {
                                    value = r[field.key] ?? (field.alt ? r[field.alt] : "") ?? "—";
                                  }
                                  return (
                                    <td key={key} style={{ padding: "6px 4px", textAlign: "center", fontSize: "10.5px", border: "1px solid #e2e8f0", width: "50px", minWidth: "50px", maxWidth: "50px", fontWeight: field.important ? "500" : "normal" }}>
                                      {value}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                    <button className="btn ghost" onClick={() => setHistLimit((s) => Math.max(10, s - 10))}>Mostrar menos</button>
                    <button className="btn ghost" onClick={() => setHistLimit((s) => s + 10)}>Mostrar más</button>
                    <div style={{ marginLeft: "auto", color: "#6b7280", fontSize: 13 }}>{rowsDesc.length} registros totales</div>
                  </div>
                </div>
              )}

              {/* Sección 3: Gráfico - Colapsable */}
              <div 
                    onClick={() => setShowGrafico(!showGrafico)}
                    style={{ 
                      margin: "8px 0 12px 0", 
                      padding: "12px 16px",
                      background: "linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%)",
                      borderRadius: "10px",
                      borderLeft: "4px solid #3b82f6",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = "translateX(2px)"}
                    onMouseLeave={(e) => e.currentTarget.style.transform = "translateX(0)"}
                  >
                    <h4 style={{ margin: 0, fontSize: "15px", color: "#1e40af", fontWeight: "600" }}>📈 Gráfico de evolución</h4>
                    <svg 
                      width="20" 
                      height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="#1e40af" 
                      strokeWidth="2"
                      style={{ 
                        transform: showGrafico ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.3s"
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  
                  {showGrafico && (
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
              )}
            </div>
          )}
          {tabs[tabIndex]?.id === "semana" && (
            <div className="card" style={{ width: "100%", maxWidth: "none", margin: "0", padding: "0", borderRadius: "0" }}>
              <div className="panel-section" style={{ padding: "16px 20px", maxWidth: "none" }}>
                <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#15803d" }}>
                  🍽️ Dieta semanal
                </h3>

                {/* Vista ADMIN: Tabla horizontal de toda la semana */}
                {adminMode ? (
                  <div style={{ overflowX: "auto", width: "100%" }}>
                    <table style={{
                      width: "100%",
                      borderCollapse: "separate",
                      borderSpacing: "0",
                      fontSize: "12px",
                      tableLayout: "auto"
                    }}>
                      <thead>
                        <tr>
                          <th style={{
                            position: "sticky",
                            left: "0",
                            background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                            padding: "14px 10px",
                            textAlign: "center",
                            fontWeight: "700",
                            color: "white",
                            fontSize: "12px",
                            width: "100px",
                            zIndex: 10,
                            border: "1px solid #e2e8f0",
                            boxShadow: "2px 0 4px rgba(0,0,0,0.1)",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px"
                          }}>COMIDA</th>
                          {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((dayName, dayIndex) => (
                            <th key={dayIndex} style={{
                              padding: "14px 10px",
                              textAlign: "center",
                              fontWeight: "700",
                              color: "white",
                              fontSize: "12px",
                              background: dayIndex === todayIndex ? "linear-gradient(135deg, #15803d 0%, #16a34a 100%)" : "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                              border: "1px solid #e2e8f0",
                              position: "relative",
                              resize: "horizontal",
                              overflow: "auto",
                              minWidth: "150px",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px"
                            }}>
                              <div style={{ marginBottom: dayIndex === todayIndex ? "6px" : "0" }}>{dayName.toUpperCase()}</div>
                              {dayIndex === todayIndex && (
                                <div style={{
                                  background: "rgba(255,255,255,0.3)",
                                  color: "white",
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  fontSize: "10px",
                                  fontWeight: "700",
                                  display: "inline-block",
                                  border: "1px solid rgba(255,255,255,0.5)"
                                }}>HOY</div>
                              )}
                              <div style={{
                                position: "absolute",
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: "5px",
                                cursor: "col-resize",
                                userSelect: "none",
                                background: "transparent"
                              }} 
                              onMouseDown={(e) => {
                                const th = e.currentTarget.parentElement;
                                const startX = e.pageX;
                                const startWidth = th.offsetWidth;
                                
                                const onMouseMove = (e) => {
                                  const newWidth = startWidth + (e.pageX - startX);
                                  if (newWidth >= 150) {
                                    th.style.width = newWidth + "px";
                                  }
                                };
                                
                                const onMouseUp = () => {
                                  document.removeEventListener("mousemove", onMouseMove);
                                  document.removeEventListener("mouseup", onMouseUp);
                                };
                                
                                document.addEventListener("mousemove", onMouseMove);
                                document.addEventListener("mouseup", onMouseUp);
                              }}
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ALL_SECTIONS.map((sec, secIdx) => (
                          <tr key={sec.key}>
                            <td style={{
                              position: "sticky",
                              left: "0",
                              background: "#f1f5f9",
                              padding: "12px 10px",
                              fontWeight: "600",
                              color: "#334155",
                              fontSize: "11px",
                              zIndex: 5,
                              border: "1px solid #e2e8f0",
                              boxShadow: "2px 0 4px rgba(0,0,0,0.08)",
                              textAlign: "center",
                              textTransform: "uppercase",
                              letterSpacing: "0.3px"
                            }}>
                              {sec.label}
                            </td>
                            {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                              <td key={dayIndex} style={{
                                padding: "10px",
                                background: dayIndex === todayIndex ? "#f0fdf4" : "white",
                                verticalAlign: "top",
                                border: "1px solid #e2e8f0"
                              }}>
                                {sec.key === "consejos" ? (
                                  <textarea 
                                    className="input" 
                                    rows={3} 
                                    value={(Array.isArray(editable.menu) && editable.menu[dayIndex] ? editable.menu[dayIndex][sec.key] : "") || ""} 
                                    onChange={(e) => { 
                                      setMenuField(dayIndex, sec.key, e.target.value); 
                                      const ta = e.target; 
                                      ta.style.height = "auto"; 
                                      ta.style.height = Math.max(72, ta.scrollHeight + 2) + "px"; 
                                    }} 
                                    placeholder="Consejos..." 
                                    style={{ 
                                      width: "100%", 
                                      fontSize: "12px",
                                      minHeight: "60px",
                                      resize: "vertical"
                                    }}
                                  />
                                ) : (
                                  <MenuSelector
                                    categoria={sec.key}
                                    value={(Array.isArray(editable.menu) && editable.menu[dayIndex] ? editable.menu[dayIndex][sec.key] : "") || ""}
                                    onChange={(val) => setMenuField(dayIndex, sec.key, val)}
                                    readOnly={false}
                                  />
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Vista USUARIO: Navegación día por día */
                  <>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      marginBottom: "10px",
                      flexWrap: "wrap",
                      gap: "8px"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <button 
                          className="btn ghost" 
                          onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.max(0, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) - 1) }))}
                          style={{ padding: "6px 12px", minHeight: "32px" }}
                        >←</button>
                        <div style={{ 
                          fontWeight: "700", 
                          color: "#16a34a",
                          fontSize: "15px",
                          minWidth: "90px",
                          textAlign: "center"
                        }}>{dayName}</div>
                        <button 
                          className="btn ghost" 
                          onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.min(6, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) + 1) }))}
                          style={{ padding: "6px 12px", minHeight: "32px" }}
                        >→</button>
                      </div>
                    </div>
                    <div>
                      <div className="weekly-menu-grid">
                        {ALL_SECTIONS.map((sec) => (
                          <div key={sec.key} className="weekly-field">
                            <label>{sec.label}</label>
                            {sec.key === "consejos" ? (
                              <textarea 
                                className="input weekly-textarea" 
                                rows={3} 
                                value={(Array.isArray(editable.menu) && editable.menu[selDay] ? editable.menu[selDay][sec.key] : "") || ""} 
                                onChange={(e) => { 
                                  if (!adminMode) return;
                                  setMenuField(selDay, sec.key, e.target.value); 
                                  const ta = e.target; 
                                  ta.style.height = "auto"; 
                                  ta.style.height = Math.max(72, ta.scrollHeight + 2) + "px"; 
                                }} 
                                placeholder="Consejos o notas..." 
                                readOnly={!adminMode}
                                style={{
                                  cursor: adminMode ? "text" : "default",
                                  backgroundColor: adminMode ? "white" : "#f8fafc"
                                }}
                              />
                            ) : (
                              <MenuSelector
                                categoria={sec.key}
                                value={(Array.isArray(editable.menu) && editable.menu[selDay] ? editable.menu[selDay][sec.key] : "") || ""}
                                onChange={(val) => setMenuField(selDay, sec.key, val)}
                                readOnly={!adminMode}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                  {/* Botones flotantes para Dieta Semanal (solo admin) */}
                  {adminMode && (
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
                  )}

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
            {tabs[tabIndex]?.id === "citas" && (
              <div className="card" style={{ padding: adminMode ? "16px 20px" : "16px", width: "100%", maxWidth: "none" }}>
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  flexWrap: "wrap",
                  gap: "10px"
                }}>
                  <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "600", color: "#15803d" }}>📅 Calendario de Citas</h3>
                  
                  {!adminMode && (
                    <button
                      onClick={requestNotificationPermission}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: notificationsEnabled ? "2px solid #16a34a" : "2px solid #94a3b8",
                        background: notificationsEnabled ? "#f0fdf4" : "white",
                        color: notificationsEnabled ? "#15803d" : "#64748b",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s"
                      }}
                      disabled={notificationsEnabled}
                    >
                      {notificationsEnabled ? "✅ Notificaciones activadas" : "🔔 Activar notificaciones"}
                    </button>
                  )}
                </div>

                {loadingAppointments ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>Cargando citas...</div>
                ) : (
                  <>
                    {/* Próxima cita destacada */}
                    {nextAppointment && (
                      <div style={{
                        background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                        border: "2px solid #16a34a",
                        borderRadius: "12px",
                        padding: "16px",
                        marginBottom: "20px"
                      }}>
                        <div style={{ fontSize: "13px", color: "#15803d", fontWeight: "600", marginBottom: "8px" }}>
                          🔔 PRÓXIMA CITA
                        </div>
                        <div style={{ fontSize: "20px", fontWeight: "700", color: "#15803d", marginBottom: "4px" }}>
                          {new Date(nextAppointment.fecha).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: "24px", fontWeight: "800", color: "#16a34a", marginBottom: "8px" }}>
                          {nextAppointment.hora}
                        </div>
                        {nextAppointment.notas && (
                          <div style={{ fontSize: "14px", color: "#064e3b", marginTop: "8px", fontStyle: "italic" }}>
                            📝 {nextAppointment.notas}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Formulario para nueva cita (solo admin) */}
                    {adminMode && (
                      <div style={{
                        background: "#f8fafc",
                        borderRadius: "10px",
                        padding: "16px",
                        marginBottom: "20px",
                        border: "1px solid #e2e8f0"
                      }}>
                        <h4 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600", color: "#475569" }}>
                          ➕ Confirmar nueva cita
                        </h4>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "12px" }}>
                          <div>
                            <label style={{ display: "block", fontSize: "12px", color: "#64748b", marginBottom: "4px", fontWeight: "600" }}>Fecha</label>
                            <input 
                              type="date" 
                              className="input"
                              value={newAppointmentDate}
                              onChange={(e) => setNewAppointmentDate(e.target.value)}
                              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "12px", color: "#64748b", marginBottom: "4px", fontWeight: "600" }}>Hora</label>
                            <input 
                              type="time" 
                              className="input"
                              value={newAppointmentTime}
                              onChange={(e) => setNewAppointmentTime(e.target.value)}
                              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}
                            />
                          </div>
                        </div>
                        <div style={{ marginBottom: "12px" }}>
                          <label style={{ display: "block", fontSize: "12px", color: "#64748b", marginBottom: "4px", fontWeight: "600" }}>Notas (opcional)</label>
                          <input 
                            type="text" 
                            className="input"
                            value={newAppointmentNotes}
                            onChange={(e) => setNewAppointmentNotes(e.target.value)}
                            placeholder="Ej: Primera consulta, revisión mensual..."
                            style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}
                          />
                        </div>
                        <button 
                          className="btn primary"
                          onClick={addAppointment}
                          style={{
                            background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                            color: "white",
                            padding: "10px 20px",
                            borderRadius: "8px",
                            border: "none",
                            fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >
                          ✅ Agregar cita
                        </button>
                      </div>
                    )}

                    {/* Lista de todas las citas */}
                    <div>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600", color: "#475569" }}>
                        📋 Todas las citas
                      </h4>
                      {appointments.length === 0 ? (
                        <div style={{ 
                          textAlign: "center", 
                          padding: "30px", 
                          color: "#94a3b8",
                          fontSize: "14px"
                        }}>
                          No hay citas programadas
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {appointments
                            .sort((a, b) => new Date(b.fecha + 'T' + b.hora) - new Date(a.fecha + 'T' + a.hora))
                            .map((apt, idx) => {
                              const aptDate = new Date(apt.fecha + 'T' + apt.hora);
                              const isPast = aptDate < new Date();
                              return (
                                <div 
                                  key={idx}
                                  style={{
                                    background: isPast ? "#f1f5f9" : "white",
                                    border: `1px solid ${isPast ? "#cbd5e1" : "#e2e8f0"}`,
                                    borderRadius: "8px",
                                    padding: "12px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    opacity: isPast ? 0.6 : 1
                                  }}
                                >
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: "600", color: "#0f172a", marginBottom: "4px" }}>
                                      📅 {new Date(apt.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                      <span style={{ marginLeft: "12px", color: "#16a34a", fontSize: "16px" }}>
                                        🕐 {apt.hora}
                                      </span>
                                    </div>
                                    {apt.notas && (
                                      <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                                        {apt.notas}
                                      </div>
                                    )}
                                    {isPast && (
                                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                                        ✓ Cita pasada
                                      </div>
                                    )}
                                  </div>
                                  {adminMode && (
                                    <button 
                                      onClick={() => deleteAppointment(apt)}
                                      style={{
                                        background: "#fee2e2",
                                        color: "#dc2626",
                                        border: "none",
                                        borderRadius: "6px",
                                        padding: "6px 12px",
                                        fontSize: "12px",
                                        cursor: "pointer",
                                        fontWeight: "600"
                                      }}
                                    >
                                      🗑️ Eliminar
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            {tabs[tabIndex]?.id === "ejercicios" && (
              <div className="card" style={{ padding: adminMode ? "16px 20px" : "12px", width: "100%", maxWidth: "none" }}>
                <h3>Ejercicios</h3>
                <div className="panel-section" style={{ maxWidth: "none" }}>
                  <FileManager userId={uid} type="ejercicios" isAdmin={adminMode} />
                </div>
              </div>
            )}
            {tabs[tabIndex]?.id === "anamnesis" && adminMode && (
              <div className="card" style={{ padding: "16px 20px", width: "100%", maxWidth: "none" }}>
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