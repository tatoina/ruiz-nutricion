import { Line } from 'react-chartjs-2';
import MenuSelector from "./MenuSelector";
import ListaCompra from "./ListaCompra";
import FileManager from "./FileManager";
import AnamnesisForm from "./AnamnesisForm";
import AdminPagos from "./AdminPagos";
import MensajesUsuario from "./MensajesUsuario";
import CitaReminder from "./CitaReminder";
import HelpForm from "./HelpForm";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import "./estilos.css";
import { auth, db, storage } from "../Firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject, listAll, getMetadata } from "firebase/storage";

import { useNavigate } from "react-router-dom";
import { useDevice } from "../hooks/useDevice";
import logger from "../utils/logger";

import {
	Chart as ChartJS,
	LineElement,
	CategoryScale,
	LinearScale,
	PointElement
} from "chart.js";

// Registro obligatorio de elementos para Chart.js v3+
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement);

// Función helper para asegurar que todas las celdas tengan contenteditable
const ensureContentEditableInHTML = (htmlContent) => {
  if (!htmlContent) return htmlContent;
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  // Obtener todas las celdas de la tabla
  const allCells = tempDiv.querySelectorAll('td, th');
  
  allCells.forEach(cell => {
    // Las celdas de cabecera (th) y primera columna (td:first-child) no son editables
    if (cell.tagName === 'TH') {
      cell.setAttribute('contenteditable', 'false');
    } else if (cell.parentElement && cell === cell.parentElement.firstElementChild) {
      // Primera celda de cada fila (nombres de comidas)
      cell.setAttribute('contenteditable', 'false');
    } else {
      // Resto de celdas son editables
      cell.setAttribute('contenteditable', 'true');
      
      // IMPORTANTE: Limpiar contenido corrupto de las celdas editables
      // Preservar saltos de línea (<br>) pero eliminar nesting complejo
      const innerHTML = cell.innerHTML.trim();
      
      // Si la celda solo tiene <br> o está vacía, dejarla así
      if (innerHTML === '<br>' || innerHTML === '') {
        cell.innerHTML = '<br>';
      } else {
        // Verificar si hay elementos verdaderamente complejos (tablas, listas, etc.)
        const hasTrulyComplex = cell.querySelector('table, tr, td, th, ul, ol, li, h1, h2, h3, h4, h5, h6, blockquote');
        if (hasTrulyComplex) {
          // Para HTML muy complejo (tablas anidadas, listas...) extraer texto plano
          const textContent = cell.textContent || '';
          if (textContent.trim()) {
            cell.textContent = textContent;
          } else {
            cell.innerHTML = '<br>';
          }
        } else {
          // Convertir <div> y <p> a saltos de línea (comportamiento de Chrome al pulsar Enter)
          // Esto preserva los saltos de línea insertados por el usuario
          let cleaned = cell.innerHTML;
          // Sustituir </div> y </p> por <br> (fin de bloque → salto de línea)
          cleaned = cleaned.replace(/<\/(div|p)>/gi, '<br>');
          // Eliminar etiquetas <div> y <p> de apertura
          cleaned = cleaned.replace(/<(div|p)[^>]*>/gi, '');
          // Evitar múltiples <br> consecutivos innecesarios al final
          cleaned = cleaned.replace(/(<br\s*\/?>\s*)+$/i, '');
          cell.innerHTML = cleaned || '<br>';
        }
      }
    }
  });
  
  return tempDiv.innerHTML;
};

