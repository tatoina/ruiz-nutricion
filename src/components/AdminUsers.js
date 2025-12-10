import React, { useEffect, useState, useRef } from "react";
import { auth, db } from "../Firebase";
import { onAuthStateChanged, signOut, getIdTokenResult } from "firebase/auth";
import { collection, getDocs, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import FichaUsuario from "./FichaUsuario";

/**
 * AdminUsers — panel admin con columna izquierda redimensionable.
 * - Soporta detection de admin por custom claim "admin" y por lista de emails.
 * - Left panel resizable, ancho persistido en localStorage (adminLeftWidth).
 * - Fallback para consultas Firestore si falta índice compuesto.
 */

export default function AdminUsers() {
  const ADMIN_EMAILS = ["admin@admin.es"]; // ajusta si hace falta
  const DESKTOP_MIN_WIDTH = 900;

  const navigate = useNavigate();
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

  // Estado para ocultar/mostrar el panel lateral
  const [panelVisible, setPanelVisible] = useState(true);

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
        console.error("getIdTokenResult error:", err);
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

  const prevUser = () => {
    setSelectedIndex((s) => Math.max(0, (s || 0) - 1));
    scrollListIntoView(Math.max(0, (selectedIndex || 0) - 1));
  };
  const nextUser = () => {
    setSelectedIndex((s) => Math.min(users.length - 1, (s || 0) + 1));
    scrollListIntoView(Math.min(users.length - 1, (selectedIndex || 0) + 1));
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
    <div className="admin-fullscreen" ref={containerRef}>
      <div className="card header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="title">Panel administrativo</div>
          <div className="subtitle">Navega por los usuarios y edita sus fichas</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
            Autenticado como: <strong>{currentUser.email}</strong> — isAdmin: <strong>{String(isAdmin)}</strong>
          </div>
        </div>
        
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => navigate("/admin/tarifas")}>Tarifas</button>
          <div style={{ 
            height: "30px", 
            width: "2px", 
            backgroundColor: "#d1d5db", 
            margin: "0 4px" 
          }}></div>
          <button className="btn primary" onClick={() => navigate("/admin/menus")}>📋 Menús</button>
          <button className="btn primary" onClick={() => navigate("/admin/agenda")}>📅 Agenda</button>
          <button className="btn primary" onClick={() => navigate("/register")}>Nuevo cliente</button>
          <button className="btn danger" onClick={handleSignOut}>Cerrar sesión</button>
        </div>
      </div>

      <div className="admin-columns" style={{ marginTop: 12 }}>
        {/* Left panel: listado (ancho controlado por leftWidth) */}
        {panelVisible && (
          <>
            <div
              className="card admin-left"
              style={{ padding: 12, width: `${leftWidth}px`, flexShrink: 0 }}
            >
              <input className="input" placeholder="Buscar por apellidos, nombre o email..." value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: "100%" }} />
              <div ref={listRef} style={{ marginTop: 8, maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
                {loading ? (
                  <div style={{ padding: 8 }}>Cargando usuarios...</div>
                ) : error ? (
                  <div style={{ color: "var(--danger, #b91c1c)", padding: 8 }}>{error}</div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: 8 }}>No se encontraron usuarios.</div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {filtered.map((u, i) => (
                      <li
                        key={u.id}
                        data-user-index={i}
                        style={{
                          padding: 10,
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
                          <strong style={{ fontSize: 14 }}>{`${(u.apellidos || "").trim()} ${(u.nombre || "").trim()}`.trim() || u.email}</strong>
                          <small style={{ color: "#666" }}>{u.email}</small>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ fontSize: 12, color: "#666" }}>{u.pesoActual ? `${u.pesoActual} kg` : ""}</div>
                          <button
                            onClick={(e) => handleDeleteUser(u.id, `${(u.apellidos || "").trim()} ${(u.nombre || "").trim()}`.trim() || u.email, u.email, e)}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px 8px",
                              borderRadius: "4px",
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
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          </>
        )}

        {/* Right panel: ficha */}
        <div className="card admin-right" style={{ padding: 0, position: 'relative' }}>
          {users.length > 0 && selectedIndex >= 0 ? (
            <div style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: 'relative' }}>
                {/* Botón para ocultar/mostrar panel */}
                <button
                  onClick={() => setPanelVisible(!panelVisible)}
                  title={panelVisible ? "Ocultar panel de usuarios" : "Mostrar panel de usuarios"}
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '-8px',
                    zIndex: 10,
                    background: 'rgba(22, 163, 74, 0.9)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(22, 163, 74, 1)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(22, 163, 74, 0.9)'}
                >
                  {panelVisible ? '◀' : '▶'}
                </button>

                <h3 style={{ margin: 0 }}>{users[selectedIndex].apellidos ? `${users[selectedIndex].apellidos} ${users[selectedIndex].nombre || ""}` : (users[selectedIndex].nombre || users[selectedIndex].email)}</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn ghost" onClick={() => prevUser()} disabled={selectedIndex <= 0}>Anterior</button>
                  <button className="btn ghost" onClick={() => nextUser()} disabled={selectedIndex >= users.length - 1}>Siguiente</button>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <FichaUsuario targetUid={users[selectedIndex].id} adminMode={true} />
              </div>
            </div>
          ) : (
            <div style={{ padding: 16 }}>Selecciona un usuario para editar su ficha.</div>
          )}
        </div>
      </div>
    </div>
  );
}