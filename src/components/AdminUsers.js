import React, { useEffect, useState, useRef } from "react";
import { auth, db, functions } from "../Firebase";
import { onAuthStateChanged, signOut, getIdTokenResult } from "firebase/auth";
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

export default function AdminUsers() {
  const ADMIN_EMAILS = ["admin@admin.es"]; // ajusta si hace falta
  const DESKTOP_MIN_WIDTH = 900;

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

  // Estados para modal de crear/editar usuario
  const [showModal, setShowModal] = useState(false);
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
    pesoActual: ""
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
        const resolvedIsAdmin = hasClaimAdmin || byEmail;
        setIsAdmin(resolvedIsAdmin);
        logDebug("Auth:", { uid: u.uid, email: u.email, claims: token?.claims, byEmail, resolvedIsAdmin });
      } catch (err) {
        logger.error("getIdTokenResult error:", err);
        const byEmail = ADMIN_EMAILS.includes((u.email || "").toLowerCase());
        setIsAdmin(byEmail);
        logDebug("Fallback isAdmin by email:", { email: u.email, byEmail });
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load users ordered by apellidos,nombre (fallback if index missing)
  useEffect(() => {
    let mounted = true;
    const loadUsers = async () => {
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
        if (!mounted) return;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => !ADMIN_EMAILS.includes((u.email || "").toLowerCase()));
        setUsers(list);
        setSelectedIndex(list.length ? 0 : -1);
      } catch (err) {
        console.error("Error fetching users with composite index:", err);
        const msg = err?.message || String(err);
        if (err?.code === "failed-precondition" || /requires an index/i.test(msg) || /create an index/i.test(msg)) {
          setIndexRequired(true);
          try {
            const snap = await getDocs(collection(db, "users")); // sin orderBy
            if (!mounted) return;
            const list = snap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((u) => !ADMIN_EMAILS.includes((u.email || "").toLowerCase()));
            list.sort((a, b) => {
              const A = (a.apellidos || "").toString().trim().toLowerCase();
              const B = (b.apellidos || "").toString().trim().toLowerCase();
              if (A === B) {
                return (a.nombre || "").toString().trim().toLowerCase().localeCompare((b.nombre || "").toString().trim().toLowerCase());
              }
              return A.localeCompare(B);
            });
            setUsers(list);
            setSelectedIndex(list.length ? 0 : -1);
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
        if (mounted) setLoading(false);
      }
    };
    loadUsers();
    return () => { mounted = false; };
  }, [isAdmin]);

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
    const filtered = users.filter((u) => {
      if (!filter) return true;
      const s = filter.toLowerCase();
      return (u.apellidos || "").toLowerCase().includes(s) || (u.nombre || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s);
    });
    
    // Si el índice actual está fuera del rango del array filtrado, resetearlo
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(filtered.length > 0 ? 0 : -1);
    }
  }, [filter, users, selectedIndex]);

  const prevUser = () => {
    setSelectedIndex((s) => Math.max(0, (s || 0) - 1));
    scrollListIntoView(Math.max(0, (selectedIndex || 0) - 1));
  };
  const nextUser = () => {
    const filtered = users.filter((u) => {
      if (!filter) return true;
      const s = filter.toLowerCase();
      return (u.apellidos || "").toLowerCase().includes(s) || (u.nombre || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s);
    });
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

  const filtered = users.filter((u) => {
    if (!filter) return true;
    const s = filter.toLowerCase();
    return (u.apellidos || "").toLowerCase().includes(s) || (u.nombre || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s);
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

  // Abrir modal para crear nuevo cliente
  const handleNuevoCliente = () => {
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
      pesoActual: ""
    });
    setModalError("");
    setShowModal(true);
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
    e.stopPropagation();
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
      pesoActual: usuario.pesoActual || ""
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
          pesoActual: formData.pesoActual ? parseFloat(formData.pesoActual) : null
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
        // Editar usuario existente
        const userRef = doc(db, "users", editingUser.id);
        const updateData = {
          nombre: formData.nombre,
          apellidos: formData.apellidos,
          nacimiento: formData.nacimiento,
          telefono: formData.telefono,
          objetivoNutricional: formData.objetivoNutricional,
          pesoActual: formData.pesoActual ? parseFloat(formData.pesoActual) : null
        };
        await updateDoc(userRef, updateData);
        
        // Actualizar en la lista local
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u.id === editingUser.id ? { ...u, ...updateData } : u
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
            Panel administrativo <span style={{ color: '#666', fontWeight: '400', fontSize: isMobile ? '12px' : '14px' }}>({users.length} usuarios)</span>
          </div>
          {!isMobile && <div className="subtitle" style={{ fontSize: "11px" }}>Navega por los usuarios y edita sus fichas</div>}
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
          {!isMobile && <button className="btn primary" onClick={handleNuevoCliente} style={{ fontWeight: "bold", padding: "6px 10px", fontSize: "13px" }}>➕ Nuevo cliente</button>}
          {!isMobile && <button className="btn primary" onClick={() => { setShowAdminProfile(true); loadAdminProfile(); }} style={{ padding: "6px 10px", fontSize: "13px" }}>👤 Perfil</button>}
          {!isMobile && <button className="btn danger" onClick={handleSignOut} style={{ padding: "6px 10px", fontSize: "13px" }}>Cerrar sesión</button>}
          {isMobile && (
            <button 
              className="btn" 
              onClick={() => setPanelVisible(!panelVisible)} 
              style={{ padding: "8px 12px", fontSize: "14px", backgroundColor: panelVisible ? "#666" : "#2196F3", color: "white" }}
            >
              {panelVisible ? "✕ Ocultar lista" : "👥 Ver lista"}
            </button>
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
              <div ref={listRef} style={{ marginTop: isMobile ? 10 : 6, flex: 1, overflowY: "auto", overflowX: "hidden" }}>
                {loading ? (
                  <div style={{ padding: isMobile ? 16 : 8, textAlign: "center", color: "#64748b" }}>Cargando usuarios...</div>
                ) : error ? (
                  <div style={{ color: "var(--danger, #b91c1c)", padding: isMobile ? 16 : 8, background: "#fee2e2", borderRadius: "8px" }}>{error}</div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: isMobile ? 16 : 8, textAlign: "center", color: "#64748b" }}>No se encontraron usuarios.</div>
                ) : isMobile ? (
                  // Vista móvil - Lista simple
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
                        onClick={() => setSelectedIndex(i)}
                      >
                        <div style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a", marginBottom: "3px" }}>
                          {`${(u.apellidos || "").trim()} ${(u.nombre || "").trim()}`.trim() || u.email}
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
                        onClick={() => setSelectedIndex(i)}
                      >
                        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                          <strong style={{ fontSize: 13 }}>{`${(u.apellidos || "").trim()} ${(u.nombre || "").trim()}`.trim() || u.email}</strong>
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
                <FichaUsuario targetUid={filtered[selectedIndex].id} adminMode={true} />
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
            padding: isMobile ? "16px" : "20px",
            borderRadius: isMobile ? "0" : "8px",
            width: isMobile ? "100%" : "95%",
            maxWidth: isMobile ? "100%" : "900px",
            minHeight: isMobile ? "100vh" : "auto",
            maxHeight: isMobile ? "100vh" : "95vh",
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

      {/* Barra de navegación inferior para móvil */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'white',
          borderTop: '1px solid #e0e0e0',
          boxShadow: '0 -2px 4px rgba(0,0,0,0.1)',
          zIndex: 100,
          display: 'flex'
        }}>
          <button
            onClick={() => navigate('/admin')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#2196F3',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '2px' }}>👥</div>
            <div style={{ fontSize: '10px' }}>Users</div>
          </button>
          <button
            onClick={() => navigate('/admin/agenda')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#666',
              fontSize: '12px'
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '2px' }}>📅</div>
            <div style={{ fontSize: '10px' }}>Agenda</div>
          </button>
          <button
            onClick={() => navigate('/admin/menus')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#666',
              fontSize: '12px'
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '2px' }}>🍽️</div>
            <div style={{ fontSize: '10px' }}>Menús</div>
          </button>
          <button
            onClick={() => navigate('/admin/gym')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#666',
              fontSize: '12px'
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '2px' }}>🏋️</div>
            <div style={{ fontSize: '10px' }}>GYM</div>
          </button>
          <button
            onClick={() => navigate('/admin/mensajes')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#666',
              fontSize: '12px',
              position: 'relative'
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '2px' }}>💬</div>
            <div style={{ fontSize: '10px' }}>MSG</div>
            {solicitudesPendientes > 0 && (
              <span style={{
                position: 'absolute',
                top: '2px',
                right: '8px',
                backgroundColor: '#f44336',
                color: 'white',
                borderRadius: '10px',
                padding: '2px 5px',
                fontSize: '9px',
                fontWeight: 'bold',
                minWidth: '16px',
                textAlign: 'center'
              }}>
                {solicitudesPendientes}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('/admin/recursos')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#666',
              fontSize: '12px'
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '2px' }}>📁</div>
            <div style={{ fontSize: '10px' }}>Files</div>
          </button>
          <button
            onClick={() => { setShowAdminProfile(true); loadAdminProfile(); }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#666',
              fontSize: '12px'
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '2px' }}>👤</div>
            <div style={{ fontSize: '10px' }}>Perfil</div>
          </button>
          <button
            onClick={handleSignOut}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#f44336',
              fontSize: '12px'
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '2px' }}>🚪</div>
            <div style={{ fontSize: '10px' }}>Salir</div>
          </button>
        </div>
      )}
    </div>
  );
}