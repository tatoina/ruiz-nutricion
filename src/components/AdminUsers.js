import React, { useEffect, useState, useRef, useCallback } from "react";
import HelpForm from "./HelpForm";
import { auth, db, functions } from "../Firebase";
import { onAuthStateChanged, signOut, getIdTokenResult, sendPasswordResetEmail } from "firebase/auth";
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useNavigate } from "react-router-dom";
import FichaUsuario from "./FichaUsuario";
import { useDevice } from "../hooks/useDevice";
import logger from "../utils/logger";

/**
 * AdminUsers — panel admin con columna izquierda redimensionable.
 * - Soporta detection de admin por custom claim "admin" y por lista de emails.
 * - Left panel resizable, ancho persistido en localStorage (adminLeftWidth).
 * - Fallback para consultas Firestore si falta índice compuesto.
 * - RESPONSIVE: Detecta móvil y muestra interfaz adaptada
 */

const ADMIN_EMAILS = ["admin@admin.es"]; // ajusta si hace falta
const DESKTOP_MIN_WIDTH = 900;

export default function AdminUsers() {
    const [showHelpModal, setShowHelpModal] = useState(false);

  const navigate = useNavigate();
  const { isMobile } = useDevice(); // Detectar si es móvil
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" ? window.innerWidth >= DESKTOP_MIN_WIDTH : true);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("activos"); // "activos", "desactivados", "todos"
  const [planFiltro, setPlanFiltro] = useState("todos"); // "todos", "basico", "basico_ejercicios", "seguimiento", "gym", "sin_plan"
  const listRef = useRef(null);
  const [indexRequired, setIndexRequired] = useState(false);

  // Resizer state
  const containerRef = useRef(null);
  const isResizingRef = useRef(false);
  const leftWidthRef = useRef(null);
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem("adminLeftWidth"), 10);
    return Number.isFinite(saved) && saved > 0 ? saved : 360;
  });
  leftWidthRef.current = leftWidth;
  const MIN_LEFT = 240;
  const MAX_LEFT = 720;

  // Estado para ocultar/mostrar el panel lateral (visible por defecto)
  const [panelVisible, setPanelVisible] = useState(true);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);

  // Estados para modal de gestión de usuarios
  const [showGestionModal, setShowGestionModal] = useState(false);
  
  // Estados para modal de crear/editar usuario
  const [showModal, setShowModal] = useState(false);
  const [showInfoPermisos, setShowInfoPermisos] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" o "edit"
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    apellidos: "",
    email: "",
    emailConfirmacion: "",
    password: "000000",
    nacimiento: "",
    telefono: "",
    objetivoNutricional: "",
    pesoActual: "",
    rol: "paciente",
    tipoPlan: ""
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  
  // Estado para modal de perfil admin
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const [adminProfileData, setAdminProfileData] = useState({
    nombre: "",
    apellidos: "",
    email: "",
    telefono: "",
    emailNotificaciones: "inaviciba@gmail.com"
  });
  const [adminProfileLoading, setAdminProfileLoading] = useState(false);
  const [adminProfileError, setAdminProfileError] = useState("");
  const [adminProfileSuccess, setAdminProfileSuccess] = useState("");

  // Debug log helper
  const logDebug = (...args) => {
    // Descomenta la siguiente línea para ver logs
    console.debug("[AdminUsers DEBUG]", ...args);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setCurrentUser(u);
      if (!u) {
        setIsAdmin(false);
        logDebug("No user");
        return;
      }
      try {
        const token = await getIdTokenResult(u, true);
        const hasClaimAdmin = !!token?.claims?.admin;
        const byEmail = ADMIN_EMAILS.includes((u.email || "").toLowerCase());
        
        // Verificar también el campo 'rol' en Firestore
        let hasRolAdmin = false;
        try {
          const userDocRef = doc(db, "users", u.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            hasRolAdmin = userDoc.data().rol === "admin";
          }
        } catch (err) {
          logger.error("Error checking rol in Firestore:", err);
        }
        
        const resolvedIsAdmin = hasClaimAdmin || byEmail || hasRolAdmin;
        setIsAdmin(resolvedIsAdmin);
        logDebug("Auth:", { uid: u.uid, email: u.email, claims: token?.claims, byEmail, hasRolAdmin, resolvedIsAdmin });
      } catch (err) {
        logger.error("getIdTokenResult error:", err);
        const byEmail = ADMIN_EMAILS.includes((u.email || "").toLowerCase());
        
        // Verificar rol en Firestore como fallback
        let hasRolAdmin = false;
        try {
          const userDocRef = doc(db, "users", u.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            hasRolAdmin = userDoc.data().rol === "admin";
          }
        } catch (err2) {
          logger.error("Fallback rol check error:", err2);
        }
        
        setIsAdmin(byEmail || hasRolAdmin);
        logDebug("Fallback isAdmin by email:", { email: u.email, byEmail, hasRolAdmin });
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load users ordered by apellidos,nombre (fallback if index missing)
  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setIndexRequired(false);
    try {
      const q = query(collection(db, "users"), orderBy("apellidos", "asc"), orderBy("nombre", "asc"));
      const snap = await getDocs(q);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => {
          // Filtrar admins
          if (ADMIN_EMAILS.includes((u.email || "").toLowerCase())) return false;
          if (u.role === "admin" || u.rol === "admin") return false;
          // Filtrar usuarios sin datos válidos
          if (!u.nombre || !u.apellidos || !u.email) return false;
          // Filtrar usuarios con datos inválidos (solo "0" o vacíos)
          if (u.nombre === "0" || u.apellidos === "0") return false;
          return true;
        });
      
      // Eliminar duplicados por email
      const usuariosUnicos = list.filter((user, index, self) => 
        index === self.findIndex((u) => u.email === user.email)
      );
      
      setUsers(usuariosUnicos);
      // Restaurar usuario seleccionado por ID
      const savedUserId = localStorage.getItem("adminSelectedUserId");
      if (savedUserId) {
        const userIndex = list.findIndex(u => u.id === savedUserId);
        if (userIndex >= 0) {
          setSelectedIndex(userIndex);
        } else {
          setSelectedIndex(list.length ? 0 : -1);
        }
      } else {
        setSelectedIndex(list.length ? 0 : -1);
      }
    } catch (err) {
      console.error("Error fetching users with composite index:", err);
      const msg = err?.message || String(err);
      if (err?.code === "failed-precondition" || /requires an index/i.test(msg) || /create an index/i.test(msg)) {
        setIndexRequired(true);
        try {
          const snap = await getDocs(collection(db, "users")); // sin orderBy
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((u) => {
              // Filtrar admins
              if (ADMIN_EMAILS.includes((u.email || "").toLowerCase())) return false;
              if (u.role === "admin" || u.rol === "admin") return false;
              // Filtrar usuarios sin datos válidos
              if (!u.nombre || !u.apellidos || !u.email) return false;
              // Filtrar usuarios con datos inválidos (solo "0" o vacíos)
              if (u.nombre === "0" || u.apellidos === "0") return false;
              return true;
            });
          
          // Eliminar duplicados por email antes de ordenar
          const usuariosUnicos = list.filter((user, index, self) => 
            index === self.findIndex((u) => u.email === user.email)
          );
          
          usuariosUnicos.sort((a, b) => {
            const A = (a.apellidos || "").toString().trim().toLowerCase();
            const B = (b.apellidos || "").toString().trim().toLowerCase();
            if (A === B) {
              return (a.nombre || "").toString().trim().toLowerCase().localeCompare((b.nombre || "").toString().trim().toLowerCase());
            }
            return A.localeCompare(B);
          });
          setUsers(usuariosUnicos);
          // Restaurar usuario seleccionado por ID
          const savedUserId = localStorage.getItem("adminSelectedUserId");
          if (savedUserId) {
            const userIndex = list.findIndex(u => u.id === savedUserId);
            if (userIndex >= 0) {
              setSelectedIndex(userIndex);
            } else {
              setSelectedIndex(list.length ? 0 : -1);
            }
          } else {
            setSelectedIndex(list.length ? 0 : -1);
          }
        } catch (err2) {
          console.error("Fallback fetch users error:", err2);
          const msg2 = err2?.code ? `${err2.code}: ${err2.message}` : (err2?.message || String(err2));
          setError(`No se pudieron cargar los usuarios: ${msg2}`);
          setUsers([]);
        }
      } else {
        const human = err?.code ? `${err.code}: ${err.message}` : msg;
        setError(`No se pudieron cargar los usuarios: ${human}`);
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Cargar contador de solicitudes pendientes
  useEffect(() => {
    if (!isAdmin) return;
    
    const loadSolicitudesPendientes = async () => {
      try {
        const solicitudesSnapshot = await getDocs(collection(db, 'mensajes_admin'));
        const pendientes = solicitudesSnapshot.docs.filter(doc => !doc.data().leido).length;
        setSolicitudesPendientes(pendientes);
      } catch (err) {
        console.error('Error al cargar solicitudes pendientes:', err);
      }
    };

    loadSolicitudesPendientes();
    // Actualizar cada 30 segundos
    const interval = setInterval(loadSolicitudesPendientes, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // resize handlers
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizingRef.current) return;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.round(e.clientX - rect.left);
      const clamped = Math.max(MIN_LEFT, Math.min(MAX_LEFT, newWidth));
      setLeftWidth(clamped);
    };
    const onMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        localStorage.setItem("adminLeftWidth", String(leftWidthRef.current || leftWidth));
        document.body.style.userSelect = "";
      }
    };
    const onTouchMove = (e) => {
      if (!isResizingRef.current || !containerRef.current) return;
      const touch = e.touches[0];
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.round(touch.clientX - rect.left);
      const clamped = Math.max(MIN_LEFT, Math.min(MAX_LEFT, newWidth));
      setLeftWidth(clamped);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, [leftWidth]);

  const startResizing = (e) => {
    isResizingRef.current = true;
    document.body.style.userSelect = "none";
  };
  const startResizingTouch = (e) => {
    isResizingRef.current = true;
    document.body.style.userSelect = "none";
    e.preventDefault();
  };
  const resetLeftWidth = () => {
    const def = 360;
    setLeftWidth(def);
    localStorage.setItem("adminLeftWidth", String(def));
  };

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= DESKTOP_MIN_WIDTH);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Resetear el índice seleccionado cuando cambie el filtro
  useEffect(() => {
    // Si el índice actual está fuera del rango del array filtrado, resetearlo
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(filtered.length > 0 ? 0 : -1);
    }
  }, [filter, users, selectedIndex, estadoFiltro, planFiltro]);

  const prevUser = () => {
    setSelectedIndex((s) => Math.max(0, (s || 0) - 1));
    scrollListIntoView(Math.max(0, (selectedIndex || 0) - 1));
  };
  const nextUser = () => {
    setSelectedIndex((s) => Math.min(filtered.length - 1, (s || 0) + 1));
    scrollListIntoView(Math.min(filtered.length - 1, (selectedIndex || 0) + 1));
  };
  const scrollListIntoView = (index) => {
    const container = listRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-user-index="${index}"]`);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate("/");
      setTimeout(() => {
        if (auth.currentUser) window.location.reload();
      }, 700);
    } catch (err) {
      console.error("Admin sign out error:", err);
      setError("No se pudo cerrar sesión. Revisa la consola para más detalles.");
    }
  };

  // Función helper para normalizar el nombre del plan
  const normalizarPlan = (usuario) => {
    // Intentar obtener el plan de anamnesis.eligePlan o tipoPlan
    const tipoPlan = usuario?.anamnesis?.eligePlan || usuario?.tipoPlan;
    
    if (!tipoPlan || tipoPlan === "undefined" || tipoPlan === "null") return null;
    
    const plan = (tipoPlan + "").toLowerCase().trim();
    
    // Casos específicos con coincidencia exacta o parcial
    if (plan === "básico" || plan === "basico") return "basico";
    if (plan.includes("básico + ejercicio") || plan.includes("basico + ejercicio")) return "basico_ejercicios";
    if (plan === "seguimiento") return "seguimiento";
    if (plan === "gym") return "gym";
    
    return null;
  };

  // Contar usuarios por plan
  const contarPorPlan = () => {
    const counts = {
      basico: 0,
      basico_ejercicios: 0,
      seguimiento: 0,
      gym: 0,
      sin_plan: 0,
      total: 0
    };
    
    users.forEach(u => {
      const isActivo = u.activo !== false;
      if (estadoFiltro === "activos" && !isActivo) return;
      if (estadoFiltro === "desactivados" && isActivo) return;
      
      counts.total++;
      
      const planNormalizado = normalizarPlan(u);
      if (planNormalizado && counts.hasOwnProperty(planNormalizado)) {
        counts[planNormalizado]++;
      } else {
        counts.sin_plan++;
      }
    });
    
    return counts;
  };
  
  const planCounts = contarPorPlan();

  // Filtrar por estado activo/desactivado y por plan
  const filtered = users.filter((u) => {
    // Filtro de texto
    if (filter) {
      const s = filter.toLowerCase();
      const matchText = (u.apellidos || "").toLowerCase().includes(s) || 
                       (u.nombre || "").toLowerCase().includes(s) || 
                       (u.email || "").toLowerCase().includes(s);
      if (!matchText) return false;
    }
    
    // Filtro de estado activo (por defecto true si no existe)
    const isActivo = u.activo !== false;
    if (estadoFiltro === "activos" && !isActivo) return false;
    if (estadoFiltro === "desactivados" && isActivo) return false;
    
    // Filtro de plan
    if (planFiltro !== "todos") {
      const planNormalizado = normalizarPlan(u);
      
      if (planFiltro === "sin_plan") {
        // Mostrar solo usuarios sin plan definido
        if (planNormalizado !== null) return false;
      } else {
        // Si el plan es null (no definido) o no coincide con el filtro, excluir
        if (!planNormalizado || planNormalizado !== planFiltro) return false;
      }
    }
    
    return true;
  });

  // Función para obtener la tendencia del peso (comparar con peso anterior)
  const getPesoTrend = (user) => {
    if (!user.pesoActual) return null;
    
    const pesoActual = parseFloat(user.pesoActual);
    if (isNaN(pesoActual)) return null;

    // Buscar peso anterior en medidasHistorico o pesoHistorico
    const historial = user.medidasHistorico || user.pesoHistorico || [];
    if (!Array.isArray(historial) || historial.length < 2) return null;

    // Ordenar por fecha (más reciente primero)
    const sorted = [...historial].sort((a, b) => {
      const dateA = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const dateB = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return dateB - dateA;
    });

    // El segundo elemento es el peso anterior
    const pesoAnterior = parseFloat(sorted[1]?.peso || sorted[1]?.pesoActual);
    if (isNaN(pesoAnterior)) return null;

    const diferencia = pesoActual - pesoAnterior;
    
    if (Math.abs(diferencia) < 0.1) return null; // Sin cambio significativo

    return {
      direccion: diferencia > 0 ? 'up' : 'down',
      diferencia: Math.abs(diferencia).toFixed(1)
    };
  };

  // Función para eliminar usuario
  const handleDeleteUser = async (userId, userName, userEmail, e) => {
    e.stopPropagation(); // Evitar que se seleccione el usuario al hacer clic en eliminar
    
    const confirmMsg = `¿Estás seguro de que quieres eliminar definitivamente al usuario?\n\n${userName}\n${userEmail}\n\n⚠️ Esta acción no se puede deshacer.`;
    
    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      // Eliminar documento de Firestore
      await deleteDoc(doc(db, "users", userId));
      
      // Actualizar la lista local
      setUsers((prevUsers) => {
        const newUsers = prevUsers.filter((u) => u.id !== userId);
        // Ajustar el índice seleccionado si es necesario
        if (selectedIndex >= newUsers.length) {
          setSelectedIndex(Math.max(0, newUsers.length - 1));
        }
        return newUsers;
      });
      
      alert(`✅ Usuario eliminado: ${userName}`);
    } catch (err) {
      console.error("Error al eliminar usuario:", err);
      alert(`❌ Error al eliminar usuario: ${err.message}`);
    }
  };

  // Abrir modal de gestión de usuarios
  const handleGestionUsuarios = () => {
    setShowGestionModal(true);
  };

  // Abrir modal para crear nuevo cliente
  const handleNuevoCliente = () => {
    setShowGestionModal(false);
    setModalMode("create");
    setEditingUser(null);
    setFormData({
      nombre: "",
      apellidos: "",
      email: "",
      emailConfirmacion: "",
      password: "000000",
      nacimiento: "",
      telefono: "",
      objetivoNutricional: "",
      pesoActual: "",
      rol: "paciente"
    });
    setModalError("");
    setShowModal(true);
  };

  // Enviar email de restablecer contraseña
  const handleEnviarRestablecerPassword = async (usuario) => {
    if (!usuario || !usuario.email) {
      alert("No se puede enviar el email: falta el correo del usuario.");
      return;
    }

    const confirmar = window.confirm(
      `¿Enviar email de restablecimiento de contraseña a:\n\n${usuario.email}?`
    );

    if (!confirmar) return;

    try {
      await sendPasswordResetEmail(auth, usuario.email);
      alert(`✅ Email de restablecimiento enviado a ${usuario.email}`);
    } catch (err) {
      console.error("Error enviando email de restablecimiento:", err);
      alert(`❌ Error al enviar el email: ${err.message}`);
    }
  };

  // Cargar datos del perfil admin
  const loadAdminProfile = async () => {
    if (!currentUser) return;
    try {
      const adminDocRef = doc(db, "users", currentUser.uid);
      const adminDoc = await getDoc(adminDocRef);
      
      if (adminDoc.exists()) {
        const data = adminDoc.data();
        setAdminProfileData({
          nombre: data.nombre || "",
          apellidos: data.apellidos || "",
          email: currentUser.email || "",
          telefono: data.telefono || "",
          emailNotificaciones: data.emailNotificaciones || "inaviciba@gmail.com"
        });
      } else {
        setAdminProfileData({
          nombre: "",
          apellidos: "",
          email: currentUser.email || "",
          telefono: "",
          emailNotificaciones: "inaviciba@gmail.com"
        });
      }
    } catch (err) {
      console.error("Error cargando perfil admin:", err);
      setAdminProfileData({
        nombre: "",
        apellidos: "",
        email: currentUser.email || "",
        telefono: ""
      });
    }
  };

  // Guardar datos del perfil admin
  const handleGuardarAdminProfile = async (e) => {
    e.preventDefault();
    setAdminProfileError("");
    setAdminProfileSuccess("");
    setAdminProfileLoading(true);

    try {
      const { nombre, apellidos, email, telefono } = adminProfileData;
      const emailCambiado = email !== currentUser.email;

      // Si cambia el email, advertir al usuario
      if (emailCambiado) {
        const confirmar = window.confirm(
          `⚠️ Vas a cambiar el email de acceso de:\n\n${currentUser.email}\n\na:\n\n${email}\n\n` +
          `Después del cambio, tendrás que iniciar sesión con el nuevo email.\n\n` +
          `¿Deseas continuar?`
        );
        
        if (!confirmar) {
          setAdminProfileLoading(false);
          return;
        }
      }

      // Actualizar datos en Firestore primero
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        nombre,
        apellidos,
        email,
        telefono,
        emailNotificaciones: adminProfileData.emailNotificaciones
      });

      // Actualizar email si cambió
      if (emailCambiado) {
        try {
          const { updateEmail } = await import("firebase/auth");
          await updateEmail(currentUser, email);
          
          // Mostrar mensaje y cerrar sesión
          alert("✅ Email actualizado correctamente.\n\nAhora serás redirigido al login para que entres con tu nuevo email.");
          await signOut(auth);
          navigate("/login");
          return;
        } catch (emailError) {
          // Si falla por autenticación reciente, pedir re-autenticación
          if (emailError.code === "auth/requires-recent-login") {
            setAdminProfileError(
              "Para cambiar el email necesitas haber iniciado sesión recientemente. " +
              "Por seguridad, cierra sesión y vuelve a entrar, luego intenta cambiar el email de nuevo."
            );
          } else if (emailError.code === "auth/email-already-in-use") {
            setAdminProfileError("Este email ya está siendo usado por otra cuenta.");
          } else {
            setAdminProfileError(`Error al actualizar email: ${emailError.message}`);
          }
          setAdminProfileLoading(false);
          return;
        }
      }

      setAdminProfileSuccess("✓ Perfil actualizado correctamente");
      setTimeout(() => {
        setAdminProfileSuccess("");
      }, 3000);
    } catch (err) {
      console.error("Error guardando perfil admin:", err);
      setAdminProfileError(err.message || "Error al guardar el perfil");
    } finally {
      setAdminProfileLoading(false);
    }
  };

  // Cargar perfil cuando se abre el modal
  useEffect(() => {
    if (showAdminProfile) {
      loadAdminProfile();
    }
  }, [showAdminProfile]);

  // Abrir modal para editar cliente
  const handleEditarCliente = (usuario, e) => {
    if (e) e.stopPropagation();
    setShowGestionModal(false);
    setModalMode("edit");
    setEditingUser(usuario);
    setFormData({
      nombre: usuario.nombre || "",
      apellidos: usuario.apellidos || "",
      email: usuario.email || "",
      password: "",
      nacimiento: usuario.nacimiento || "",
      telefono: usuario.telefono || "",
      objetivoNutricional: usuario.objetivoNutricional || "",
      pesoActual: usuario.pesoActual || "",
      rol: usuario.rol || "paciente",
      tipoPlan: ""
    });
    setModalError("");
    setShowModal(true);
  };

  // Guardar (crear o editar)
  const handleGuardar = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError("");

    try {
      if (modalMode === "create") {
        // Validar que los emails coincidan
        if (formData.email !== formData.emailConfirmacion) {
          setModalError("Los emails no coinciden. Por favor, verifícalos.");
          setModalLoading(false);
          return;
        }

        // Validar que se haya seleccionado un plan
        if (!formData.tipoPlan || formData.tipoPlan.trim() === "") {
          setModalError("Debes seleccionar un tipo de plan para el usuario.");
          setModalLoading(false);
          return;
        }

        // Crear nuevo usuario usando Cloud Function
        const createUser = httpsCallable(functions, "createUser");
        await createUser({
          nombre: formData.nombre,
          apellidos: formData.apellidos,
          email: formData.email,
          password: formData.password,
          nacimiento: formData.nacimiento,
          telefono: formData.telefono,
          objetivoNutricional: formData.objetivoNutricional,
          pesoActual: formData.pesoActual ? parseFloat(formData.pesoActual) : null,
          rol: formData.rol,
          tipoPlan: formData.tipoPlan
        });
        alert("Cliente creado correctamente");
        
        // Recargar usuarios
        const q = query(collection(db, "users"), orderBy("apellidos", "asc"), orderBy("nombre", "asc"));
        const snap = await getDocs(q);
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => !ADMIN_EMAILS.includes((u.email || "").toLowerCase()));
        setUsers(list);
      } else {
        // Editar usuario existente usando Cloud Function
        const updateUser = httpsCallable(functions, "updateUser");
        await updateUser({
          uid: editingUser.id,
          nombre: formData.nombre,
          apellidos: formData.apellidos,
          nacimiento: formData.nacimiento,
          telefono: formData.telefono,
          objetivoNutricional: formData.objetivoNutricional,
          pesoActual: formData.pesoActual ? parseFloat(formData.pesoActual) : null,
          rol: formData.rol
        });
        
        // Actualizar en la lista local
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u.id === editingUser.id ? { 
              ...u, 
              nombre: formData.nombre,
              apellidos: formData.apellidos,
              nacimiento: formData.nacimiento,
              telefono: formData.telefono,
              objetivoNutricional: formData.objetivoNutricional,
              pesoActual: formData.pesoActual ? parseFloat(formData.pesoActual) : null,
              rol: formData.rol
            } : u
          )
        );
        
        alert("Cliente actualizado correctamente");
      }

      setShowModal(false);
    } catch (err) {
      console.error("Error al guardar:", err);
      setModalError(err.message || "Error al guardar el cliente");
    } finally {
      setModalLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="layout admin-fullscreen">
        <div className="card">
          <p style={{ padding: 16 }}>Inicia sesión para acceder al panel de administración.</p>
          <div style={{ padding: 12, color: "#666" }}>
            Si ya estás autenticado en Firebase Console pero no aquí, revisa la consola del navegador para ver errores de auth.
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="layout admin-fullscreen">
        <div className="card" style={{ maxWidth: 720, margin: "40px auto", textAlign: "center" }}>
          <h3 style={{ marginTop: 8 }}>Sin permisos de administrador</h3>
          <p style={{ color: "#666" }}>
            Tu cuenta (<strong>{currentUser.email}</strong>) no tiene permisos para acceder al panel de administración.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
            <button className="btn primary" onClick={() => navigate("/mi-ficha")}>Ver mi ficha</button>
            <button className="btn ghost" onClick={() => handleSignOut()}>Cerrar sesión</button>
          </div>

          <div style={{ marginTop: 12, color: "#666", fontSize: 13 }}>
            Si crees que deberías tener acceso, verifica:
            <ul style={{ textAlign: "left", display: "inline-block", marginTop: 8 }}>
              <li>Que estás con el email correcto (compara con: {ADMIN_EMAILS.join(", ")})</li>
              <li>O que tu usuario tenga el custom claim <code>admin: true</code> (recomendado)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // admin allowed even on small screens for convenience
  return (
    <div className="admin-fullscreen" ref={containerRef} style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden', paddingBottom: isMobile ? '70px' : '0' }}>
      <div className="card header" style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        padding: isMobile ? "6px 8px" : "8px 12px",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? "8px" : "0",
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden'
      }}>
        <div style={{ width: isMobile ? "100%" : "auto", textAlign: isMobile ? "center" : "left" }}>
          <div className="title" style={{ fontSize: isMobile ? "14px" : "16px", marginBottom: "2px" }}>
            Panel administrativo <span style={{ color: '#666', fontWeight: '400', fontSize: isMobile ? '12px' : '14px' }}>({filtered.length} usuarios)</span>
          </div>
          {!isMobile && (
            <>
              <div style={{ fontSize: "10px", color: '#16a34a', fontWeight: '500', marginBottom: "2px" }}>
                Sesión: {currentUser?.email}
              </div>
              <div className="subtitle" style={{ fontSize: "11px" }}>
                Navega por los usuarios y edita sus fichas
              </div>
            </>
          )}
        </div>
        
        <div style={{ display: "flex", gap: isMobile ? "4px" : "6px", alignItems: "center", flexWrap: "wrap", justifyContent: isMobile ? "center" : "flex-start", width: isMobile ? "100%" : "auto", maxWidth: '100%', overflow: 'hidden' }}>
          {!isMobile && (
            <>
              <button className="btn primary" onClick={() => navigate("/admin/pagos")} style={{ padding: "6px 10px", fontSize: "13px" }}>💰 Pagos</button>
              <button className="btn primary" onClick={() => navigate("/admin/tarifas")} style={{ padding: "6px 10px", fontSize: "13px" }}>Tarifas</button>
              <div style={{ 
                height: "20px", 
                width: "1px", 
                backgroundColor: "#d1d5db", 
                margin: "0 2px" 
              }}></div>
              <button className="btn primary" onClick={() => navigate("/admin/menus")} style={{ padding: "6px 10px", fontSize: "13px" }}>📋 Menús</button>
              <button className="btn primary" onClick={() => navigate("/admin/agenda")} style={{ padding: "6px 10px", fontSize: "13px" }}>📅 Agenda</button>
              <button className="btn primary" onClick={() => navigate("/admin/gym")} style={{ padding: "6px 10px", fontSize: "13px" }}>🏋️ GYM</button>
              <button 
                className="btn primary" 
                onClick={() => navigate("/admin/mensajes")} 
                style={{ 
                  padding: "6px 10px", 
                  fontSize: "13px",
                  position: 'relative'
                }}
              >
                💬 MSG
                {solicitudesPendientes > 0 && (
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
                    {solicitudesPendientes}
                  </span>
                )}
              </button>
              <button className="btn primary" onClick={() => navigate("/admin/recursos")} style={{ padding: "6px 10px", fontSize: "13px" }}>📁 Recursos</button>
            </>
          )}
          {!isMobile && <button className="btn primary" onClick={handleGestionUsuarios} style={{ fontWeight: "bold", padding: "6px 10px", fontSize: "13px" }}>👥 Gestión de Usuarios</button>}
          {!isMobile && <button className="btn primary" onClick={() => { setShowAdminProfile(true); loadAdminProfile(); }} style={{ padding: "6px 10px", fontSize: "13px" }}>👤 Perfil</button>}
          {!isMobile && <>
            <button className="btn danger" onClick={handleSignOut} style={{ padding: "6px 10px", fontSize: "13px" }}>Cerrar sesión</button>
            <button
              className="btn primary"
              onClick={() => setShowHelpModal(true)}
              style={{ padding: "6px 10px", fontSize: "13px", background: "linear-gradient(90deg,#a7f3d0,#6ee7b7)", color: "#065f46", fontWeight: 600, border: "none", marginLeft: 4 }}
              title="Ayuda"
            >
              <span style={{ fontWeight: 700, fontSize: 16, marginRight: 4 }}>?</span> Ayuda
            </button>
          </>}
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
                </div>
                <HelpForm onClose={() => setShowHelpModal(false)} />
              </div>
            </div>
          )}


        </div>
      </div>

      <div className="admin-columns" style={{ marginTop: 8, flexDirection: isMobile ? "column" : "row", width: '100%', boxSizing: 'border-box' }}>
        {/* Left panel: listado (ancho controlado por leftWidth) */}
        {panelVisible && (
          <>
            <div
              className="card admin-left"
              style={{ padding: isMobile ? 12 : 8, width: isMobile ? "100%" : `${leftWidth}px`, flexShrink: 0, marginBottom: isMobile ? "12px" : "0", boxSizing: 'border-box', overflowX: 'hidden', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <input className="input" placeholder="Buscar por apellidos, nombre o email..." value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: "100%", padding: isMobile ? "10px 12px" : "6px 8px", fontSize: isMobile ? "15px" : "13px", flexShrink: 0, borderRadius: "8px", border: isMobile ? "2px solid #e5e7eb" : "1px solid #ddd" }} />
              
              {/* Filtro de estado activo/desactivado */}
              <div style={{ marginTop: isMobile ? 10 : 6, display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <button
                  onClick={() => setEstadoFiltro("activos")}
                  style={{
                    flex: 1,
                    minWidth: "80px",
                    padding: "6px 12px",
                    fontSize: "13px",
                    fontWeight: estadoFiltro === "activos" ? "600" : "500",
                    backgroundColor: estadoFiltro === "activos" ? "#16a34a" : "#f1f5f9",
                    color: estadoFiltro === "activos" ? "white" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  ✅ Activos
                </button>
                <button
                  onClick={() => setEstadoFiltro("desactivados")}
                  style={{
                    flex: 1,
                    minWidth: "80px",
                    padding: "6px 12px",
                    fontSize: "13px",
                    fontWeight: estadoFiltro === "desactivados" ? "600" : "500",
                    backgroundColor: estadoFiltro === "desactivados" ? "#ef4444" : "#f1f5f9",
                    color: estadoFiltro === "desactivados" ? "white" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  ⛔ Desactivados
                </button>
                <button
                  onClick={() => setEstadoFiltro("todos")}
                  style={{
                    flex: 1,
                    minWidth: "80px",
                    padding: "6px 12px",
                    fontSize: "13px",
                    fontWeight: estadoFiltro === "todos" ? "600" : "500",
                    backgroundColor: estadoFiltro === "todos" ? "#3b82f6" : "#f1f5f9",
                    color: estadoFiltro === "todos" ? "white" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  📋 Todos
                </button>
              </div>
              
              {/* Filtro de planes */}
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <button
                  onClick={() => setPlanFiltro("todos")}
                  style={{
                    padding: "5px 10px",
                    fontSize: "11px",
                    fontWeight: "600",
                    backgroundColor: planFiltro === "todos" ? "#3b82f6" : "#f1f5f9",
                    color: planFiltro === "todos" ? "white" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  📋 Todos
                  {planCounts.total > 0 && (
                    <span style={{
                      backgroundColor: planFiltro === "todos" ? "rgba(255,255,255,0.3)" : "#cbd5e1",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "10px",
                      fontWeight: "700"
                    }}>
                      {planCounts.total}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setPlanFiltro("basico")}
                  style={{
                    padding: "5px 10px",
                    fontSize: "11px",
                    fontWeight: "600",
                    backgroundColor: planFiltro === "basico" ? "#3b82f6" : "#f1f5f9",
                    color: planFiltro === "basico" ? "white" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  Básico
                  {planCounts.basico > 0 && (
                    <span style={{
                      backgroundColor: planFiltro === "basico" ? "rgba(255,255,255,0.3)" : "#cbd5e1",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "10px",
                      fontWeight: "700"
                    }}>
                      {planCounts.basico}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setPlanFiltro("basico_ejercicios")}
                  style={{
                    padding: "5px 10px",
                    fontSize: "11px",
                    fontWeight: "600",
                    backgroundColor: planFiltro === "basico_ejercicios" ? "#3b82f6" : "#f1f5f9",
                    color: planFiltro === "basico_ejercicios" ? "white" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  Básico + Ejercicios
                  {planCounts.basico_ejercicios > 0 && (
                    <span style={{
                      backgroundColor: planFiltro === "basico_ejercicios" ? "rgba(255,255,255,0.3)" : "#cbd5e1",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "10px",
                      fontWeight: "700"
                    }}>
                      {planCounts.basico_ejercicios}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setPlanFiltro("seguimiento")}
                  style={{
                    padding: "5px 10px",
                    fontSize: "11px",
                    fontWeight: "600",
                    backgroundColor: planFiltro === "seguimiento" ? "#3b82f6" : "#f1f5f9",
                    color: planFiltro === "seguimiento" ? "white" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  Seguimiento
                  {planCounts.seguimiento > 0 && (
                    <span style={{
                      backgroundColor: planFiltro === "seguimiento" ? "rgba(255,255,255,0.3)" : "#cbd5e1",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "10px",
                      fontWeight: "700"
                    }}>
                      {planCounts.seguimiento}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setPlanFiltro("gym")}
                  style={{
                    padding: "5px 10px",
                    fontSize: "11px",
                    fontWeight: "600",
                    backgroundColor: planFiltro === "gym" ? "#3b82f6" : "#f1f5f9",
                    color: planFiltro === "gym" ? "white" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  GYM
                  {planCounts.gym > 0 && (
                    <span style={{
                      backgroundColor: planFiltro === "gym" ? "rgba(255,255,255,0.3)" : "#cbd5e1",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "10px",
                      fontWeight: "700"
                    }}>
                      {planCounts.gym}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setPlanFiltro("sin_plan")}
                  style={{
                    padding: "5px 10px",
                    fontSize: "11px",
                    fontWeight: "600",
                    backgroundColor: planFiltro === "sin_plan" ? "#f59e0b" : "#f1f5f9",
                    color: planFiltro === "sin_plan" ? "white" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  ⚠️ Sin plan
                  {planCounts.sin_plan > 0 && (
                    <span style={{
                      backgroundColor: planFiltro === "sin_plan" ? "rgba(255,255,255,0.3)" : "#fbbf24",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "10px",
                      fontWeight: "700",
                      color: planFiltro === "sin_plan" ? "white" : "#78350f"
                    }}>
                      {planCounts.sin_plan}
                    </span>
                  )}
                </button>
              </div>
              
              <div ref={listRef} style={{ marginTop: isMobile ? 10 : 6, flex: 1, overflowY: "auto", overflowX: "hidden" }}>
                {loading ? (
                  <div style={{ padding: isMobile ? 16 : 8, textAlign: "center", color: "#64748b" }}>Cargando usuarios...</div>
                ) : error ? (
                  <div style={{ color: "var(--danger, #b91c1c)", padding: isMobile ? 16 : 8, background: "#fee2e2", borderRadius: "8px" }}>{error}</div>
                ) : isMobile ? (
                  filter.length < 2 ? (
                    null
                  ) : filtered.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "#64748b", fontSize: 15 }}>No se encontraron usuarios.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1px", padding: "0" }}>
                      {filtered.map((u, i) => (
                        <div
                          key={u.id}
                          data-user-index={i}
                          style={{
                            padding: "12px 10px",
                            background: i === selectedIndex ? "#dcfce7" : "white",
                            borderLeft: `3px solid ${i === selectedIndex ? '#16a34a' : 'transparent'}`,
                            cursor: "pointer",
                            transition: "all 0.15s",
                            borderBottom: "1px solid #f1f5f9"
                          }}
                          onClick={() => {
                            setSelectedIndex(i);
                            localStorage.setItem("adminSelectedUserId", u.id);
                          }}
                        >
                          <div style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a", marginBottom: "3px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>{`${(u.apellidos || "").trim()} ${(u.nombre || "").trim()}`.trim() || u.email}</span>
                            {u.activo === false && (
                              <span style={{
                                fontSize: "10px",
                                fontWeight: "600",
                                backgroundColor: "#ef4444",
                                color: "white",
                                padding: "2px 6px",
                                borderRadius: "4px"
                              }}>
                                DESACTIVADO
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{u.email}</span>
                            {u.pesoActual && (
                              <>
                                <span>•</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
                                  {u.pesoActual} kg
                                  {(() => {
                                    const trend = getPesoTrend(u);
                                    if (!trend) return null;
                                    const tooltipText = `${trend.direccion === 'down' ? 'Bajó' : 'Subió'} ${trend.diferencia}kg`;
                                    return (
                                      <span 
                                        style={{ 
                                          fontSize: '14px',
                                          color: trend.direccion === 'down' ? '#16a34a' : '#dc2626',
                                          fontWeight: 'bold',
                                          cursor: 'help'
                                        }} 
                                        title={tooltipText}
                                        aria-label={tooltipText}
                                      >
                                        {trend.direccion === 'down' ? '↓' : '↑'}
                                      </span>
                                    );
                                  })()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  // Vista desktop - Lista compacta
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {filtered.map((u, i) => (
                      <li
                        key={u.id}
                        data-user-index={i}
                        style={{
                          padding: 6,
                          borderBottom: "1px solid #eee",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: i === selectedIndex ? "rgba(22,163,74,0.06)" : undefined,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setSelectedIndex(i);
                          localStorage.setItem("adminSelectedUserId", u.id);
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong style={{ fontSize: 13 }}>{`${(u.apellidos || "").trim()} ${(u.nombre || "").trim()}`.trim() || u.email}</strong>
                            {u.activo === false && (
                              <span style={{
                                fontSize: "9px",
                                fontWeight: "600",
                                backgroundColor: "#ef4444",
                                color: "white",
                                padding: "2px 5px",
                                borderRadius: "3px"
                              }}>
                                DESACTIVADO
                              </span>
                            )}
                          </div>
                          <small style={{ color: "#666", fontSize: "11px" }}>{u.email}</small>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                          <div style={{ fontSize: 11, color: "#666", display: 'flex', alignItems: 'center', gap: '3px', position: 'relative' }}>
                            {u.pesoActual ? `${u.pesoActual} kg` : ""}
                            {u.pesoActual && (() => {
                              const trend = getPesoTrend(u);
                              if (!trend) return null;
                              const tooltipText = `${trend.direccion === 'down' ? 'Bajó' : 'Subió'} ${trend.diferencia}kg`;
                              return (
                                <span 
                                  style={{ 
                                    fontSize: '13px',
                                    color: trend.direccion === 'down' ? '#16a34a' : '#dc2626',
                                    fontWeight: 'bold',
                                    marginLeft: '2px',
                                    cursor: 'help',
                                    position: 'relative'
                                  }} 
                                  title={tooltipText}
                                  aria-label={tooltipText}
                                >
                                  {trend.direccion === 'down' ? '↓' : '↑'}
                                </span>
                              );
                            })()}
                          </div>
                          <button
                            onClick={(e) => handleEditarCliente(u, e)}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "3px 5px",
                              borderRadius: "3px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.2s",
                              color: "#2196F3",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(33, 150, 243, 0.1)";
                              e.currentTarget.style.transform = "scale(1.1)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                            title="Editar usuario"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDeleteUser(u.id, `${(u.apellidos || "").trim()} ${(u.nombre || "").trim()}`.trim() || u.email, u.email, e)}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "3px 5px",
                              borderRadius: "3px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.2s",
                              color: "#dc2626",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(220, 38, 38, 0.1)";
                              e.currentTarget.style.transform = "scale(1.1)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                            title="Eliminar usuario"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* If index required */}
              {indexRequired && (
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <div style={{ color: "#666" }}>Para un rendimiento óptimo crea este índice compuesto en Firestore:</div>
                  <a href={`https://console.firebase.google.com/project/${db.app.options.projectId}/firestore/indexes`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 6 }}>
                    Ir a índices de Firestore
                  </a>
                </div>
              )}
            </div>

            {/* Resizer divider */}
            {!isMobile && (
              <div
                className="resizer"
                onMouseDown={startResizing}
                onDoubleClick={resetLeftWidth}
                onTouchStart={startResizingTouch}
                role="separator"
                aria-orientation="vertical"
                aria-label="Redimensionar panel izquierdo"
                title="Arrastra para redimensionar (doble clic para reset)"
              />
            )}
          </>
        )}

        {/* Right panel: ficha */}
        <div className="card admin-right" style={{ padding: 0, position: 'relative', boxSizing: 'border-box', overflowX: 'hidden', width: '100%' }}>
          {filtered.length > 0 && selectedIndex >= 0 && selectedIndex < filtered.length ? (
            <div style={{ padding: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: 'relative' }}>
                {/* Botón para ocultar/mostrar panel */}
                <button
                  onClick={() => setPanelVisible(!panelVisible)}
                  title={panelVisible ? "Ocultar panel de usuarios" : "Mostrar panel de usuarios"}
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '-6px',
                    zIndex: 10,
                    background: 'rgba(22, 163, 74, 0.9)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(22, 163, 74, 1)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(22, 163, 74, 0.9)'}
                >
                  {panelVisible ? '◀' : '▶'}
                </button>

                {!isMobile && (
                  <>
                    <h3 style={{ margin: 0, fontSize: "16px" }}>{filtered[selectedIndex].apellidos ? `${filtered[selectedIndex].apellidos} ${filtered[selectedIndex].nombre || ""}` : (filtered[selectedIndex].nombre || filtered[selectedIndex].email)}</h3>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn ghost" onClick={() => prevUser()} disabled={selectedIndex <= 0} style={{ padding: "5px 10px", fontSize: "12px" }}>Anterior</button>
                      <button className="btn ghost" onClick={() => nextUser()} disabled={selectedIndex >= filtered.length - 1} style={{ padding: "5px 10px", fontSize: "12px" }}>Siguiente</button>
                    </div>
                  </>
                )}
              </div>

              <div style={{ marginTop: 8 }}>
                <FichaUsuario 
                  targetUid={filtered[selectedIndex].id} 
                  adminMode={true} 
                  onUsuarioUpdated={loadUsers}
                />
              </div>
            </div>
          ) : (
            <div style={{ padding: 16 }}>Selecciona un usuario para editar su ficha.</div>
          )}
        </div>
      </div>

      {/* Modal para perfil de admin */}
      {showAdminProfile && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: isMobile ? "0" : "20px"
        }}>
          <div style={{
            backgroundColor: "white",
            padding: isMobile ? "20px" : "24px",
            borderRadius: isMobile ? "0" : "8px",
            width: isMobile ? "100%" : "500px",
            minHeight: isMobile ? "100vh" : "auto",
            maxHeight: isMobile ? "100vh" : "90vh",
            overflowY: "auto",
            boxSizing: "border-box"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: isMobile ? "20px" : "18px", margin: "0", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ 
                  width: "32px", 
                  height: "32px", 
                  borderRadius: "50%", 
                  backgroundColor: "#64748b", 
                  color: "white",
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  fontSize: "18px"
                }}>
                  👤
                </span>
                Perfil de Administrador
              </h2>
              <button
                onClick={() => {
                  setShowAdminProfile(false);
                  setAdminProfileError("");
                  setAdminProfileSuccess("");
                }}
                style={{
                  background: "#fee2e2",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "18px",
                  color: "#dc2626"
                }}
              >
                ✕
              </button>
            </div>

            {adminProfileError && (
              <div style={{ color: "#dc2626", marginBottom: 12, padding: 12, backgroundColor: "#fee2e2", borderRadius: "8px", fontSize: "14px", border: "2px solid #dc2626" }}>
                ⚠️ {adminProfileError}
              </div>
            )}

            {adminProfileSuccess && (
              <div style={{ color: "#16a34a", marginBottom: 12, padding: 12, backgroundColor: "#dcfce7", borderRadius: "8px", fontSize: "14px", border: "2px solid #16a34a" }}>
                {adminProfileSuccess}
              </div>
            )}

            <form onSubmit={handleGuardarAdminProfile}>
              <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "16px" : "12px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={adminProfileData.nombre}
                    onChange={(e) => setAdminProfileData({ ...adminProfileData, nombre: e.target.value })}
                    style={{
                      width: "100%",
                      padding: isMobile ? "12px" : "10px",
                      fontSize: isMobile ? "16px" : "14px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "8px",
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>
                    Apellidos
                  </label>
                  <input
                    type="text"
                    value={adminProfileData.apellidos}
                    onChange={(e) => setAdminProfileData({ ...adminProfileData, apellidos: e.target.value })}
                    style={{
                      width: "100%",
                      padding: isMobile ? "12px" : "10px",
                      fontSize: isMobile ? "16px" : "14px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "8px",
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={adminProfileData.email}
                    onChange={(e) => setAdminProfileData({ ...adminProfileData, email: e.target.value })}
                    style={{
                      width: "100%",
                      padding: isMobile ? "12px" : "10px",
                      fontSize: isMobile ? "16px" : "14px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "8px",
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={adminProfileData.telefono}
                    onChange={(e) => setAdminProfileData({ ...adminProfileData, telefono: e.target.value })}
                    style={{
                      width: "100%",
                      padding: isMobile ? "12px" : "10px",
                      fontSize: isMobile ? "16px" : "14px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "8px",
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>
                    📧 Email para notificaciones
                  </label>
                  <input
                    type="email"
                    value={adminProfileData.emailNotificaciones}
                    onChange={(e) => setAdminProfileData({ ...adminProfileData, emailNotificaciones: e.target.value })}
                    placeholder="inaviciba@gmail.com"
                    style={{
                      width: "100%",
                      padding: isMobile ? "12px" : "10px",
                      fontSize: isMobile ? "16px" : "14px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "8px",
                      boxSizing: "border-box"
                    }}
                  />
                  <small style={{ display: "block", marginTop: "4px", color: "#64748b", fontSize: "12px" }}>
                    Email donde se recibirán las solicitudes de GYM y otras notificaciones
                  </small>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>
                    Rol
                  </label>
                  <input
                    type="text"
                    value="Administrador"
                    disabled
                    style={{
                      width: "100%",
                      padding: isMobile ? "12px" : "10px",
                      fontSize: isMobile ? "16px" : "14px",
                      border: "2px solid #e5e7eb",
                      borderRadius: "8px",
                      boxSizing: "border-box",
                      backgroundColor: "#f5f5f5",
                      color: "#64748b"
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={adminProfileLoading}
                  style={{
                    width: "100%",
                    padding: isMobile ? "14px" : "12px",
                    fontSize: isMobile ? "16px" : "14px",
                    fontWeight: "600"
                  }}
                >
                  {adminProfileLoading ? "Guardando..." : "💾 Guardar Cambios"}
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowAdminProfile(false);
                    window.location.href = "#/cambiar-password";
                  }}
                  style={{
                    width: "100%",
                    padding: isMobile ? "14px" : "12px",
                    fontSize: isMobile ? "16px" : "14px",
                    fontWeight: "600",
                    backgroundColor: "#64748b",
                    color: "white"
                  }}
                >
                  🔒 Cambiar Contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gestión de Usuarios */}
      {showGestionModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 10000,
          padding: "20px"
        }}>
          <div style={{
            backgroundColor: "white",
            padding: isMobile ? "20px" : "30px",
            borderRadius: "12px",
            width: "100%",
            maxWidth: "1400px",
            maxHeight: "90vh",
            overflowY: "auto",
            boxSizing: "border-box"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: isMobile ? "20px" : "22px", margin: "0", color: "#0f172a" }}>
                👥 Gestión de Usuarios
              </h2>
              <button
                onClick={() => setShowGestionModal(false)}
                style={{
                  background: "#fee2e2",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "20px",
                  color: "#dc2626"
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <button
                onClick={handleNuevoCliente}
                className="btn primary"
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  borderRadius: "8px"
                }}
              >
                ➕ Crear Nuevo Usuario
              </button>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <input
                className="input"
                placeholder="Buscar por nombre, apellidos o email..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "15px",
                  borderRadius: "8px",
                  border: "2px solid #e5e7eb"
                }}
              />
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: isMobile ? "13px" : "14px"
              }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: "600", color: "#475569" }}>Nombre</th>
                    <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: "600", color: "#475569" }}>Email</th>
                    <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: "600", color: "#475569" }}>Teléfono</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontWeight: "600", color: "#475569" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                        No se encontraron usuarios
                      </td>
                    </tr>
                  ) : (
                    filtered.map((usuario) => (
                      <tr key={usuario.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 8px" }}>
                          <div style={{ fontWeight: "600", color: "#0f172a" }}>
                            {usuario.nombre} {usuario.apellidos}
                          </div>
                        </td>
                        <td style={{ padding: "12px 8px", color: "#64748b" }}>
                          {usuario.email}
                        </td>
                        <td style={{ padding: "12px 8px", color: "#64748b" }}>
                          {usuario.telefono || "-"}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
                            <button
                              onClick={(e) => handleEditarCliente(usuario, e)}
                              className="btn primary"
                              style={{
                                padding: "6px 10px",
                                fontSize: "12px",
                                background: "#3b82f6",
                                fontWeight: "600",
                                whiteSpace: "nowrap"
                              }}
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={(e) => {
                                handleDeleteUser(
                                  usuario.id, 
                                  `${usuario.nombre || ''} ${usuario.apellidos || ''}`.trim() || usuario.email,
                                  usuario.email,
                                  e
                                );
                              }}
                              className="btn danger"
                              style={{
                                padding: "6px 10px",
                                fontSize: "12px",
                                background: "#dc2626",
                                color: "white",
                                border: "none",
                                fontWeight: "600",
                                whiteSpace: "nowrap"
                              }}
                            >
                              🗑️ Borrar
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEnviarRestablecerPassword(usuario);
                              }}
                              className="btn"
                              style={{
                                padding: "6px 10px",
                                fontSize: "12px",
                                background: "#0284c7",
                                color: "white",
                                border: "none",
                                fontWeight: "600",
                                whiteSpace: "nowrap"
                              }}
                            >
                              📧 Mail
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button
                onClick={() => setShowGestionModal(false)}
                className="btn ghost"
                style={{
                  padding: "12px 24px",
                  fontSize: "14px"
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear/editar usuario */}
      {showModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: isMobile ? "flex-start" : "center",
          zIndex: 10000,
          overflowY: "auto",
          padding: isMobile ? "0" : "20px"
        }}>
          <div style={{
            backgroundColor: "white",
            padding: isMobile ? "16px" : "24px",
            borderRadius: isMobile ? "0" : "8px",
            width: isMobile ? "100%" : "95%",
            maxWidth: isMobile ? "100%" : "1200px",
            minHeight: isMobile ? "100vh" : "auto",
            maxHeight: isMobile ? "100vh" : "90vh",
            overflowY: "auto",
            boxSizing: "border-box"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2 style={{ fontSize: isMobile ? "18px" : "16px", margin: "0", padding: "4px 0", color: "#0f172a" }}>
                {modalMode === "create" ? "➕ Nuevo Cliente" : "✏️ Editar Cliente"}
              </h2>
              {isMobile && (
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    background: "#fee2e2",
                    border: "none",
                    borderRadius: "50%",
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: "18px",
                    color: "#dc2626"
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            
            <button
              type="button"
              onClick={() => setShowInfoPermisos(true)}
              style={{
                width: "100%",
                padding: isMobile ? "12px" : "8px 12px",
                backgroundColor: "#dbeafe",
                border: "2px solid #3b82f6",
                borderRadius: isMobile ? "8px" : "6px",
                color: "#1e40af",
                fontWeight: "600",
                fontSize: isMobile ? "14px" : "13px",
                cursor: "pointer",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#bfdbfe";
                e.currentTarget.style.borderColor = "#2563eb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#dbeafe";
                e.currentTarget.style.borderColor = "#3b82f6";
              }}
            >
              ℹ️ INFO DE PERMISOS
            </button>
            
            {modalError && (
              <div style={{ color: "#dc2626", marginBottom: isMobile ? 12 : 2, padding: isMobile ? 12 : 3, backgroundColor: "#fee2e2", borderRadius: isMobile ? "8px" : "4px", fontSize: isMobile ? "14px" : "12px", border: "2px solid #dc2626" }}>
                ⚠️ {modalError}
              </div>
            )}

            <form onSubmit={handleGuardar}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "12px" : "8px" }}>
                <div style={{ marginBottom: isMobile ? 0 : 6 }}>
                  <label style={{ display: "block", marginBottom: isMobile ? 6 : 2, fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>Nombre *</label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    style={{ width: "100%", padding: isMobile ? "12px" : "6px", fontSize: isMobile ? "16px" : "13px", border: "2px solid #e5e7eb", borderRadius: isMobile ? "8px" : "4px", boxSizing: "border-box" }}
                  />
                </div>

              <div style={{ marginBottom: isMobile ? 0 : 6 }}>
                <label style={{ display: "block", marginBottom: isMobile ? 6 : 2, fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>Apellidos *</label>
                <input
                  type="text"
                  required
                  value={formData.apellidos}
                  onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                  style={{ width: "100%", padding: isMobile ? "12px" : "6px", fontSize: isMobile ? "16px" : "13px", border: "2px solid #e5e7eb", borderRadius: isMobile ? "8px" : "4px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: isMobile ? 0 : 6, gridColumn: isMobile ? "1" : "span 2" }}>
                <label style={{ display: "block", marginBottom: isMobile ? 6 : 2, fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={modalMode === "edit"}
                  style={{ 
                    width: "100%", 
                    padding: isMobile ? "12px" : "6px", 
                    fontSize: isMobile ? "16px" : "13px", 
                    border: "2px solid #e5e7eb", 
                    borderRadius: isMobile ? "8px" : "4px",
                    backgroundColor: modalMode === "edit" ? "#f5f5f5" : "white",
                    boxSizing: "border-box"
                  }}
                />
                {modalMode === "edit" && (
                  <small style={{ color: "#64748b", fontSize: isMobile ? "13px" : "11px", marginTop: "4px", display: "block" }}>El email no se puede modificar</small>
                )}
              </div>

              {modalMode === "create" && (
                <div style={{ marginBottom: isMobile ? 0 : 6, gridColumn: isMobile ? "1" : "span 2" }}>
                  <label style={{ display: "block", marginBottom: isMobile ? 6 : 2, fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>Confirmar Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.emailConfirmacion}
                    onChange={(e) => setFormData({ ...formData, emailConfirmacion: e.target.value })}
                    style={{ 
                      width: "100%", 
                      padding: isMobile ? "12px" : "6px", 
                      fontSize: isMobile ? "16px" : "13px", 
                      border: `2px solid ${formData.emailConfirmacion && formData.email !== formData.emailConfirmacion ? '#dc2626' : '#e5e7eb'}`, 
                      borderRadius: isMobile ? "8px" : "4px",
                      boxSizing: "border-box"
                    }}
                    placeholder="Escribe el email nuevamente"
                  />
                  {formData.emailConfirmacion && formData.email !== formData.emailConfirmacion && (
                    <small style={{ color: "#dc2626", display: "block", marginTop: isMobile ? 6 : 2, fontSize: isMobile ? "13px" : "11px" }}>
                      ⚠️ Los emails no coinciden
                    </small>
                  )}
                  {formData.emailConfirmacion && formData.email === formData.emailConfirmacion && (
                    <small style={{ color: "#16a34a", display: "block", marginTop: isMobile ? 6 : 2, fontSize: isMobile ? "13px" : "11px" }}>
                      ✓ Los emails coinciden
                    </small>
                  )}
                </div>
              )}

              {modalMode === "create" && (
                <div style={{ marginBottom: isMobile ? 0 : 6 }}>
                  <label style={{ display: "block", marginBottom: isMobile ? 6 : 2, fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>Contraseña *</label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{ width: "100%", padding: isMobile ? "12px" : "6px", fontSize: isMobile ? "16px" : "13px", border: "2px solid #e5e7eb", borderRadius: isMobile ? "8px" : "4px", boxSizing: "border-box" }}
                  />
                  <small style={{ color: "#64748b", fontSize: isMobile ? "13px" : "11px", marginTop: "4px", display: "block" }}>Por defecto: 000000</small>
                </div>
              )}

              <div style={{ marginBottom: isMobile ? 0 : 6 }}>
                <label style={{ display: "block", marginBottom: isMobile ? 6 : 2, fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>Fecha de Nacimiento</label>
                <input
                  type="date"
                  value={formData.nacimiento}
                  onChange={(e) => setFormData({ ...formData, nacimiento: e.target.value })}
                  style={{ width: "100%", padding: isMobile ? "12px" : "6px", fontSize: isMobile ? "16px" : "13px", border: "2px solid #e5e7eb", borderRadius: isMobile ? "8px" : "4px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: isMobile ? 0 : 6 }}>
                <label style={{ display: "block", marginBottom: isMobile ? 6 : 2, fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>Teléfono</label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  style={{ width: "100%", padding: isMobile ? "12px" : "6px", fontSize: isMobile ? "16px" : "13px", border: "2px solid #e5e7eb", borderRadius: isMobile ? "8px" : "4px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: isMobile ? 0 : 6, gridColumn: isMobile ? "1" : "span 2" }}>
                <label style={{ display: "block", marginBottom: isMobile ? 6 : 2, fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>Objetivo Nutricional</label>
                <input
                  type="text"
                  value={formData.objetivoNutricional}
                  onChange={(e) => setFormData({ ...formData, objetivoNutricional: e.target.value })}
                  style={{ width: "100%", padding: isMobile ? "12px" : "6px", fontSize: isMobile ? "16px" : "13px", border: "2px solid #e5e7eb", borderRadius: isMobile ? "8px" : "4px", boxSizing: "border-box" }}
                  placeholder="Ej: Pérdida de peso, ganar masa muscular..."
                />
              </div>

              <div style={{ marginBottom: isMobile ? 0 : 6 }}>
                <label style={{ display: "block", marginBottom: isMobile ? 6 : 2, fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>Peso Actual (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.pesoActual}
                  onChange={(e) => setFormData({ ...formData, pesoActual: e.target.value })}
                  style={{ width: "100%", padding: isMobile ? "12px" : "6px", fontSize: isMobile ? "16px" : "13px", border: "2px solid #e5e7eb", borderRadius: isMobile ? "8px" : "4px", boxSizing: "border-box" }}
                />
              </div>
              
              {modalMode === "create" && (
                <div style={{ marginBottom: isMobile ? 0 : 6, gridColumn: isMobile ? "1" : "span 2" }}>
                  <label style={{ display: "block", marginBottom: isMobile ? 6 : 2, fontWeight: "600", fontSize: isMobile ? "14px" : "13px", color: "#0f172a" }}>Tipo de Plan *</label>
                  <select
                    required
                    value={formData.tipoPlan}
                    onChange={(e) => setFormData({ ...formData, tipoPlan: e.target.value })}
                    style={{ 
                      width: "100%", 
                      padding: isMobile ? "12px" : "6px", 
                      fontSize: isMobile ? "16px" : "13px", 
                      border: `2px solid ${!formData.tipoPlan ? '#dc2626' : '#e5e7eb'}`, 
                      borderRadius: isMobile ? "8px" : "4px",
                      boxSizing: "border-box",
                      backgroundColor: "white"
                    }}
                  >
                    <option value="" disabled>Seleccionar...</option>
                    <option value="Básico">Básico</option>
                    <option value="Básico + Ejercicios">Básico + Ejercicios</option>
                    <option value="Seguimiento">Seguimiento</option>
                    <option value="GYM">GYM</option>
                  </select>
                  <small style={{ color: "#64748b", fontSize: isMobile ? "13px" : "11px", marginTop: "4px", display: "block" }}>Define qué módulos tendrá acceso el usuario en la aplicación</small>
                </div>
              )}
              </div>

              <div style={{ display: "flex", gap: isMobile ? 10 : 8, marginTop: isMobile ? 16 : 8, flexDirection: isMobile ? "column-reverse" : "row" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={modalLoading}
                  className="btn ghost"
                  style={{
                    flex: 1,
                    padding: isMobile ? "14px 16px" : "8px 16px",
                    fontSize: isMobile ? "16px" : "13px",
                    cursor: modalLoading ? "not-allowed" : "pointer",
                    opacity: modalLoading ? 0.6 : 1,
                    borderRadius: isMobile ? "8px" : "4px"
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="btn primary"
                  style={{
                    flex: 1,
                    padding: isMobile ? "14px 16px" : "8px 16px",
                    fontSize: isMobile ? "16px" : "13px",
                    cursor: modalLoading ? "not-allowed" : "pointer",
                    opacity: modalLoading ? 0.6 : 1,
                    borderRadius: isMobile ? "8px" : "4px",
                    fontWeight: "700"
                  }}
                >
                  {modalLoading ? "Guardando..." : "✓ Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Info de Permisos */}
      {showInfoPermisos && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10001,
            padding: "20px"
          }}
          onClick={() => setShowInfoPermisos(false)}
        >
          <div 
            style={{
              backgroundColor: "white",
              padding: isMobile ? "20px" : "30px",
              borderRadius: "12px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: isMobile ? "20px" : "22px", color: "#1e40af", fontWeight: "700" }}>
                ℹ️ Control de Permisos
              </h3>
              <button
                onClick={() => setShowInfoPermisos(false)}
                style={{
                  background: "#fee2e2",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "20px",
                  color: "#dc2626"
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ 
              backgroundColor: "#fef3c7", 
              border: "2px solid #f59e0b", 
              borderRadius: "8px", 
              padding: "16px", 
              marginBottom: "20px",
              fontSize: isMobile ? "14px" : "15px"
            }}>
              <strong style={{ color: "#92400e" }}>⚠️ Importante:</strong>
              <p style={{ margin: "8px 0 0 0", color: "#78350f" }}>
                Los permisos se configuran en la <strong>ANAMNESIS</strong> del usuario después de crearlo.
              </p>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ 
                fontSize: isMobile ? "16px" : "17px", 
                color: "#0f172a", 
                marginBottom: "12px",
                fontWeight: "600",
                borderBottom: "2px solid #e5e7eb",
                paddingBottom: "8px"
              }}>
                1️⃣ ELIGE TU PLAN (eligePlan)
              </h4>
              <p style={{ fontSize: isMobile ? "13px" : "14px", color: "#475569", marginBottom: "12px" }}>
                Controla qué pestañas puede ver el usuario:
              </p>
              <div style={{ paddingLeft: "16px" }}>
                <div style={{ marginBottom: "10px", fontSize: isMobile ? "13px" : "14px" }}>
                  <strong style={{ color: "#10b981" }}>✓ Básico + Ejercicios:</strong>
                  <div style={{ color: "#64748b", marginLeft: "20px" }}>Acceso a TODAS las pestañas (Dieta, Ejercicios, GYM, Pesaje, Citas)</div>
                </div>
                <div style={{ marginBottom: "10px", fontSize: isMobile ? "13px" : "14px" }}>
                  <strong style={{ color: "#f59e0b" }}>⚠️ Básico:</strong>
                  <div style={{ color: "#64748b", marginLeft: "20px" }}>SIN Ejercicios ni GYM (solo Dieta, Pesaje, Citas)</div>
                </div>
                <div style={{ marginBottom: "10px", fontSize: isMobile ? "13px" : "14px" }}>
                  <strong style={{ color: "#3b82f6" }}>📊 Seguimiento:</strong>
                  <div style={{ color: "#64748b", marginLeft: "20px" }}>SOLO Pesaje y Citas</div>
                </div>
                <div style={{ marginBottom: "10px", fontSize: isMobile ? "13px" : "14px" }}>
                  <strong style={{ color: "#8b5cf6" }}>🏋️ GYM:</strong>
                  <div style={{ color: "#64748b", marginLeft: "20px" }}>SOLO GYM</div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ 
                fontSize: isMobile ? "16px" : "17px", 
                color: "#0f172a", 
                marginBottom: "12px",
                fontWeight: "600",
                borderBottom: "2px solid #e5e7eb",
                paddingBottom: "8px"
              }}>
                2️⃣ PREFERENCIA DE PLAN NUTRICIONAL (preferenciaPlan)
              </h4>
              <p style={{ fontSize: isMobile ? "13px" : "14px", color: "#475569", marginBottom: "12px" }}>
                Controla si el usuario ve el botón de RECETAS:
              </p>
              <div style={{ paddingLeft: "16px" }}>
                <div style={{ marginBottom: "10px", fontSize: isMobile ? "13px" : "14px" }}>
                  <strong style={{ color: "#f59e0b" }}>👨‍🍳 Menú completo (Con recetas):</strong>
                  <div style={{ color: "#64748b", marginLeft: "20px" }}>SÍ ve el botón de recetas</div>
                </div>
                <div style={{ marginBottom: "10px", fontSize: isMobile ? "13px" : "14px" }}>
                  <strong style={{ color: "#64748b" }}>📋 Menú sencillo (Sin recetas):</strong>
                  <div style={{ color: "#64748b", marginLeft: "20px" }}>NO ve recetas</div>
                </div>
              </div>
            </div>

            <div style={{ 
              backgroundColor: "#dbeafe", 
              borderRadius: "8px", 
              padding: "16px",
              fontSize: isMobile ? "13px" : "14px",
              color: "#1e40af"
            }}>
              <strong>💡 Recordatorio:</strong>
              <ul style={{ margin: "8px 0 0 20px", padding: 0 }}>
                <li style={{ marginBottom: "6px" }}>Crea el usuario primero</li>
                <li style={{ marginBottom: "6px" }}>Luego edita su <strong>ANAMNESIS</strong></li>
                <li style={{ marginBottom: "6px" }}>Los campos "ELIGE TU PLAN" y "PREFERENCIA DE PLAN NUTRICIONAL" son <strong>OBLIGATORIOS</strong></li>
                <li>Sin estos campos configurados, el formulario no se puede guardar</li>
              </ul>
            </div>

            <button
              onClick={() => setShowInfoPermisos(false)}
              style={{
                width: "100%",
                padding: isMobile ? "14px" : "12px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: isMobile ? "16px" : "15px",
                fontWeight: "600",
                cursor: "pointer",
                marginTop: "20px"
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Barra de navegación inferior para móvil eliminada (ahora la gestiona el layout) */}
    </div>
  );
}