export default function FichaUsuario(props) {
  const { targetUid = null, adminMode = false, onUsuarioUpdated = null } = props;
  const [showHelpModal, setShowHelpModal] = useState(false);
  const navigate = useNavigate();
  const { isMobile } = useDevice();

  const DEFAULT_CLINIC_LOGO =
    "https://raw.githubusercontent.com/tatoina/ruiz-nutricion/564ee270d5f1a4c692bdd730ce055dd6aab0bfae/public/logoclinica-512.png";

  // Memoizar baseTabs para evitar recrearlas en cada render
  const baseTabs = useMemo(() => [
    { id: "pesaje", label: "📊 Pesaje", icon: "📊" },
    { id: "semana", label: "🍽️ Dieta", icon: "🍽️" },
    { id: "lista-compra", label: "🛒 Lista Compra", icon: "🛒" },
    { id: "gym", label: "🏋️ GYM", icon: "🏋️" },
    { id: "ejercicios", label: "� Docs", icon: "📄" },
    { id: "citas", label: "📅 Citas", icon: "📅" },
    { id: "mensajes", label: "💬 MSG", icon: "💬" },
  ], []);

  // Memoizar ALL_SECTIONS (constante)
  const ALL_SECTIONS = useMemo(() => [
    { key: "desayuno", label: "Desayuno" },
    { key: "almuerzo", label: "Almuerzo" },
    { key: "comida", label: "Comida" },
    { key: "merienda", label: "Merienda" },
    { key: "cena", label: "Cena" },
    { key: "consejos", label: "Consejos del día" },
  ], []);

  const DRIVE_FOLDER_EXERCISES = "1EN-1h1VcV4K4kG2JgmRpxFSY-izas-9c";
  const DRIVE_FOLDER_RECIPES = "1FBwJtFBj0gWr0W9asHdGrkR7Q1FzkKK3";

  const [authUser, setAuthUser] = useState(null);
  const [authUid, setAuthUid] = useState(null);
  const [userData, setUserData] = useState(null);
  const [editable, setEditable] = useState({});
  const [loading, setLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(1); // Pestaña Dieta por defecto
  const [error, setError] = useState(null);

  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [newAppointmentDate, setNewAppointmentDate] = useState("");
  const [newAppointmentTime, setNewAppointmentTime] = useState("");
  const [newAppointmentNotes, setNewAppointmentNotes] = useState("");
  const [printOptions, setPrintOptions] = useState({ dietaMensual: true, datosPesaje: true, tablaGym: false });

  const [showProfile, setShowProfile] = useState(false);
  const [showSnacksModal, setShowSnacksModal] = useState(false);
  const [snacksList, setSnacksList] = useState([]);
  const [loadingSnacks, setLoadingSnacks] = useState(false);
  const [showRecetasModal, setShowRecetasModal] = useState(false);
  const [recetasList, setRecetasList] = useState([]);
  const [loadingRecetas, setLoadingRecetas] = useState(false);
  const [showTarifasModal, setShowTarifasModal] = useState(false);
  const [tarifasUrl, setTarifasUrl] = useState("");
  const [loadingTarifas, setLoadingTarifas] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  const [currentVideoTitle, setCurrentVideoTitle] = useState("");
  const [diasColapsados, setDiasColapsados] = useState({"Día 1": true, "Día 2": true, "Día 3": true, "Día 4": true, "Día 5": true, "Día 6": true, "Día 7": true});

  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const todayISO = new Date().toISOString().slice(0, 10);
  const [fechaPeso, setFechaPeso] = useState(() => todayISO);
  const [savingPeso, setSavingPeso] = useState(false);
  
  // Estado para tipo de menú (tabla o vertical)
  const [tipoMenu, setTipoMenu] = useState("tabla"); // "tabla" o "vertical"
  const [menuVertical, setMenuVertical] = useState({
    desayuno: [],
    almuerzo: [],
    comida: [],
    merienda: [],
    cena: [],
    consejos: "",
    desayuno_notas: "",
    almuerzo_notas: "",
    comida_notas: "",
    merienda_notas: "",
    cena_notas: ""
  });
  
  // Estado para modo manual (editor tipo Word)
  const [modoManual, setModoManual] = useState(false);
  const [contenidoManual, setContenidoManual] = useState("");
  const editorManualRef = useRef(null);
  const debounceTimerRef = useRef(null);
  
  // Estado para celdas seleccionadas (para combinar)
  const [celdasSeleccionadas, setCeldasSeleccionadas] = useState([]);
  
  // Estado para controlar qué comidas están activas en modo manual
  const [comidasActivas, setComidasActivas] = useState({
    desayuno: true,
    almuerzo: true,
    comida: true,
    merienda: true,
    cena: true,
    tips: true
  });
  
  // Estados para opciones disponibles desde BD
  const [menuItemsDisponibles, setMenuItemsDisponibles] = useState({
    desayuno: [],
    almuerzo: [],
    comida: [],
    merienda: [],
    cena: [],
    consejos: []
  });
  const [loadingMenuItems, setLoadingMenuItems] = useState(false);
  const [seccionesColapsadas, setSeccionesColapsadas] = useState({
    desayuno: true,
    almuerzo: true,
    comida: true,
    merienda: true,
    cena: true,
    consejos: true
  });

  // Calcular edad desde fecha de nacimiento
  const calcularEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return null;
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  };

  // Estados para notificaciones
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifiedAppointments, setNotifiedAppointments] = useState(new Set());
  
  // Estado para recordatorio de citas
  const [showCitaReminder, setShowCitaReminder] = useState(false);
  const [citaToRemind, setCitaToRemind] = useState(null);
  const [dismissedReminders, setDismissedReminders] = useState(() => {
    try {
      const saved = localStorage.getItem('dismissedCitaReminders');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Estados para mensajes del admin
  const [showMensajeModal, setShowMensajeModal] = useState(false);
  const [mensajesPendientes, setMensajesPendientes] = useState([]);
  const [mensajeActual, setMensajeActual] = useState(null);
  const [currentMensajeIndex, setCurrentMensajeIndex] = useState(0);
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);

  // Estados para solicitud de cambio de tabla GYM
  const [showSolicitudTabla, setShowSolicitudTabla] = useState(false);
  const [solicitudTablaTexto, setSolicitudTablaTexto] = useState('');
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  
  // Estados para solicitud de cambio de dieta
  const [showSolicitudDieta, setShowSolicitudDieta] = useState(false);
  const [solicitudDietaTexto, setSolicitudDietaTexto] = useState('');
  
  // Estados para solicitud de nueva tabla GYM
  const [showSolicitudNuevaTabla, setShowSolicitudNuevaTabla] = useState(false);
  
  // Modal confirmación email al guardar dieta
  const [showEmailConfirmModal, setShowEmailConfirmModal] = useState(false);
  const [emailConfirmVersion, setEmailConfirmVersion] = useState("");
  const emailConfirmResolveRef = React.useRef(null);

  // Modal restaurar dieta histórica
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreDietaPreview, setRestoreDietaPreview] = useState(null);

  // Historial de dietas (subcolección)
  const [dietasHistoricoList, setDietasHistoricoList] = useState([]);
  const loadDietasHistorico = useCallback(async (targetUid) => {
    if (!targetUid) return;
    try {
      const histRef = collection(db, "users", targetUid, "dietasHistorico");
      const q = query(histRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setDietasHistoricoList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      logger.error("[FichaUsuario] loadDietasHistorico error:", err);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar historial cuando cambia el uid (uid se define más abajo, se usa en useEffect)
  // El useEffect se declara aquí pero uid se resuelve en tiempo de ejecución desde props/auth

  // Estados para galería de fotos de dieta
  const [showFotosModal, setShowFotosModal] = useState(false);
  const [fotosGaleria, setFotosGaleria] = useState([]);
  const [loadingFotos, setLoadingFotos] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFoto, setSelectedFoto] = useState(null);
  const [editingCaption, setEditingCaption] = useState(null);
  const [tempCaption, setTempCaption] = useState('');
  const fileInputRef = useRef(null);
  
  // Email de notificaciones global, leído del perfil del admin
  const [emailNotificaciones, setEmailNotificaciones] = useState('asesoramiento.ruiz@gmail.com');

  // Al cargar el componente, buscar el email de notificaciones del perfil admin
  useEffect(() => {
    const fetchAdminEmail = async () => {
      try {
        const adminDoc = await getDoc(doc(db, 'users', 'admin@admin.es'));
        if (adminDoc.exists()) {
          const data = adminDoc.data();
          if (data.emailNotificaciones && typeof data.emailNotificaciones === 'string') {
            setEmailNotificaciones(data.emailNotificaciones);
          }
        }
      } catch (err) {
        // Si falla, se mantiene el valor por defecto
      }
    };
    fetchAdminEmail();
  }, []);

  // Calcular campos automáticamente cuando cambian peso, altura o porcentajes
  useEffect(() => {
    const pesoNum = parseFloat(editable.peso);
    const alturaNum = parseFloat(altura);
    const masaGrasaPct = parseFloat(editable.masaGrasaPct);
    const aguaTotalPct = parseFloat(editable.aguaTotalPct);
    
    const updates = {};
    
    // Calcular IMC si hay peso y altura
    if (pesoNum > 0 && alturaNum > 0) {
      const alturaMetros = alturaNum / 100;
      const imcCalculado = pesoNum / (alturaMetros * alturaMetros);
      const imcRedondeado = Math.round(imcCalculado * 10) / 10;
      
      const imcActual = parseFloat(editable.imc);
      if (isNaN(imcActual) || Math.abs(imcActual - imcRedondeado) > 0.05) {
        updates.imc = imcRedondeado.toString();
      }
    }
    
    // Calcular Masa Grasa (kg) desde Masa Grasa (%)
    if (pesoNum > 0 && masaGrasaPct >= 0) {
      const masaGrasaKg = Math.round((pesoNum * masaGrasaPct / 100) * 100) / 100;
      const masaGrasaKgActual = parseFloat(editable.masaGrasaKg);
      if (isNaN(masaGrasaKgActual) || Math.abs(masaGrasaKgActual - masaGrasaKg) > 0.05) {
        updates.masaGrasaKg = masaGrasaKg.toString();
      }
      
      // Masa magra ahora es editable manualmente, no se calcula automáticamente
    }
    
    // Calcular Agua Total (kg) desde Agua Total (%)
    if (pesoNum > 0 && aguaTotalPct >= 0) {
      const aguaTotalKg = Math.round((pesoNum * aguaTotalPct / 100) * 100) / 100;
      const aguaTotalKgActual = parseFloat(editable.aguaTotalKg);
      if (isNaN(aguaTotalKgActual) || Math.abs(aguaTotalKgActual - aguaTotalKg) > 0.05) {
        updates.aguaTotalKg = aguaTotalKg.toString();
      }
    }
    
    // Aplicar actualizaciones si hay cambios
    if (Object.keys(updates).length > 0) {
      setEditable(prev => ({ ...prev, ...updates }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable.peso, altura, editable.masaGrasaPct, editable.aguaTotalPct]);

  // Calcular tabs filtradas según el plan del usuario
  const tabs = useMemo(() => {
    const planUsuario = userData?.anamnesis?.eligePlan;
    
    // En modo admin, mostrar siempre todas las pestañas para poder gestionar todo
    // En modo usuario, filtrar según el plan
    let tabsFiltradas = baseTabs;
    
    if (!adminMode) {
      if (planUsuario === "Seguimiento") {
        // Plan Seguimiento: solo Pesaje y Citas
        tabsFiltradas = baseTabs.filter(tab => tab.id === "pesaje" || tab.id === "citas");
      } else if (planUsuario === "Basico") {
        // Plan Básico: sin Ejercicios ni GYM
        tabsFiltradas = baseTabs.filter(tab => tab.id !== "ejercicios" && tab.id !== "gym");
      } else if (planUsuario === "GYM") {
        // Plan GYM: solo GYM
        tabsFiltradas = baseTabs.filter(tab => tab.id === "gym");
      } else if (planUsuario === "GYM + Seguimiento") {
        // Plan GYM + Seguimiento: Pesaje y GYM
        tabsFiltradas = baseTabs.filter(tab => tab.id === "pesaje" || tab.id === "gym");
      }
      // Plan "Basico + Ejercicios" y cualquier otro: todas las pestañas
    }
    
    // En modo admin móvil, reorganizar pestañas: lo importante primero
    if (adminMode) {
      const adminTabs = isMobile 
        ? [
            ...tabsFiltradas,
            { id: "anamnesis", label: "👤 Anamnesis", icon: "👤" },
            { id: "pagos", label: "💰 Pagos", icon: "💰" }
          ]
        : [
            ...tabsFiltradas,
            { id: "anamnesis", label: "Anamnesis", icon: "👤" },
            { id: "pagos", label: "💰 Pagos", icon: "💰" }
          ];
      return adminTabs;
    }
    
    return tabsFiltradas;
  }, [userData, adminMode, baseTabs, isMobile]);

  const saveTimerRef = useRef(null);
  const autoSaveManualFirestoreTimerRef = useRef(null);
  const latestMenuRef = useRef(null);
  const latestUidRef = useRef(null);
  const latestModoManualRef = useRef(false);
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
  const [transposeTable, setTransposeTable] = useState(true); // Siempre vertical por defecto
  const [tableZoom, setTableZoom] = useState(100); // Zoom level percentage

  // Estados para controlar secciones colapsables
  const [showFormulario, setShowFormulario] = useState(false);
  const [showHistorico, setShowHistorico] = useState(isMobile && adminMode); // Expandido por defecto en móvil admin
  const [showGrafico, setShowGrafico] = useState(false);

  // Estado para el orden de los campos de pesaje (solo para admin)
  const [fieldsLocked, setFieldsLocked] = useState(false); // Controla si los campos están bloqueados
  const [fieldsOrder, setFieldsOrder] = useState([
    "masaGrasaPct", "masaGrasaKg", "aguaTotalPct", "aguaTotalKg",
    "masaOseaKg", "masaMuscularKg", "masaMagraKg", "mbKcal", "grasaVisceralNivel",
    "imc", "edadMetabolica", "circunferenciaBrazoCm", "circunferenciaCinturaCm",
    "circunferenciaCaderaCm", "circunferenciaPiernaCm", "indiceCinturaTalla", "pliegueCintura"
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
      logger.error("[FichaUsuario] signOut error:", err);
      setError("No se pudo cerrar sesión.");
    }
  }

  const uid = targetUid || authUid;

  // Cargar historial cuando cambia el uid
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (uid) loadDietasHistorico(uid); }, [uid]);

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
          
          // Limpiar el campo peso y cargar altura antes de establecer userData
          setPeso("");
          setAltura(data.altura || "");
          setUserData(data);
          
          // Cargar tipo de menú y menú vertical
          setTipoMenu(data.tipoMenu || "tabla");
          
          // Normalizar menuVertical para asegurar que todas las propiedades sean arrays
          const menuVerticalData = data.menuVertical || {};
          const normalizedMenuVertical = {
            desayuno: Array.isArray(menuVerticalData.desayuno) ? menuVerticalData.desayuno : [],
            almuerzo: Array.isArray(menuVerticalData.almuerzo) ? menuVerticalData.almuerzo : [],
            comida: Array.isArray(menuVerticalData.comida) ? menuVerticalData.comida : [],
            merienda: Array.isArray(menuVerticalData.merienda) ? menuVerticalData.merienda : [],
            cena: Array.isArray(menuVerticalData.cena) ? menuVerticalData.cena : [],
            consejos: typeof menuVerticalData.consejos === 'string' ? menuVerticalData.consejos : (menuVerticalData.consejos || ""),
            desayuno_notas: menuVerticalData.desayuno_notas || "",
            almuerzo_notas: menuVerticalData.almuerzo_notas || "",
            comida_notas: menuVerticalData.comida_notas || "",
            merienda_notas: menuVerticalData.merienda_notas || "",
            cena_notas: menuVerticalData.cena_notas || ""
          };
          setMenuVertical(normalizedMenuVertical);
          
          // Cargar modo manual
          setModoManual(data.modoManual || false);
          setContenidoManual(data.contenidoManual || "");
          
          // Cargar estado de comidas activas
          if (data.comidasActivas) {
            setComidasActivas({
              desayuno: data.comidasActivas.desayuno !== false,
              almuerzo: data.comidasActivas.almuerzo !== false,
              comida: data.comidasActivas.comida !== false,
              merienda: data.comidasActivas.merienda !== false,
              cena: data.comidasActivas.cena !== false,
              tips: data.comidasActivas.tips !== false
            });
          } else {
            // Resetear a valores por defecto si el usuario no tiene comidas activas guardadas
            setComidasActivas({
              desayuno: true,
              almuerzo: true,
              comida: true,
              merienda: true,
              cena: true,
              tips: true
            });
          }
          
          // Cargar orden de campos si existe
          if (data.fieldsOrder && Array.isArray(data.fieldsOrder)) {
            // Asegurar que el nuevo campo pliegueCintura esté incluido
            let updatedFieldsOrder = [...data.fieldsOrder];
            
            // Si tiene tensionArterial pero no pliegueCintura, reemplazar
            if (updatedFieldsOrder.includes('tensionArterial') && !updatedFieldsOrder.includes('pliegueCintura')) {
              const index = updatedFieldsOrder.indexOf('tensionArterial');
              updatedFieldsOrder[index] = 'pliegueCintura';
            }
            // Si no tiene pliegueCintura, agregarlo al final
            else if (!updatedFieldsOrder.includes('pliegueCintura')) {
              updatedFieldsOrder.push('pliegueCintura');
            }
            
            setFieldsOrder(updatedFieldsOrder);
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
            pliegueCintura: "",
            notas: "",
          }));
          setError(null);
        }
      } catch (err) {
        logger.error("[FichaUsuario] load error:", err);
        setError(err?.message || "Error al cargar la ficha.");
        setUserData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    
    // Listener en tiempo real para cambios en la dieta
    if (uid) {
      const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          
          // En modo admin, NO sobreescribir modoManual/tipoMenu desde Firestore:
          // el admin es quien controla esos valores localmente
          if (!adminMode) {
            if (data.modoManual !== undefined) {
              setModoManual(data.modoManual);
            }
            if (data.contenidoManual !== undefined) {
              setContenidoManual(data.contenidoManual);
            }
            if (data.tipoMenu !== undefined) {
              setTipoMenu(data.tipoMenu);
            }
          }
          
          // Actualizar menú vertical solo si no estamos en modo admin editando
          // Para evitar que se sobrescriba mientras el admin está seleccionando opciones
          if (data.menuVertical !== undefined && !adminMode) {
            const menuVerticalData = data.menuVertical || {};
            const normalizedMenuVertical = {
              desayuno: Array.isArray(menuVerticalData.desayuno) ? menuVerticalData.desayuno : [],
              almuerzo: Array.isArray(menuVerticalData.almuerzo) ? menuVerticalData.almuerzo : [],
              comida: Array.isArray(menuVerticalData.comida) ? menuVerticalData.comida : [],
              merienda: Array.isArray(menuVerticalData.merienda) ? menuVerticalData.merienda : [],
              cena: Array.isArray(menuVerticalData.cena) ? menuVerticalData.cena : [],
              consejos: typeof menuVerticalData.consejos === 'string' ? menuVerticalData.consejos : (menuVerticalData.consejos || ""),
              desayuno_notas: menuVerticalData.desayuno_notas || "",
              almuerzo_notas: menuVerticalData.almuerzo_notas || "",
              comida_notas: menuVerticalData.comida_notas || "",
              merienda_notas: menuVerticalData.merienda_notas || "",
              cena_notas: menuVerticalData.cena_notas || ""
            };
            setMenuVertical(normalizedMenuVertical);
          }
          
          // Actualizar menú normal
          if (data.menu !== undefined) {
            setEditable((prev) => ({
              ...prev,
              menu: normalizeMenu(data.menu)
            }));
          }
        }
      });
      
      return () => {
        mounted = false;
        unsubscribe();
      };
    }
    
    return () => { mounted = false; };
  }, [uid, normalizeMenu, emptyDayMenu, todayIndex]);

  // Cargar items de menú disponibles cuando se activa el formato vertical
  useEffect(() => {
    if (tipoMenu === "vertical" && Object.keys(menuItemsDisponibles).every(k => menuItemsDisponibles[k].length === 0)) {
      loadMenuItems();
    }
  }, [tipoMenu]);

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

  // === AUTOSAVE FIABLE: sincronización de refs con últimos valores ===
  // (permite acceso sin stale closures desde visibilitychange y cleanups)
  useEffect(() => { latestMenuRef.current = editable.menu; }, [editable.menu]);
  useEffect(() => { latestUidRef.current = uid; }, [uid]);
  useEffect(() => { latestModoManualRef.current = modoManual; }, [modoManual]);

  // Guardado real del menú normal – lee siempre de refs, nunca stale
  const flushSaveMenu = useCallback(async () => {
    const currentUid = latestUidRef.current;
    const currentMenu = latestMenuRef.current;
    if (!currentUid || !currentMenu) return;
    setSaveStatus("saving");
    try {
      const menuToSave = Array.isArray(currentMenu) ? currentMenu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      await updateDoc(doc(db, "users", currentUid), { menu: menuToSave, updatedAt: serverTimestamp() });
      setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 1200);
    } catch (err) {
      logger.error("[FichaUsuario] flushSaveMenu error:", err);
      const notFoundCodes = ["not-found", "notFound", "404"];
      const isNotFound = err?.code ? notFoundCodes.some((c) => String(err.code).toLowerCase().includes(String(c).toLowerCase())) : false;
      if (isNotFound) {
        try {
          await setDoc(doc(db, "users", currentUid), { menu: Array.isArray(currentMenu) ? currentMenu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() })), updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
          setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 1200);
        } catch (err2) {
          logger.error("[FichaUsuario] flushSaveMenu fallback error:", err2);
          setSaveStatus("error"); setError(err2?.message || "No se pudo guardar el menú.");
        }
      } else {
        setSaveStatus("error"); setError(err?.message || "No se pudo guardar el menú.");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Guardado real del modo manual – lee de editorManualRef (DOM) o contenidoManualRef
  const flushSaveManual = useCallback(async () => {
    // Guarda: si ya no estamos en modo manual (el admin cambió de tipo), no guardar
    if (!latestModoManualRef.current) return;
    const currentUid = latestUidRef.current;
    const html = editorManualRef.current?.innerHTML || contenidoManualRef.current;
    if (!currentUid || !html) return;
    // Guardia de tamaño (autosave)
    const estimatedKB = Math.round(new Blob([html]).size / 1024);
    if (estimatedKB > 800) {
      logger.error(`[FichaUsuario] flushSaveManual BLOQUEADO: contenidoManual es ${estimatedKB} KB (límite seguro 800 KB)`);
      setSaveStatus("error");
      return;
    }
    setSaveStatus("saving");
    try {
      await updateDoc(doc(db, "users", currentUid), {
        contenidoManual: html,
        modoManual: true,
        updatedAt: serverTimestamp()
      });
      setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 1200);
    } catch (err) {
      logger.error("[FichaUsuario] flushSaveManual error:", err);
      setSaveStatus("error");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave menú normal (tabla/vertical)
  // Fix: en el cleanup, si hay timer pendiente → flush inmediato en vez de cancelar
  useEffect(() => {
    if (!uid) return;
    if (!editable.menu) return;
    if (modoManual) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    setSaveStatus("pending");
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null;
      await flushSaveMenu();
    }, 1200);
    return () => {
      if (saveTimerRef.current) {
        // Cambios pendientes: cancelar timer y guardar YA (al navegar/desmontar)
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        flushSaveMenu();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable.menu, uid, modoManual]);

  // Autoguardar contenido manual en localStorage mientras se edita
  const autoSaveManualTimerRef = useRef(null);

  // Limpiar timer de debounce al desmontar
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Autosave modoManual: localStorage rápido (800ms) + Firestore (3000ms)
  // Fix: antes solo iba a localStorage; ahora también va a Firestore
  useEffect(() => {
    if (!adminMode || !modoManual || !uid || !contenidoManual) return;

    // localStorage rápido (800ms)
    if (autoSaveManualTimerRef.current) { clearTimeout(autoSaveManualTimerRef.current); autoSaveManualTimerRef.current = null; }
    autoSaveManualTimerRef.current = setTimeout(() => {
      const storageKey = `menu_manual_draft_${uid}`;
      try {
        localStorage.setItem(storageKey, contenidoManual);
        logger.log("[FichaUsuario] Contenido manual autoguardado en localStorage");
      } catch (err) {
        logger.error("[FichaUsuario] Error guardando en localStorage:", err);
      }
    }, 800);

    // Firestore con debounce de 3s
    if (autoSaveManualFirestoreTimerRef.current) { clearTimeout(autoSaveManualFirestoreTimerRef.current); autoSaveManualFirestoreTimerRef.current = null; }
    autoSaveManualFirestoreTimerRef.current = setTimeout(async () => {
      autoSaveManualFirestoreTimerRef.current = null;
      await flushSaveManual();
    }, 3000);

    return () => {
      if (autoSaveManualTimerRef.current) { clearTimeout(autoSaveManualTimerRef.current); autoSaveManualTimerRef.current = null; }
      if (autoSaveManualFirestoreTimerRef.current) {
        clearTimeout(autoSaveManualFirestoreTimerRef.current);
        autoSaveManualFirestoreTimerRef.current = null;
        // Solo hacer flush si seguimos en modo manual (evita guardar modoManual:true al cambiar de tipo)
        if (latestModoManualRef.current) flushSaveManual();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contenidoManual, adminMode, modoManual, uid]);

  // visibilitychange: guardar inmediatamente cuando el admin cambia de pestaña del navegador
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) return;
      // Modo normal: hay timer pendiente → flush ahora
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (!latestModoManualRef.current) flushSaveMenu();
      }
      // Modo manual: hay timer Firestore pendiente → flush ahora
      if (autoSaveManualFirestoreTimerRef.current) {
        clearTimeout(autoSaveManualFirestoreTimerRef.current);
        autoSaveManualFirestoreTimerRef.current = null;
        if (latestModoManualRef.current) flushSaveManual();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Establecer el contenido inicial del editor manual
  // IMPORTANTE: se actualiza síncronamente en cada render (NO en useEffect)
  // para que cuando setEditorManualRef se ejecute tras el commit, el ref ya tenga el valor actual.
  const contenidoManualRef = useRef(contenidoManual);
  contenidoManualRef.current = contenidoManual;
  
  const setEditorManualRef = useCallback((node) => {
    // Siempre actualizar el ref del DOM (ANTES del early-return).
    // useCallback tiene deps=[] → su closure puede tener modoManual stale.
    // Al menos el ref apunta al nodo correcto para que el timeout del restore lo encuentre.
    if (!node) { editorManualRef.current = null; return; }
    editorManualRef.current = node;

    // Si hay contenido pendiente de restauración, aplicarlo y salir
    // (no necesitamos inicialización estándar en ese caso)
    if (pendingRestoreContentRef.current) {
      node.innerHTML = ensureContentEditableInHTML(pendingRestoreContentRef.current);
      pendingRestoreContentRef.current = null;
      return;
    }

    if (!adminMode || !modoManual || !uid) return;
    const defaultContent = `
      <style>
        table { 
          width: 100%; 
          border-collapse: collapse; 
          font-family: Arial, sans-serif; 
          font-size: 13px; 
          table-layout: auto;
        }
        th, td { 
          border: 1px solid #ddd; 
          padding: 10px; 
          vertical-align: top; 
          word-break: break-word;
          min-width: 120px;
        }
        th { 
          background-color: #15803d; 
          color: white; 
          text-align: center; 
          font-weight: 600;
          user-select: none;
          cursor: not-allowed;
          font-size: 12px;
          white-space: nowrap;
        }
        td:first-child { 
          font-weight: 600; 
          background-color: #f0fdf4; 
          text-align: center;
          min-width: 90px;
          width: 90px;
          user-select: none;
          cursor: not-allowed;
          font-size: 11px;
        }
        td:not(:first-child) { 
          min-height: 80px;
          height: auto;
          font-size: 14px;
          line-height: 1.5;
        }
        
        /* Estilos para móvil */
        @media (max-width: 768px) {
          table {
            font-size: 16px;
            display: block;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          thead {
            display: block;
          }
          tbody {
            display: block;
          }
          tr {
            display: table;
            width: 100%;
            table-layout: auto;
          }
          th, td {
            padding: 12px;
            font-size: 16px;
            min-width: 140px;
          }
          td:first-child {
            min-width: 100px;
            width: 100px;
            font-size: 14px;
            position: sticky;
            left: 0;
            z-index: 2;
            box-shadow: 2px 0 4px rgba(0,0,0,0.1);
          }
          th:first-child {
            position: sticky;
            left: 0;
            z-index: 3;
            box-shadow: 2px 0 4px rgba(0,0,0,0.1);
          }
          td:not(:first-child) {
            min-height: 100px;
            font-size: 16px;
            line-height: 1.6;
          }
        }
      </style>
      <table>
        <thead>
          <tr>
            <th style="width: 120px;" contenteditable="false">COMIDA</th>
            <th contenteditable="false">LUNES</th>
            <th contenteditable="false">MARTES</th>
            <th contenteditable="false">MIÉRCOLES</th>
            <th contenteditable="false">JUEVES</th>
            <th contenteditable="false">VIERNES</th>
            <th contenteditable="false">SÁBADO</th>
            <th contenteditable="false">DOMINGO</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td contenteditable="false">DESAYUNO</td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
          </tr>
          <tr>
            <td contenteditable="false">ALMUERZO</td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
          </tr>
          <tr>
            <td contenteditable="false">COMIDA</td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
          </tr>
          <tr>
            <td contenteditable="false">MERIENDA</td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
          </tr>
          <tr>
            <td contenteditable="false">CENA</td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
          </tr>
          <tr>
            <td style="background-color: #fff7ed;" contenteditable="false">TIPS</td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
          </tr>
        </tbody>
      </table>
    `;
    
    const storageKey = `menu_manual_draft_${uid}`;
    const savedContent = localStorage.getItem(storageKey);
    
    // Función para validar que el contenido es una tabla válida
    const isValidContent = (content) => {
      if (!content) return false;
      
      // Verificar que tenga una tabla
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const table = doc.querySelector('table');
      
      if (!table) return false;
      
      // Verificar que tenga las filas principales
      const tbody = table.querySelector('tbody');
      if (!tbody) return false;
      
      const rows = tbody.querySelectorAll('tr');
      if (rows.length < 5) return false; // Debe tener al menos 5 comidas
      
      return true;
    };
    
    // Función para asegurar que el contenido tiene los estilos
    const ensureStyles = (content) => {
      if (!content) return defaultContent;
      
      // Si ya tiene la etiqueta <style>, devolverlo tal cual
      if (content.includes('<style>')) return content;
      
      // Si no tiene estilos, añadirlos
      const styleTag = `
      <style>
        table { 
          width: 100%; 
          border-collapse: collapse; 
          font-family: Arial, sans-serif; 
          font-size: 13px; 
          table-layout: auto;
        }
        th, td { 
          border: 1px solid #ddd; 
          padding: 10px; 
          vertical-align: top; 
          word-break: break-word;
          min-width: 120px;
        }
        th { 
          background-color: #15803d; 
          color: white; 
          text-align: center; 
          font-weight: 600;
          user-select: none;
          cursor: not-allowed;
          font-size: 12px;
          white-space: nowrap;
        }
        td:first-child { 
          font-weight: 600; 
          background-color: #f0fdf4; 
          text-align: center;
          min-width: 90px;
          width: 90px;
          user-select: none;
          cursor: not-allowed;
          font-size: 11px;
        }
        td:not(:first-child) { 
          min-height: 80px;
          height: auto;
          font-size: 14px;
          line-height: 1.5;
        }
        
        /* Estilos para móvil */
        @media (max-width: 768px) {
          table {
            font-size: 16px;
            display: block;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          thead {
            display: block;
          }
          tbody {
            display: block;
          }
          tr {
            display: table;
            width: 100%;
            table-layout: auto;
          }
          th, td {
            padding: 12px;
            font-size: 16px;
            min-width: 140px;
          }
          td:first-child {
            min-width: 100px;
            width: 100px;
            font-size: 14px;
            position: sticky;
            left: 0;
            z-index: 2;
            box-shadow: 2px 0 4px rgba(0,0,0,0.1);
          }
          th:first-child {
            position: sticky;
            left: 0;
            z-index: 3;
            box-shadow: 2px 0 4px rgba(0,0,0,0.1);
          }
          td:not(:first-child) {
            min-height: 100px;
            font-size: 16px;
            line-height: 1.6;
          }
        }
      </style>
      `;
      return styleTag + content;
    };
    
    // Prioridad: localStorage > contenidoManual > default
    // Validar y limpiar si está corrupto
    if (savedContent && isValidContent(savedContent)) {
      node.innerHTML = ensureContentEditableInHTML(ensureStyles(savedContent));
    } else if (savedContent && !isValidContent(savedContent)) {
      // Contenido corrupto en localStorage, limpiar y usar default
      console.warn('⚠️ Contenido corrupto en localStorage, reseteando...');
      localStorage.removeItem(storageKey);
      node.innerHTML = defaultContent;
    } else if (contenidoManualRef.current && isValidContent(contenidoManualRef.current)) {
      node.innerHTML = ensureContentEditableInHTML(ensureStyles(contenidoManualRef.current));
    } else if (contenidoManualRef.current && !isValidContent(contenidoManualRef.current)) {
      // Contenido corrupto en memoria, usar default
      console.warn('⚠️ Contenido corrupto en memoria, usando plantilla por defecto...');
      node.innerHTML = defaultContent;
    } else {
      node.innerHTML = defaultContent;
    }
    
    // Configurar celdas editables después de cargar
    setTimeout(() => {
      if (!node) return;
      
      const editableCells = node.querySelectorAll('td[contenteditable="true"]');
      console.log('🔧 Celdas editables encontradas:', editableCells.length);
      
      editableCells.forEach((cell, index) => {
        // Forzar atributo contenteditable
        cell.setAttribute('contenteditable', 'true');
        cell.style.cursor = 'text';
        cell.style.outline = 'none';
        cell.style.userSelect = 'text';
        cell.style.WebkitUserSelect = 'text';
        cell.style.transition = 'background-color 0.2s, box-shadow 0.2s';
        
        // Agregar un ID único para identificar la celda
        cell.dataset.cellId = `cell-${index}`;
        
        // Si la celda está vacía, asegurar que tiene un <br>
        if (!cell.textContent.trim() && !cell.querySelector('br')) {
          cell.innerHTML = '<br>';
        }
        
        // Event listener para seleccionar celdas (Ctrl+Click)
        cell.addEventListener('click', (e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            
            const cellId = cell.dataset.cellId;
            const isSelected = cell.classList.contains('celda-seleccionada');
            
            if (isSelected) {
              // Deseleccionar
              cell.classList.remove('celda-seleccionada');
              cell.style.backgroundColor = '';
              cell.style.boxShadow = '';
              setCeldasSeleccionadas(prev => prev.filter(c => c !== cell));
            } else {
              // Seleccionar
              cell.classList.add('celda-seleccionada');
              cell.style.backgroundColor = '#dbeafe';
              cell.style.boxShadow = 'inset 0 0 0 2px #3b82f6';
              setCeldasSeleccionadas(prev => [...prev, cell]);
            }
          }
        });
        
        console.log('✅ Celda configurada:', cell.textContent.substring(0, 20));
      });
    }, 100);
    
    // El estado de comidas activas se aplicará por el useEffect separado más abajo (no aquí para evitar re-renders)
  }, [adminMode, modoManual, uid]);

  // Limpiar selección de celdas cuando cambia el usuario o modo
  useEffect(() => {
    if (celdasSeleccionadas.length > 0) {
      celdasSeleccionadas.forEach(cell => {
        if (cell && cell.classList) {
          cell.classList.remove('celda-seleccionada');
          cell.style.backgroundColor = '';
          cell.style.boxShadow = '';
        }
      });
      setCeldasSeleccionadas([]);
    }
  }, [uid, modoManual]);

  // Actualizar contenido cuando cambia el usuario
  const lastLoadedUidRef = useRef(null);
  useEffect(() => {
    if (!editorManualRef.current || !adminMode || !modoManual || !uid) return;
    
    // Si cambió el usuario, recargar el contenido
    if (lastLoadedUidRef.current && lastLoadedUidRef.current !== uid) {
      const defaultContent = `
      <style>
        table { 
          width: 100%; 
          border-collapse: collapse; 
          font-family: Arial, sans-serif; 
          font-size: 13px; 
          table-layout: fixed; 
        }
        th, td { 
          border: 1px solid #ddd; 
          padding: 8px; 
          vertical-align: top; 
          word-break: break-word;
        }
        th { 
          background-color: #15803d; 
          color: white; 
          text-align: center; 
          font-weight: 600;
          user-select: none;
          cursor: not-allowed;
        }
        td:first-child { 
          font-weight: 600; 
          background-color: #f0fdf4; 
          text-align: center;
          width: 100px;
          user-select: none;
          cursor: not-allowed;
        }
        td:not(:first-child) { 
          min-height: 80px;
          height: auto;
        }
      </style>
      <table>
        <thead>
          <tr>
            <th style="width: 120px;" contenteditable="false">COMIDA</th>
            <th contenteditable="false">LUNES</th>
            <th contenteditable="false">MARTES</th>
            <th contenteditable="false">MIÉRCOLES</th>
            <th contenteditable="false">JUEVES</th>
            <th contenteditable="false">VIERNES</th>
            <th contenteditable="false">SÁBADO</th>
            <th contenteditable="false">DOMINGO</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td contenteditable="false">DESAYUNO</td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
          </tr>
          <tr>
            <td contenteditable="false">ALMUERZO</td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
          </tr>
          <tr>
            <td contenteditable="false">COMIDA</td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
          </tr>
          <tr>
            <td contenteditable="false">MERIENDA</td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
          </tr>
          <tr>
            <td contenteditable="false">CENA</td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
          </tr>
          <tr>
            <td style="background-color: #fff7ed;" contenteditable="false">TIPS</td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
            <td contenteditable="true"><br></td>
          </tr>
        </tbody>
      </table>
    `;
      
      const ensureStyles = (content) => {
        if (!content) return defaultContent;
        if (content.includes('<style>')) return content;
        
        const styleTag = `
      <style>
        table { 
          width: 100%; 
          border-collapse: collapse; 
          font-family: Arial, sans-serif; 
          font-size: 13px; 
          table-layout: fixed; 
        }
        th, td { 
          border: 1px solid #ddd; 
          padding: 8px; 
          vertical-align: top; 
          word-break: break-word;
        }
        th { 
          background-color: #15803d; 
          color: white; 
          text-align: center; 
          font-weight: 600;
          user-select: none;
          cursor: not-allowed;
        }
        td:first-child { 
          font-weight: 600; 
          background-color: #f0fdf4; 
          text-align: center;
          width: 100px;
          user-select: none;
          cursor: not-allowed;
        }
        td:not(:first-child) { 
          min-height: 80px;
          height: auto;
        }
      </style>
      `;
        return styleTag + content;
      };
      
      const storageKey = `menu_manual_draft_${uid}`;
      const savedContent = localStorage.getItem(storageKey);
      
      // Cargar contenido del nuevo usuario
      if (savedContent) {
        editorManualRef.current.innerHTML = ensureContentEditableInHTML(ensureStyles(savedContent));
      } else if (contenidoManual) {
        editorManualRef.current.innerHTML = ensureContentEditableInHTML(ensureStyles(contenidoManual));
      } else {
        editorManualRef.current.innerHTML = defaultContent;
      }
      
      // Configurar celdas editables después de cargar
      setTimeout(() => {
        if (!editorManualRef.current) return;
        
        const editableCells = editorManualRef.current.querySelectorAll('td[contenteditable="true"]');
        console.log('🔧 Configurando celdas al cambiar usuario:', editableCells.length);
        
        editableCells.forEach((cell) => {
          cell.setAttribute('contenteditable', 'true');
          cell.style.cursor = 'text';
          cell.style.outline = 'none';
          cell.style.userSelect = 'text';
          cell.style.WebkitUserSelect = 'text';
          
          if (!cell.textContent.trim() && !cell.querySelector('br')) {
            cell.innerHTML = '<br>';
          }
        });
      }, 100);
    }
    
    lastLoadedUidRef.current = uid;
  }, [uid, adminMode, modoManual]);

  // Aplicar estado de comidas activas al editor (solo cuando cambia comidasActivas, no contenidoManual)
  useEffect(() => {
    if (!editorManualRef.current || !adminMode || !modoManual) return;
    
    // Usar requestAnimationFrame para evitar conflictos con el foco del usuario
    requestAnimationFrame(() => {
      const table = editorManualRef.current?.querySelector('table');
      if (!table) return;
      
      const tbody = table.querySelector('tbody');
      if (!tbody) return;
      
      // Guardar el elemento con foco y selección antes de modificar
      const activeElement = document.activeElement;
      const wasFocused = editorManualRef.current?.contains(activeElement);
      let selection = null;
      let range = null;
      
      if (wasFocused && activeElement.tagName === 'TD') {
        try {
          const sel = window.getSelection();
          if (sel.rangeCount > 0) {
            range = sel.getRangeAt(0);
            selection = {
              startContainer: range.startContainer,
              startOffset: range.startOffset,
              endContainer: range.endContainer,
              endOffset: range.endOffset
            };
          }
        } catch (e) {
          // Ignorar errores de selección
        }
      }
      
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(row => {
        const firstCell = row.querySelector('td:first-child');
        if (!firstCell) return;
        
        const cellText = firstCell.textContent.trim().toUpperCase();
        const mealKey = cellText.toLowerCase();
        
        // Verificar si esta comida está activa
        const isActive = comidasActivas[mealKey];
        
        // Actualizar todas las celdas de esta fila (excepto la primera)
        const cells = row.querySelectorAll('td:not(:first-child)');
        cells.forEach(cell => {
          if (isActive !== false) {
            // Comida activa: permitir edición
            cell.setAttribute('contenteditable', 'true');
            cell.style.backgroundColor = '';
            cell.style.opacity = '1';
            cell.style.cursor = 'text';
          } else {
            // Comida desactivada: bloquear edición
            cell.setAttribute('contenteditable', 'false');
            cell.style.backgroundColor = '#f1f5f9';
            cell.style.opacity = '0.6';
            cell.style.cursor = 'not-allowed';
          }
        });
      });
      
      // Restaurar foco y selección si estaba dentro del editor
      if (wasFocused && activeElement && activeElement !== document.body) {
        try {
          activeElement.focus();
          if (selection && range) {
            const newRange = document.createRange();
            newRange.setStart(selection.startContainer, selection.startOffset);
            newRange.setEnd(selection.endContainer, selection.endOffset);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
        } catch (e) {
          // Ignorar errores al restaurar selección
        }
      }
    });
  }, [comidasActivas, adminMode, modoManual, uid]);

  const saveSemana = useCallback(async () => {
    if (!uid) { setError("Usuario objetivo no disponible."); return; }
    setSaveStatus("saving");
    try {
      const menuToSave = Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      await updateDoc(doc(db, "users", uid), { menu: menuToSave, updatedAt: serverTimestamp() });
      setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 1200);
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        setUserData(snap.data());
        
        // Enviar email de notificación al usuario
        const currentData = snap.data();
        if (currentData.email) {
          const userName = currentData.nombre || 'Usuario';
          await sendDietUpdateEmail(currentData.email, userName);
        }
      }
    } catch (err) {
      logger.error("[FichaUsuario] saveSemana error:", err);
      setSaveStatus("error"); setError(err?.message || "No se pudo guardar el menú semanal.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, editable.menu]);

  // Función para enviar email de notificación de dieta actualizada
  const sendDietUpdateEmail = async (userEmail, userName) => {
    try {
      await addDoc(collection(db, "mail"), {
        to: userEmail,
        message: {
          subject: "Tu dieta ha sido actualizada 🍎",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Dieta Actualizada</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 40px 0;">
                    <table role="presentation" style="width: 600px; max-width: 90%; border-collapse: collapse; background-color: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                      <!-- Header -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">
                            ✅ Tu Dieta ha sido Actualizada
                          </h1>
                        </td>
                      </tr>
                      
                      <!-- Body -->
                      <tr>
                        <td style="padding: 40px 30px;">
                          <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            Hola <strong>${userName || 'Usuario'}</strong>,
                          </p>
                          
                          <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            Tu nutricionista ha actualizado tu dieta personalizada. Ya puedes consultarla desde la aplicación.
                          </p>
                          
                          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin: 30px 0; border-radius: 4px;">
                            <p style="color: #166534; font-size: 15px; margin: 0; line-height: 1.6;">
                              <strong>💡 ¿Qué hacer ahora?</strong><br>
                              Accede a la aplicación para ver tu nueva dieta y todas las recomendaciones de tu nutricionista.
                            </p>
                          </div>
                          
                          <!-- CTA Button -->
                          <table role="presentation" style="margin: 30px 0; width: 100%;">
                            <tr>
                              <td align="center">
                                <a href="https://nutricionapp-b7b7d.web.app" 
                                   style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(22,163,74,0.3);">
                                  📱 Ver mi Dieta
                                </a>
                              </td>
                            </tr>
                          </table>
                          
                          <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                            Si tienes alguna duda sobre tu nueva dieta, no dudes en contactar con tu nutricionista.
                          </p>
                        </td>
                      </tr>
                      
                      <!-- Footer -->
                      <tr>
                        <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                          <p style="color: #6b7280; font-size: 13px; margin: 0; line-height: 1.5;">
                            Este correo se envió automáticamente. Por favor, no respondas a este mensaje.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        },
      });
      logger.log(`[FichaUsuario] Email de actualización de dieta enviado a ${userEmail}`);
    } catch (err) {
      logger.error("[FichaUsuario] Error al enviar email de actualización de dieta:", err);
      // No lanzamos error para no interrumpir el flujo de guardado
    }
  };

  const saveVersionMenu = async () => {
    if (!uid) { setError("Usuario objetivo no disponible."); return; }
    try {
      let menuToSave;
      let contenidoManualToSave = contenidoManual;
      
      // Si estamos en modo manual, capturar el contenido del editor
      if (modoManual && editorManualRef.current) {
        contenidoManualToSave = editorManualRef.current.innerHTML;
        
        // Extraer contenido de la tabla para poblar el menú normal
        const parser = new DOMParser();
        const doc = parser.parseFromString(contenidoManualToSave, 'text/html');
        const table = doc.querySelector('table');
        
        if (table) {
          const rows = table.querySelectorAll('tbody tr');
          const menuData = Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
          
          rows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('td');
            const mealTypes = ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena', 'consejos'];
            const mealType = mealTypes[rowIndex];
            
            if (mealType) {
              // Procesar cada día de la semana (columnas 1-7, la 0 es el nombre de la comida)
              for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                const cell = cells[dayIndex + 1]; // +1 porque la primera celda es el nombre de la comida
                if (cell) {
                  const text = cell.textContent.trim();
                  if (mealType === 'consejos') {
                    // Para consejos (TIPS), solo guardar en el primer día
                    if (dayIndex === 0 && text) {
                      for (let i = 0; i < 7; i++) {
                        menuData[i][mealType] = text;
                      }
                    }
                  } else {
                    menuData[dayIndex][mealType] = text;
                  }
                }
              }
            }
          });
          
          menuToSave = menuData;
        } else {
          // Si no hay tabla, usar menú vacío
          menuToSave = Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
        }
      } else {
        // Modo normal (tabla o vertical)
        menuToSave = Array.isArray(editable.menu) ? editable.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      }
      
      const timestamp = new Date().toISOString();
      const now = new Date();
      
      const snap = await getDoc(doc(db, "users", uid));
      const currentData = snap.exists() ? snap.data() : {};

      // --- Historial en SUBCOLECIÓN (no en el documento del usuario) ---
      const histRef = collection(db, "users", uid, "dietasHistorico");
      // Marcar fechaHasta de la última versión activa
      const sortedAsc = [...dietasHistoricoList].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
      if (sortedAsc.length > 0) {
        const lastVersion = sortedAsc[sortedAsc.length - 1];
        if (!lastVersion.fechaHasta && lastVersion.id) {
          try {
            await updateDoc(doc(db, "users", uid, "dietasHistorico", lastVersion.id), { fechaHasta: timestamp });
          } catch (_) {}
        }
      }
      // Crear nueva versión en la subcoleción
      const versionNumber = String(dietasHistoricoList.length + 1).padStart(3, '0');
      const newVersion = {
        numero: versionNumber,
        fechaDesde: timestamp,
        fechaHasta: null,
        menu: menuToSave,
        modoManual: modoManual,
        contenidoManual: modoManual ? contenidoManualToSave : null,
        tipoMenu: tipoMenu,
        menuVertical: tipoMenu === "vertical" ? menuVertical : null,
        createdAt: timestamp
      };
      await addDoc(histRef, newVersion);

      // Actualizar documento usuario SIN dietasHistorico ni menuHistorico
      const updateData = {
        menu: menuToSave,
        modoManual: modoManual,
        tipoMenu: tipoMenu,
        comidasActivas: comidasActivas,
        updatedAt: serverTimestamp()
      };
      if (modoManual) {
        updateData.contenidoManual = contenidoManualToSave;
        setContenidoManual(contenidoManualToSave);
      }
      // Guardar menuVertical cuando el tipo de menú es vertical
      if (tipoMenu === "vertical") {
        updateData.menuVertical = menuVertical;
      }

      // ── Guardia de tamaño: estimar KB antes de escribir ──────────────────
      // Firestore limita a 1MB por documento. JSON.stringify subestima ligeramente
      // (Firestore usa codificación propia), pero sirve como cota de seguridad.
      const estimatedUpdateKB = Math.round(new Blob([JSON.stringify(updateData)]).size / 1024);
      const FIRESTORE_SAFE_LIMIT_KB = 800; // 80% del límite real (1024 KB)
      if (estimatedUpdateKB > FIRESTORE_SAFE_LIMIT_KB) {
        logger.error(`[FichaUsuario] GUARDIA TAMAÑO: updateData estimado en ${estimatedUpdateKB} KB, supera ${FIRESTORE_SAFE_LIMIT_KB} KB. Guardado bloqueado.`);
        alert(`⚠️ El contenido de la dieta es demasiado grande (${estimatedUpdateKB} KB).\nFirestore tiene un límite de 1024 KB por documento.\nPor favor, reduce el contenido antes de guardar.`);
        return;
      }
      if (estimatedUpdateKB > 500) {
        logger.warn(`[FichaUsuario] Aviso tamaño: updateData es ${estimatedUpdateKB} KB. Considera reducir el contenido.`);
      }
      // ─────────────────────────────────────────────────────────────────────

      await updateDoc(doc(db, "users", uid), updateData);
      await loadDietasHistorico(uid);
      const newSnap = await getDoc(doc(db, "users", uid));
      if (newSnap.exists()) setUserData(newSnap.data());
      
      // Limpiar el borrador de localStorage después de guardar exitosamente
      if (modoManual) {
        const storageKey = `menu_manual_draft_${uid}`;
        try {
          localStorage.removeItem(storageKey);
          logger.log("[FichaUsuario] Borrador de localStorage eliminado después de guardar");
        } catch (err) {
          logger.error("[FichaUsuario] Error eliminando borrador de localStorage:", err);
        }
      }
      
      // Preguntar si desea enviar email de notificación al usuario
      let emailEnviado = false;
      if (currentData.email) {
        const confirmarEmail = await new Promise((resolve) => {
          emailConfirmResolveRef.current = resolve;
          setEmailConfirmVersion(versionNumber);
          setShowEmailConfirmModal(true);
        });
        setShowEmailConfirmModal(false);
        emailConfirmResolveRef.current = null;
        
        if (confirmarEmail) {
          try {
            const userName = currentData.nombre || 'Usuario';
            await sendDietUpdateEmail(currentData.email, userName);
            emailEnviado = true;
          } catch (emailError) {
            console.error("Error enviando email:", emailError);
            alert("⚠️ La dieta se guardó pero hubo un error al enviar el email.");
          }
        }
      } else {
        alert(`✅ Dieta #${versionNumber} guardada correctamente`);
      }
      
      if (emailEnviado) {
        alert(`✅ Dieta #${versionNumber} guardada y email enviado al usuario`);
      } else if (currentData.email) {
        alert(`✅ Dieta #${versionNumber} guardada correctamente`);
      }
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
      
      // Si es admin y está cambiando el rol, usar Cloud Function
      if (adminMode && editable.rol && editable.rol !== userData?.rol) {
        const { httpsCallable } = await import("firebase/functions");
        const { functions } = await import("../Firebase");
        const updateUser = httpsCallable(functions, "updateUser");
        
        await updateUser({
          uid: uid,
          ...payload,
          rol: editable.rol
        });
      } else if (adminMode && editable.rol) {
        // Si es admin pero no cambió el rol, incluir rol en el payload
        payload.rol = editable.rol;
        await updateDoc(doc(db, "users", uid), payload);
      } else {
        // Usuario normal actualizando su perfil (sin tocar el rol)
        await updateDoc(doc(db, "users", uid), payload);
      }
      
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setUserData(snap.data());
      setShowProfile(false);
    } catch (err) {
      console.error("[FichaUsuario] saveProfile error:", err);
      setError("No se pudieron guardar los datos del perfil.");
    }
  };

  // Función para recargar citas
  const loadAppointments = () => {
    if (!uid) return;
    
    setLoadingAppointments(true);
    
    getDoc(doc(db, "users", uid))
      .then(userSnap => {
        if (userSnap.exists()) {
          const data = userSnap.data();
          const appts = data.citas || [];
          setAppointments(appts);
          
          // Encontrar próxima cita
          const now = new Date();
          const futureAppts = appts
            .filter(apt => {
              try {
                return new Date(apt.fecha + 'T' + apt.hora) > now;
              } catch (e) {
                return false;
              }
            })
            .sort((a, b) => new Date(a.fecha + 'T' + a.hora) - new Date(b.fecha + 'T' + b.hora));
          
          setNextAppointment(futureAppts[0] || null);
          
          // Mostrar recordatorio solo si NO es admin y hay cita futura
          if (futureAppts.length > 0 && !adminMode) {
            const nextCita = futureAppts[0];
            if (nextCita && nextCita.fecha && nextCita.hora) {
              const citaKey = `${nextCita.fecha}_${nextCita.hora}`;
              
              // Obtener dismissed reminders del localStorage
              let currentDismissed = {};
              try {
                const saved = localStorage.getItem('dismissedCitaReminders');
                currentDismissed = saved ? JSON.parse(saved) : {};
              } catch {
                currentDismissed = {};
              }
              
              // Verificar si no está descartada
              if (!currentDismissed[citaKey]) {
                console.log('Mostrando recordatorio para cita:', nextCita);
                setCitaToRemind(nextCita);
                setShowCitaReminder(true);
              } else {
                console.log('Cita ya descartada:', citaKey);
              }
            }
          } else {
            logger.log('No hay citas futuras o es admin:', { futureAppts: futureAppts.length, adminMode });
          }
        } else {
          setAppointments([]);
          setNextAppointment(null);
        }
      })
      .catch(err => {
        console.error("Error loading appointments:", err);
        setAppointments([]);
        setNextAppointment(null);
      })
      .finally(() => {
        setLoadingAppointments(false);
      });
  };

  // Cargar citas cuando se accede al tab
  useEffect(() => {
    const currentTabId = tabs[tabIndex]?.id;
    
    if (currentTabId === "citas" && uid) {
      loadAppointments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabIndex, uid]);

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

  // Listener para notificaciones push desde Firestore
  useEffect(() => {
    if (!uid) return;

    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("userId", "==", uid),
      where("read", "==", false),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const notification = change.doc.data();
          
          // Mostrar notificación del navegador
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(notification.title, {
              body: notification.body,
              icon: DEFAULT_CLINIC_LOGO,
              badge: DEFAULT_CLINIC_LOGO,
              tag: change.doc.id,
            });
          }

          // Marcar como leída
          updateDoc(doc(db, "notifications", change.doc.id), {
            read: true,
            readAt: serverTimestamp()
          }).catch(err => console.error("Error marking notification as read:", err));
        }
      });
    }, (error) => {
      // Silenciar errores de permisos de la colección notifications
      console.log("Notifications listener disabled (permissions not configured)");
    });

    return () => unsubscribe();
  }, [uid, DEFAULT_CLINIC_LOGO]);

  // Comprobar citas cada minuto
  useEffect(() => {
    if (!notificationsEnabled) return;

    const interval = setInterval(() => {
      checkUpcomingAppointments();
    }, 60000); // Cada 60 segundos

    return () => clearInterval(interval);
  }, [notificationsEnabled, checkUpcomingAppointments]);

  // Cargar mensajes pendientes al abrir la app (solo si NO es admin)
  useEffect(() => {
    if (!uid || adminMode) return;

    const loadMensajes = async () => {
      try {
        // Cargar mensajes del usuario
        const mensajesRef = collection(db, 'users', uid, 'mensajes');
        const q = query(mensajesRef, where('leido', '==', false));
        const mensajesSnapshot = await getDocs(q);
        
        const mensajes = mensajesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        console.log('Mensajes encontrados:', mensajes.length, mensajes);

        // Actualizar contador de mensajes no leídos
        setMensajesNoLeidos(mensajes.length);

        if (mensajes.length > 0) {
          setMensajesPendientes(mensajes);
          setMensajeActual(mensajes[0]);
          setCurrentMensajeIndex(0);
          setShowMensajeModal(true);
        }
      } catch (err) {
        console.error('Error al cargar mensajes:', err);
        // Mostrar el error en consola para debugging
        alert('Error al cargar mensajes: ' + err.message);
      }
    };

    loadMensajes();
  }, [uid, adminMode]);

  // Función para marcar mensaje como leído y pasar al siguiente
  const handleCerrarMensaje = async () => {
    if (!mensajeActual) return;

    try {
      // Marcar mensaje actual como leído
      const mensajeRef = doc(db, 'users', uid, 'mensajes', mensajeActual.id);
      await updateDoc(mensajeRef, {
        leido: true,
        leidoEn: serverTimestamp()
      });

      // Decrementar contador de mensajes no leídos
      setMensajesNoLeidos(prev => Math.max(0, prev - 1));

      // Pasar al siguiente mensaje o cerrar modal
      const nextIndex = currentMensajeIndex + 1;
      if (nextIndex < mensajesPendientes.length) {
        setCurrentMensajeIndex(nextIndex);
        setMensajeActual(mensajesPendientes[nextIndex]);
      } else {
        setShowMensajeModal(false);
        setMensajeActual(null);
        setMensajesPendientes([]);
        setCurrentMensajeIndex(0);
      }
    } catch (err) {
      console.error('Error al marcar mensaje como leído:', err);
    }
  };

  // Función para enviar solicitud de cambio de tabla GYM
  const handleEnviarSolicitudTabla = async () => {
    if (!solicitudTablaTexto.trim()) {
      alert('Por favor, escribe el motivo de tu solicitud');
      return;
    }

    setEnviandoSolicitud(true);
    try {
      const nombreCompleto = userData?.nombre && userData?.apellidos 
        ? `${userData.apellidos}, ${userData.nombre}`
        : userData?.email || 'Usuario sin nombre';
      
      const mensajeContenido = `🏋️ SOLICITUD DE CAMBIO DE TABLA GYM\n\nUsuario: ${nombreCompleto}\n\nMotivo:\n${solicitudTablaTexto.trim()}`;

      // Enviar mensaje a la colección mensajes_admin
      await addDoc(collection(db, 'mensajes_admin'), {
        contenido: mensajeContenido,
        creadoEn: serverTimestamp(),
        leido: false,
        creadoPor: uid,
        tipo: 'solicitud_tabla_gym',
        usuarioNombre: nombreCompleto
      });

      // Enviar email a asesoramiento.ruiz@gmail.com
      await addDoc(collection(db, 'mail'), {
        to: emailNotificaciones,
        message: {
          subject: `🏋️ Solicitud de cambio de tabla GYM - ${nombreCompleto}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2196F3; border-bottom: 3px solid #2196F3; padding-bottom: 10px;">
                🏋️ Solicitud de Cambio de Tabla GYM
              </h2>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Usuario:</strong> ${nombreCompleto}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${userData?.email || 'No disponible'}</p>
              </div>
              
              <div style="margin: 20px 0;">
                <h3 style="color: #333;">Motivo de la solicitud:</h3>
                <div style="background-color: #fff; border-left: 4px solid #2196F3; padding: 15px; margin-top: 10px;">
                  <p style="white-space: pre-wrap; line-height: 1.6; color: #555;">${solicitudTablaTexto.trim()}</p>
                </div>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 12px;">
                <p>Este email fue generado automáticamente por el sistema de gestión nutricional.</p>
              </div>
            </div>
          `,
          text: `SOLICITUD DE CAMBIO DE TABLA GYM\n\nUsuario: ${nombreCompleto}\nEmail: ${userData?.email || 'No disponible'}\n\nMotivo:\n${solicitudTablaTexto.trim()}`
        }
      });

      // DESACTIVADO - Notificaciones push desactivadas, solo se usan notificaciones por email
      // try {
      //   console.log('📱 Intentando enviar push al admin...');
      //   const functions = getFunctions();
      //   const sendPushToAdmin = httpsCallable(functions, 'sendPushToAdmin');
      //   const result = await sendPushToAdmin({
      //     title: '🏋️ SOLICITUD DE CAMBIO DE TABLA GYM',
      //     body: `${nombreCompleto} ha solicitado un cambio en su tabla de ejercicios`
      //   });
      //   console.log('✅ Push al admin enviado:', result);
      // } catch (pushError) {
      //   console.error('❌ Error enviando push al admin:', pushError);
      //   console.error('Detalles del error:', pushError.message, pushError.code);
      //   // No interrumpir el flujo si falla el push
      // }

      alert('✓ Solicitud enviada correctamente al nutricionista');
      setShowSolicitudTabla(false);
      setSolicitudTablaTexto('');
    } catch (err) {
      console.error('Error al enviar solicitud:', err);
      alert('Error al enviar la solicitud. Por favor, inténtalo de nuevo.');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  // Función para enviar solicitud de cambio de dieta
  const handleEnviarSolicitudDieta = async () => {
    if (!solicitudDietaTexto.trim()) {
      alert('Por favor, escribe el motivo de tu solicitud');
      return;
    }

    setEnviandoSolicitud(true);
    try {
      const nombreCompleto = userData?.nombre && userData?.apellidos 
        ? `${userData.apellidos}, ${userData.nombre}`
        : userData?.email || 'Usuario sin nombre';
      
      const mensajeContenido = `🍽️ SOLICITUD DE CAMBIO DE DIETA\n\nUsuario: ${nombreCompleto}\n\nMotivo:\n${solicitudDietaTexto.trim()}`;

      // Enviar mensaje a la colección mensajes_admin
      await addDoc(collection(db, 'mensajes_admin'), {
        contenido: mensajeContenido,
        creadoEn: serverTimestamp(),
        leido: false,
        creadoPor: uid,
        tipo: 'solicitud_cambio_dieta',
        usuarioNombre: nombreCompleto
      });

      // Enviar email al nutricionista
      await addDoc(collection(db, 'mail'), {
        to: emailNotificaciones,
        message: {
          subject: `🍽️ Solicitud de cambio de dieta - ${nombreCompleto}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a; border-bottom: 3px solid #16a34a; padding-bottom: 10px;">
                🍽️ Solicitud de Cambio de Dieta
              </h2>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Usuario:</strong> ${nombreCompleto}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${userData?.email || 'No disponible'}</p>
              </div>
              
              <div style="margin: 20px 0;">
                <h3 style="color: #333;">Motivo de la solicitud:</h3>
                <div style="background-color: #fff; border-left: 4px solid #16a34a; padding: 15px; margin-top: 10px;">
                  <p style="white-space: pre-wrap; line-height: 1.6; color: #555;">${solicitudDietaTexto.trim()}</p>
                </div>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 12px;">
                <p>Este email fue generado automáticamente por el sistema de gestión nutricional.</p>
              </div>
            </div>
          `,
          text: `SOLICITUD DE CAMBIO DE DIETA\n\nUsuario: ${nombreCompleto}\nEmail: ${userData?.email || 'No disponible'}\n\nMotivo:\n${solicitudDietaTexto.trim()}`
        }
      });

      // DESACTIVADO - Notificaciones push desactivadas, solo se usan notificaciones por email
      // try {
      //   console.log('📱 Intentando enviar push al admin...');
      //   const functions = getFunctions();
      //   const sendPushToAdmin = httpsCallable(functions, 'sendPushToAdmin');
      //   const result = await sendPushToAdmin({
      //     title: '🍽️ SOLICITUD DE CAMBIO DE DIETA',
      //     body: `${nombreCompleto} ha solicitado un cambio en su dieta`
      //   });
      //   console.log('✅ Push al admin enviado:', result);
      // } catch (pushError) {
      //   console.error('❌ Error enviando push al admin:', pushError);
      //   console.error('Detalles del error:', pushError.message, pushError.code);
      //   // No interrumpir el flujo si falla el push
      // }

      alert('✓ Solicitud enviada correctamente al nutricionista');
      setShowSolicitudDieta(false);
      setSolicitudDietaTexto('');
    } catch (err) {
      console.error('Error al enviar solicitud:', err);
      alert('Error al enviar la solicitud. Por favor, inténtalo de nuevo.');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  // Función para enviar solicitud de nueva tabla GYM
  const handleEnviarSolicitudNuevaTabla = async () => {
    setEnviandoSolicitud(true);
    try {
      const nombreCompleto = userData?.nombre && userData?.apellidos 
        ? `${userData.apellidos}, ${userData.nombre}`
        : userData?.email || 'Usuario sin nombre';
      
      const mensajeContenido = `🏋️ SOLICITUD DE NUEVA TABLA GYM\n\nUsuario: ${nombreCompleto}\n\nEl usuario ha solicitado que se le asigne una nueva tabla de ejercicios.`;

      // Enviar mensaje a la colección mensajes_admin
      await addDoc(collection(db, 'mensajes_admin'), {
        contenido: mensajeContenido,
        creadoEn: serverTimestamp(),
        leido: false,
        creadoPor: uid,
        tipo: 'solicitud_nueva_tabla_gym',
        usuarioNombre: nombreCompleto
      });

      // Enviar email a asesoramiento.ruiz@gmail.com
      await addDoc(collection(db, 'mail'), {
        to: emailNotificaciones,
        message: {
          subject: `🏋️ Solicitud de NUEVA tabla GYM - ${nombreCompleto}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4CAF50; border-bottom: 3px solid #4CAF50; padding-bottom: 10px;">
                🏋️ Solicitud de Nueva Tabla GYM
              </h2>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Usuario:</strong> ${nombreCompleto}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${userData?.email || 'No disponible'}</p>
                ${userData?.telefono ? `<p style="margin: 5px 0;"><strong>Teléfono:</strong> ${userData.telefono}</p>` : ''}
              </div>
              
              <div style="background-color: #e8f5e9; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #2e7d32; font-size: 15px;">
                  <strong>ℹ️ El usuario ha solicitado que se le asigne una nueva tabla de ejercicios.</strong>
                </p>
              </div>
              
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  💰 <strong>Próximos pasos:</strong> Contacta con el usuario para informarle sobre la tarifa y condiciones del servicio GYM.
                </p>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 12px;">
                <p>Este email fue generado automáticamente por el sistema de gestión nutricional.</p>
              </div>
            </div>
          `,
          text: `SOLICITUD DE NUEVA TABLA GYM\n\nUsuario: ${nombreCompleto}\nEmail: ${userData?.email || 'No disponible'}${userData?.telefono ? `\nTeléfono: ${userData.telefono}` : ''}\n\nEl usuario ha solicitado que se le asigne una nueva tabla de ejercicios.\n\nPróximos pasos: Contacta con el usuario para informarle sobre la tarifa y condiciones del servicio GYM.`
        }
      });

      // DESACTIVADO - Notificaciones push desactivadas, solo se usan notificaciones por email
      // try {
      //   console.log('📱 Intentando enviar push al admin...');
      //   const functions = getFunctions();
      //   const sendPushToAdmin = httpsCallable(functions, 'sendPushToAdmin');
      //   const result = await sendPushToAdmin({
      //     title: 'SOLICITUD DE NUEVA TABLA GYM',
      //     body: `${nombreCompleto} ha solicitado una nueva tabla de ejercicios`
      //   });
      //   console.log('✅ Push al admin enviado:', result);
      // } catch (pushError) {
      //   console.error('❌ Error enviando push al admin:', pushError);
      //   console.error('Detalles del error:', pushError.message, pushError.code);
      //   // No interrumpir el flujo si falla el push
      // }

      alert('✓ Solicitud enviada correctamente.\n\nEl nutricionista recibirá tu solicitud y se pondrá en contacto contigo para informarte sobre la tarifa y los siguientes pasos.');
      setShowSolicitudNuevaTabla(false);
    } catch (err) {
      console.error('Error al enviar solicitud:', err);
      alert('Error al enviar la solicitud. Por favor, inténtalo de nuevo.');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  // Función para generar PDF de la tabla GYM
  const generarPDFTablaGym = async () => {
    try {
      await ensureHtml2Pdf();
      
      const nombreCompleto = userData?.nombre && userData?.apellidos 
        ? `${userData.apellidos}, ${userData.nombre}`
        : userData?.email || 'Usuario';
      
      const fechaActual = new Date().toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Construir HTML para el PDF
      let contenidoHTML = '';
      
      // Determinar si usar ejerciciosPorDia o tablaGym
      const tieneEjerciciosPorDia = userData?.ejerciciosPorDia && 
        Object.keys(userData.ejerciciosPorDia).some(dia => userData.ejerciciosPorDia[dia]?.length > 0);
      
      if (tieneEjerciciosPorDia) {
        // Nueva estructura: ejercicios organizados por días
        ["Día 1", "Día 2", "Día 3", "Día 4", "Día 5", "Día 6", "Día 7"].forEach((dia) => {
          const ejerciciosDelDia = userData.ejerciciosPorDia[dia] || [];
          if (ejerciciosDelDia.length === 0) return;
          
          contenidoHTML += `
            <div style="margin-bottom: 20px; page-break-inside: avoid;">
              <h3 style="background: #2196F3; color: white; padding: 8px; margin: 0 0 10px 0; font-size: 14px; border-radius: 4px;">
                📅 ${dia} (${ejerciciosDelDia.length} ejercicio${ejerciciosDelDia.length !== 1 ? 's' : ''})
              </h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px;">
                <thead>
                  <tr style="background: #e3f2fd;">
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 30px;">#</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Ejercicio</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: left; width: 120px;">Categoría</th>
                    <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Detalles</th>
                  </tr>
                </thead>
                <tbody>
          `;
          
          ejerciciosDelDia.forEach((ej, idx) => {
            const detalles = [];
            if (ej.series) detalles.push(`<strong>Series:</strong> ${ej.series}`);
            if (ej.repeticiones) detalles.push(`<strong>Reps:</strong> ${ej.repeticiones}`);
            if (ej.peso) detalles.push(`<strong>Peso:</strong> ${ej.peso}`);
            if (ej.tiempo) detalles.push(`<strong>Tiempo:</strong> ${ej.tiempo}`);
            if (ej.intervalo) detalles.push(`<strong>Intervalo:</strong> ${ej.intervalo}`);
            
            contenidoHTML += `
              <tr>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center; font-weight: bold;">${idx + 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${escapeHtmlForInject(ej.nombre || '')}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px;">${escapeHtmlForInject(ej.categoria || '')}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px;">${detalles.join(' • ') || '-'}</td>
              </tr>
            `;
          });
          
          contenidoHTML += `
                </tbody>
              </table>
            </div>
          `;
        });
      } else if (userData?.tablaGym && userData.tablaGym.length > 0) {
        // Estructura antigua: tabla simple sin días
        contenidoHTML += `
          <div style="margin-bottom: 15px;">
            <p style="font-weight: bold; font-size: 12px;">Total de ejercicios: ${userData.tablaGym.length}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #e3f2fd;">
                <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 30px;">#</th>
                <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Ejercicio</th>
                <th style="border: 1px solid #ddd; padding: 6px; text-align: left; width: 120px;">Categoría</th>
                <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Detalles</th>
              </tr>
            </thead>
            <tbody>
        `;
        
        userData.tablaGym.forEach((ej, idx) => {
          const detalles = [];
          if (ej.series) detalles.push(`<strong>Series:</strong> ${ej.series}`);
          if (ej.repeticiones) detalles.push(`<strong>Reps:</strong> ${ej.repeticiones}`);
          if (ej.peso) detalles.push(`<strong>Peso:</strong> ${ej.peso}`);
          if (ej.tiempo) detalles.push(`<strong>Tiempo:</strong> ${ej.tiempo}`);
          if (ej.intervalo) detalles.push(`<strong>Intervalo:</strong> ${ej.intervalo}`);
          
          contenidoHTML += `
            <tr>
              <td style="border: 1px solid #ddd; padding: 6px; text-align: center; font-weight: bold;">${idx + 1}</td>
              <td style="border: 1px solid #ddd; padding: 6px;">${escapeHtmlForInject(ej.nombre || '')}</td>
              <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px;">${escapeHtmlForInject(ej.categoria || '')}</td>
              <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px;">${detalles.join(' • ') || '-'}</td>
            </tr>
          `;
        });
        
        contenidoHTML += `
            </tbody>
          </table>
        `;
      }
      
      // CSS para el PDF
      const pdfCSS = `
        @page { size: A4 portrait; margin: 15mm; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; 
          color: #333; 
          background: #fff; 
          margin: 0; 
          font-size: 11px; 
        }
        #pdf-root { padding: 10px; }
        h1 { 
          font-size: 18px; 
          color: #1976d2; 
          margin: 0 0 5px 0; 
          text-align: center;
          border-bottom: 3px solid #2196F3;
          padding-bottom: 8px;
        }
        .pdf-meta { 
          font-size: 11px; 
          text-align: center; 
          margin-bottom: 20px; 
          color: #666;
        }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; page-break-after: auto; }
      `;
      
      // Logo
      const logoUrl = DEFAULT_CLINIC_LOGO;
      let logoData = null;
      try { 
        logoData = await imgUrlToDataUrl(logoUrl); 
      } catch (e) { 
        logoData = null; 
      }
      
      const logoHtml = logoData 
        ? `<img src="${logoData}" alt="Logo" style="width:50px;height:50px;object-fit:contain;border-radius:6px;display:block;margin:0 auto 10px;" />` 
        : '';
      
      // HTML completo
      const pdfInner = `
        <div id="pdf-root">
          ${logoHtml}
          <h1>🏋️ TABLA DE EJERCICIOS GYM</h1>
          <div class="pdf-meta">
            <div style="font-weight: bold; margin-bottom: 3px;">${escapeHtmlForInject(nombreCompleto)}</div>
            <div>Generado: ${fechaActual}</div>
          </div>
          ${contenidoHTML}
        </div>
      `;
      
      // Crear contenedor temporal
      const container = document.createElement("div");
      container.id = "pdf-temp-gym";
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "210mm";
      container.style.minHeight = "297mm";
      container.innerHTML = `<style>${pdfCSS}</style>${pdfInner}`;
      document.body.appendChild(container);
      
      const element = container.querySelector("#pdf-root");
      const filenameSafe = `tabla_gym_${nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      
      const opt = {
        margin: [10, 10, 10, 10],
        filename: filenameSafe,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };
      
      await window.html2pdf().set(opt).from(element).save();
      
      // Limpiar contenedor temporal
      setTimeout(() => {
        try { 
          document.body.removeChild(container); 
        } catch (e) {}
      }, 600);
      
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar el PDF. Por favor, inténtalo de nuevo.');
    }
  };

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

      // Enviar email al usuario notificando la nueva cita
      const citaDateTime = new Date(`${newAppointmentDate}T${newAppointmentTime}`);
      const userEmail = userData?.email;
      const userName = `${userData?.nombre || ''} ${userData?.apellidos || ''}`.trim() || 'Usuario';
      
      if (userEmail) {
        await setDoc(doc(collection(db, "mail")), {
          to: userEmail,
          message: {
            subject: "Nueva cita programada - Ruiz Nutrición",
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                  }
                  .header {
                    background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
                    color: white;
                    padding: 30px 20px;
                    border-radius: 10px 10px 0 0;
                    text-align: center;
                  }
                  .content {
                    background: #ffffff;
                    padding: 30px;
                    border: 1px solid #e2e8f0;
                    border-top: none;
                  }
                  .cita-box {
                    background: #f0fdf4;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #16a34a;
                  }
                  .footer {
                    text-align: center;
                    color: #64748b;
                    font-size: 14px;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e2e8f0;
                  }
                </style>
              </head>
              <body>
                <div class="header">
                  <h1 style="margin: 0; font-size: 28px;">📅 Nueva Cita Programada</h1>
                </div>
                
                <div class="content">
                  <p>Hola <strong>${userName}</strong>,</p>
                  
                  <p>Se ha programado una nueva cita para ti:</p>

                  <div class="cita-box">
                    <h3 style="margin-top: 0; color: #15803d;">📋 Detalles de la cita</h3>
                    <p style="margin: 10px 0;"><strong>📅 Fecha:</strong> ${citaDateTime.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p style="margin: 10px 0;"><strong>🕐 Hora:</strong> ${citaDateTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                    ${newAppointmentNotes ? `<p style="margin: 10px 0;"><strong>📝 Notas:</strong> ${newAppointmentNotes}</p>` : ''}
                  </div>

                  <p style="margin-top: 30px;">Recibirás recordatorios automáticos:</p>
                  <ul>
                    <li>📧 Un email 1 día antes de la cita</li>
                    <li>🔔 Una notificación 1 hora antes (si has activado las notificaciones en la app)</li>
                  </ul>

                  <p style="margin-top: 20px;">Si necesitas cancelar o reprogramar, por favor avísanos con antelación.</p>
                  
                  <p style="margin-top: 20px;">
                    ¡Nos vemos pronto! 💪
                  </p>
                </div>

                <div class="footer">
                  <p><strong>Ruiz Nutrición</strong></p>
                  <p>Este correo fue enviado automáticamente.</p>
                </div>
              </body>
              </html>
            `,
            text: `
Hola ${userName},

Se ha programado una nueva cita para ti:

📅 Fecha: ${citaDateTime.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
🕐 Hora: ${citaDateTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
${newAppointmentNotes ? `📝 Notas: ${newAppointmentNotes}` : ''}

Recibirás recordatorios automáticos:
- 📧 Un email 1 día antes de la cita
- 🔔 Una notificación 1 hora antes (si has activado las notificaciones en la app)

Si necesitas cancelar o reprogramar, por favor avísanos con antelación.

¡Nos vemos pronto!
Ruiz Nutrición
            `.trim(),
          },
          createdAt: new Date(),
        });
      }

      setNewAppointmentDate("");
      setNewAppointmentTime("");
      setNewAppointmentNotes("");
      loadAppointments();
    } catch (err) {
      console.error("Error adding appointment:", err);
      setError("No se pudo agregar la cita.");
    }
  };

  // Funciones para manejar el recordatorio de citas
  const handleDismissCitaReminder = () => {
    // Solo cerrar el modal, NO guardar en localStorage
    // Para que vuelva a aparecer la próxima vez
    setShowCitaReminder(false);
    setCitaToRemind(null);
  };

  const handleDismissAllCitaReminders = () => {
    // Guardar en localStorage para NO volver a mostrar esta cita
    if (citaToRemind) {
      const citaKey = `${citaToRemind.fecha}_${citaToRemind.hora}`;
      const newDismissed = { ...dismissedReminders, [citaKey]: true };
      setDismissedReminders(newDismissed);
      localStorage.setItem('dismissedCitaReminders', JSON.stringify(newDismissed));
    }
    setShowCitaReminder(false);
    setCitaToRemind(null);
  };

  const handleAddToCalendar = () => {
    if (!citaToRemind) return;

    const { fecha, hora } = citaToRemind;
    const [year, month, day] = fecha.split('-');
    const [hours, minutes] = hora.split(':');
    
    // Crear fecha de inicio (fecha y hora de la cita)
    const startDate = new Date(year, month - 1, day, hours, minutes);
    
    // Crear fecha de fin (1 hora después)
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
    
    // Formatear fechas para ICS (formato: YYYYMMDDTHHmmss)
    const formatDateToICS = (date) => {
      const pad = (n) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
    };
    
    const start = formatDateToICS(startDate);
    const end = formatDateToICS(endDate);
    
    // Crear contenido del archivo ICS
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ruiz Nutrición//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `DTSTART:${start}`,
      `DTEND:${end}`,
      'SUMMARY:Cita con Pablo - Ruiz Nutrición',
      'DESCRIPTION:Cita de consulta nutricional',
      'LOCATION:Ruiz Nutrición',
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'DESCRIPTION:Recordatorio de cita',
      'ACTION:DISPLAY',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    
    // Crear blob y descargar
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `cita-nutricion-${fecha}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cerrar el recordatorio después de descargar
    handleDismissCitaReminder();
  };

  // Función para activar/desactivar usuario
  const handleToggleActivoUsuario = async () => {
    if (!adminMode || !uid) return;
    
    const isActivo = userData.activo !== false; // Por defecto true si no existe
    const accion = isActivo ? "desactivar" : "activar";
    
    const confirmar = window.confirm(
      `¿Estás seguro de que deseas ${accion} a este usuario?\n\n` +
      `Usuario: ${userData.nombre || ''} ${userData.apellidos || ''}\n` +
      (isActivo 
        ? "Al desactivarlo, aparecerá en la tabla de usuarios NO ACTIVOS." 
        : "Al activarlo, volverá a la lista de usuarios activos.")
    );
    
    if (!confirmar) return;
    
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        activo: !isActivo,
        fechaEstadoActivo: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Actualizar estado local
      setUserData(prev => ({
        ...prev,
        activo: !isActivo,
        fechaEstadoActivo: new Date().toISOString()
      }));
      
      alert(`✅ Usuario ${accion}do correctamente`);
      
      // Notificar al componente padre para recargar usuarios
      if (onUsuarioUpdated) {
        onUsuarioUpdated();
      }
    } catch (err) {
      console.error(`Error al ${accion} usuario:`, err);
      alert(`❌ Error al ${accion} usuario: ${err.message}`);
    }
  };

  // Función para cargar snacks desde Firestore
  const loadSnacks = async () => {
    setLoadingSnacks(true);
    try {
      const snacksRef = collection(db, "menuItems", "snacks", "items");
      const snapshot = await getDocs(snacksRef);
      const snacksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSnacksList(snacksData.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
    } catch (err) {
      console.error("Error cargando snacks:", err);
    } finally {
      setLoadingSnacks(false);
    }
  };

  // Función para cargar recetas desde Firestore
  const loadRecetas = async () => {
    setLoadingRecetas(true);
    try {
      const recetasRef = collection(db, "recetas");
      const snapshot = await getDocs(recetasRef);
      const recetasData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecetasList(recetasData.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
    } catch (err) {
      console.error("Error cargando recetas:", err);
    } finally {
      setLoadingRecetas(false);
    }
  };

  // Función para obtener color según categoría de receta
  const getCategoryColor = (categoria) => {
    const colors = {
      'desayuno': '#f59e0b',
      'almuerzo': '#3b82f6',
      'comida': '#10b981',
      'cena': '#8b5cf6',
      'infusion': '#ec4899'
    };
    return colors[categoria?.toLowerCase()] || '#6b7280';
  };
  
  // Función para cargar opciones de menú disponibles desde BD
  const loadMenuItems = async () => {
    setLoadingMenuItems(true);
    try {
      const categorias = ["desayuno", "almuerzo", "comida", "merienda", "cena", "consejos"];
      const itemsPorCategoria = {};
      
      for (const categoria of categorias) {
        const itemsRef = collection(db, "menuItems", categoria, "items");
        const snapshot = await getDocs(itemsRef);
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        itemsPorCategoria[categoria] = items.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      }
      
      setMenuItemsDisponibles(itemsPorCategoria);
    } catch (err) {
      console.error("Error cargando items de menú:", err);
    } finally {
      setLoadingMenuItems(false);
    }
  };

  const loadTarifas = async () => {
    setLoadingTarifas(true);
    try {
      const tarifasRef = doc(db, "settings", "tarifas");
      const tarifasSnap = await getDoc(tarifasRef);
      if (tarifasSnap.exists()) {
        const data = tarifasSnap.data();
        setTarifasUrl(data.imageUrl || "");
      } else {
        setTarifasUrl("");
      }
    } catch (err) {
      console.error("Error cargando tarifas:", err);
      setTarifasUrl("");
    } finally {
      setLoadingTarifas(false);
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
    // Usar el peso de editable, no el estado separado
    const pesoValue = parseNum(ed.peso);
    const vError = validateMeasures(pesoValue, ed);
    if (vError) { setError(vError); return; }

    setSavingPeso(true); setError(null);
    let masaGrasaKg = parseNum(ed.masaGrasaKg);
    const masaMagraKg = parseNum(ed.masaMagraKg);
    const masaGrasaPct = parseNum(ed.masaGrasaPct);

    if (pesoValue !== null && masaGrasaPct !== null && masaGrasaKg === null) {
      const mgKgCalc = +(pesoValue * (masaGrasaPct / 100));
      masaGrasaKg = Math.round(mgKgCalc * 100) / 100;
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
      pliegueCintura: parseNum(ed.pliegueCintura),
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

      // Preparar actualización con arrays completos y altura
      const updatePayload = {
        medidasHistorico: updatedMedidas,
        pesoHistorico: updatedPeso,
        pesoActual: measuresPayload.pesoActual,
        updatedAt: serverTimestamp(),
      };
      
      // Solo actualizar altura si hay un valor válido
      if (altura && parseFloat(altura) > 0) {
        updatePayload.altura = parseFloat(altura);
      }
      
      await updateDoc(userDocRef, updatePayload);
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
        peso: "", // Añadir limpieza del campo peso
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
        pliegueCintura: "",
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

      logger.debug("Intentando borrar índice:", index);
      logger.debug("Total registros en rowsDesc:", rowsDesc.length);
      logger.debug("Registro a borrar:", rowsDesc[index]);

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
          
          logger.debug("Comparando medida:", { sameDate, samePeso, sameTimestamp, m, recordToDelete });
          
          return (sameDate && samePeso) || sameTimestamp;
        });
        
        logger.debug("Índice encontrado en medidasHistorico:", medidasIndex);
        
        if (medidasIndex !== -1) {
          medidasArray.splice(medidasIndex, 1);
          logger.debug("Eliminado de medidasHistorico");
        }

        // Buscar y eliminar en pesoHistorico
        const pesoIndex = pesoArray.findIndex((p) => {
          const sameDate = p.fecha === recordToDelete.fecha;
          const samePeso = p.peso === recordToDelete.peso || p.peso === recordToDelete.pesoActual;
          const pTimestamp = timestampToMs(p.createdAt);
          const sameTimestamp = pTimestamp === recordToDelete._t;
          
          logger.debug("Comparando peso:", { sameDate, samePeso, sameTimestamp, p, recordToDelete });
          
          return (sameDate && samePeso) || sameTimestamp;
        });
        
        logger.debug("Índice encontrado en pesoHistorico:", pesoIndex);
        
        if (pesoIndex !== -1) {
          pesoArray.splice(pesoIndex, 1);
          logger.debug("Eliminado de pesoHistorico");
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
      pliegueCintura: record.pliegueCintura ?? "",
      notas: record.notas ?? "",
      _t: record._t,
      createdAt: record.createdAt,
    });
  };

  // Función para guardar la edición
  const saveEditedRecord = async () => {
    if (!editingRecord || editingIndex === null) return;

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
      
      // Convertir campos numéricos
      const parseNum = (val) => {
        const n = parseFloat(val);
        return isNaN(n) ? null : n;
      };

      // Preparar el registro actualizado con todos los campos convertidos correctamente
      const updatedRecord = {
        fecha: editingRecord.fecha,
        pesoActual: parseNum(editingRecord.peso),
        masaGrasaPct: parseNum(editingRecord.masaGrasaPct),
        masaGrasaKg: parseNum(editingRecord.masaGrasaKg),
        masaMagraKg: parseNum(editingRecord.masaMagraKg),
        masaMuscularKg: parseNum(editingRecord.masaMuscularKg),
        aguaTotalKg: parseNum(editingRecord.aguaTotalKg),
        aguaTotalPct: parseNum(editingRecord.aguaTotalPct),
        masaOseaKg: parseNum(editingRecord.masaOseaKg),
        mbKcal: parseNum(editingRecord.mbKcal),
        grasaVisceralNivel: parseNum(editingRecord.grasaVisceralNivel),
        imc: parseNum(editingRecord.imc),
        edadMetabolica: parseNum(editingRecord.edadMetabolica),
        indiceCinturaTalla: editingRecord.indiceCinturaTalla || "",
        circunferenciaBrazoCm: parseNum(editingRecord.circunferenciaBrazoCm),
        circunferenciaCinturaCm: parseNum(editingRecord.circunferenciaCinturaCm),
        circunferenciaCaderaCm: parseNum(editingRecord.circunferenciaCaderaCm),
        circunferenciaPiernaCm: parseNum(editingRecord.circunferenciaPiernaCm),
        pliegueCintura: parseNum(editingRecord.pliegueCintura),
        notas: editingRecord.notas || "",
        createdAt: recordToUpdate.createdAt || new Date(),
      };

      // Buscar y actualizar en medidasHistorico usando createdAt como identificador único
      let foundMedidas = false;
      for (let i = 0; i < medidasArray.length; i++) {
        const m = medidasArray[i];
        const mCreatedTime = timestampToMs(m.createdAt);
        const recordCreatedTime = timestampToMs(recordToUpdate.createdAt);
        
        if (Math.abs(mCreatedTime - recordCreatedTime) < 1000) { // Dentro de 1 segundo
          medidasArray[i] = updatedRecord;
          foundMedidas = true;
          break;
        }
      }

      // Buscar y actualizar en pesoHistorico
      let foundPeso = false;
      for (let i = 0; i < pesoArray.length; i++) {
        const p = pesoArray[i];
        const pCreatedTime = timestampToMs(p.createdAt);
        const recordCreatedTime = timestampToMs(recordToUpdate.createdAt);
        
        if (Math.abs(pCreatedTime - recordCreatedTime) < 1000) { // Dentro de 1 segundo
          pesoArray[i] = {
            fecha: editingRecord.fecha,
            peso: parseNum(editingRecord.peso),
            createdAt: recordToUpdate.createdAt,
          };
          foundPeso = true;
          break;
        }
      }

      // Si no se encontró en medidasHistorico pero sí hay datos, agregar
      if (!foundMedidas && medidasArray.length > 0) {
        medidasArray.push(updatedRecord);
      }

      // Si no se encontró en pesoHistorico pero sí hay datos, agregar
      if (!foundPeso && pesoArray.length > 0) {
        pesoArray.push({
          fecha: editingRecord.fecha,
          peso: parseNum(editingRecord.peso),
          createdAt: recordToUpdate.createdAt || new Date(),
        });
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
      alert("Error al actualizar: " + (err?.message || "Error desconocido"));
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

  // ================== FUNCIONES PARA GALERÍA DE FOTOS ==================
  
  // Cargar fotos desde Firebase Storage
  const loadFotos = async () => {
    if (!uid) return;
    setLoadingFotos(true);
    try {
      const fotosRef = storageRef(storage, `dietaFotos/${uid}`);
      const listResult = await listAll(fotosRef);
      
      // Cargar metadata de Firestore si existe
      const fotosDocRef = doc(db, "users", uid, "dietaFotos", "metadata");
      const fotosDoc = await getDoc(fotosDocRef);
      const fotosMetadata = fotosDoc.exists() ? fotosDoc.data().fotos || {} : {};
      
      const fotosPromises = listResult.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        const metadata = await getMetadata(itemRef);
        const fileName = itemRef.name;
        
        return {
          name: fileName,
          url: url,
          fullPath: itemRef.fullPath,
          createdAt: metadata.timeCreated,
          size: metadata.size,
          caption: fotosMetadata[fileName]?.caption || ''
        };
      });
      
      const fotos = await Promise.all(fotosPromises);
      // Ordenar por fecha de creación (más recientes primero)
      fotos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setFotosGaleria(fotos);
    } catch (err) {
      console.error("Error cargando fotos:", err);
      setError("Error al cargar las fotos");
    } finally {
      setLoadingFotos(false);
    }
  };

  // Subir foto a Firebase Storage
  const uploadFoto = async (file, caption = '') => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError("Solo se permiten archivos de imagen");
      return;
    }
    
    // Limitar tamaño a 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no debe superar los 5MB");
      return;
    }
    
    setUploadingFoto(true);
    setError(null);
    
    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const fotoRef = storageRef(storage, `dietaFotos/${uid}/${fileName}`);
      
      await uploadBytes(fotoRef, file);
      
      // Guardar caption en Firestore si se proporcionó
      if (caption || caption === '') {
        const fotosDocRef = doc(db, "users", uid, "dietaFotos", "metadata");
        const fotosDoc = await getDoc(fotosDocRef);
        const currentData = fotosDoc.exists() ? fotosDoc.data().fotos || {} : {};
        
        await setDoc(fotosDocRef, {
          fotos: {
            ...currentData,
            [fileName]: {
              caption: caption,
              createdAt: new Date().toISOString()
            }
          }
        });
      }
      
      await loadFotos(); // Recargar la lista
    } catch (err) {
      console.error("Error subiendo foto:", err);
      setError("Error al subir la foto");
    } finally {
      setUploadingFoto(false);
    }
  };

  // Actualizar caption de una foto
  const updateCaption = async (foto, newCaption) => {
    try {
      const fotosDocRef = doc(db, "users", uid, "dietaFotos", "metadata");
      const fotosDoc = await getDoc(fotosDocRef);
      const currentData = fotosDoc.exists() ? fotosDoc.data().fotos || {} : {};
      
      await setDoc(fotosDocRef, {
        fotos: {
          ...currentData,
          [foto.name]: {
            caption: newCaption,
            createdAt: currentData[foto.name]?.createdAt || new Date().toISOString()
          }
        }
      });
      
      await loadFotos();
    } catch (err) {
      console.error("Error actualizando pie de foto:", err);
      setError("Error al actualizar el pie de foto");
    }
  };

  // Eliminar foto
  const deleteFoto = async (foto) => {
    if (!window.confirm("¿Estás seguro de eliminar esta foto?")) return;
    
    try {
      // Eliminar archivo de Storage
      const fotoRef = storageRef(storage, foto.fullPath);
      await deleteObject(fotoRef);
      
      // Eliminar metadata de Firestore
      const fotosDocRef = doc(db, "users", uid, "dietaFotos", "metadata");
      const fotosDoc = await getDoc(fotosDocRef);
      if (fotosDoc.exists()) {
        const currentData = fotosDoc.data().fotos || {};
        delete currentData[foto.name];
        await setDoc(fotosDocRef, { fotos: currentData });
      }
      
      await loadFotos(); // Recargar la lista
    } catch (err) {
      console.error("Error eliminando foto:", err);
      setError("Error al eliminar la foto");
    }
  };

  // Manejar selección de archivos
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const caption = prompt('Introduce un pie de foto (opcional):');
      if (caption !== null) { // Si no canceló el prompt
        await uploadFoto(file, caption);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Manejar drag & drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOverFotos = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDropFotos = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      const caption = prompt('Introduce un pie de foto (opcional):');
      if (caption !== null) { // Si no canceló el prompt
        await uploadFoto(file, caption);
      }
    }
  };

  // Manejar paste desde clipboard
  const handlePaste = async (e) => {
    if (!showFotosModal || !adminMode) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const caption = prompt('Introduce un pie de foto (opcional):');
          if (caption !== null) { // Si no canceló el prompt
            await uploadFoto(blob, caption);
          }
        }
      }
    }
  };

  // Abrir modal de fotos
  const openFotosModal = () => {
    setShowFotosModal(true);
    loadFotos();
  };

  // Cerrar modal de fotos
  const closeFotosModal = () => {
    setShowFotosModal(false);
    setSelectedFoto(null);
    setEditingCaption(null);
  };

  // Efecto para escuchar paste cuando el modal está abierto
  useEffect(() => {
    const handlePasteEvent = (e) => handlePaste(e);
    
    if (showFotosModal && adminMode) {
      document.addEventListener('paste', handlePasteEvent);
      return () => {
        document.removeEventListener('paste', handlePasteEvent);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFotosModal, adminMode]);

  // ================== FIN FUNCIONES GALERÍA DE FOTOS ==================

  // chart helpers
  const timestampToMs = (t) => {
    if (!t) return null;
    if (typeof t === "number") return t;
    if (typeof t === "string") {
      const parsed = Date.parse(t);
      return isNaN(parsed) ? null : parsed;
    }
    if (t?.seconds != null) return t.seconds * 1000 + (t.nanoseconds ? Math.floor(t.nanoseconds / 1e6) : 0);
    if (typeof t?.toDate === "function") return t.toDate().getTime();
    return null;
  };

  const formatDate = (tMs) => {
    if (!tMs) return "";
    const d = new Date(Number(tMs));
    return d.toLocaleString();
  };

  // Memoizar el procesamiento del historial de pesajes (cálculo pesado)
  const rowsDesc = useMemo(() => {
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
  }, [userData?.medidasHistorico, userData?.pesoHistorico]);

  // Memoizar datos para el gráfico
  const mappedForChart = useMemo(() => 
    rowsDesc.map((p) => ({ ...p })).sort((a, b) => (a._t || 0) - (b._t || 0))
  , [rowsDesc]);

  const labels = useMemo(() => 
    mappedForChart.map((s) => s.fecha || (s._t ? new Date(s._t).toLocaleDateString() : ""))
  , [mappedForChart]);
  
  // Memoizar cálculo de masa grasa en kg
  const masaGrasaKgCalc = useMemo(() => {
    const p = parseFloat(editable.peso);
    const mgPct = parseFloat(editable.masaGrasaPct);
    if (!isNaN(p) && !isNaN(mgPct) && p > 0 && mgPct >= 0) {
      return (Math.round((p * mgPct / 100) * 100) / 100).toString();
    }
    return editable.masaGrasaKg || "";
  }, [editable.peso, editable.masaGrasaPct, editable.masaGrasaKg]);

  // Masa magra ahora es un campo editable manualmente
  const masaMagraKgCalc = editable.masaMagraKg || "";

  // Memoizar cálculo de agua total en kg
  const aguaTotalKgCalc = useMemo(() => {
    const p = parseFloat(editable.peso);
    const atPct = parseFloat(editable.aguaTotalPct);
    if (!isNaN(p) && !isNaN(atPct) && p > 0 && atPct >= 0) {
      return (Math.round((p * atPct / 100) * 100) / 100).toString();
    }
    return editable.aguaTotalKg || "";
  }, [editable.peso, editable.aguaTotalPct, editable.aguaTotalKg]);

  const masaMuscularKgCalc = (() => {
    const mmKg = parseFloat(editable.masaMuscularKg);
    // Si ya hay un valor manual, usarlo
    if (!isNaN(mmKg) && mmKg > 0) {
      return mmKg.toString();
    }
    return "";
  })();

  // Función para renderizar cada campo de pesaje dinámicamente
  const renderPesajeField = (fieldKey) => {
    const baseStyle = {
      padding: isMobile ? "6px 8px" : "9px 12px",
      borderRadius: "6px",
      border: "1px solid #e2e8f0",
      fontSize: isMobile ? "14px" : "15px",
      fontWeight: "500",
      width: isMobile ? "70px" : "auto"
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
              value={editable.masaMuscularKg ?? ""}
              onChange={(e) => setEditable((s) => ({ ...s, masaMuscularKg: e.target.value }))}
              style={baseStyle}
            />
          </div>
        );
      
      case "masaMagraKg":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Masa magra (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              className="input"
              value={editable.masaMagraKg ?? ""}
              onChange={(e) => setEditable((s) => ({ ...s, masaMagraKg: e.target.value }))}
              style={baseStyle}
            />
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
      
      case "pliegueCintura":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Pliegue Cintura (mm)</label>
            <input type="number" inputMode="decimal" step="0.1" className="input" value={editable.pliegueCintura ?? ""} onChange={(e) => setEditable((s) => ({ ...s, pliegueCintura: e.target.value }))} style={{ padding: "9px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "15px", fontWeight: "500" }} />
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

  const menuHistoryRaw = [];
  const menuHistoryMapped = [];

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
      const headers = ["Fecha","Peso","Masa grasa %","Masa grasa (kg)","Masa magra (kg)","Masa muscular (kg)","Agua (kg)","% Agua","Masa ósea (kg)","MB (kcal)","Grasa visceral","IMC","Edad metabólica","C. Brazo (cm)","C. Cintura (cm)","C. Cadera (cm)","C. Pierna (cm)","Índice C/T","Pliegue Cintura (mm)","Notas"];
      const rows = rowsDesc.map((r) => {
        return [ r.fecha || (r._t ? new Date(r._t).toLocaleString() : ""), r.peso ?? r.pesoActual ?? "", r.masaGrasaPct ?? "", r.masaGrasaKg ?? "", r.masaMagraKg ?? "", r.masaMuscularKg ?? "", r.aguaTotalKg ?? "", r.aguaTotalPct ?? "", r.masaOseaKg ?? "", r.mbKcal ?? "", r.grasaVisceralNivel ?? "", r.imc ?? "", r.edadMetabolica ?? "", r.circunferenciaBrazoCm ?? "", r.circunferenciaCinturaCm ?? "", r.circunferenciaCaderaCm ?? "", r.circunferenciaPiernaCm ?? "", r.indiceCinturaTalla ?? "", r.pliegueCintura ?? "", (r.notas || "").replace(/\n/g, " ") ];
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
    // Usar userData directamente para asegurar que tenemos los datos correctos
    const esMenuVertical = userData?.tipoMenu === "vertical";
    const esModoManual = userData?.modoManual === true;
    
    if (esModoManual) {
      // Modo manual: mostrar contenido HTML generado directamente
      const esc = (s) => escapeHtmlForInject(s || "");
      return `<div class="print-section dieta-week">
        <h2 style="margin:0 0 5px 0;color:#064e3b;font-size:13px;font-weight:700">Dieta semanal</h2>
        <div style="padding:8px;border:1px solid #e5e7eb;border-radius:4px;font-size:9px;line-height:1.3">
          ${userData?.contenidoManual || '<p style="color:#6b7280;font-style:italic;">No hay contenido de dieta</p>'}
        </div>
      </div><div style="page-break-after:always;"></div>`;
    }
    
    if (esMenuVertical) {
      // Construir HTML desde menuVertical (formato con items seleccionables)
      const dayNames = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
      const esc = (s) => escapeHtmlForInject(s || "");
      
      let html = `<div class="print-section dieta-week">
        <h2 style="margin:0 0 5px 0;color:#064e3b;font-size:13px;font-weight:700">Dieta semanal</h2>
        <table class="print-calendar" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed;">
          <thead>
            <tr>
              <th style="text-align:left;padding:4px 3px;background:#f7fff9;border:1px solid #d1d5db;font-size:9px;font-weight:700">Comida</th>`;
      for (let d = 0; d < 7; d++) html += `<th style="text-align:center;padding:4px 3px;background:#f7fff9;border:1px solid #d1d5db;font-size:9px;font-weight:700">${dayNames[d]}</th>`;
      html += `</tr></thead><tbody>`;
      
      const secciones = ["desayuno", "almuerzo", "comida", "merienda", "cena", "consejos"];
      const labels = {
        desayuno: "Desayuno",
        almuerzo: "Almuerzo",
        comida: "Comida",
        merienda: "Merienda",
        cena: "Cena",
        consejos: "Consejos"
      };
      
      const menuVerticalData = userData?.menuVertical || {};
      
      for (const seccion of secciones) {
        html += `<tr>
          <td style="vertical-align:top;padding:4px 3px;border:1px solid #e5e7eb;font-weight:700;width:12%;background:#f9fafb;font-size:9px">${labels[seccion]}</td>`;
        
        // Para menú vertical, el contenido es el mismo todos los días
        const itemIds = menuVerticalData[seccion] || [];
        const itemsDisponibles = menuItemsDisponibles[seccion] || [];
        
        let contenido = "";
        if (seccion === "consejos") {
          // Consejos puede ser texto libre
          contenido = typeof itemIds === 'string' ? itemIds : (Array.isArray(itemIds) && itemIds.length > 0 ? itemIds[0] : '');
        } else {
          // Otras secciones: convertir IDs a nombres
          if (Array.isArray(itemIds) && itemIds.length > 0) {
            const itemsSeleccionados = itemIds
              .map(id => itemsDisponibles.find(item => item.id === id))
              .filter(item => item);
            contenido = itemsSeleccionados.map(item => item.nombre).join(', ');
          }
        }
        
        // Repetir el mismo contenido para todos los días
        for (let d = 0; d < 7; d++) {
          html += `<td style="vertical-align:top;padding:4px 3px;border:1px solid #e5e7eb;word-break:break-word;font-size:8.5px;line-height:1.3">${esc(contenido)}</td>`;
        }
        html += `</tr>`;
      }
      
      html += `</tbody></table></div><div style="page-break-after:always;"></div>`;
      return html;
    } else {
      // Formato tabla original (diferente por día)
      const menuFromData = userData?.menu || editable.menu;
      const menuTemplate = Array.isArray(menuFromData) ? menuFromData : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      const dayNames = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
      const esc = (s) => escapeHtmlForInject(s || "");

      let html = `<div class="print-section dieta-week">
        <h2 style="margin:0 0 5px 0;color:#064e3b;font-size:13px;font-weight:700">Dieta semanal</h2>
        <table class="print-calendar" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed;">
          <thead>
            <tr>
              <th style="text-align:left;padding:4px 3px;background:#f7fff9;border:1px solid #d1d5db;font-size:9px;font-weight:700">Comida / Día</th>`;
      for (let d = 0; d < 7; d++) html += `<th style="text-align:center;padding:4px 3px;background:#f7fff9;border:1px solid #d1d5db;font-size:9px;font-weight:700">${dayNames[d]}</th>`;
      html += `</tr></thead><tbody>`;

      for (let r = 0; r < ALL_SECTIONS.length; r++) {
        const sec = ALL_SECTIONS[r];
        html += `<tr>
          <td style="vertical-align:top;padding:4px 3px;border:1px solid #e5e7eb;font-weight:700;width:12%;background:#f9fafb;font-size:9px">${escapeHtmlForInject(sec.label)}</td>`;
        for (let d = 0; d < 7; d++) {
          const m = (menuTemplate[d] && menuTemplate[d][sec.key]) ? menuTemplate[d][sec.key] : "";
          html += `<td style="vertical-align:top;padding:4px 3px;border:1px solid #e5e7eb;word-break:break-word;font-size:8.5px;line-height:1.3">${esc(m)}</td>`;
        }
        html += `</tr>`;
      }

      html += `</tbody></table></div><div style="page-break-after:always;"></div>`;
      return html;
    }
  };

  const buildTablaGymHTML = () => {
    // Usar userData directamente para asegurar que tenemos los datos correctos
    const ejerciciosPorDia = userData?.ejerciciosPorDia || editable.ejerciciosPorDia;
    const tablaGym = userData?.tablaGym || editable.tablaGym;
    
    if (!ejerciciosPorDia && (!tablaGym || tablaGym.length === 0)) {
      return "<div class='print-section'><p style='color:#6b7280;font-style:italic;'>No hay tabla de ejercicios asignada</p></div>";
    }

    const esc = (s) => escapeHtmlForInject(s || "");
    let html = `<div class="print-section tabla-gym">
      <h2 style="margin:0 0 10px 0;color:#064e3b;font-size:14px;font-weight:700">💪 Tabla de Ejercicios GYM</h2>`;

    if (ejerciciosPorDia) {
      const diasSemana = ["Día 1", "Día 2", "Día 3", "Día 4", "Día 5", "Día 6", "Día 7"];
      for (const dia of diasSemana) {
        const ejercicios = ejerciciosPorDia[dia] || [];
        if (ejercicios.length === 0) continue;
        
        html += `<div style="margin-bottom:16px;page-break-inside:avoid">
          <h3 style="margin:0 0 8px 0;color:#059669;font-size:13px;font-weight:700;border-bottom:2px solid #10b981;padding-bottom:4px">${dia}</h3>
          <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px">
            <thead>
              <tr style="background:#f0fdf4">
                <th style="text-align:left;padding:6px 4px;border:1px solid #d1d5db;font-weight:700">Ejercicio</th>
                <th style="text-align:center;padding:6px 4px;border:1px solid #d1d5db;font-weight:700;width:15%">Series</th>
                <th style="text-align:center;padding:6px 4px;border:1px solid #d1d5db;font-weight:700;width:15%">Repeticiones</th>
                <th style="text-align:center;padding:6px 4px;border:1px solid #d1d5db;font-weight:700;width:15%">Descanso</th>
              </tr>
            </thead>
            <tbody>`;
        
        for (const ej of ejercicios) {
          html += `<tr>
              <td style="padding:6px 4px;border:1px solid #e5e7eb;vertical-align:top">${esc(ej.nombre)}</td>
              <td style="padding:6px 4px;border:1px solid #e5e7eb;text-align:center;vertical-align:top">${esc(ej.series)}</td>
              <td style="padding:6px 4px;border:1px solid #e5e7eb;text-align:center;vertical-align:top">${esc(ej.repeticiones)}</td>
              <td style="padding:6px 4px;border:1px solid #e5e7eb;text-align:center;vertical-align:top">${esc(ej.descanso)}</td>
            </tr>`;
        }
        
        html += `</tbody></table></div>`;
      }
    } else if (tablaGym && tablaGym.length > 0) {
      html += `<table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:8px">
        <thead>
          <tr style="background:#f0fdf4">
            <th style="text-align:left;padding:6px 4px;border:1px solid #d1d5db;font-weight:700">Ejercicio</th>
            <th style="text-align:center;padding:6px 4px;border:1px solid #d1d5db;font-weight:700;width:15%">Series</th>
            <th style="text-align:center;padding:6px 4px;border:1px solid #d1d5db;font-weight:700;width:15%">Repeticiones</th>
            <th style="text-align:center;padding:6px 4px;border:1px solid #d1d5db;font-weight:700;width:15%">Descanso</th>
          </tr>
        </thead>
        <tbody>`;
      
      for (const ej of tablaGym) {
        html += `<tr>
            <td style="padding:6px 4px;border:1px solid #e5e7eb;vertical-align:top">${esc(ej.nombre)}</td>
            <td style="padding:6px 4px;border:1px solid #e5e7eb;text-align:center;vertical-align:top">${esc(ej.series)}</td>
            <td style="padding:6px 4px;border:1px solid #e5e7eb;text-align:center;vertical-align:top">${esc(ej.repeticiones)}</td>
            <td style="padding:6px 4px;border:1px solid #e5e7eb;text-align:center;vertical-align:top">${esc(ej.descanso)}</td>
          </tr>`;
      }
      
      html += `</tbody></table>`;
    }
    
    html += `</div>`;
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
        <td>${escapeHtmlForInject(r.pliegueCintura ?? "")}</td>
        <td>${escapeHtmlForInject(r.notas || "")}</td>
      </tr>`;
    }).join("");

    const tableHtml = `<div class="print-section pesaje-historico">
      <h2 style="margin:0 0 8px 0;color:#064e3b;font-size:14px;font-weight:700">Histórico de medidas</h2>
      <table class="print-hist-table" style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th>Fecha</th><th>Peso</th><th>Masa grasa %</th><th>Masa grasa (kg)</th><th>Masa magra (kg)</th>
            <th>Masa muscular (kg)</th><th>Agua (kg)</th><th>% Agua</th><th>Masa ósea (kg)</th><th>MB (kcal)</th>
            <th>Grasa visceral</th><th>IMC</th><th>Edad metab.</th><th>C. Brazo</th><th>C. Cintura</th><th>C. Cadera</th><th>C. Pierna</th><th>Índice C/T</th><th>Pliegue Cintura</th><th>Notas</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="20">Sin registros</td></tr>'}
        </tbody>
      </table>
    </div>`;
    
    const chartHtml = chartImg ? `<div class="chart-page"><h2 style="margin:0 0 15px 0;color:#064e3b;font-size:16px;font-weight:700;text-align:center">Gráfico de Evolución</h2><div class="chart-print"><img src="${chartImg}" alt="Gráfico de peso" /></div></div>` : "";
    
    return { tableHtml, chartHtml };
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
      let chartContent = "";
      if (printOptions.dietaMensual) parts.push(buildDietaWeeklyHTML());
      if (printOptions.datosPesaje) {
        const { tableHtml, chartHtml } = await buildPesajeHTML();
        parts.push(tableHtml);
        if (chartHtml) chartContent = chartHtml;
      }
      if (printOptions.tablaGym) parts.push(buildTablaGymHTML());

      const headerName = escapeHtmlForInject(userData ? (userData.nombre ? `${userData.nombre} ${userData.apellidos || ""}` : userData.email || "Usuario") : "Usuario");
      const headerDate = new Date().toLocaleString();
      const filenameSafe = (userData && userData.nombre ? userData.nombre.replace(/\s+/g, "_") : "ficha") + "_" + new Date().toISOString().slice(0,10);

      const printCSS = `
        @page { size: A4 landscape; margin: 8mm; }
        * { box-sizing: border-box; margin:0; padding:0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; color:#062017; background: #fff; font-size:10px; line-height:1.3; }
        #pdf-root { padding: 6px; width: 100%; }
        .pdf-header { display:flex; align-items:center; gap:6px; margin-bottom:8px; }
        .pdf-logo { width:35px; height:35px; flex:0 0 35px; display:flex; align-items:center; justify-content:center; background:#064e3b; border-radius:4px; color:#fff; font-weight:700; font-size:14px; }
        h1 { margin:0; font-size:14px; color:#064e3b; font-weight:700; }
        .pdf-meta { font-size:9px; color:#374151; margin:0; }
        h2 { font-size:13px; margin:0 0 5px 0; color:#064e3b; font-weight:700; }
        .print-section { margin:0; padding:0; }
        .print-calendar { font-size:9px; width:100%; table-layout: fixed; border-collapse:collapse; margin:0; }
        .print-calendar th { padding:4px 3px; background:#f7fff9; border:1px solid #d1d5db; font-size:9px; font-weight:700; line-height:1.2; }
        .print-calendar td { padding:4px 3px; vertical-align:top; word-break:break-word; border:1px solid #e5e7eb; font-size:8.5px; line-height:1.3; }
        .print-calendar td:first-child { font-weight:700; width:12%; background:#f9fafb; }
        table { border-collapse:collapse; width:100%; margin:0; }
        .chart-page { page-break-before: always; margin-top:15px; }
        .chart-print { margin:15px auto; text-align:center; }
        .chart-print img { max-width:95%; height:auto; border:2px solid #e5e7eb; padding:8px; background:#fff; border-radius:4px; }
      `;

      const logoUrl = DEFAULT_CLINIC_LOGO;
      let logoData = null;
      try { logoData = await imgUrlToDataUrl(logoUrl); } catch (e) { logoData = null; }

      const logoHtml = logoData ? `<img src="${logoData}" alt="Logo" style="width:35px;height:35px;object-fit:contain;border-radius:4px" />` : `<img src="${escapeHtmlForInject(logoUrl)}" alt="Logo" style="width:35px;height:35px;object-fit:contain;border-radius:4px" onerror="this.style.display='none'" />`;

      const pdfInner = `
        <div id="pdf-root">
          <div class="pdf-header">
            ${logoHtml}
            <div style="flex:1">
              <h1 style="font-size:15px;margin:0;font-weight:700">${headerName}</h1>
              <div class="pdf-meta" style="font-size:10px">Generado: ${headerDate}</div>
            </div>
            <div style="text-align:right;font-size:10px;color:#374151">Ficha imprimible</div>
          </div>
          ${parts.join("")}
          ${chartContent}
        </div>
      `;

      const container = document.createElement("div");
      container.id = "pdf-temp-root";
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "297mm";
      container.style.overflow = "visible";
      container.innerHTML = `<style>${printCSS}</style>${pdfInner}`;
      document.body.appendChild(container);

      await ensureHtml2Pdf();

      const element = container.querySelector("#pdf-root");
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `${filenameSafe}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { 
          scale: 1.5, 
          useCORS: true, 
          logging: false,
          windowWidth: 1122,
          windowHeight: 794
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: 'avoid-all', before: '.chart-page' }
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

  // Restaurar una versión histórica de la dieta
  // Ref para cargar contenido en el editor tras una restauración
  // (cubre tanto el caso de editor ya montado como el de recién montado)
  const pendingRestoreContentRef = useRef(null);

  const handleRestoreDieta = async (dieta) => {
    if (!uid) return;
    try {
      const restoredMenu = Array.isArray(dieta.menu) ? dieta.menu : Array.from({ length: 7 }, () => ({ ...emptyDayMenu() }));
      const restoredModoManual = dieta.modoManual || false;
      const restoredTipoMenu = dieta.tipoMenu || "tabla";
      const restoredContenido = dieta.contenidoManual || "";

      const updateData = {
        menu: restoredMenu,
        modoManual: restoredModoManual,
        tipoMenu: restoredTipoMenu,
        updatedAt: serverTimestamp()
      };
      if (restoredModoManual && restoredContenido) {
        updateData.contenidoManual = restoredContenido;
      }
      if (restoredTipoMenu === "vertical" && dieta.menuVertical) {
        updateData.menuVertical = dieta.menuVertical;
      }
      await updateDoc(doc(db, "users", uid), updateData);

      // 1. Limpiar borrador de localStorage para que no machaque la restauración
      try { localStorage.removeItem(`menu_manual_draft_${uid}`); } catch (_) {}

      // 2. Actualizar refs síncronos ANTES de los setStates
      if (restoredModoManual && restoredContenido) {
        contenidoManualRef.current = restoredContenido;
        // Guardar también en el pending ref por si el editor aún no está montado
        pendingRestoreContentRef.current = restoredContenido;
      }

      // 3. Si el editor ya está montado, actualizar el DOM directamente ahora
      if (restoredModoManual && restoredContenido && editorManualRef.current) {
        editorManualRef.current.innerHTML = ensureContentEditableInHTML(restoredContenido);
        pendingRestoreContentRef.current = null; // ya aplicado
      }

      // 4. Actualizar todo el estado de React
      setModoManual(restoredModoManual);
      setTipoMenu(restoredTipoMenu);
      if (restoredModoManual && restoredContenido) {
        setContenidoManual(restoredContenido);
      }
      if (restoredTipoMenu === "vertical" && dieta.menuVertical) {
        setMenuVertical(dieta.menuVertical);
      }
      setEditable(prev => ({
        ...prev,
        menu: normalizeMenu(restoredMenu)
      }));

      // 5. Fallback con setTimeout: cubre el caso de que el editor se monte
      //    después de que React procese el cambio de modoManual (modo tabla → manual)
      if (restoredModoManual && restoredContenido) {
        setTimeout(() => {
          if (pendingRestoreContentRef.current && editorManualRef.current) {
            editorManualRef.current.innerHTML = ensureContentEditableInHTML(pendingRestoreContentRef.current);
            pendingRestoreContentRef.current = null;
          }
        }, 150);
      }

      const newSnap = await getDoc(doc(db, "users", uid));
      if (newSnap.exists()) setUserData(newSnap.data());

      setShowRestoreModal(false);
      setRestoreDietaPreview(null);
      alert(`✅ Dieta #${dieta.numero} restaurada correctamente`);
    } catch (err) {
      console.error("Error restaurando dieta:", err);
      alert("❌ Error al restaurar la dieta");
    }
  };

  const generateHistoricalDietPDF = async (dietaVersion) => {
    try {
      const fechaDesde = new Date(dietaVersion.fechaDesde);
      const fechaHasta = dietaVersion.fechaHasta ? new Date(dietaVersion.fechaHasta) : new Date();
      const formatFecha = (date) => {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
      };
      
      // Build weekly diet HTML for this specific version
      const menuSemanal = Array.isArray(dietaVersion.menu) ? dietaVersion.menu : [];
      const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
      
      let rows = "";
      const cells = ["desayuno", "almuerzo", "comida", "merienda", "cena", "consejos"];
      const cellsLabels = ["Desayuno", "Almuerzo", "Comida", "Merienda", "Cena", "Consejos"];
      
      cells.forEach((cell, cellIdx) => {
        let row = `<tr><td style="font-weight:700;background:#f9fafb">${cellsLabels[cellIdx]}</td>`;
        for (let d = 0; d < 7; d++) {
          const dayObj = menuSemanal[d] || {};
          const val = dayObj[cell] || "";
          row += `<td>${escapeHtmlForInject(val)}</td>`;
        }
        row += "</tr>";
        rows += row;
      });
      
      const dietaHTML = `
        <div style="margin-bottom:12px">
          <h2 style="font-size:14px;margin:0 0 6px 0;color:#064e3b;font-weight:700">
            Dieta Semanal #${dietaVersion.numero}
          </h2>
          <div style="font-size:10px;color:#6b7280;margin-bottom:8px">
            Período: ${formatFecha(fechaDesde)} - ${formatFecha(fechaHasta)}
          </div>
          <table class="print-calendar">
            <thead>
              <tr>
                <th style="width:12%"></th>
                ${dias.map(d => `<th>${d}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
      
      const headerName = escapeHtmlForInject(userData ? (userData.nombre ? `${userData.nombre} ${userData.apellidos || ""}` : userData.email || "Usuario") : "Usuario");
      const headerDate = new Date().toLocaleString();
      const filenameSafe = `dieta_${dietaVersion.numero}_${userData?.nombre?.replace(/\s+/g, "_") || "usuario"}`;
      
      const printCSS = `
        @page { size: A4 landscape; margin: 8mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; color:#062017; background: #fff; margin:0; font-size:10px; line-height:1.3; }
        #pdf-root { padding: 4px; max-width: 100%; }
        .pdf-header { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
        .pdf-logo { width:35px; height:35px; flex:0 0 35px; display:flex; align-items:center; justify-content:center; background:#064e3b; border-radius:4px; color:#fff; font-weight:700; font-size:14px; }
        h1 { margin:0; font-size:14px; color:#064e3b; font-weight:700; }
        .pdf-meta { font-size:9px; color:#374151; }
        h2 { font-size:13px; margin:0 0 5px 0; color:#064e3b; font-weight:700; }
        .print-section { margin:0; padding:0; }
        .print-calendar { font-size:9px; width:100%; table-layout: fixed; border-collapse:collapse; margin:0; }
        .print-calendar th { padding:4px 3px; background:#f7fff9; border:1px solid #d1d5db; font-size:9px; font-weight:700; line-height:1.2; }
        .print-calendar td { padding:4px 3px; vertical-align:top; word-break:break-word; border:1px solid #e5e7eb; font-size:8.5px; line-height:1.3; overflow:hidden; height:auto; max-height:none; }
        .print-calendar td:first-child { font-weight:700; width:12%; background:#f9fafb; }
        table { page-break-inside:auto; border-collapse:collapse; width:100%; margin:0; }
        tr { page-break-inside:avoid; page-break-after:auto; }
        @media print { 
          #pdf-root { padding: 3mm; }
          body { font-size:9px; }
        }
      `;
      
      const logoUrl = DEFAULT_CLINIC_LOGO;
      let logoData = null;
      try { logoData = await imgUrlToDataUrl(logoUrl); } catch (e) { logoData = null; }
      
      const logoHtml = logoData ? `<img src="${logoData}" alt="Logo" style="width:35px;height:35px;object-fit:contain;border-radius:4px" />` : `<img src="${escapeHtmlForInject(logoUrl)}" alt="Logo" style="width:35px;height:35px;object-fit:contain;border-radius:4px" onerror="this.style.display='none'" />`;
      
      const pdfInner = `
        <div id="pdf-root">
          <div class="pdf-header">
            ${logoHtml}
            <div style="flex:1">
              <h1 style="font-size:12px;margin:0;font-weight:700">${headerName}</h1>
              <div class="pdf-meta" style="font-size:8px">Generado: ${headerDate}</div>
            </div>
            <div style="text-align:right;font-size:8px;color:#374151">Dieta #${dietaVersion.numero}</div>
          </div>
          
          ${dietaHTML}
        </div>
      `;
      
      const container = document.createElement("div");
      container.id = "pdf-temp-historical";
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "297mm";
      container.style.height = "210mm";
      container.style.overflow = "hidden";
      container.innerHTML = `<style>${printCSS}</style>${pdfInner}`;
      document.body.appendChild(container);
      
      await ensureHtml2Pdf();
      
      const element = container.querySelector("#pdf-root");
      const opt = {
        margin: [3, 3, 3, 3],
        filename: `${filenameSafe}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2.5, useCORS: true, logging: false, width: 1400, height: 900 },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      
      try {
        await window.html2pdf().set(opt).from(element).save();
      } catch (err) {
        console.error("html2pdf error:", err);
        alert("Ocurrió un error generando el PDF histórico.");
      } finally {
        setTimeout(() => {
          try { document.body.removeChild(container); } catch (e) {}
        }, 600);
      }
    } catch (err) {
      console.error("generateHistoricalDietPDF error:", err);
      alert("No se pudo generar el PDF histórico.");
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
            <div 
              onClick={() => {
                setShowProfile((s) => {
                  if (!s) {
                    // Al abrir el perfil, inicializar editable con los datos actuales
                    setEditable((prev) => ({
                      ...prev,
                      nombre: userData.nombre || "",
                      apellidos: userData.apellidos || "",
                      nacimiento: userData.nacimiento || "",
                      telefono: userData.telefono || "",
                      rol: userData.rol || "paciente"
                    }));
                  }
                  return !s;
                });
              }}
              style={{
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
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)", e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)", e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)")}
              title="Click para ver perfil"
            >
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
                {userData.activo === false && (
                  <span style={{
                    marginLeft: "8px",
                    padding: "4px 10px",
                    fontSize: "12px",
                    fontWeight: "700",
                    backgroundColor: "#ef4444",
                    color: "white",
                    borderRadius: "6px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                  }}>
                    ⛔ DESACTIVADO
                  </span>
                )}
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
                    {userData.anamnesis.eligePlan === "Otros" && userData.anamnesis.eligePlanOtros 
                      ? userData.anamnesis.eligePlanOtros 
                      : userData.anamnesis.eligePlan}
                  </span>
                )}
                {userData?.anamnesis?.tipoDieta && (
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
                    {userData.anamnesis.tipoDieta === "Otros" && userData.anamnesis.tipoDietaOtros 
                      ? userData.anamnesis.tipoDietaOtros 
                      : userData.anamnesis.tipoDieta}
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

            {/* Botón activar/desactivar usuario - Solo visible para admin */}
            {adminMode && (
              <button 
                className="btn-icon-header" 
                onClick={handleToggleActivoUsuario} 
                title={userData.activo === false ? "Activar usuario" : "Desactivar usuario"}
                style={{
                  background: userData.activo === false ? "rgba(239, 68, 68, 0.9)" : "rgba(255,255,255,0.2)",
                  border: "none",
                  borderRadius: "8px",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = userData.activo === false ? "rgba(239, 68, 68, 1)" : "rgba(255,255,255,0.3)";
                  e.target.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = userData.activo === false ? "rgba(239, 68, 68, 0.9)" : "rgba(255,255,255,0.2)";
                  e.target.style.transform = "scale(1)";
                }}
              >
                {userData.activo === false ? (
                  <span style={{ fontSize: "18px" }}>⛔</span>
                ) : (
                  <span style={{ fontSize: "18px", filter: "grayscale(0)" }}>✅</span>
                )}
              </button>
            )}

            {(!targetUid || targetUid === authUid) && (
              <>
                <button 
                  className="btn-icon-header" 
                  onClick={() => {
                    const msgIndex = tabs.findIndex(t => t.id === "mensajes");
                    if (msgIndex !== -1) setTabIndex(msgIndex);
                  }}
                  title="Mensajes"
                  style={{
                    background: "rgba(147,51,234,0.9)",
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
                  onMouseEnter={(e) => e.target.style.background = "rgba(126,34,206,1)"}
                  onMouseLeave={(e) => e.target.style.background = "rgba(147,51,234,0.9)"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                <button 
                  className="btn-icon-header" 
                  onClick={() => setShowHelpModal(true)}
                  title="Ayuda"
                  style={{
                    background: "rgba(33,150,243,0.9)",
                    border: "none",
                    borderRadius: "8px",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    marginRight: 8,
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(25,118,210,1)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(33,150,243,0.9)"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 16v-2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 8a2 2 0 1 1 0 4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
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
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(220,38,38,1)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.9)"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
  {/* Modal de ayuda */}
  {showHelpModal && (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20
    }}
      onClick={() => setShowHelpModal(false)}
    >
      <div style={{ background: 'white', borderRadius: 12, maxWidth: 400, width: '100%', padding: 24, position: 'relative' }} onClick={e => e.stopPropagation()}>
        <div style={{ position: 'absolute', top: 10, right: 16, cursor: 'pointer', fontSize: 22 }} onClick={() => setShowHelpModal(false)}>✖️</div>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>❓</div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#2196F3' }}>Ayuda y Sugerencias</h2>
          <p style={{ color: '#555', fontSize: 15, margin: '8px 0 0 0' }}>¿Tienes dudas o sugerencias sobre la app?<br/>Envíanos tu consulta y te responderemos.</p>
        </div>
        <HelpForm onClose={() => setShowHelpModal(false)} />
      </div>
    </div>
  )}
              </>
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
                className="btn-icon-header"
                title="Cerrar"
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
                onMouseEnter={e => e.currentTarget.style.background = "rgba(220,38,38,1)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.9)"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <p style={{ color: "#374151", fontSize: "14px", marginBottom: "20px" }}>
              Selecciona los elementos que deseas incluir en el PDF:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <label 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "12px",
                  padding: "14px 16px",
                  background: printOptions.dietaMensual ? "rgba(59,130,246,0.08)" : "#f8fafc",
                  border: `2px solid ${printOptions.dietaMensual ? "#3b82f6" : "#e2e8f0"}`,
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
                    accentColor: "#3b82f6"
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "15px", marginBottom: "2px" }}>🍽️ Dieta Semanal</div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>Menú semanal completo organizado por días y comidas</div>
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

              <label 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "12px",
                  padding: "14px 16px",
                  background: printOptions.tablaGym ? "rgba(234,88,12,0.08)" : "#f8fafc",
                  border: `2px solid ${printOptions.tablaGym ? "#ea580c" : "#e2e8f0"}`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (!printOptions.tablaGym) {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!printOptions.tablaGym) {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                  }
                }}
              >
                <input 
                  type="checkbox" 
                  checked={printOptions.tablaGym} 
                  onChange={(e) => setPrintOptions((s) => ({ ...s, tablaGym: e.target.checked }))}
                  style={{ 
                    width: "20px", 
                    height: "20px", 
                    cursor: "pointer",
                    accentColor: "#ea580c"
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "15px", marginBottom: "2px" }}>💪 Tabla de Ejercicios</div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>Rutina de gimnasio organizada por días con series y repeticiones</div>
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
                disabled={!printOptions.dietaMensual && !printOptions.datosPesaje && !printOptions.tablaGym}
                style={{ 
                  padding: "10px 24px",
                  opacity: (!printOptions.dietaMensual && !printOptions.datosPesaje && !printOptions.tablaGym) ? 0.5 : 1,
                  cursor: (!printOptions.dietaMensual && !printOptions.datosPesaje && !printOptions.tablaGym) ? "not-allowed" : "pointer"
                }}
              >
                📥 Generar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfile && (
        <div className="card" style={{ 
          padding: isMobile ? 16 : 12, 
          margin: isMobile ? "0 0 12px 0" : "0 12px 12px 12px" 
        }}>
          <h3 style={{ fontSize: isMobile ? "18px" : "16px" }}>
            {adminMode ? "Perfil de Usuario" : "Mi Perfil"}
          </h3>
          <div className="panel-section">
            {/* Datos Personales Editables */}
            <h4 style={{ marginBottom: 12, fontSize: isMobile ? "16px" : "15px", color: "#374151" }}>📝 Datos Personales</h4>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 12, marginBottom: 20 }}>
              <div className="field"><label style={{ fontSize: isMobile ? "14px" : "13px" }}>Nombre</label><input className="input" style={{ fontSize: isMobile ? "16px" : "14px", padding: isMobile ? "12px" : "8px" }} value={editable.nombre || ""} onChange={(e) => setEditable((s) => ({ ...s, nombre: e.target.value }))} /></div>
              <div className="field"><label style={{ fontSize: isMobile ? "14px" : "13px" }}>Apellidos</label><input className="input" style={{ fontSize: isMobile ? "16px" : "14px", padding: isMobile ? "12px" : "8px" }} value={editable.apellidos || ""} onChange={(e) => setEditable((s) => ({ ...s, apellidos: e.target.value }))} /></div>
              <div className="field"><label style={{ fontSize: isMobile ? "14px" : "13px" }}>Fecha de nacimiento</label><input className="input" style={{ fontSize: isMobile ? "16px" : "14px", padding: isMobile ? "12px" : "8px" }} type="date" value={editable.nacimiento || ""} onChange={(e) => setEditable((s) => ({ ...s, nacimiento: e.target.value }))} /></div>
              <div className="field"><label style={{ fontSize: isMobile ? "14px" : "13px" }}>Teléfono</label><input className="input" style={{ fontSize: isMobile ? "16px" : "14px", padding: isMobile ? "12px" : "8px" }} type="tel" inputMode="tel" value={editable.telefono || ""} onChange={(e) => setEditable((s) => ({ ...s, telefono: e.target.value }))} /></div>
              
              {/* Campo Rol - Solo visible/editable para admins */}
              <div className="field">
                <label style={{ fontSize: isMobile ? "14px" : "13px" }}>Rol</label>
                {adminMode ? (
                  <select 
                    className="input" 
                    value={editable.rol || "paciente"} 
                    onChange={(e) => setEditable((s) => ({ ...s, rol: e.target.value }))}
                    style={{ 
                      backgroundColor: "white",
                      fontSize: isMobile ? "16px" : "14px",
                      padding: isMobile ? "12px" : "8px"
                    }}
                  >
                    <option value="paciente">Paciente</option>
                    <option value="admin">Administrador</option>
                  </select>
                ) : (
                  <input 
                    className="input" 
                    value={editable.rol === "admin" ? "Administrador" : "Paciente"} 
                    disabled 
                    style={{ 
                      backgroundColor: "#f5f5f5", 
                      color: "#666",
                      fontSize: isMobile ? "16px" : "14px",
                      padding: isMobile ? "12px" : "8px"
                    }}
                  />
                )}
                {adminMode && (
                  <small style={{ display: "block", marginTop: "4px", color: "#64748b", fontSize: isMobile ? "12px" : "11px" }}>
                    {editable.rol === "admin" ? "⚠️ Acceso completo al panel" : "Usuario regular"}
                  </small>
                )}
              </div>
            </div>

            {/* Plan y Tipo de Dieta Asignados (Solo Visible) */}
            {(userData?.anamnesis?.eligePlan || userData?.anamnesis?.tipoDieta) && (
              <>
                <hr style={{ margin: "16px 0" }} />
                <h4 style={{ marginBottom: 12, fontSize: "15px", color: "#374151" }}>🍽️ Plan Asignado por tu Nutricionista</h4>
                
                {/* Plan de suscripción */}
                {userData?.anamnesis?.eligePlan && (
                  <div style={{
                    padding: "16px",
                    backgroundColor: "#16a34a",
                    borderRadius: "12px",
                    textAlign: "center",
                    marginBottom: userData?.anamnesis?.tipoDieta ? "12px" : "20px"
                  }}>
                    <div style={{
                      fontSize: "18px",
                      fontWeight: "700",
                      color: "white",
                      textTransform: "uppercase",
                      letterSpacing: "1px"
                    }}>
                      {userData.anamnesis.eligePlan === "Otros" && userData.anamnesis.eligePlanOtros 
                        ? userData.anamnesis.eligePlanOtros 
                        : userData.anamnesis.eligePlan}
                    </div>
                    <div style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.8)",
                      marginTop: "6px"
                    }}>
                      Plan de suscripción
                    </div>
                  </div>
                )}
                
                {/* Tipo de dieta */}
                {userData?.anamnesis?.tipoDieta && (
                  <div style={{
                    padding: "16px",
                    backgroundColor: "#3b82f6",
                    borderRadius: "12px",
                    textAlign: "center",
                    marginBottom: 20
                  }}>
                    <div style={{
                      fontSize: "18px",
                      fontWeight: "700",
                      color: "white",
                      textTransform: "uppercase",
                      letterSpacing: "1px"
                    }}>
                      {userData.anamnesis.tipoDieta === "Otros" && userData.anamnesis.tipoDietaOtros 
                        ? userData.anamnesis.tipoDietaOtros 
                        : userData.anamnesis.tipoDieta}
                    </div>
                    <div style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.8)",
                      marginTop: "6px"
                    }}>
                      Objetivo nutricional
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: isMobile ? 20 : 12, display: "flex", gap: isMobile ? 12 : 8, flexDirection: isMobile ? "column" : "row" }}>
              <button 
                className="btn primary" 
                onClick={saveProfile}
                style={{
                  fontSize: isMobile ? "16px" : "14px",
                  padding: isMobile ? "14px 20px" : "10px 16px",
                  fontWeight: "600"
                }}
              >
                💾 Guardar cambios
              </button>
              <button 
                className="btn ghost" 
                onClick={() => { 
                  setEditable((prev) => ({ 
                    ...prev, 
                    nombre: userData.nombre || "", 
                    apellidos: userData.apellidos || "", 
                    nacimiento: userData.nacimiento || "", 
                    telefono: userData.telefono || "", 
                    rol: userData.rol || "paciente" 
                  })); 
                  setShowProfile(false); 
                }}
                style={{
                  fontSize: isMobile ? "16px" : "14px",
                  padding: isMobile ? "14px 20px" : "10px 16px"
                }}
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content (pesaje, dieta, etc.) */}
      {!showProfile && (
        <>
          {/* Tabs modernos con iconos */}
          <nav className="tabs" role="tablist" aria-label="Secciones" style={{ 
            display: isMobile && adminMode ? "grid" : "flex",
            gridTemplateColumns: isMobile && adminMode ? "repeat(3, 1fr)" : "none",
            gridTemplateRows: isMobile && adminMode ? "repeat(3, auto)" : "none",
            gap: isMobile ? "6px" : "6px", 
            padding: adminMode ? (isMobile ? "0 8px" : "0 20px") : (isMobile ? "0 8px" : "0"),
            overflowX: isMobile && adminMode ? "visible" : "auto",
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
                  flex: isMobile && adminMode ? "none" : (isMobile ? "0 0 auto" : "1 1 auto"),
                  minWidth: isMobile && adminMode ? "auto" : (isMobile ? "fit-content" : "fit-content"),
                  padding: isMobile && adminMode ? "10px 4px" : (isMobile ? "10px 12px" : "10px 16px"),
                  borderRadius: isMobile ? "8px" : "10px",
                  background: i === tabIndex 
                    ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" 
                    : (isMobile ? "white" : "#f1f5f9"),
                  border: (isMobile && i !== tabIndex) ? "1px solid #e5e7eb" : "none",
                  color: i === tabIndex ? "white" : "#64748b",
                  fontWeight: i === tabIndex ? "700" : "500",
                  fontSize: isMobile && adminMode ? "11px" : (isMobile ? "14px" : "14px"),
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: i === tabIndex 
                    ? "0 4px 12px rgba(22,163,74,0.3)" 
                    : (isMobile ? "0 1px 2px rgba(0,0,0,0.05)" : "none"),
                  whiteSpace: isMobile && adminMode ? "normal" : "nowrap",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: isMobile && !adminMode ? "row" : "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: isMobile && !adminMode ? "6px" : "2px",
                  position: "relative"
                }}
              >
                {isMobile && adminMode ? (
                  <>
                    <span style={{ fontSize: "18px" }}>{t.icon}</span>
                    <span style={{ fontSize: "10px", lineHeight: "1.2", wordBreak: "break-word" }}>
                      {t.label.replace(/^[^\s]+\s/, '')}
                    </span>
                    {/* Badge de mensajes no leídos */}
                    {t.id === 'mensajes' && mensajesNoLeidos > 0 && (
                      <span style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        borderRadius: '10px',
                        padding: '2px 5px',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        minWidth: '16px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}>
                        {mensajesNoLeidos}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {t.label}
                    {/* Badge de mensajes no leídos */}
                    {t.id === 'mensajes' && mensajesNoLeidos > 0 && (
                      <span style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        borderRadius: '10px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        minWidth: '18px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}>
                        {mensajesNoLeidos}
                      </span>
                    )}
                  </>
                )}
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
                  <div className="pesaje-container">
                    {/* Fila con Fecha, Peso, Edad y Altura */}
                    <div style={{ 
                      marginBottom: "16px", 
                      display: "grid", 
                      gridTemplateColumns: isMobile ? "1fr 1fr" : "200px 120px 80px 120px", 
                      gap: isMobile ? "8px" : "16px", 
                      alignItems: "end" 
                    }}>
                      <div>
                        <label style={{ display: "block", fontSize: isMobile ? "11px" : "12px", color: "#475569", marginBottom: "6px", fontWeight: "500" }}>Fecha</label>
                        <input type="date" className="input" value={fechaPeso} onChange={(e) => setFechaPeso(e.target.value)} style={{ width: "100%", fontSize: isMobile ? "14px" : "15px" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: isMobile ? "11px" : "12px", color: "#475569", marginBottom: "6px", fontWeight: "500" }}>Peso (kg)</label>
                        <input type="number" step="0.1" className="input" value={editable.peso || ""} onChange={(e) => setEditable((s) => ({ ...s, peso: e.target.value }))} style={{ width: "100%", fontSize: isMobile ? "14px" : "15px" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: isMobile ? "11px" : "12px", color: "#475569", marginBottom: "6px", fontWeight: "500" }}>Edad</label>
                        <input type="text" className="input" value={calcularEdad(userData?.nacimiento) || "—"} readOnly style={{ width: "100%", backgroundColor: "#f8fafc", cursor: "not-allowed", fontSize: isMobile ? "14px" : "15px" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: isMobile ? "11px" : "12px", color: "#475569", marginBottom: "6px", fontWeight: "500" }}>Altura (cm)</label>
                        <input type="number" step="0.1" className="input" value={altura} onChange={(e) => setAltura(e.target.value)} style={{ width: "100%", fontSize: isMobile ? "14px" : "15px" }} />
                      </div>
                    </div>

                    {/* Grid compacto para campos de medidas - organizados por tipo */}
                    {adminMode && !isMobile && (
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

                    {/* Botón de guardar */}
                    <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
                      <button 
                        className="btn primary" 
                        type="button" 
                        disabled={savingPeso} 
                        onClick={(e) => submitPeso(e)}
                        style={{
                          background: savingPeso ? "#94a3b8" : "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                          color: "white",
                          padding: "10px 24px",
                          borderRadius: "8px",
                          border: "none",
                          cursor: savingPeso ? "not-allowed" : "pointer",
                          fontWeight: "600",
                          fontSize: "14px",
                          boxShadow: savingPeso ? "none" : "0 2px 8px rgba(22, 163, 74, 0.3)",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px"
                        }}
                        onMouseEnter={(e) => {
                          if (!savingPeso) {
                            e.target.style.transform = "translateY(-1px)";
                            e.target.style.boxShadow = "0 4px 12px rgba(22, 163, 74, 0.4)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!savingPeso) {
                            e.target.style.transform = "translateY(0)";
                            e.target.style.boxShadow = "0 2px 8px rgba(22, 163, 74, 0.3)";
                          }
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
                            Guardar Medidas
                          </>
                        )}
                      </button>
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
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
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
                        
                        <input 
                          type="checkbox" 
                          id="transpose-check" 
                          checked={transposeTable} 
                          onChange={(e) => setTransposeTable(e.target.checked)}
                          style={{ 
                            cursor: "pointer", 
                            marginLeft: "8px",
                            accentColor: "#64748b"
                          }}
                        />
                        <label htmlFor="transpose-check" style={{ fontSize: 13, color: "#64748b", fontWeight: "500", cursor: "pointer" }}>
                          VER/HOR
                        </label>
                      </div>

                      {!isMobile && (
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
                      )}
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
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "60px" }}>Pliegue Cintura</th>
                            <th style={{ padding: "6px 8px", fontSize: "10.5px", fontWeight: "600", textAlign: "left", width: "150px", maxWidth: "150px" }}>Notas</th>
                            <th style={{ padding: "6px 4px", fontSize: "10.5px", fontWeight: "600", textAlign: "center", width: "70px" }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(!rowsDesc || rowsDesc.length === 0) ? (
                            <tr><td colSpan={21} style={{ padding: 12, textAlign: "center", color: "#94a3b8" }}>Sin registros</td></tr>
                          ) : (
                            rowsDesc.slice(0, histLimit).map((r, i) => {
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
                                    <td style={{ padding: "5px 4px", fontSize: "10.5px", textAlign: "center" }}>{r.pliegueCintura ?? "—"}</td>
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
                              rowsDesc.slice(0, histLimit).reverse().map((r, i) => {
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
                              { label: "Pliegue Cintura", key: "pliegueCintura" },
                              { label: "Notas", key: "notas" }
                            ].map((field, fieldIdx) => (
                              <tr key={`row-${fieldIdx}`} style={{ background: fieldIdx % 2 === 0 ? "#fefefe" : "#fafafa" }}>
                                <td style={{ position: "sticky", left: 0, background: fieldIdx % 2 === 0 ? "#fff" : "#fafafa", fontWeight: 500, padding: "6px 8px", fontSize: "10.5px", width: "100px", minWidth: "100px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", border: "1px solid #cbd5e1", boxShadow: "3px 0 4px rgba(0,0,0,0.1)", color: "#1e293b", borderRight: "3px solid #cbd5e1" }}>
                                  {field.label}
                                </td>
                                {rowsDesc.slice(0, histLimit).reverse().map((r, i) => {
                                  const key = `cell-${fieldIdx}-${i}`;
                                  let value = "—";
                                  value = r[field.key] ?? (field.alt ? r[field.alt] : "") ?? "—";
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
              <div className="panel-section" style={{ padding: "8px 20px 16px", maxWidth: "none" }}>
                {/* Selectores modo admin */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                  {adminMode && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button 
                        onClick={async () => {
                          latestModoManualRef.current = false; // actualizar ref antes de que React procese el cleanup
                          setTipoMenu("tabla");
                          setModoManual(false);
                          try {
                            await updateDoc(doc(db, "users", uid), {
                              tipoMenu: "tabla",
                              modoManual: false,
                              updatedAt: serverTimestamp()
                            });
                          } catch (err) {
                            console.error("Error guardando tipo de menú:", err);
                          }
                        }}
                        title="Modo desplegable"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: "0",
                          margin: "0",
                          backgroundColor: tipoMenu === "tabla" && !modoManual ? "#dcfce7" : "#f0fdf4",
                          borderRadius: "6px",
                          border: `2px solid ${tipoMenu === "tabla" && !modoManual ? "#16a34a" : "#bbf7d0"}`,
                          fontSize: "20px",
                          width: "40px",
                          height: "40px",
                          boxSizing: "border-box",
                          flexShrink: 0,
                          outline: "none"
                        }}
                      >
                        📋
                      </button>
                      
                      <button 
                        onClick={async () => {
                          latestModoManualRef.current = false; // actualizar ref antes de que React procese el cleanup
                          setTipoMenu("vertical");
                          setModoManual(false);
                          try {
                            await updateDoc(doc(db, "users", uid), {
                              tipoMenu: "vertical",
                              modoManual: false,
                              updatedAt: serverTimestamp()
                            });
                          } catch (err) {
                            console.error("Error guardando tipo de menú:", err);
                          }
                        }}
                        title="Opciones múltiples"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: "0",
                          margin: "0",
                          backgroundColor: tipoMenu === "vertical" ? "#dcfce7" : "#f0fdf4",
                          borderRadius: "6px",
                          border: `2px solid ${tipoMenu === "vertical" ? "#16a34a" : "#bbf7d0"}`,
                          fontSize: "20px",
                          width: "40px",
                          height: "40px",
                          boxSizing: "border-box",
                          flexShrink: 0,
                          outline: "none"
                        }}
                      >
                        📖
                      </button>
                      
                      <button 
                        onClick={async () => {
                          setModoManual(true);
                          setTipoMenu("tabla");
                          try {
                            await updateDoc(doc(db, "users", uid), {
                              modoManual: true,
                              tipoMenu: "tabla",
                              updatedAt: serverTimestamp()
                            });
                          } catch (err) {
                            console.error("Error guardando modo manual:", err);
                          }
                        }}
                        title="Modo manual"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: "0",
                          margin: "0",
                          backgroundColor: modoManual ? "#dcfce7" : "#f0fdf4",
                          borderRadius: "6px",
                          border: `2px solid ${modoManual ? "#16a34a" : "#bbf7d0"}`,
                          fontSize: "20px",
                          width: "40px",
                          height: "40px",
                          boxSizing: "border-box",
                          flexShrink: 0,
                          outline: "none"
                        }}
                      >
                        ✍️
                      </button>
                      
                      <button 
                        onClick={saveVersionMenu}
                        title="Guardar dieta"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: "0",
                          margin: "0",
                          backgroundColor: "#16a34a",
                          borderRadius: "6px",
                          border: "2px solid #16a34a",
                          color: "white",
                          fontSize: "20px",
                          width: "40px",
                          height: "40px",
                          boxSizing: "border-box",
                          flexShrink: 0,
                          outline: "none"
                        }}
                      >
                        💾
                      </button>
                      
                      <button 
                        onClick={openFotosModal}
                        title="Gestionar Fotos de Dieta"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: "0",
                          margin: "0",
                          backgroundColor: "#3b82f6",
                          borderRadius: "6px",
                          border: "2px solid #3b82f6",
                          color: "white",
                          fontSize: "20px",
                          width: "40px",
                          height: "40px",
                          boxSizing: "border-box",
                          flexShrink: 0,
                          outline: "none"
                        }}
                      >
                        📸
                      </button>
                    </div>
                  )}
                </div>

                {/* Editor Modo Manual */}
                {adminMode && modoManual ? (
                  isMobile ? (
                    <div style={{ marginTop: "20px" }}>
                      {/* Navegación de días */}
                      <div style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between", 
                        marginBottom: "16px", 
                        gap: "10px",
                        backgroundColor: "#f0fdf4",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid #86efac"
                      }}>
                        <button 
                          onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.max(0, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) - 1) }))}
                          style={{ 
                            padding: "8px 16px", 
                            fontSize: "20px",
                            backgroundColor: "#fff",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            cursor: "pointer",
                            minWidth: "44px",
                            minHeight: "44px"
                          }}
                        >←</button>
                        
                        <div style={{ 
                          fontWeight: "700", 
                          color: "#15803d",
                          fontSize: "17px",
                          textAlign: "center"
                        }}>{dayName}</div>
                        
                        <button 
                          onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.min(6, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) + 1) }))}
                          style={{ 
                            padding: "8px 16px", 
                            fontSize: "20px",
                            backgroundColor: "#fff",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            cursor: "pointer",
                            minWidth: "44px",
                            minHeight: "44px"
                          }}
                        >→</button>
                      </div>

                      {/* Editor simplificado por comidas */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {(() => {
                          const mealNames = ['DESAYUNO', 'ALMUERZO', 'COMIDA', 'MERIENDA', 'CENA', 'TIPS'];
                          const mealKeys = ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena', 'tips'];
                          const mealIcons = ['🌅', '☕', '🍽️', '🥤', '🌙', '💡'];
                          
                          return mealNames.map((mealName, idx) => {
                            const mealKey = mealKeys[idx];
                            if (!comidasActivas[mealKey]) return null;
                            
                            // Extraer contenido actual del día para esta comida (considerando colspan)
                            let currentContent = '';
                            let targetCell = null;
                            if (contenidoManual) {
                              try {
                                const parser = new DOMParser();
                                const doc = parser.parseFromString(contenidoManual, 'text/html');
                                const table = doc.querySelector('table');
                                
                                if (table) {
                                  const rows = table.querySelectorAll('tbody tr');
                                  const row = rows[idx];
                                  if (row) {
                                    const cells = Array.from(row.querySelectorAll('td'));
                                    let cellPosition = 0;
                                    
                                    for (let i = 0; i < cells.length; i++) {
                                      const cell = cells[i];
                                      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
                                      
                                      if (cellPosition <= selDay + 1 && cellPosition + colspan > selDay + 1) {
                                        targetCell = cell;
                                        currentContent = cell.innerHTML || '';
                                        break;
                                      }
                                      
                                      cellPosition += colspan;
                                    }
                                  }
                                }
                              } catch (e) {
                                console.error('Error parseando contenido:', e);
                              }
                            }
                            
                            return (
                              <div key={mealKey} style={{
                                backgroundColor: "#fff",
                                border: "2px solid #e5e7eb",
                                borderRadius: "10px",
                                overflow: "hidden"
                              }}>
                                <div style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "10px 14px",
                                  backgroundColor: "#f9fafb",
                                  borderBottom: "2px solid #e5e7eb"
                                }}>
                                  <span style={{ fontSize: "18px" }}>{mealIcons[idx]}</span>
                                  <span style={{ 
                                    fontSize: "15px", 
                                    fontWeight: "700", 
                                    color: "#0f172a" 
                                  }}>{mealName}</span>
                                </div>
                                <div
                                  contentEditable
                                  suppressContentEditableWarning
                                  data-meal={mealKey}
                                  data-day={selDay}
                                  dangerouslySetInnerHTML={{ __html: currentContent }}
                                  onInput={(e) => {
                                    try {
                                      const newText = e.currentTarget.innerHTML;
                                      const parser = new DOMParser();
                                      const doc = parser.parseFromString(contenidoManual, 'text/html');
                                      const table = doc.querySelector('table');
                                      
                                      if (table) {
                                        const tbody = table.querySelector('tbody');
                                        if (tbody) {
                                          const rows = tbody.querySelectorAll('tr');
                                          const row = rows[idx];
                                          if (row) {
                                            const cells = Array.from(row.querySelectorAll('td'));
                                            let cellPosition = 0;
                                            
                                            for (let i = 0; i < cells.length; i++) {
                                              const cell = cells[i];
                                              const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
                                              
                                              if (cellPosition <= selDay + 1 && cellPosition + colspan > selDay + 1) {
                                                cell.innerHTML = newText;
                                                const serializer = new XMLSerializer();
                                                setContenidoManual(serializer.serializeToString(doc));
                                                break;
                                              }
                                              
                                              cellPosition += colspan;
                                            }
                                          }
                                        }
                                      }
                                    } catch (e) {
                                      console.error('Error actualizando contenido:', e);
                                    }
                                  }}
                                  style={{
                                    padding: "14px",
                                    backgroundColor: "#fff",
                                    fontSize: "15px",
                                    lineHeight: "1.6",
                                    color: "#374151",
                                    minHeight: "100px",
                                    outline: "none",
                                    WebkitUserSelect: "text",
                                    userSelect: "text"
                                  }}
                                />
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: "20px" }}>
                      <>
                    {/* Banner informativo para selección de celdas */}
                    {celdasSeleccionadas.length > 0 && (
                      <div style={{
                        padding: "8px 12px",
                        backgroundColor: "#dbeafe",
                        border: "2px solid #3b82f6",
                        borderRadius: "6px",
                        marginBottom: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "13px",
                        color: "#1e40af"
                      }}>
                        <span>
                          <strong>{celdasSeleccionadas.length} celda{celdasSeleccionadas.length > 1 ? 's' : ''} seleccionada{celdasSeleccionadas.length > 1 ? 's' : ''}</strong> - 
                          {celdasSeleccionadas.length >= 2 ? ' Haz clic en "Combinar" para fusionarlas' : ' Selecciona más celdas con Ctrl+Click'}
                        </span>
                      </div>
                    )}
                    {/* Barra de herramientas de formato */}
                    <div style={{
                      display: "flex",
                      gap: isMobile ? "4px" : "6px",
                      padding: isMobile ? "6px" : "8px",
                      backgroundColor: "#f8fafc",
                      borderRadius: "6px 6px 0 0",
                      border: "1px solid #e5e7eb",
                      borderBottom: "1px solid #e5e7eb",
                      alignItems: "center",
                      overflowX: "auto",
                      WebkitOverflowScrolling: "touch",
                      flexWrap: isMobile ? "nowrap" : "wrap"
                    }}>
                      <button
                        onClick={() => document.execCommand('undo', false, null)}
                        style={{
                          padding: isMobile ? "8px 12px" : "6px 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          backgroundColor: "white",
                          cursor: "pointer",
                          fontSize: isMobile ? "18px" : "16px",
                          minWidth: isMobile ? "44px" : "auto",
                          minHeight: isMobile ? "44px" : "auto"
                        }}
                        title="Deshacer"
                      >
                        ↶
                      </button>
                      <button
                        onClick={() => document.execCommand('redo', false, null)}
                        style={{
                          padding: isMobile ? "8px 12px" : "6px 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          backgroundColor: "white",
                          cursor: "pointer",
                          fontSize: isMobile ? "18px" : "16px",
                          minWidth: isMobile ? "44px" : "auto",
                          minHeight: isMobile ? "44px" : "auto"
                        }}
                        title="Rehacer"
                      >
                        ↷
                      </button>
                      {!isMobile && <div style={{ width: "1px", backgroundColor: "#cbd5e1", height: "24px", margin: "0 2px" }}></div>}
                      <button
                        onClick={() => document.execCommand('bold', false, null)}
                        style={{
                          padding: isMobile ? "8px 12px" : "6px 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          backgroundColor: "white",
                          cursor: "pointer",
                          fontWeight: "bold",
                          fontSize: "13px"
                        }}
                        title="Negrita"
                      >
                        <strong>N</strong>
                      </button>
                      <button
                        onClick={() => document.execCommand('italic', false, null)}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          backgroundColor: "white",
                          cursor: "pointer",
                          fontStyle: "italic",
                          fontSize: "13px"
                        }}
                        title="Cursiva"
                      >
                        <em>C</em>
                      </button>
                      <button
                        onClick={() => document.execCommand('underline', false, null)}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          backgroundColor: "white",
                          cursor: "pointer",
                          textDecoration: "underline",
                          fontSize: "13px"
                        }}
                        title="Subrayado"
                      >
                        S
                      </button>
                      <div style={{ width: "1px", backgroundColor: "#cbd5e1", height: "24px", margin: "0 2px" }}></div>
                      <input
                        type="color"
                        onChange={(e) => document.execCommand('foreColor', false, e.target.value)}
                        style={{
                          width: "32px",
                          height: "28px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          cursor: "pointer"
                        }}
                        title="Color de texto"
                      />
                      <input
                        type="color"
                        onChange={(e) => document.execCommand('backColor', false, e.target.value)}
                        style={{
                          width: "32px",
                          height: "28px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          cursor: "pointer"
                        }}
                        title="Color de fondo"
                      />
                      <div style={{ width: "1px", backgroundColor: "#cbd5e1", height: "24px", margin: "0 2px" }}></div>
                      <button
                        onClick={() => {
                          if (!editorManualRef.current) {
                            alert('Editor no disponible');
                            return;
                          }
                          
                          // Usar las celdas del estado en lugar de la selección
                          if (celdasSeleccionadas.length < 2) {
                            alert('Por favor, selecciona al menos 2 celdas con Ctrl+Click');
                            return;
                          }
                          
                          // Verificar que todas las celdas están en la misma fila
                          const firstRow = celdasSeleccionadas[0].parentElement;
                          const sameRow = celdasSeleccionadas.every(cell => cell.parentElement === firstRow);
                          
                          if (!sameRow) {
                            alert('Solo puedes combinar celdas de la misma fila');
                            return;
                          }
                          
                          // Ordenar las celdas por su posición en la fila
                          const allCellsInRow = Array.from(firstRow.querySelectorAll('td, th'));
                          const sortedCells = celdasSeleccionadas.sort((a, b) => {
                            return allCellsInRow.indexOf(a) - allCellsInRow.indexOf(b);
                          });
                          
                          // Verificar que las celdas son consecutivas
                          for (let i = 1; i < sortedCells.length; i++) {
                            const prevIndex = allCellsInRow.indexOf(sortedCells[i - 1]);
                            const currIndex = allCellsInRow.indexOf(sortedCells[i]);
                            if (currIndex !== prevIndex + 1) {
                              alert('Las celdas deben ser consecutivas');
                              return;
                            }
                          }
                          
                          // Combinar contenido
                          let combinedContent = '';
                          sortedCells.forEach(cell => {
                            const text = cell.innerHTML.trim();
                            if (text && text !== '<br>') {
                              combinedContent += (combinedContent ? '<br>' : '') + text;
                            }
                          });
                          
                          if (!combinedContent) {
                            combinedContent = '<br>';
                          }
                          
                          // Aplicar colspan a la primera celda
                          const firstCell = sortedCells[0];
                          firstCell.setAttribute('colspan', sortedCells.length.toString());
                          firstCell.setAttribute('contenteditable', 'true');
                          firstCell.innerHTML = combinedContent;
                          
                          // Quitar estilo de selección
                          firstCell.classList.remove('celda-seleccionada');
                          firstCell.style.backgroundColor = '';
                          firstCell.style.boxShadow = '';
                          
                          // Eliminar las demás celdas
                          for (let i = 1; i < sortedCells.length; i++) {
                            sortedCells[i].remove();
                          }
                          
                          // Actualizar el estado
                          setContenidoManual(editorManualRef.current.innerHTML);
                          const storageKey = `menu_manual_draft_${uid}`;
                          localStorage.setItem(storageKey, editorManualRef.current.innerHTML);
                          
                          // Limpiar selección
                          setCeldasSeleccionadas([]);
                        }}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          backgroundColor: celdasSeleccionadas.length >= 2 ? "#3b82f6" : "white",
                          color: celdasSeleccionadas.length >= 2 ? "white" : "#374151",
                          cursor: "pointer",
                          fontSize: "12px",
                          whiteSpace: "nowrap",
                          fontWeight: celdasSeleccionadas.length >= 2 ? "600" : "normal",
                          transition: "all 0.2s"
                        }}
                        title={`Combinar celdas seleccionadas (${celdasSeleccionadas.length} seleccionadas)`}
                      >
                        🔗 Combinar {celdasSeleccionadas.length >= 2 && `(${celdasSeleccionadas.length})`}
                      </button>
                      <button
                        onClick={(e) => {
                          // Buscar la celda que está actualmente en foco o seleccionada
                          let cell = null;
                          
                          // Intentar obtener desde la selección
                          const selection = window.getSelection();
                          if (selection && selection.rangeCount > 0) {
                            const range = selection.getRangeAt(0);
                            let currentElement = range.startContainer;
                            
                            // Buscar la celda más cercana
                            if (currentElement.nodeType === Node.TEXT_NODE) {
                              currentElement = currentElement.parentElement;
                            }
                            
                            cell = currentElement?.closest('td, th');
                          }
                          
                          // Si no hay selección, buscar la última celda clickeada en el editor
                          if (!cell && editorManualRef.current) {
                            // Obtener todas las celdas con colspan o rowspan
                            const table = editorManualRef.current.querySelector('table');
                            if (table) {
                              const allCells = table.querySelectorAll('td[colspan], td[rowspan], th[colspan], th[rowspan]');
                              if (allCells.length === 1) {
                                // Si solo hay una celda combinada, usar esa
                                cell = allCells[0];
                              } else if (allCells.length > 1) {
                                alert('Hay varias celdas combinadas. Por favor, haz clic primero dentro de la celda que deseas separar y luego presiona el botón Descombinar.');
                                return;
                              }
                            }
                          }
                          
                          if (!cell) {
                            alert('Por favor, haz clic primero dentro de una celda de la tabla y luego presiona Descombinar');
                            return;
                          }
                          
                          // Verificar si la celda tiene colspan o rowspan
                          const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
                          const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
                          
                          if (colspan === 1 && rowspan === 1) {
                            alert('Esta celda no está combinada');
                            return;
                          }
                          
                          // Obtener el contenido actual
                          const currentContent = cell.innerHTML;
                          
                          // Si tiene colspan, añadir las celdas que faltan en la misma fila
                          if (colspan > 1) {
                            const row = cell.parentElement;
                            
                            // Eliminar el atributo colspan
                            cell.removeAttribute('colspan');
                            
                            // Añadir las celdas faltantes después de la celda actual
                            for (let i = 1; i < colspan; i++) {
                              const newCell = document.createElement('td');
                              newCell.innerHTML = '<br>';
                              newCell.setAttribute('contenteditable', 'true');
                              
                              // Copiar estilos básicos si no es la primera columna
                              const isFirstColumn = Array.from(row.children).indexOf(cell) === 0;
                              if (!isFirstColumn) {
                                newCell.style.minHeight = '80px';
                              }
                              
                              // Insertar después de la celda actual
                              if (cell.nextSibling) {
                                row.insertBefore(newCell, cell.nextSibling);
                              } else {
                                row.appendChild(newCell);
                              }
                            }
                          }
                          
                          // Si tiene rowspan, añadir las celdas que faltan en las filas siguientes
                          if (rowspan > 1) {
                            const table = cell.closest('table');
                            const tbody = table.querySelector('tbody');
                            const currentRow = cell.parentElement;
                            const allRows = Array.from(tbody.querySelectorAll('tr'));
                            const currentRowIndex = allRows.indexOf(currentRow);
                            const cellIndex = Array.from(currentRow.children).indexOf(cell);
                            
                            // Eliminar el atributo rowspan
                            cell.removeAttribute('rowspan');
                            
                            // Añadir celdas en las filas siguientes
                            for (let i = 1; i < rowspan; i++) {
                              const targetRow = allRows[currentRowIndex + i];
                              if (targetRow) {
                                const newCell = document.createElement('td');
                                newCell.innerHTML = '<br>';
                                newCell.setAttribute('contenteditable', 'true');
                                newCell.style.minHeight = '80px';
                                
                                // Insertar en la posición correcta
                                if (cellIndex < targetRow.children.length) {
                                  targetRow.insertBefore(newCell, targetRow.children[cellIndex]);
                                } else {
                                  targetRow.appendChild(newCell);
                                }
                              }
                            }
                          }
                          
                          // Actualizar el contenido en el estado
                          if (editorManualRef.current) {
                            setContenidoManual(editorManualRef.current.innerHTML);
                            const storageKey = `menu_manual_draft_${uid}`;
                            localStorage.setItem(storageKey, editorManualRef.current.innerHTML);
                          }
                        }}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          backgroundColor: "white",
                          cursor: "pointer",
                          fontSize: "12px",
                          whiteSpace: "nowrap",
                          marginLeft: "4px"
                        }}
                        title="Separar celda combinada"
                      >
                        ⛓️‍💥 Descombinar
                      </button>
                      {celdasSeleccionadas.length > 0 && (
                        <button
                          onClick={() => {
                            // Limpiar estilos de todas las celdas seleccionadas
                            celdasSeleccionadas.forEach(cell => {
                              cell.classList.remove('celda-seleccionada');
                              cell.style.backgroundColor = '';
                              cell.style.boxShadow = '';
                            });
                            setCeldasSeleccionadas([]);
                          }}
                          style={{
                            padding: "6px 10px",
                            border: "1px solid #ef4444",
                            borderRadius: "4px",
                            backgroundColor: "white",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                            marginLeft: "4px",
                            fontWeight: "600"
                          }}
                          title="Limpiar selección"
                        >
                          ✖ Limpiar ({celdasSeleccionadas.length})
                        </button>
                      )}
                    </div>
                    
                    {/* Panel de control de comidas activas */}
                    <div style={{
                      padding: isMobile ? "4px 2px" : "8px 12px",
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "6px",
                      marginBottom: "12px",
                      marginTop: "12px",
                      overflow: isMobile ? "visible" : "auto"
                    }}>
                      <div style={{ 
                        fontSize: isMobile ? "10px" : "12px", 
                        fontWeight: "600", 
                        color: "#166534",
                        marginBottom: isMobile ? "2px" : "4px"
                      }}>
                        ✓ Comidas:
                      </div>
                      <div style={{ 
                        display: isMobile ? "grid" : "flex",
                        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : undefined,
                        flexWrap: isMobile ? undefined : "wrap",
                        gap: isMobile ? "3px 6px" : "8px",
                        justifyContent: "flex-start",
                        width: "100%"
                      }}>
                        {[
                          { key: 'desayuno', label: '🌅 Desayuno' },
                          { key: 'almuerzo', label: '🥪 Almuerzo' },
                          { key: 'comida', label: '🍽️ Comida' },
                          { key: 'merienda', label: '🍎 Merienda' },
                          { key: 'cena', label: '🌙 Cena' },
                          { key: 'tips', label: '💡 Tips' }
                        ].map(({ key, label }) => (
                          <label
                            key={key}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              gap: isMobile ? "2px" : "3px",
                              cursor: "pointer",
                              padding: "0",
                              backgroundColor: "transparent",
                              border: "none",
                              transition: "all 0.2s",
                              fontSize: isMobile ? "10px" : "11px",
                              fontWeight: "500",
                              color: comidasActivas[key] ? "#166534" : "#991b1b",
                              whiteSpace: "nowrap"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={comidasActivas[key]}
                              onChange={(e) => {
                                const newValue = e.target.checked;
                                setComidasActivas(prev => ({ ...prev, [key]: newValue }));
                                
                                // Actualizar el editor para reflejar el cambio
                                if (editorManualRef.current) {
                                  const table = editorManualRef.current.querySelector('table');
                                  if (table) {
                                    const tbody = table.querySelector('tbody');
                                    if (tbody) {
                                      const rows = tbody.querySelectorAll('tr');
                                      rows.forEach(row => {
                                        const firstCell = row.querySelector('td:first-child');
                                        if (firstCell) {
                                          const cellText = firstCell.textContent.trim().toUpperCase();
                                          if (cellText === key.toUpperCase()) {
                                            // Actualizar todas las celdas de esta fila
                                            const cells = row.querySelectorAll('td:not(:first-child)');
                                            cells.forEach(cell => {
                                              if (newValue) {
                                                cell.setAttribute('contenteditable', 'true');
                                                cell.style.backgroundColor = '';
                                                cell.style.opacity = '1';
                                                cell.style.cursor = 'text';
                                              } else {
                                                cell.setAttribute('contenteditable', 'false');
                                                cell.style.backgroundColor = '#f1f5f9';
                                                cell.style.opacity = '0.6';
                                                cell.style.cursor = 'not-allowed';
                                              }
                                            });
                                          }
                                        }
                                      });
                                    }
                                  }
                                }
                              }}
                              style={{
                                width: isMobile ? "12px" : "14px",
                                height: isMobile ? "12px" : "14px",
                                cursor: "pointer",
                                flexShrink: 0,
                                margin: "0"
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                      <div style={{ 
                        fontSize: isMobile ? "10px" : "10px", 
                        color: "#059669",
                        marginTop: "4px",
                        fontStyle: "italic",
                        paddingLeft: isMobile ? "2px" : "0"
                      }}>
                        💡 Desactiva las comidas que el paciente no necesite.
                      </div>
                    </div>
                    
                    <div 
                      ref={setEditorManualRef}
                      suppressContentEditableWarning
                      onInput={(e) => {
                        // Guardar con debounce en cada pulsación (incluido Enter → <br>)
                        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                        debounceTimerRef.current = setTimeout(() => {
                          if (editorManualRef.current) {
                            const html = editorManualRef.current.innerHTML;
                            setContenidoManual(html);
                            try {
                              const storageKey = `menu_manual_draft_${uid}`;
                              localStorage.setItem(storageKey, html);
                            } catch (_) {}
                          }
                        }, 600);
                      }}
                      onBlur={(e) => {
                        // Guardar inmediatamente al perder el foco
                        if (debounceTimerRef.current) { clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; }
                        if (editorManualRef.current) {
                          const html = editorManualRef.current.innerHTML;
                          setContenidoManual(html);
                          try {
                            const storageKey = `menu_manual_draft_${uid}`;
                            localStorage.setItem(storageKey, html);
                          } catch (_) {}
                        }
                      }}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: isMobile ? "8px" : "16px",
                        minHeight: isMobile ? "300px" : "400px",
                        backgroundColor: "white",
                        overflowX: "auto",
                        WebkitOverflowScrolling: "touch"
                      }}
                    />
                    
                    <div style={{ 
                      marginTop: "12px", 
                      fontSize: isMobile ? "14px" : "13px", 
                      color: "#64748b", 
                      padding: "12px", 
                      backgroundColor: "#f8fafc", 
                      borderRadius: "6px", 
                      border: "1px solid #e2e8f0" 
                    }}>
                      💡 <strong>Instrucciones:</strong> {isMobile ? "Toca" : "Haz clic en"} cualquier celda para editar el contenido.<br/>
                      🔗 <strong>Para combinar celdas:</strong> Mantén presionada la tecla Ctrl (o Cmd en Mac) y haz clic en las celdas que deseas combinar. Luego presiona el botón "🔗 Combinar".
                    </div>
                      </>
                    </div>
                  )
                ) : adminMode && tipoMenu === "tabla" ? (
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
                ) : adminMode && tipoMenu === "vertical" ? (
                  /* Vista ADMIN: Formato vertical con múltiples opciones */
                  <div style={{ maxWidth: "900px", margin: "0 auto" }}>
                    {loadingMenuItems ? (
                      <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                        Cargando opciones de menú...
                      </div>
                    ) : (
                      <>
                        {["desayuno", "almuerzo", "comida", "merienda", "cena", "consejos"].map((seccion) => {
                          const labels = {
                            desayuno: "🌅 Desayuno",
                            almuerzo: "☕ Almuerzo",
                            comida: "🍽️ Comida",
                            merienda: "🥤 Merienda",
                            cena: "🌙 Cena",
                            consejos: "💡 Consejos"
                          };
                          
                          const itemsDisponibles = menuItemsDisponibles[seccion] || [];
                          // Asegurar que itemsSeleccionados siempre sea un array
                          const rawSeleccionados = menuVertical[seccion] || [];
                          const itemsSeleccionados = Array.isArray(rawSeleccionados) ? rawSeleccionados : [];
                          
                          const isCollapsed = seccionesColapsadas[seccion];
                          
                          return (
                            <div key={seccion} style={{ marginBottom: "24px", padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                              <div 
                                onClick={() => setSeccionesColapsadas(prev => ({ ...prev, [seccion]: !prev[seccion] }))}
                                style={{ 
                                  display: "flex", 
                                  alignItems: "center", 
                                  justifyContent: "space-between",
                                  cursor: "pointer",
                                  marginBottom: isCollapsed ? "0" : "12px",
                                  gap: "12px"
                                }}
                              >
                                <h4 style={{ margin: "0", fontSize: "15px", fontWeight: "600", color: "#0f172a", flex: "0 0 auto" }}>
                                  {labels[seccion]}
                                </h4>
                                {seccion !== "consejos" && (
                                  <textarea
                                    value={menuVertical[`${seccion}_notas`] || ''}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setMenuVertical(prev => ({ ...prev, [`${seccion}_notas`]: e.target.value }));
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder={`Notas para ${labels[seccion].replace(/[🌅☕🍽️🥤🌙💡]\s/, '')}...`}
                                    rows={1}
                                    style={{
                                      flex: 1,
                                      padding: "8px 12px",
                                      border: "1px solid #d1d5db",
                                      borderRadius: "6px",
                                      fontSize: "14px",
                                      fontFamily: "inherit",
                                      resize: "vertical",
                                      minHeight: "38px",
                                      backgroundColor: "#fff"
                                    }}
                                  />
                                )}
                                <span style={{ fontSize: "18px", color: "#6b7280", transition: "transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", flex: "0 0 auto" }}>
                                  ▼
                                </span>
                              </div>
                              
                              {!isCollapsed && (
                                <>
                                  {seccion === "consejos" ? (
                                    <textarea
                                      value={typeof itemsSeleccionados === 'string' ? itemsSeleccionados : (itemsSeleccionados[0] || '')}
                                      onChange={(e) => setMenuVertical(prev => ({ ...prev, [seccion]: e.target.value }))}
                                      placeholder="Escribe aquí los consejos del día..."
                                      rows={4}
                                      style={{
                                        width: "100%",
                                        padding: "12px",
                                        border: "1px solid #d1d5db",
                                        borderRadius: "6px",
                                        fontSize: "14px",
                                        fontFamily: "inherit",
                                        resize: "vertical",
                                        minHeight: "100px"
                                      }}
                                    />
                                  ) : itemsDisponibles.length === 0 ? (
                                <div style={{ padding: "12px", color: "#6b7280", fontSize: "13px", backgroundColor: "#fff", borderRadius: "6px" }}>
                                  No hay opciones disponibles. Añade items en la sección de Menús.
                                </div>
                              ) : (
                                <>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "8px", marginBottom: "12px" }}>
                                    {itemsDisponibles.map((item) => {
                                      const isSelected = itemsSeleccionados.includes(item.id);
                                      
                                      return (
                                        <div
                                          key={item.id}
                                          onClick={() => {
                                            const nuevosSeleccionados = isSelected
                                              ? itemsSeleccionados.filter(id => id !== item.id)
                                              : [...itemsSeleccionados, item.id];
                                            
                                            console.log(`Div clicked - Sección: ${seccion}, Item: ${item.nombre}, Nueva selección:`, nuevosSeleccionados);
                                            setMenuVertical(prev => {
                                              const updated = { ...prev, [seccion]: nuevosSeleccionados };
                                              console.log(`Estado menuVertical actualizado:`, updated);
                                              return updated;
                                            });
                                          }}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            padding: "10px 12px",
                                            backgroundColor: isSelected ? "#dbeafe" : "#fff",
                                            border: isSelected ? "2px solid #3b82f6" : "1px solid #d1d5db",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                            fontSize: "14px",
                                            transition: "all 0.2s"
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            readOnly
                                            style={{ width: "16px", height: "16px", cursor: "pointer", pointerEvents: "none" }}
                                          />
                                          <span style={{ flex: 1, color: "#374151" }}>{item.nombre}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                                </>
                              )}
                            </div>
                          );
                        })}
                        
                        {/* Botón guardar menú vertical */}
                        <button
                          onClick={async () => {
                            try {
                              console.log("Guardando menú vertical:", menuVertical);
                              await updateDoc(doc(db, "users", uid), {
                                menuVertical: menuVertical,
                                updatedAt: serverTimestamp()
                              });
                              console.log("Menú guardado exitosamente");
                              alert("✅ Menú guardado correctamente");
                            } catch (err) {
                              console.error("Error guardando menú vertical:", err);
                              alert("❌ Error al guardar el menú");
                            }
                          }}
                          style={{
                            width: "100%",
                            padding: "12px",
                            backgroundColor: "#3b82f6",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "15px",
                            fontWeight: "600",
                            boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)"
                          }}
                        >
                          💾 Guardar menú
                        </button>
                        
                        {/* Botón Imprimir */}
                        <button
                          onClick={() => {
                            const printWindow = window.open('', '_blank');
                            const today = new Date();
                            const fechaStr = today.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
                            const nombreCompleto = `${userData?.nombre || ''} ${userData?.apellidos || ''}`.trim() || 'Cliente';
                            
                            const menuContent = ["desayuno", "almuerzo", "comida", "merienda", "cena", "consejos"]
                              .map((seccion) => {
                                const labels = {
                                  desayuno: "🌅 Desayuno",
                                  almuerzo: "☕ Almuerzo",
                                  comida: "🍽️ Comida",
                                  merienda: "🥤 Merienda",
                                  cena: "🌙 Cena",
                                  consejos: "💡 Consejos"
                                };
                                
                                const itemIds = menuVertical[seccion] || [];
                                const itemsDisponibles = menuItemsDisponibles[seccion] || [];
                                const itemsSeleccionados = itemIds
                                  .map(id => itemsDisponibles.find(item => item.id === id))
                                  .filter(item => item);
                                
                                if (itemsSeleccionados.length === 0) return '';
                                
                                const itemsHTML = itemsSeleccionados
                                  .map(item => `<li style="margin-bottom: 6px; font-size: 14px; color: #374151;">${item.nombre}</li>`)
                                  .join('');
                                
                                return `
                                  <div style="margin-bottom: 24px; page-break-inside: avoid;">
                                    <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 6px;">
                                      ${labels[seccion]}
                                    </h4>
                                    <ul style="margin: 0; padding-left: 24px; list-style: disc; line-height: 1.8;">
                                      ${itemsHTML}
                                    </ul>
                                  </div>
                                `;
                              })
                              .filter(html => html)
                              .join('');
                            
                            printWindow.document.write(`
                              <!DOCTYPE html>
                              <html>
                                <head>
                                  <meta charset="utf-8">
                                  <title>Menú - ${nombreCompleto}</title>
                                  <style>
                                    @page { margin: 2cm; }
                                    body { 
                                      font-family: Arial, sans-serif; 
                                      margin: 0; 
                                      padding: 20px;
                                      background: white;
                                    }
                                    .header {
                                      display: flex;
                                      justify-content: space-between;
                                      align-items: center;
                                      margin-bottom: 30px;
                                      padding-bottom: 20px;
                                      border-bottom: 3px solid #3b82f6;
                                    }
                                    .logo {
                                      max-width: 150px;
                                      height: auto;
                                    }
                                    .info {
                                      text-align: right;
                                    }
                                    .nombre {
                                      font-size: 20px;
                                      font-weight: 700;
                                      color: #1f2937;
                                      margin: 0 0 8px 0;
                                    }
                                    .fecha {
                                      font-size: 14px;
                                      color: #6b7280;
                                      margin: 0;
                                    }
                                    @media print {
                                      body { padding: 0; }
                                    }
                                  </style>
                                </head>
                                <body>
                                  <div class="header">
                                    <img src="/logoclinica-192.png" alt="Logo" class="logo" />
                                    <div class="info">
                                      <p class="nombre">${nombreCompleto}</p>
                                      <p class="fecha">${fechaStr}</p>
                                    </div>
                                  </div>
                                  ${menuContent}
                                </body>
                              </html>
                            `);
                            printWindow.document.close();
                            printWindow.focus();
                            setTimeout(() => {
                              printWindow.print();
                            }, 250);
                          }}
                          style={{
                            width: "100%",
                            padding: "12px",
                            backgroundColor: "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "15px",
                            fontWeight: "600",
                            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                            marginTop: "12px"
                          }}
                        >
                          🖨️ Imprimir menú
                        </button>
                        
                        {/* Vista previa formato A4 */}
                        <div style={{ marginTop: "32px", padding: "24px", backgroundColor: "#fff", borderRadius: "8px", border: "2px solid #e5e7eb" }}>
                          <h3 style={{ margin: "0 0 20px 0", fontSize: "16px", fontWeight: "600", color: "#0f172a", textAlign: "center" }}>
                            📄 Vista Previa del Menú
                          </h3>
                          
                          <div style={{ 
                            backgroundColor: "#fff",
                            width: "100%",
                            maxWidth: "794px",
                            margin: "0 auto",
                            padding: "40px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            minHeight: "400px",
                            fontFamily: "Arial, sans-serif"
                          }}>
                            {["desayuno", "almuerzo", "comida", "merienda", "cena", "consejos"].map((seccion) => {
                              const labels = {
                                desayuno: "🌅 Desayuno",
                                almuerzo: "☕ Almuerzo",
                                comida: "🍽️ Comida",
                                merienda: "🥤 Merienda",
                                cena: "🌙 Cena",
                                consejos: "💡 Consejos"
                              };
                              
                              const itemIds = menuVertical[seccion] || [];
                              
                              // Para consejos, puede ser un string de texto libre
                              if (seccion === "consejos") {
                                const consejosText = typeof itemIds === 'string' ? itemIds : (itemIds[0] || '');
                                if (!consejosText.trim()) return null;
                                
                                return (
                                  <div key={seccion} style={{ marginBottom: "24px", pageBreakInside: "avoid" }}>
                                    <h4 style={{ 
                                      margin: "0 0 12px 0", 
                                      fontSize: "16px", 
                                      fontWeight: "700", 
                                      color: "#1f2937",
                                      borderBottom: "2px solid #3b82f6",
                                      paddingBottom: "6px"
                                    }}>
                                      {labels[seccion]}
                                    </h4>
                                    <p style={{ 
                                      margin: "0", 
                                      fontSize: "14px", 
                                      color: "#374151",
                                      lineHeight: "1.8",
                                      whiteSpace: "pre-wrap"
                                    }}>
                                      {consejosText}
                                    </p>
                                  </div>
                                );
                              }
                              
                              // Para otras secciones, son IDs de items
                              const itemsDisponibles = menuItemsDisponibles[seccion] || [];
                              const itemsSeleccionados = itemIds
                                .map(id => itemsDisponibles.find(item => item.id === id))
                                .filter(item => item);
                              
                              if (itemsSeleccionados.length === 0) return null;
                              
                              return (
                                <div key={seccion} style={{ marginBottom: "24px", pageBreakInside: "avoid" }}>
                                  <h4 style={{ 
                                    margin: "0 0 12px 0", 
                                    fontSize: "16px", 
                                    fontWeight: "700", 
                                    color: "#1f2937",
                                    borderBottom: "2px solid #3b82f6",
                                    paddingBottom: "6px"
                                  }}>
                                    {labels[seccion]}
                                  </h4>
                                  <ul style={{ 
                                    margin: "0", 
                                    paddingLeft: "24px", 
                                    listStyle: "disc",
                                    lineHeight: "1.8"
                                  }}>
                                    {itemsSeleccionados.map((item) => (
                                      <li key={item.id} style={{ 
                                        marginBottom: "6px", 
                                        fontSize: "14px", 
                                        color: "#374151" 
                                      }}>
                                        {item.nombre}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : !adminMode && tipoMenu === "vertical" ? (
                  /* Vista USUARIO: Ver opciones múltiples */
                  <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                    {loadingMenuItems ? (
                      <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                        Cargando tu menú...
                      </div>
                    ) : (
                      <>
                        {["desayuno", "almuerzo", "comida", "merienda", "cena", "consejos"].map((seccion) => {
                          const labels = {
                            desayuno: "🌅 Desayuno",
                            almuerzo: "☕ Almuerzo",
                            comida: "🍽️ Comida",
                            merienda: "🥤 Merienda",
                            cena: "🌙 Cena",
                            consejos: "💡 Consejos"
                          };
                          
                          // Verificar si esta comida está activa (excepto consejos que siempre se muestra si tiene contenido)
                          const userComidasActivas = userData?.comidasActivas || {
                            desayuno: true,
                            almuerzo: true,
                            comida: true,
                            merienda: true,
                            cena: true,
                            tips: true
                          };
                          
                          // Mapear "consejos" a "tips" para la verificación
                          const keyToCheck = seccion === "consejos" ? "tips" : seccion;
                          if (userComidasActivas[keyToCheck] === false) {
                            // No mostrar esta comida si está desactivada
                            return null;
                          }
                          
                          const itemIds = userData?.menuVertical?.[seccion] || [];
                          
                          // Para consejos, puede ser texto libre
                          if (seccion === "consejos") {
                            const consejosText = typeof itemIds === 'string' ? itemIds : (itemIds[0] || '');
                            if (!consejosText || !consejosText.trim()) return null;
                            
                            const isCollapsed = seccionesColapsadas[seccion];
                            
                            return (
                              <div key={seccion} style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                                <div 
                                  onClick={() => setSeccionesColapsadas(prev => ({ ...prev, [seccion]: !prev[seccion] }))}
                                  style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    justifyContent: "space-between",
                                    cursor: "pointer",
                                    marginBottom: isCollapsed ? "0" : "12px"
                                  }}
                                >
                                  <h4 style={{ margin: "0", fontSize: "15px", fontWeight: "600", color: "#15803d" }}>
                                    {labels[seccion]}
                                  </h4>
                                  <span style={{ fontSize: "18px", color: "#15803d", transition: "transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
                                    ▼
                                  </span>
                                </div>
                                {!isCollapsed && (
                                  <p style={{ margin: "0", fontSize: "14px", color: "#374151", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                                    {consejosText}
                                  </p>
                                )}
                              </div>
                            );
                          }
                          
                          // Para otras secciones, son IDs de items
                          const filteredIds = Array.isArray(itemIds) ? itemIds.filter(id => id) : [];
                          if (filteredIds.length === 0) return null;
                          
                          // Obtener nombres de los items desde menuItemsDisponibles
                          const itemsDisponibles = menuItemsDisponibles[seccion] || [];
                          const itemsSeleccionados = filteredIds
                            .map(id => itemsDisponibles.find(item => item.id === id))
                            .filter(item => item);
                          
                          if (itemsSeleccionados.length === 0) return null;
                          
                          const isCollapsed = seccionesColapsadas[seccion];
                          
                          return (
                            <div key={seccion} style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                              <div 
                                onClick={() => setSeccionesColapsadas(prev => ({ ...prev, [seccion]: !prev[seccion] }))}
                                style={{ 
                                  display: "flex", 
                                  alignItems: "center", 
                                  justifyContent: "space-between",
                                  cursor: "pointer",
                                  marginBottom: isCollapsed ? "0" : "12px"
                                }}
                              >
                                <h4 style={{ margin: "0", fontSize: "15px", fontWeight: "600", color: "#15803d" }}>
                                  {labels[seccion]}
                                </h4>
                                <span style={{ fontSize: "18px", color: "#15803d", transition: "transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
                                  ▼
                                </span>
                              </div>
                              {!isCollapsed && (
                                <>
                                  <ul style={{ margin: "0 0 12px 0", paddingLeft: "20px", listStyle: "disc" }}>
                                    {itemsSeleccionados.map((item) => (
                                      <li key={item.id} style={{ marginBottom: "6px", fontSize: "14px", color: "#374151" }}>
                                        {item.nombre}
                                      </li>
                                    ))}
                                  </ul>
                                  {userData?.menuVertical?.[`${seccion}_notas`] && (
                                    <div style={{ 
                                      padding: "12px", 
                                      backgroundColor: "#fff", 
                                      borderRadius: "6px", 
                                      border: "1px solid #bbf7d0",
                                      fontSize: "14px",
                                      color: "#374151",
                                      lineHeight: "1.6",
                                      whiteSpace: "pre-wrap"
                                    }}>
                                      <strong style={{ color: "#15803d" }}>Notas:</strong><br />
                                      {userData.menuVertical[`${seccion}_notas`]}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                        
                        {/* Vista previa formato A4para usuario */}
                        <div style={{ marginTop: "32px", padding: "24px", backgroundColor: "#fff", borderRadius: "8px", border: "2px solid #e5e7eb" }}>
                          <h3 style={{ margin: "0 0 20px 0", fontSize: "16px", fontWeight: "600", color: "#0f172a", textAlign: "center" }}>
                            📄 Vista Previa del Menú
                          </h3>
                          
                          <div style={{ 
                            backgroundColor: "#fff",
                            width: "100%",
                            maxWidth: "794px",
                            margin: "0 auto",
                            padding: "40px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            minHeight: "400px",
                            fontFamily: "Arial, sans-serif"
                          }}>
                            {["desayuno", "almuerzo", "comida", "merienda", "cena", "consejos"].map((seccion) => {
                              const labels = {
                                desayuno: "🌅 Desayuno",
                                almuerzo: "☕ Almuerzo",
                                comida: "🍽️ Comida",
                                merienda: "🥤 Merienda",
                                cena: "🌙 Cena",
                                consejos: "💡 Consejos"
                              };
                              
                              const itemIds = userData?.menuVertical?.[seccion] || [];
                              
                              // Para consejos, puede ser texto libre
                              if (seccion === "consejos") {
                                const consejosText = typeof itemIds === 'string' ? itemIds : (itemIds[0] || '');
                                if (!consejosText || !consejosText.trim()) return null;
                                
                                return (
                                  <div key={seccion} style={{ marginBottom: "24px", pageBreakInside: "avoid" }}>
                                    <h4 style={{ 
                                      margin: "0 0 12px 0", 
                                      fontSize: "16px", 
                                      fontWeight: "700", 
                                      color: "#1f2937",
                                      borderBottom: "2px solid #3b82f6",
                                      paddingBottom: "6px"
                                    }}>
                                      {labels[seccion]}
                                    </h4>
                                    <p style={{ 
                                      margin: "0", 
                                      fontSize: "14px", 
                                      color: "#374151",
                                      lineHeight: "1.8",
                                      whiteSpace: "pre-wrap"
                                    }}>
                                      {consejosText}
                                    </p>
                                  </div>
                                );
                              }
                              
                              // Para otras secciones, son IDs
                              const filteredIds = Array.isArray(itemIds) ? itemIds.filter(id => id) : [];
                              const itemsDisponibles = menuItemsDisponibles[seccion] || [];
                              const itemsSeleccionados = filteredIds
                                .map(id => itemsDisponibles.find(item => item.id === id))
                                .filter(item => item);
                              
                              if (itemsSeleccionados.length === 0) return null;
                              
                              return (
                                <div key={seccion} style={{ marginBottom: "24px", pageBreakInside: "avoid" }}>
                                  <h4 style={{ 
                                    margin: "0 0 12px 0", 
                                    fontSize: "16px", 
                                    fontWeight: "700", 
                                    color: "#1f2937",
                                    borderBottom: "2px solid #3b82f6",
                                    paddingBottom: "6px"
                                  }}>
                                    {labels[seccion]}
                                  </h4>
                                  <ul style={{ 
                                    margin: "0", 
                                    paddingLeft: "24px", 
                                    listStyle: "disc",
                                    lineHeight: "1.8"
                                  }}>
                                    {itemsSeleccionados.map((item) => (
                                      <li key={item.id} style={{ 
                                        marginBottom: "6px", 
                                        fontSize: "14px", 
                                        color: "#374151" 
                                      }}>
                                        {item.nombre}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : modoManual && userData?.contenidoManual ? (
                  /* Vista USUARIO: Modo Manual - Extraer contenido día por día de la tabla HTML */
                  <>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      marginBottom: "10px",
                      gap: "8px"
                    }}>
                      {/* Navegación de días */}
                      <button 
                        className="btn ghost" 
                        onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.max(0, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) - 1) }))}
                        style={{ padding: "6px 10px", minHeight: "32px", fontSize: "16px" }}
                      >←</button>
                      
                      <div style={{ 
                        fontWeight: "700", 
                        color: "#16a34a",
                        fontSize: "14px",
                        textAlign: "center",
                        flex: "0 0 auto"
                      }}>{dayName}</div>
                      
                      <button 
                        className="btn ghost" 
                        onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.min(6, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) + 1) }))}
                        style={{ padding: "6px 10px", minHeight: "32px", fontSize: "16px" }}
                      >→</button>

                      {/* Botones de acción */}
                      <button
                        onClick={openFotosModal}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "16px",
                          backgroundColor: "#3b82f6",
                          color: "white",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "18px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
                          width: "40px",
                          height: "32px",
                          flex: "0 0 auto"
                        }}
                        title="Ver Fotos de Alimentos"
                      >
                        📸
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowSnacksModal(true);
                          loadSnacks();
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "16px",
                          backgroundColor: "#fb923c",
                          color: "white",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "18px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(251, 146, 60, 0.3)",
                          width: "40px",
                          height: "32px",
                          flex: "0 0 auto"
                        }}
                        title="Ver SNACK's disponibles"
                      >
                        🍎
                      </button>
                      
                      {userData?.anamnesis?.preferenciaPlan === "Menú completo (Con recetas)" && (
                        <button
                          onClick={() => {
                            setShowRecetasModal(true);
                            loadRecetas();
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "16px",
                            backgroundColor: "#f59e0b",
                            color: "white",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "18px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
                            width: "40px",
                            height: "32px",
                            flex: "0 0 auto"
                          }}
                          title="Ver Recetas disponibles"
                        >
                          👨‍🍳
                        </button>
                      )}
                      
                      <button
                        onClick={() => setShowSolicitudDieta(true)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "16px",
                          backgroundColor: "#16a34a",
                          color: "white",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "18px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(22, 163, 74, 0.3)",
                          width: "40px",
                          height: "32px",
                          flex: "0 0 auto"
                        }}
                        title="Solicitar cambios en tu dieta"
                      >
                        💬
                      </button>
                    </div>

                    {/* Contenido del día desde la tabla HTML */}
                    <div style={{ 
                      backgroundColor: "white",
                      borderRadius: "12px",
                      padding: "20px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                    }}>
                      {(() => {
                        // Parsear el HTML y extraer el contenido del día actual
                        try {
                          const parser = new DOMParser();
                          const doc = parser.parseFromString(userData.contenidoManual, 'text/html');
                          const table = doc.querySelector('table');
                          
                          if (!table) {
                            return <div style={{ padding: "20px", color: "#6b7280", textAlign: "center" }}>No hay menú disponible</div>;
                          }

                          const rows = table.querySelectorAll('tbody tr');
                          const mealNames = ['DESAYUNO', 'ALMUERZO', 'COMIDA', 'MERIENDA', 'CENA', 'TIPS'];
                          const mealKeys = ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena', 'tips'];
                          const mealIcons = ['🌅', '☕', '🍽️', '🥤', '🌙', '💡'];
                          
                          // Obtener el estado de comidas activas del usuario
                          const userComidasActivas = userData.comidasActivas || {
                            desayuno: true,
                            almuerzo: true,
                            comida: true,
                            merienda: true,
                            cena: true,
                            tips: true
                          };
                          
                          return (
                            <div className="weekly-menu-grid">
                              {Array.from(rows).map((row, rowIndex) => {
                                const cells = Array.from(row.querySelectorAll('td'));
                                
                                // Verificar si esta comida está activa
                                const mealKey = mealKeys[rowIndex];
                                if (mealKey && userComidasActivas[mealKey] === false) {
                                  return null;
                                }
                                
                                // Buscar la celda que corresponde al día seleccionado considerando colspan
                                // La primera celda (índice 0) es el nombre de la comida
                                // Las celdas 1-7 son los días Lunes-Domingo
                                let dayCell = null;
                                let cellPosition = 0; // Posición lógica (0 = nombre, 1-7 = días)
                                
                                for (let i = 0; i < cells.length; i++) {
                                  const cell = cells[i];
                                  const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
                                  
                                  // Si la posición lógica actual + colspan abarca el día seleccionado
                                  if (cellPosition <= selDay + 1 && cellPosition + colspan > selDay + 1) {
                                    dayCell = cell;
                                    break;
                                  }
                                  
                                  cellPosition += colspan;
                                }
                                
                                if (!dayCell) return null;
                                
                                const content = dayCell.innerHTML || dayCell.textContent || '';
                                if (!content.trim() || content.trim() === '<br>') return null;
                                
                                return (
                                  <div key={rowIndex} className="weekly-field" style={{ marginBottom: "16px" }}>
                                    <label style={{ 
                                      display: "flex", 
                                      alignItems: "center", 
                                      gap: "6px",
                                      fontSize: "15px",
                                      fontWeight: "600",
                                      color: "#0f172a",
                                      marginBottom: "8px"
                                    }}>
                                      <span>{mealIcons[rowIndex] || '🍴'}</span>
                                      {mealNames[rowIndex] || `Comida ${rowIndex + 1}`}
                                    </label>
                                    <div 
                                      style={{
                                        padding: "12px",
                                        backgroundColor: "#f8fafc",
                                        borderRadius: "8px",
                                        border: "1px solid #e2e8f0",
                                        fontSize: "14px",
                                        lineHeight: "1.6",
                                        color: "#374151",
                                        whiteSpace: "pre-wrap",
                                        minHeight: "60px"
                                      }}
                                      dangerouslySetInnerHTML={{ __html: content }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          );
                        } catch (err) {
                          console.error("Error parseando contenido manual:", err);
                          return <div style={{ padding: "20px", color: "#ef4444", textAlign: "center" }}>Error al cargar el menú</div>;
                        }
                      })()}
                    </div>

                    <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn ghost" onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.max(0, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) - 1) }))}>Día anterior</button>
                        <button className="btn ghost" onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.min(6, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) + 1) }))}>Siguiente día</button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Vista USUARIO: Navegación día por día (formato tabla) */
                  <>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      marginBottom: "10px",
                      gap: "8px"
                    }}>
                      {/* Navegación de días */}
                      <button 
                        className="btn ghost" 
                        onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.max(0, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) - 1) }))}
                        style={{ padding: "6px 10px", minHeight: "32px", fontSize: "16px" }}
                      >←</button>
                      
                      <div style={{ 
                        fontWeight: "700", 
                        color: "#16a34a",
                        fontSize: "14px",
                        textAlign: "center",
                        flex: "0 0 auto"
                      }}>{dayName}</div>
                      
                      <button 
                        className="btn ghost" 
                        onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.min(6, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) + 1) }))}
                        style={{ padding: "6px 10px", minHeight: "32px", fontSize: "16px" }}
                      >→</button>
                      
                      {/* Botones de acción */}
                      <button
                        onClick={() => {
                          setShowSnacksModal(true);
                          loadSnacks();
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "16px",
                          backgroundColor: "#fb923c",
                          color: "white",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                          boxShadow: "0 2px 8px rgba(251, 146, 60, 0.3)",
                          whiteSpace: "nowrap",
                          flex: "0 0 auto"
                        }}
                        title="Ver SNACK's disponibles"
                      >
                        <span style={{ fontSize: "14px" }}>🍎</span>
                        <span>SNACK's</span>
                      </button>
                      
                      {!adminMode && (
                        <button
                          onClick={() => setShowSolicitudDieta(true)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "16px",
                            backgroundColor: "#16a34a",
                            color: "white",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            boxShadow: "0 2px 8px rgba(22, 163, 74, 0.3)",
                            whiteSpace: "nowrap",
                            flex: "0 0 auto"
                          }}
                          title="Solicitar cambios en tu dieta"
                        >
                          <span style={{ fontSize: "14px" }}>💬</span>
                          <span>C.Dieta</span>
                        </button>
                      )}
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

                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn ghost" onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.max(0, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) - 1) }))}>Día anterior</button>
                      <button className="btn ghost" onClick={() => setEditable((s) => ({ ...s, _selectedDay: Math.min(6, (typeof s._selectedDay === "number" ? s._selectedDay : selDay) + 1) }))}>Siguiente día</button>
                    </div>
                  </div>

                  {adminMode && (
                    <>
                      <hr style={{ margin: "12px 0" }} />
                      
                      {/* Historial completo de dietas */}
                      <h4 style={{ marginTop: "20px", marginBottom: "12px", fontSize: "16px", fontWeight: "600" }}>📋 Historial de Dietas Completas</h4>
                      <div style={{ overflowX: "auto", marginTop: 8 }}>
                        {(() => {
                          const dietasHistorico = dietasHistoricoList;
                          if (dietasHistorico.length === 0) {
                            return <div style={{ padding: 12, color: "#374151", backgroundColor: "#f9fafb", borderRadius: "6px" }}>No hay dietas guardadas. Pulsa "💾 Guardar versión" para crear la primera.</div>;
                          }
                          
                          return (
                            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e5e7eb" }}>
                              <thead>
                                <tr style={{ backgroundColor: "#f3f4f6" }}>
                                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #d1d5db", fontWeight: "600" }}>Nº Dieta</th>
                                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #d1d5db", fontWeight: "600" }}>Desde</th>
                                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #d1d5db", fontWeight: "600" }}>Hasta</th>
                                  <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: "2px solid #d1d5db", fontWeight: "600" }}>Acción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dietasHistorico.map((dieta, idx) => {
                                  const fechaDesde = new Date(dieta.fechaDesde);
                                  const fechaHasta = dieta.fechaHasta ? new Date(dieta.fechaHasta) : null;
                                  const formatFecha = (date) => {
                                    if (!date) return "";
                                    const d = date.getDate().toString().padStart(2, '0');
                                    const m = (date.getMonth() + 1).toString().padStart(2, '0');
                                    const y = date.getFullYear();
                                    return `${d}/${m}/${y}`;
                                  };
                                  
                                  const handleViewPDF = () => {
                                    // Generar PDF de esta versión histórica
                                    generateHistoricalDietPDF(dieta);
                                  };
                                  
                                  const handleDelete = async () => {
                                    if (!window.confirm(`⚠️ ¿Borrar la dieta #${dieta.numero}? Esta acción no se puede deshacer.`)) {
                                      return;
                                    }
                                    try {
                                      await deleteDoc(doc(db, "users", uid, "dietasHistorico", dieta.id));
                                      await loadDietasHistorico(uid);
                                      alert("✅ Dieta eliminada correctamente");
                                    } catch (err) {
                                      console.error("Error eliminando dieta:", err);
                                      alert("❌ Error al eliminar la dieta");
                                    }
                                  };
                                  
                                  return (
                                    <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                                      <td style={{ padding: "10px 12px", fontWeight: "500", color: "#3b82f6" }}>#{dieta.numero}</td>
                                      <td style={{ padding: "10px 12px" }}>{formatFecha(fechaDesde)}</td>
                                      <td style={{ padding: "10px 12px" }}>
                                        {fechaHasta ? formatFecha(fechaHasta) : <span style={{ color: "#10b981", fontWeight: "500" }}>Actual</span>}
                                      </td>
                                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                                          <button
                                            onClick={handleViewPDF}
                                            style={{
                                              backgroundColor: "#ef4444",
                                              color: "white",
                                              padding: "6px 16px",
                                              borderRadius: "6px",
                                              border: "none",
                                              cursor: "pointer",
                                              fontWeight: "500",
                                              fontSize: "13px",
                                              boxShadow: "0 2px 4px rgba(239, 68, 68, 0.3)",
                                              transition: "all 0.2s"
                                            }}
                                            onMouseOver={(e) => e.target.style.backgroundColor = "#dc2626"}
                                            onMouseOut={(e) => e.target.style.backgroundColor = "#ef4444"}
                                          >
                                            📄 Ver PDF
                                          </button>
                                          <button
                                            onClick={() => { setRestoreDietaPreview(dieta); setShowRestoreModal(true); }}
                                            style={{
                                              backgroundColor: "#f59e0b",
                                              color: "white",
                                              padding: "6px 16px",
                                              borderRadius: "6px",
                                              border: "none",
                                              cursor: "pointer",
                                              fontWeight: "500",
                                              fontSize: "13px",
                                              boxShadow: "0 2px 4px rgba(245, 158, 11, 0.3)",
                                              transition: "all 0.2s"
                                            }}
                                            onMouseOver={(e) => e.target.style.backgroundColor = "#d97706"}
                                            onMouseOut={(e) => e.target.style.backgroundColor = "#f59e0b"}
                                          >
                                            ♻️ Restaurar
                                          </button>
                                          <button
                                            onClick={handleDelete}
                                            style={{
                                              backgroundColor: "#64748b",
                                              color: "white",
                                              padding: "6px 16px",
                                              borderRadius: "6px",
                                              border: "none",
                                              cursor: "pointer",
                                              fontWeight: "500",
                                              fontSize: "13px",
                                              boxShadow: "0 2px 4px rgba(100, 116, 139, 0.3)",
                                              transition: "all 0.2s"
                                            }}
                                            onMouseOver={(e) => e.target.style.backgroundColor = "#475569"}
                                            onMouseOut={(e) => e.target.style.backgroundColor = "#64748b"}
                                          >
                                            🗑️ Borrar
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                    </>
                  )}
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
            {tabs[tabIndex]?.id === "lista-compra" && (
              <div className="card" style={{ padding: adminMode ? "16px 20px" : "12px", width: "100%", maxWidth: "none" }}>
                <ListaCompra 
                  menu={tipoMenu === "vertical" ? menuVertical : editable.menu}
                  tipoMenu={tipoMenu}
                />
              </div>
            )}
            {tabs[tabIndex]?.id === "gym" && (
              <div className="card" style={{ padding: adminMode ? "16px 20px" : "8px", width: "100%", maxWidth: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <h3 style={{ fontSize: "18px", margin: 0 }}>🏋️ Mi Tabla GYM</h3>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {/* Botón de descarga PDF - visible para usuario y admin si hay ejercicios */}
                    {(() => {
                      const tieneEjerciciosPorDia = userData?.ejerciciosPorDia && 
                        Object.keys(userData.ejerciciosPorDia).some(dia => userData.ejerciciosPorDia[dia]?.length > 0);
                      const tieneTablaGym = userData?.tablaGym && userData.tablaGym.length > 0;
                      return (tieneEjerciciosPorDia || tieneTablaGym) && (
                        <button
                          onClick={generarPDFTablaGym}
                          style={{
                            padding: "8px 16px",
                            fontSize: "13px",
                            fontWeight: "600",
                            color: "white",
                            backgroundColor: "#4CAF50",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            transition: "background 0.2s",
                            boxShadow: "0 2px 4px rgba(76,175,80,0.3)"
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = "#45a049"}
                          onMouseLeave={(e) => e.target.style.backgroundColor = "#4CAF50"}
                        >
                          📄 Descargar PDF
                        </button>
                      );
                    })()}
                    {/* Botón de solicitud de cambio - solo para usuario */}
                    {!adminMode && (
                      <button
                        onClick={() => setShowSolicitudTabla(true)}
                        style={{
                          padding: "8px 16px",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "white",
                          backgroundColor: "#2196F3",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                          transition: "background 0.2s",
                          boxShadow: "0 2px 4px rgba(33,150,243,0.3)"
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = "#1976d2"}
                        onMouseLeave={(e) => e.target.style.backgroundColor = "#2196F3"}
                      >
                        📝 Solicitar cambio de tabla
                      </button>
                    )}
                  </div>
                </div>
                {userData?.ejerciciosPorDia && Object.keys(userData.ejerciciosPorDia).some(dia => userData.ejerciciosPorDia[dia]?.length > 0) ? (
                  <div style={{ marginTop: "8px" }}>
                    {/* Mostrar ejercicios organizados por días */}
                    {["Día 1", "Día 2", "Día 3", "Día 4", "Día 5", "Día 6", "Día 7"].map((dia) => {
                      const ejerciciosDelDia = userData.ejerciciosPorDia[dia] || [];
                      if (ejerciciosDelDia.length === 0) return null;
                      
                      const colapsado = diasColapsados[dia] !== false;
                      return (
                        <div key={dia} style={{
                          marginBottom: "12px",
                          borderRadius: "12px",
                          border: "2px solid #e0e7ff",
                          overflow: "hidden"
                        }}>
                          {/* Encabezado del día - clicable */}
                          <div
                            onClick={() => setDiasColapsados(prev => ({ ...prev, [dia]: !colapsado }))}
                            style={{
                              fontSize: "16px",
                              fontWeight: "700",
                              color: "white",
                              padding: "12px 14px",
                              backgroundColor: "#1976d2",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              cursor: "pointer",
                              userSelect: "none"
                            }}
                          >
                            <span style={{
                              display: "inline-block",
                              transition: "transform 0.25s",
                              transform: colapsado ? "rotate(-90deg)" : "rotate(0deg)",
                              fontSize: "12px"
                            }}>▼</span>
                            <span>📅</span>
                            <span style={{ flex: 1 }}>{dia}</span>
                            <span style={{
                              fontSize: "12px",
                              fontWeight: "500",
                              backgroundColor: "rgba(255,255,255,0.25)",
                              color: "white",
                              padding: "2px 8px",
                              borderRadius: "12px"
                            }}>
                              {ejerciciosDelDia.length} ejercicio{ejerciciosDelDia.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          {/* Lista de ejercicios del día */}
                          {!colapsado && <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            padding: "12px",
                            backgroundColor: "#f8f9fa"
                          }}>
                            {ejerciciosDelDia.map((ejercicio, index) => (
                              <div 
                                key={ejercicio.id} 
                                style={{
                                  padding: "10px",
                                  backgroundColor: "white",
                                  border: "2px solid #2196F3",
                                  borderRadius: "8px",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                                }}
                              >
                                <div style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "10px"
                                }}>
                                  <div style={{
                                    fontSize: "14px",
                                    fontWeight: "700",
                                    color: "#1976d2",
                                    minWidth: "28px",
                                    height: "28px",
                                    borderRadius: "50%",
                                    backgroundColor: "#e3f2fd",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: "2px solid #2196F3",
                                    flexShrink: 0
                                  }}>
                                    {index + 1}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                      fontSize: "15px",
                                      fontWeight: "600",
                                      color: "#333",
                                      marginBottom: "3px",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      justifyContent: "space-between"
                                    }}>
                                      <span>{ejercicio.nombre}</span>
                                      {ejercicio.videoUrl && (
                                        <button
                                          onClick={() => {
                                            setCurrentVideoUrl(ejercicio.videoUrl);
                                            setCurrentVideoTitle(ejercicio.nombre);
                                            setShowVideoModal(true);
                                          }}
                                          style={{
                                            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                            border: "none",
                                            borderRadius: "50%",
                                            width: "32px",
                                            height: "32px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer",
                                            boxShadow: "0 2px 8px rgba(102,126,234,0.3)",
                                            transition: "all 0.2s",
                                            flexShrink: 0
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = "scale(1.1)";
                                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(102,126,234,0.5)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = "scale(1)";
                                            e.currentTarget.style.boxShadow = "0 2px 8px rgba(102,126,234,0.3)";
                                          }}
                                          title="Ver video demostrativo"
                                        >
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                                            <path d="M8 5v14l11-7z"/>
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                    <div style={{
                                      fontSize: "12px",
                                      color: "#1976d2",
                                      marginBottom: "6px",
                                      fontWeight: "500"
                                    }}>
                                      📁 {ejercicio.categoria}
                                    </div>
                                    
                                    {/* Parámetros del ejercicio */}
                                    {(ejercicio.series || ejercicio.repeticiones || ejercicio.peso || ejercicio.tiempo || ejercicio.intervalo) && (
                                      <div style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "4px",
                                        marginBottom: "6px"
                                      }}>
                                        {ejercicio.series && (
                                          <span style={{ 
                                            backgroundColor: "#e8f5e9", 
                                            padding: "3px 8px", 
                                            borderRadius: "4px", 
                                            fontSize: "11px",
                                            fontWeight: "500",
                                            border: "1px solid #4caf50",
                                            color: "#2e7d32"
                                          }}>
                                            📊 {ejercicio.series}
                                          </span>
                                        )}
                                        {ejercicio.repeticiones && (
                                          <span style={{ 
                                            backgroundColor: "#e3f2fd", 
                                            padding: "3px 8px", 
                                            borderRadius: "4px", 
                                            fontSize: "11px",
                                            fontWeight: "500",
                                            border: "1px solid #2196f3",
                                            color: "#1565c0"
                                          }}>
                                            🔢 {ejercicio.repeticiones}
                                          </span>
                                        )}
                                        {ejercicio.peso && (
                                          <span style={{ 
                                            backgroundColor: "#fff3e0", 
                                            padding: "3px 8px", 
                                            borderRadius: "4px", 
                                            fontSize: "11px",
                                            fontWeight: "500",
                                            border: "1px solid #ff9800",
                                            color: "#e65100"
                                          }}>
                                            ⚖️ {ejercicio.peso}
                                          </span>
                                        )}
                                        {ejercicio.tiempo && (
                                          <span style={{ 
                                            backgroundColor: "#f3e5f5", 
                                            padding: "3px 8px", 
                                            borderRadius: "4px", 
                                            fontSize: "11px",
                                            fontWeight: "500",
                                            border: "1px solid #9c27b0",
                                            color: "#6a1b9a"
                                          }}>
                                            ⏱️ {ejercicio.tiempo}
                                          </span>
                                        )}
                                        {ejercicio.intervalo && (
                                          <span style={{ 
                                            backgroundColor: "#fce4ec", 
                                            padding: "3px 8px", 
                                            borderRadius: "4px", 
                                            fontSize: "11px",
                                            fontWeight: "500",
                                            border: "1px solid #e91e63",
                                            color: "#c2185b"
                                          }}>
                                            ⏸️ {ejercicio.intervalo}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>}
                        </div>
                      );
                    })}
                  </div>
                ) : userData?.tablaGym && userData.tablaGym.length > 0 ? (
                  /* Backward compatibility: mostrar tablaGym antigua si existe */
                  <div style={{ marginTop: "8px" }}>
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px"
                    }}>
                      {userData.tablaGym.map((ejercicio, index) => (
                        <div 
                          key={ejercicio.id} 
                          style={{
                            padding: "10px",
                            backgroundColor: "#f0f7ff",
                            border: "2px solid #2196F3",
                            borderRadius: "8px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                          }}
                        >
                          <div style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "10px"
                          }}>
                            <div style={{
                              fontSize: "16px",
                              fontWeight: "700",
                              color: "#1976d2",
                              minWidth: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              backgroundColor: "white",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "2px solid #2196F3",
                              flexShrink: 0
                            }}>
                              {index + 1}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: "15px",
                                fontWeight: "600",
                                color: "#333",
                                marginBottom: "3px",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                justifyContent: "space-between"
                              }}>
                                <span>{ejercicio.nombre}</span>
                                {ejercicio.videoUrl && (
                                  <button
                                    onClick={() => {
                                      setCurrentVideoUrl(ejercicio.videoUrl);
                                      setCurrentVideoTitle(ejercicio.nombre);
                                      setShowVideoModal(true);
                                    }}
                                    style={{
                                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                      border: "none",
                                      borderRadius: "50%",
                                      width: "32px",
                                      height: "32px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      cursor: "pointer",
                                      boxShadow: "0 2px 8px rgba(102,126,234,0.3)",
                                      transition: "all 0.2s",
                                      flexShrink: 0
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = "scale(1.1)";
                                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(102,126,234,0.5)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = "scale(1)";
                                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(102,126,234,0.3)";
                                    }}
                                    title="Ver video demostrativo"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                                      <path d="M8 5v14l11-7z"/>
                                    </svg>
                                  </button>
                                )}
                              </div>
                              <div style={{
                                fontSize: "12px",
                                color: "#1976d2",
                                marginBottom: "6px",
                                fontWeight: "500"
                              }}>
                                📁 {ejercicio.categoria}
                              </div>
                              
                              {/* Parámetros del ejercicio */}
                              {(ejercicio.series || ejercicio.repeticiones || ejercicio.peso || ejercicio.tiempo || ejercicio.intervalo) && (
                                <div style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "4px",
                                  marginBottom: "6px"
                                }}>
                                  {ejercicio.series && (
                                    <span style={{ 
                                      backgroundColor: "white", 
                                      padding: "3px 8px", 
                                      borderRadius: "4px", 
                                      fontSize: "11px",
                                      fontWeight: "500",
                                      border: "1px solid #e0e0e0"
                                    }}>
                                      📊 {ejercicio.series}
                                    </span>
                                  )}
                                  {ejercicio.repeticiones && (
                                    <span style={{ 
                                      backgroundColor: "white", 
                                      padding: "3px 8px", 
                                      borderRadius: "4px", 
                                      fontSize: "11px",
                                      fontWeight: "500",
                                      border: "1px solid #e0e0e0"
                                    }}>
                                      🔢 {ejercicio.repeticiones}
                                    </span>
                                  )}
                                  {ejercicio.peso && (
                                    <span style={{ 
                                      backgroundColor: "white", 
                                      padding: "3px 8px", 
                                      borderRadius: "4px", 
                                      fontSize: "11px",
                                      fontWeight: "500",
                                      border: "1px solid #e0e0e0"
                                    }}>
                                      ⚖️ {ejercicio.peso}
                                    </span>
                                  )}
                                  {ejercicio.tiempo && (
                                    <span style={{ 
                                      backgroundColor: "white", 
                                      padding: "3px 8px", 
                                      borderRadius: "4px", 
                                      fontSize: "11px",
                                      fontWeight: "500",
                                      border: "1px solid #e0e0e0"
                                    }}>
                                      ⏱️ {ejercicio.tiempo}
                                    </span>
                                  )}
                                  {ejercicio.intervalo && (
                                    <span style={{ 
                                      backgroundColor: "white", 
                                      padding: "3px 8px", 
                                      borderRadius: "4px", 
                                      fontSize: "11px",
                                      fontWeight: "500",
                                      border: "1px solid #e0e0e0"
                                    }}>
                                      ⏸️ {ejercicio.intervalo}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "#999"
                  }}>
                    <p style={{ fontSize: "48px", margin: "0 0 16px 0" }}>🏋️</p>
                    <p style={{ fontSize: "16px", margin: 0 }}>
                      {adminMode 
                        ? "Este usuario no tiene tabla GYM asignada"
                        : "Aún no tienes ejercicios asignados"}
                    </p>
                    <p style={{ fontSize: "14px", color: "#bbb", marginTop: "8px" }}>
                      {adminMode 
                        ? "Ve a la sección GYM del panel de admin para asignar ejercicios"
                        : "Consulta con tu nutricionista"}
                    </p>
                    {!adminMode && (
                      <button
                        onClick={() => setShowSolicitudNuevaTabla(true)}
                        style={{
                          marginTop: "24px",
                          padding: "12px 24px",
                          fontSize: "15px",
                          fontWeight: "600",
                          color: "white",
                          backgroundColor: "#4CAF50",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          boxShadow: "0 2px 8px rgba(76,175,80,0.3)"
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = "#45a049";
                          e.target.style.transform = "translateY(-2px)";
                          e.target.style.boxShadow = "0 4px 12px rgba(76,175,80,0.4)";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = "#4CAF50";
                          e.target.style.transform = "translateY(0)";
                          e.target.style.boxShadow = "0 2px 8px rgba(76,175,80,0.3)";
                        }}
                      >
                        ✨ Solicitar nueva tabla GYM
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {tabs[tabIndex]?.id === "ejercicios" && (
              <div className="card" style={{ padding: adminMode ? "16px 20px" : "12px", width: "100%", maxWidth: "none" }}>
                <h3>Ejercicios</h3>
                <div className="panel-section" style={{ maxWidth: "none" }}>
                  <FileManager userId={uid} type="ejercicios" isAdmin={adminMode} />
                </div>
                {adminMode && (
                  <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #ddd" }}>
                    <h4 style={{ marginBottom: "12px" }}>📁 Archivos adicionales</h4>
                  </div>
                )}
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
            {tabs[tabIndex]?.id === "pagos" && adminMode && (
              <div className="card" style={{ padding: "0", width: "100%", maxWidth: "none" }}>
                <AdminPagos 
                  userId={uid} 
                  userData={userData}
                />
              </div>
            )}
            {tabs[tabIndex]?.id === "mensajes" && (
              <div className="card" style={{ padding: "0", width: "100%", maxWidth: "none" }}>
                <MensajesUsuario 
                  user={{ ...userData, id: uid }} 
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
                <label>Pliegue Cintura (mm)</label>
                <input 
                  type="number" 
                  inputMode="decimal" 
                  step="0.1" 
                  className="input" 
                  value={editingRecord.pliegueCintura ?? ""} 
                  onChange={(e) => setEditingRecord({ ...editingRecord, pliegueCintura: e.target.value })} 
                />
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

      {/* Modal de Snacks */}
      {showSnacksModal && (
        <div className="print-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setShowSnacksModal(false)}>
          <div className="print-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "20px", color: "#064e3b", fontWeight: "600" }}>🍎 Snacks Disponibles</h3>
              <button 
                onClick={() => setShowSnacksModal(false)}
                className="btn-icon-header"
                title="Cerrar"
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
                onMouseEnter={e => e.currentTarget.style.background = "rgba(220,38,38,1)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.9)"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Contenido del modal */}
            <div style={{
              padding: "24px",
              overflowY: "auto",
              flex: 1
            }}>
              {loadingSnacks ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                  <div style={{ fontSize: "18px" }}>Cargando snacks...</div>
                </div>
              ) : snacksList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>🍎</div>
                  <div style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>
                    No hay snacks disponibles
                  </div>
                  <div style={{ fontSize: "14px" }}>
                    El administrador aún no ha añadido snacks a la base de datos
                  </div>
                </div>
              ) : (
                <div style={{
                  display: "grid",
                  gap: "12px"
                }}>
                  {snacksList.map((snack) => (
                    <div
                      key={snack.id}
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        backgroundColor: "#fffbeb",
                        border: "2px solid #fde68a",
                        fontSize: "15px",
                        fontWeight: "500",
                        color: "#92400e",
                        transition: "all 0.2s",
                        cursor: "default"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#fef3c7";
                        e.currentTarget.style.borderColor = "#fbbf24";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#fffbeb";
                        e.currentTarget.style.borderColor = "#fde68a";
                      }}
                    >
                      {snack.nombre}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid #e5e7eb",
              textAlign: "center",
              color: "#6b7280",
              fontSize: "14px"
            }}>
              {snacksList.length > 0 && `${snacksList.length} snack${snacksList.length !== 1 ? 's' : ''} disponible${snacksList.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Recetas */}
      {showRecetasModal && (
        <div className="print-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setShowRecetasModal(false)}>
          <div className="print-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "800px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "20px", color: "#92400e", fontWeight: "600" }}>👨‍🍳 Recetas Disponibles</h3>
              <button 
                onClick={() => setShowRecetasModal(false)}
                className="btn-icon-header"
                title="Cerrar"
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
                onMouseEnter={e => e.currentTarget.style.background = "rgba(220,38,38,1)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.9)"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Contenido del modal */}
            <div style={{
              padding: "24px",
              overflowY: "auto",
              flex: 1,
              maxHeight: "70vh"
            }}>
              {loadingRecetas ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                  <div style={{ fontSize: "18px" }}>Cargando recetas...</div>
                </div>
              ) : recetasList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>👨‍🍳</div>
                  <div style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>
                    No hay recetas disponibles
                  </div>
                  <div style={{ fontSize: "14px" }}>
                    El administrador aún no ha añadido recetas
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: isMobile ? "13px" : "14px"
                  }}>
                    <thead>
                      <tr style={{
                        backgroundColor: "#f59e0b",
                        color: "white"
                      }}>
                        <th style={{
                          padding: isMobile ? "10px 8px" : "12px 16px",
                          textAlign: "left",
                          fontWeight: "600",
                          borderBottom: "2px solid #d97706"
                        }}>Categoría</th>
                        <th style={{
                          padding: isMobile ? "10px 8px" : "12px 16px",
                          textAlign: "left",
                          fontWeight: "600",
                          borderBottom: "2px solid #d97706"
                        }}>Nombre</th>
                        <th style={{
                          padding: isMobile ? "10px 8px" : "12px 16px",
                          textAlign: "center",
                          fontWeight: "600",
                          borderBottom: "2px solid #d97706",
                          width: "80px"
                        }}>Tipo</th>
                        <th style={{
                          padding: isMobile ? "10px 8px" : "12px 16px",
                          textAlign: "center",
                          fontWeight: "600",
                          borderBottom: "2px solid #d97706",
                          width: "80px"
                        }}>Ver</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recetasList.map((receta, index) => (
                        <tr key={receta.id} style={{
                          backgroundColor: index % 2 === 0 ? "white" : "#fafafa",
                          transition: "background-color 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#fef3c7"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? "white" : "#fafafa"}
                        >
                          <td style={{
                            padding: isMobile ? "10px 8px" : "12px 16px",
                            borderBottom: "1px solid #e5e7eb"
                          }}>
                            <span style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: "12px",
                              backgroundColor: getCategoryColor(receta.categoria),
                              color: "white",
                              fontSize: isMobile ? "11px" : "12px",
                              fontWeight: "600",
                              textTransform: "capitalize"
                            }}>
                              {receta.categoria || "General"}
                            </span>
                          </td>
                          <td style={{
                            padding: isMobile ? "10px 8px" : "12px 16px",
                            borderBottom: "1px solid #e5e7eb",
                            fontWeight: "500"
                          }}>
                            {receta.nombre}
                          </td>
                          <td style={{
                            padding: isMobile ? "10px 8px" : "12px 16px",
                            borderBottom: "1px solid #e5e7eb",
                            textAlign: "center"
                          }}>
                            <span style={{ fontSize: isMobile ? "18px" : "20px" }}>
                              {receta.tipoArchivo === 'video' ? '🎥' : '📄'}
                            </span>
                          </td>
                          <td style={{
                            padding: isMobile ? "10px 8px" : "12px 16px",
                            borderBottom: "1px solid #e5e7eb",
                            textAlign: "center"
                          }}>
                            <button
                              onClick={() => window.open(receta.url, '_blank')}
                              style={{
                                padding: isMobile ? "6px 12px" : "8px 16px",
                                backgroundColor: "#3b82f6",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: isMobile ? "12px" : "13px",
                                fontWeight: "500",
                                transition: "background-color 0.2s"
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#2563eb"}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#3b82f6"}
                              title="Abrir receta"
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid #e5e7eb",
              textAlign: "center",
              color: "#6b7280",
              fontSize: "14px"
            }}>
              {recetasList.length > 0 && `${recetasList.length} receta${recetasList.length !== 1 ? 's' : ''} disponible${recetasList.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Tarifas */}
      {showTarifasModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
            cursor: "pointer"
          }}
          onClick={() => setShowTarifasModal(false)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "95%",
              maxHeight: "95%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón cerrar */}
            <button
              onClick={() => setShowTarifasModal(false)}
              style={{
                position: "absolute",
                top: "-50px",
                right: "0",
                background: "#16a34a",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                fontSize: "24px",
                cursor: "pointer",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                fontWeight: "700",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#15803d";
                e.currentTarget.style.transform = "scale(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#16a34a";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              ✕
            </button>

            {/* Contenido */}
            {loadingTarifas ? (
              <div style={{ 
                backgroundColor: "white", 
                padding: "40px", 
                borderRadius: "12px",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "18px", color: "#6b7280" }}>Cargando tarifas...</div>
              </div>
            ) : !tarifasUrl ? (
              <div style={{ 
                backgroundColor: "white", 
                padding: "40px", 
                borderRadius: "12px",
                textAlign: "center",
                maxWidth: "400px"
              }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>💰</div>
                <div style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px", color: "#374151" }}>
                  No hay tarifas disponibles
                </div>
                <div style={{ fontSize: "14px", color: "#6b7280" }}>
                  El administrador aún no ha subido la imagen de tarifas
                </div>
              </div>
            ) : (
              <img
                src={tarifasUrl}
                alt="Tarifas"
                style={{
                  maxWidth: "100%",
                  maxHeight: "calc(100vh - 100px)",
                  objectFit: "contain",
                  borderRadius: "8px",
                  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
                  backgroundColor: "white"
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Recordatorio de cita */}
      {showCitaReminder && citaToRemind && (
        <CitaReminder
          cita={citaToRemind}
          onDismiss={handleDismissCitaReminder}
          onDismissAll={handleDismissAllCitaReminders}
          onAddToCalendar={handleAddToCalendar}
        />
      )}

      {/* Modal de mensajes del admin */}
      {showMensajeModal && mensajeActual && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '15px',
              padding: isMobile ? '24px' : '40px',
              maxWidth: '600px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
              animation: 'slideIn 0.3s ease-out',
              position: 'relative'
            }}
          >
            {/* Indicador de mensajes múltiples */}
            {mensajesPendientes.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                {currentMensajeIndex + 1} de {mensajesPendientes.length}
              </div>
            )}

            {/* Ícono */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '60px', marginBottom: '10px' }}>💬</div>
              <h2
                style={{
                  margin: '0 0 8px 0',
                  color: '#2c3e50',
                  fontSize: isMobile ? '22px' : '26px',
                  fontWeight: '700'
                }}
              >
                Mensaje del Nutricionista
              </h2>
              <p style={{ margin: 0, color: '#7f8c8d', fontSize: '14px' }}>
                {new Date(mensajeActual.creadoEn?.toDate()).toLocaleDateString('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>

            {/* Contenido del mensaje */}
            <div
              style={{
                backgroundColor: '#f8f9fa',
                padding: '20px',
                borderRadius: '10px',
                marginBottom: '24px',
                minHeight: '100px',
                fontSize: '16px',
                lineHeight: '1.6',
                color: '#2c3e50',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {mensajeActual.contenido}
            </div>

            {/* Botón de acción */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleCerrarMensaje}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#1976D2'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#2196F3'}
              >
                {mensajesPendientes.length > 1 && currentMensajeIndex < mensajesPendientes.length - 1
                  ? '➡️ Siguiente mensaje'
                  : '✓ Entendido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de solicitud de cambio de tabla GYM */}
      {showSolicitudTabla && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => !enviandoSolicitud && setShowSolicitudTabla(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '15px',
              padding: isMobile ? '24px' : '32px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
              animation: 'slideIn 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>🏋️</div>
              <h2
                style={{
                  margin: '0 0 8px 0',
                  color: '#2c3e50',
                  fontSize: isMobile ? '20px' : '24px',
                  fontWeight: '700'
                }}
              >
                Solicitar Cambio de Tabla
              </h2>
              <p style={{ margin: 0, color: '#7f8c8d', fontSize: '14px' }}>
                Explica por qué necesitas un cambio en tu tabla de ejercicios
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#555'
                }}
              >
                Motivo de la solicitud:
              </label>
              <textarea
                value={solicitudTablaTexto}
                onChange={(e) => setSolicitudTablaTexto(e.target.value)}
                placeholder="Ej: Algunos ejercicios me resultan muy difíciles, o necesito ejercicios para casa, etc."
                disabled={enviandoSolicitud}
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '12px',
                  fontSize: '15px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  backgroundColor: enviandoSolicitud ? '#f5f5f5' : 'white'
                }}
                onFocus={(e) => e.target.style.borderColor = '#2196F3'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowSolicitudTabla(false)}
                disabled={enviandoSolicitud}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  backgroundColor: '#f5f5f5',
                  color: '#666',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: enviandoSolicitud ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: enviandoSolicitud ? 0.5 : 1
                }}
                onMouseOver={(e) => !enviandoSolicitud && (e.target.style.backgroundColor = '#e5e5e5')}
                onMouseOut={(e) => !enviandoSolicitud && (e.target.style.backgroundColor = '#f5f5f5')}
              >
                Cancelar
              </button>
              <button
                onClick={handleEnviarSolicitudTabla}
                disabled={enviandoSolicitud || !solicitudTablaTexto.trim()}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  backgroundColor: enviandoSolicitud || !solicitudTablaTexto.trim() ? '#ccc' : '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: enviandoSolicitud || !solicitudTablaTexto.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (!enviandoSolicitud && solicitudTablaTexto.trim()) {
                    e.target.style.backgroundColor = '#1976D2';
                  }
                }}
                onMouseOut={(e) => {
                  if (!enviandoSolicitud && solicitudTablaTexto.trim()) {
                    e.target.style.backgroundColor = '#2196F3';
                  }
                }}
              >
                {enviandoSolicitud ? '⏳ Enviando...' : '📤 Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de solicitud de cambio de DIETA */}
      {showSolicitudDieta && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => !enviandoSolicitud && setShowSolicitudDieta(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '15px',
              padding: isMobile ? '24px' : '32px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
              animation: 'slideIn 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>🍽️</div>
              <h2
                style={{
                  margin: '0 0 8px 0',
                  color: '#2c3e50',
                  fontSize: isMobile ? '20px' : '24px',
                  fontWeight: '700'
                }}
              >
                Solicitar Cambio de Dieta
              </h2>
              <p style={{ margin: 0, color: '#7f8c8d', fontSize: '14px' }}>
                Explica qué cambios necesitas en tu dieta o alimentación
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#555'
                }}
              >
                Motivo de la solicitud:
              </label>
              <textarea
                value={solicitudDietaTexto}
                onChange={(e) => setSolicitudDietaTexto(e.target.value)}
                placeholder="Ej: Necesito más variedad, tengo alergias a ciertos alimentos, quiero ajustar las porciones, etc."
                disabled={enviandoSolicitud}
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '12px',
                  fontSize: '15px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  backgroundColor: enviandoSolicitud ? '#f5f5f5' : 'white'
                }}
                onFocus={(e) => e.target.style.borderColor = '#16a34a'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowSolicitudDieta(false)}
                disabled={enviandoSolicitud}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  backgroundColor: '#f5f5f5',
                  color: '#666',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: enviandoSolicitud ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: enviandoSolicitud ? 0.5 : 1
                }}
                onMouseOver={(e) => !enviandoSolicitud && (e.target.style.backgroundColor = '#e5e5e5')}
                onMouseOut={(e) => !enviandoSolicitud && (e.target.style.backgroundColor = '#f5f5f5')}
              >
                Cancelar
              </button>
              <button
                onClick={handleEnviarSolicitudDieta}
                disabled={enviandoSolicitud || !solicitudDietaTexto.trim()}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  backgroundColor: enviandoSolicitud || !solicitudDietaTexto.trim() ? '#ccc' : '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: enviandoSolicitud || !solicitudDietaTexto.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (!enviandoSolicitud && solicitudDietaTexto.trim()) {
                    e.target.style.backgroundColor = '#15803d';
                  }
                }}
                onMouseOut={(e) => {
                  if (!enviandoSolicitud && solicitudDietaTexto.trim()) {
                    e.target.style.backgroundColor = '#16a34a';
                  }
                }}
              >
                {enviandoSolicitud ? '⏳ Enviando...' : '📤 Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de solicitud de NUEVA tabla GYM */}
      {showSolicitudNuevaTabla && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => !enviandoSolicitud && setShowSolicitudNuevaTabla(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '15px',
              padding: isMobile ? '24px' : '32px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
              animation: 'slideIn 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '64px', marginBottom: '12px' }}>🏋️</div>
              <h2
                style={{
                  margin: '0 0 8px 0',
                  color: '#2c3e50',
                  fontSize: isMobile ? '20px' : '24px',
                  fontWeight: '700'
                }}
              >
                Solicitar Nueva Tabla GYM
              </h2>
              <p style={{ margin: 0, color: '#7f8c8d', fontSize: '14px', lineHeight: '1.5' }}>
                ¿Estás interesado en comenzar con entrenamientos personalizados?
              </p>
            </div>

            <div
              style={{
                backgroundColor: '#e8f5e9',
                borderLeft: '4px solid #4CAF50',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '24px'
              }}
            >
              <p style={{ margin: '0 0 10px 0', color: '#2e7d32', fontSize: '14px', fontWeight: '600' }}>
                ℹ️ Información importante:
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#555', fontSize: '13px', lineHeight: '1.6' }}>
                <li>Tu solicitud será enviada al nutricionista</li>
                <li>Recibirás información sobre tarifas y condiciones</li>
                <li>El nutricionista te contactará para confirmar el servicio</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowSolicitudNuevaTabla(false)}
                disabled={enviandoSolicitud}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  backgroundColor: '#f5f5f5',
                  color: '#666',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: enviandoSolicitud ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: enviandoSolicitud ? 0.5 : 1
                }}
                onMouseOver={(e) => !enviandoSolicitud && (e.target.style.backgroundColor = '#e5e5e5')}
                onMouseOut={(e) => !enviandoSolicitud && (e.target.style.backgroundColor = '#f5f5f5')}
              >
                Cancelar
              </button>
              <button
                onClick={handleEnviarSolicitudNuevaTabla}
                disabled={enviandoSolicitud}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  backgroundColor: enviandoSolicitud ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: enviandoSolicitud ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (!enviandoSolicitud) {
                    e.target.style.backgroundColor = '#45a049';
                  }
                }}
                onMouseOut={(e) => {
                  if (!enviandoSolicitud) {
                    e.target.style.backgroundColor = '#4CAF50';
                  }
                }}
              >
                {enviandoSolicitud ? '⏳ Enviando...' : '✨ Solicitar tabla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Galería de Fotos */}
      {showFotosModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: isMobile ? '10px' : '20px',
            overflow: 'auto'
          }}
          onClick={closeFotosModal}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '15px',
              padding: isMobile ? '16px' : '24px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
              animation: 'fadeIn 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', color: '#2c3e50', fontSize: isMobile ? '20px' : '24px', fontWeight: '700' }}>
                  📸 {adminMode ? 'Gestionar Fotos' : 'Fotos de Alimentos'}
                </h2>
                <p style={{ margin: 0, color: '#7f8c8d', fontSize: '14px' }}>
                  {adminMode ? 'Sube fotos de productos y alimentos para el usuario' : 'Fotos de referencia de alimentos'}
                </p>
              </div>
              <button
                onClick={closeFotosModal}
                style={{
                  backgroundColor: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  cursor: 'pointer',
                  fontSize: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#e2e8f0'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#f1f5f9'}
              >
                ✕
              </button>
            </div>

            {/* Zona de subida (solo admin) */}
            {adminMode && (
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOverFotos}
                onDrop={handleDropFotos}
                style={{
                  border: isDragging ? '3px dashed #3b82f6' : '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: isMobile ? '20px' : '30px',
                  marginBottom: '24px',
                  backgroundColor: isDragging ? '#eff6ff' : '#f8fafc',
                  textAlign: 'center',
                  transition: 'all 0.3s'
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📤</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#334155', fontSize: '16px', fontWeight: '600' }}>
                  Subir fotos
                </h3>
                <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '13px' }}>
                  Arrastra imágenes aquí, pega desde el portapapeles (Ctrl+V) o haz clic para seleccionar
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFoto}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: uploadingFoto ? 'not-allowed' : 'pointer',
                      opacity: uploadingFoto ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => !uploadingFoto && (e.target.style.backgroundColor = '#2563eb')}
                    onMouseLeave={(e) => !uploadingFoto && (e.target.style.backgroundColor = '#3b82f6')}
                  >
                    📂 Seleccionar archivos
                  </button>
                </div>
                
                {uploadingFoto && (
                  <div style={{ marginTop: '16px', color: '#3b82f6', fontSize: '14px', fontWeight: '600' }}>
                    ⏳ Subiendo foto...
                  </div>
                )}
              </div>
            )}

            {/* Galería de fotos */}
            {loadingFotos ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>⏳</div>
                <p>Cargando fotos...</p>
              </div>
            ) : fotosGaleria.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📸</div>
                <p>{adminMode ? 'No hay fotos aún. Sube la primera!' : 'No hay fotos disponibles'}</p>
              </div>
            ) : (
              <div>
                <h3 style={{ margin: '0 0 16px 0', color: '#334155', fontSize: '16px', fontWeight: '600' }}>
                  Galería ({fotosGaleria.length} {fotosGaleria.length === 1 ? 'foto' : 'fotos'})
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '12px'
                  }}
                >
                  {fotosGaleria.map((foto, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        borderRadius: '8px',
                        overflow: 'visible',
                        backgroundColor: '#f1f5f9',
                        transition: 'transform 0.2s',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          aspectRatio: '1',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          borderRadius: '8px 8px 0 0'
                        }}
                        onClick={() => setSelectedFoto(foto)}
                        onMouseEnter={(e) => e.currentTarget.parentElement.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.parentElement.style.transform = 'scale(1)'}
                      >
                        <img
                          src={foto.url}
                          alt={foto.caption || `Foto ${idx + 1}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        {adminMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFoto(foto);
                            }}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              backgroundColor: 'rgba(239, 68, 68, 0.9)',
                              border: 'none',
                              borderRadius: '6px',
                              width: '32px',
                              height: '32px',
                              cursor: 'pointer',
                              fontSize: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.stopPropagation();
                              e.target.style.backgroundColor = 'rgba(220, 38, 38, 1)';
                            }}
                            onMouseLeave={(e) => {
                              e.stopPropagation();
                              e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                      
                      {/* Pie de foto */}
                      <div style={{
                        padding: '8px',
                        backgroundColor: 'white',
                        borderRadius: '0 0 8px 8px',
                        minHeight: '40px'
                      }}>
                        {adminMode && editingCaption === idx ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input
                              type="text"
                              value={tempCaption}
                              onChange={(e) => setTempCaption(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateCaption(foto, tempCaption);
                                  setEditingCaption(null);
                                } else if (e.key === 'Escape') {
                                  setEditingCaption(null);
                                }
                              }}
                              autoFocus
                              style={{
                                flex: 1,
                                padding: '4px 8px',
                                fontSize: '12px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                outline: 'none'
                              }}
                              placeholder="Pie de foto..."
                            />
                            <button
                              onClick={() => {
                                updateCaption(foto, tempCaption);
                                setEditingCaption(null);
                              }}
                              style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                backgroundColor: '#16a34a',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setEditingCaption(null)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                backgroundColor: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={(e) => {
                              if (adminMode) {
                                e.stopPropagation();
                                setEditingCaption(idx);
                                setTempCaption(foto.caption || '');
                              }
                            }}
                            style={{
                              fontSize: '12px',
                              color: foto.caption ? '#334155' : '#94a3b8',
                              fontStyle: foto.caption ? 'normal' : 'italic',
                              cursor: adminMode ? 'pointer' : 'default',
                              padding: '4px',
                              borderRadius: '4px',
                              transition: 'background-color 0.2s',
                              wordBreak: 'break-word'
                            }}
                            onMouseEnter={(e) => adminMode && (e.target.style.backgroundColor = '#f1f5f9')}
                            onMouseLeave={(e) => adminMode && (e.target.style.backgroundColor = 'transparent')}
                          >
                            {foto.caption || (adminMode ? 'Haz clic para añadir pie de foto' : 'Sin descripción')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  backgroundColor: '#fee2e2',
                  borderLeft: '4px solid #ef4444',
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '14px'
                }}
              >
                ⚠️ {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de visualización de foto ampliada */}
      {selectedFoto && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => setSelectedFoto(null)}
        >
          <button
            onClick={() => setSelectedFoto(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              cursor: 'pointer',
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              transition: 'all 0.2s',
              zIndex: 10001
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
          >
            ✕
          </button>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90%', maxHeight: '90%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img
              src={selectedFoto.url}
              alt={selectedFoto.caption || "Foto ampliada"}
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(90vh - 80px)',
                objectFit: 'contain',
                borderRadius: '8px 8px 0 0',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
              }}
            />
            {selectedFoto.caption && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                padding: '16px 24px',
                borderRadius: '0 0 8px 8px',
                color: '#1f2937',
                fontSize: '16px',
                fontWeight: '500',
                textAlign: 'center',
                maxWidth: '100%',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
              }}>
                {selectedFoto.caption}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Video */}
      {showVideoModal && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => {
            setShowVideoModal(false);
            setCurrentVideoUrl("");
            setCurrentVideoTitle("");
          }}
        >
          <div 
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              maxWidth: "800px",
              width: "100%",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "2px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            }}>
              <h3 style={{
                margin: 0,
                fontSize: "18px",
                color: "white",
                fontWeight: "600"
              }}>
                🎥 {currentVideoTitle}
              </h3>
              <button
                onClick={() => {
                  setShowVideoModal(false);
                  setCurrentVideoUrl("");
                  setCurrentVideoTitle("");
                }}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.2)";
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Video */}
            <div style={{
              backgroundColor: "#000",
              position: "relative",
              paddingTop: "56.25%" /* 16:9 Aspect Ratio */
            }}>
              <video
                controls
                autoPlay
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain"
                }}
              >
                <source src={currentVideoUrl} type="video/mp4" />
                Tu navegador no soporta el elemento de video.
              </video>
            </div>

            {/* Footer */}
            <div style={{
              padding: "12px 20px",
              backgroundColor: "#f9fafb",
              textAlign: "center",
              fontSize: "13px",
              color: "#6b7280"
            }}>
              Video demostrativo del ejercicio
            </div>
          </div>
        </div>
      )}

      {/* Modal restaurar dieta histórica */}
      {showRestoreModal && restoreDietaPreview && (() => {
        const d = restoreDietaPreview;
        const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
        const comidas = ["desayuno", "almuerzo", "comida", "merienda", "cena", "consejos"];
        const comidasLabels = ["Desayuno", "Almuerzo", "Comida", "Merienda", "Cena", "Consejos"];
        const formatFecha = (iso) => {
          if (!iso) return "";
          const dt = new Date(iso);
          return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
        };
        return (
          <div style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, padding: "16px"
          }}>
            <div style={{
              backgroundColor: "#fff", borderRadius: "12px", padding: "28px",
              maxWidth: "900px", width: "100%", maxHeight: "90vh",
              overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.3)"
            }}>
              {/* Cabecera */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "20px", color: "#92400e" }}>♻️ Restaurar Dieta #{d.numero}</h3>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
                    Desde: {formatFecha(d.fechaDesde)} {d.fechaHasta ? `— Hasta: ${formatFecha(d.fechaHasta)}` : "(Actual)"}
                  </p>
                </div>
                <button onClick={() => { setShowRestoreModal(false); setRestoreDietaPreview(null); }}
                  style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>✕</button>
              </div>

              {/* Aviso */}
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", color: "#92400e" }}>
                ⚠️ <strong>Atención:</strong> Restaurar esta dieta <strong>sobreescribirá</strong> la dieta actual del usuario. Esta acción no se puede deshacer.
              </div>

              {/* Vista previa */}
              <h4 style={{ margin: "0 0 12px", fontSize: "15px", color: "#374151" }}>Vista previa de la dieta a restaurar:</h4>

              {d.modoManual && d.contenidoManual ? (
                /* Modo manual: mostrar el HTML de la tabla */
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", overflowX: "auto", backgroundColor: "#fafafa" }}>
                  <div dangerouslySetInnerHTML={{ __html: d.contenidoManual }} />
                </div>
              ) : d.tipoMenu === "vertical" && d.menuVertical ? (
                /* Modo vertical: mostrar secciones con ítems */
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", backgroundColor: "#fafafa" }}>
                  {["desayuno","almuerzo","comida","merienda","cena","consejos"].map(sec => {
                    const labels = { desayuno:"🌅 Desayuno", almuerzo:"☕ Almuerzo", comida:"🍽️ Comida", merienda:"🥤 Merienda", cena:"🌙 Cena", consejos:"💡 Consejos" };
                    const val = d.menuVertical[sec];
                    const isEmpty = !val || (Array.isArray(val) && val.length === 0) || (typeof val === "string" && !val.trim());
                    if (isEmpty) return null;
                    return (
                      <div key={sec} style={{ marginBottom: "12px" }}>
                        <strong style={{ color: "#374151" }}>{labels[sec]}</strong>
                        {sec === "consejos" ? (
                          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280", whiteSpace: "pre-wrap" }}>{typeof val === "string" ? val : val[0] || ""}</p>
                        ) : (
                          <ul style={{ margin: "4px 0 0", paddingLeft: "20px", fontSize: "13px", color: "#6b7280" }}>
                            {(Array.isArray(val) ? val : [val]).map((item, i) => <li key={i}>{typeof item === "string" ? item : (item?.nombre || item)}</li>)}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Modo tabla: mostrar cuadrícula semanal */
                <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#15803d" }}>
                        <th style={{ padding: "8px", color: "white", fontWeight: "600", textAlign: "center", minWidth: "80px" }}>Comida</th>
                        {dias.map(dia => <th key={dia} style={{ padding: "8px", color: "white", fontWeight: "600", textAlign: "center", minWidth: "100px" }}>{dia}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {comidas.map((c, ci) => (
                        <tr key={c} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "8px", fontWeight: "600", backgroundColor: "#f0fdf4", textAlign: "center" }}>{comidasLabels[ci]}</td>
                          {dias.map((_, di) => {
                            const val = (Array.isArray(d.menu) && d.menu[di]) ? d.menu[di][c] || "" : "";
                            return <td key={di} style={{ padding: "8px", verticalAlign: "top", color: val ? "#374151" : "#d1d5db", fontStyle: val ? "normal" : "italic" }}>{val || "—"}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Botones */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
                <button
                  onClick={() => { setShowRestoreModal(false); setRestoreDietaPreview(null); }}
                  style={{ padding: "10px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", border: "2px solid #d1d5db", backgroundColor: "#fff", color: "#374151" }}
                >Cancelar</button>
                <button
                  onClick={() => handleRestoreDieta(d)}
                  style={{ padding: "10px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", border: "none", backgroundColor: "#f59e0b", color: "white", boxShadow: "0 2px 8px rgba(245,158,11,0.4)" }}
                >♻️ Sí, restaurar esta dieta</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal confirmación email al guardar dieta */}
      {showEmailConfirmModal && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: "#fff", borderRadius: "12px", padding: "28px 32px",
            maxWidth: "420px", width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>💾</div>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", color: "#0f172a" }}>
              Dieta #{emailConfirmVersion} guardada
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: "15px", color: "#475569", lineHeight: "1.5" }}>
              ¿Quieres enviar un email de notificación al usuario?
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => { if (emailConfirmResolveRef.current) emailConfirmResolveRef.current(false); }}
                style={{
                  flex: 1, padding: "12px", borderRadius: "8px", fontSize: "14px",
                  fontWeight: "600", cursor: "pointer", border: "2px solid #d1d5db",
                  backgroundColor: "#fff", color: "#374151"
                }}
              >
                No, solo guardar
              </button>
              <button
                onClick={() => { if (emailConfirmResolveRef.current) emailConfirmResolveRef.current(true); }}
                style={{
                  flex: 1, padding: "12px", borderRadius: "8px", fontSize: "14px",
                  fontWeight: "600", cursor: "pointer", border: "2px solid #16a34a",
                  backgroundColor: "#16a34a", color: "white"
                }}
              >
                Sí, guardar y enviar mail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}