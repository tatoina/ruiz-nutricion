import React, { useEffect, useState, useRef } from "react";
import { auth, db } from "../Firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import FichaUsuario from "./FichaUsuario";

/**
 * AdminUsers — con panel izquierdo redimensionable.
 * - Arrastra el divisor vertical para cambiar el ancho del panel izquierdo.
 * - El ancho se guarda en localStorage (clave: adminLeftWidth).
 * - Si el usuario NO es admin, ahora se muestra un botón claro para ir a /mi-ficha.
 */

export default function AdminUsers() {
  const ADMIN_EMAIL = "admin@admin.es";
  const DESKTOP_MIN_WIDTH = 900;
  const INDEX_CREATE_URL = "https://console.firebase.google.com/v1/r/project/nutricionapp-b7b7d/firestore/indexes?create_composite=ClBwcm9qZWN0cy9udXRyaWNpb25hcHAtYjdiN2QvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3VzZXJzL2luZGV4ZXMvXxABGg0KCWFwZWxsaWRvcxABGgoKBm5vbWJyZRABGgwKCF9fbmFtZV9fEAE";

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
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem("adminLeftWidth"), 10);
    return Number.isFinite(saved) && saved > 0 ? saved : 360;
  });
  const MIN_LEFT = 240;
  const MAX_LEFT = 720;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      setIsAdmin(!!u && u.email === ADMIN_EMAIL);
    });
    return () => unsub();
  }, []);

  // Load users ordered by apellidos,nombre (fallback to client sort if index missing)
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
        // Intentamos la consulta con índice compuesto
        const q = query(collection(db, "users"), orderBy("apellidos", "asc"), orderBy("nombre", "asc"));
        const snap = await getDocs(q);
        if (!mounted) return;
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            // ordenar en memoria por apellidos then nombre (case-insensitive)
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
            setError(null);
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

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= DESKTOP_MIN_WIDTH);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Resizer handlers (mouse & touch)
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizingRef.current) return;
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.round(e.clientX - containerRect.left);
      const clamped = Math.max(MIN_LEFT, Math.min(MAX_LEFT, newWidth));
      setLeftWidth(clamped);
    };
    const onMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        localStorage.setItem("adminLeftWidth", String(leftWidth));
        // remove selecting text on some browsers
        document.body.style.userSelect = "";
      }
    };
    const onTouchMove = (e) => {
      if (!isResizingRef.current || !containerRef.current) return;
      const touch = e.touches[0];
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.round(touch.clientX - containerRect.left);
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
    // prevent text selection while dragging
    document.body.style.userSelect = "none";
  };
  const startResizingTouch = (e) => {
    isResizingRef.current = true;
    document.body.style.userSelect = "none";
    // stop propagation so page doesn't scroll
    e.preventDefault();
  };
  const resetLeftWidth = () => {
    const def = 360;
    setLeftWidth(def);
    localStorage.setItem("adminLeftWidth", String(def));
  };

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
    // <-- Aquí mostramos un botón claro para ir a la propia ficha en lugar de solo el mensaje
    return (
      <div className="layout admin-fullscreen">
        <div className="card" style={{ maxWidth: 720, margin: "40px auto", textAlign: "center" }}>
          <h3 style={{ marginTop: 8 }}>Sin permisos de administrador</h3>
          <p style={{ color: "#666" }}>
            Tu cuenta (<strong>{currentUser.email}</strong>) no tiene permisos para acceder al panel de administración.
            Si quieres revisar o editar tu propia ficha, puedes abrir tu ficha de usuario.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
            <button className="btn primary" onClick={() => navigate("/mi-ficha")}>Ver mi ficha</button>
            <button className="btn ghost" onClick={() => handleSignOut()}>Cerrar sesión</button>
          </div>
        </div>
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <div className="layout admin-fullscreen">
        <div className="card">
          <p style={{ padding: 16 }}>El panel de administración sólo está disponible en escritorio. Por favor, usa un PC.</p>
        </div>
      </div>
    );
  }

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

        <div>
          <button className="btn danger" onClick={handleSignOut}>Cerrar sesión</button>
        </div>
      </div>

      <div className="admin-columns" style={{ marginTop: 12 }}>
        {/* Left panel: listado (ancho controlado por leftWidth) */}
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
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <strong style={{ fontSize: 14 }}>{`${(u.apellidos || "").trim()} ${(u.nombre || "").trim()}`.trim() || u.email}</strong>
                      <small style={{ color: "#666" }}>{u.email}</small>
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>{u.pesoActual ? `${u.pesoActual} kg` : ""}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Si el índice es requerido mostramos el enlace directo para crear el índice */}
          {indexRequired && (
            <div style={{ marginTop: 10, fontSize: 13 }}>
              <div style={{ color: "#666" }}>Para un rendimiento óptimo crea este índice compuesto en Firestore:</div>
              <a href={INDEX_CREATE_URL} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 6 }}>
                Crear índice compuesto (apellidos ASC, nombre ASC)
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

        {/* Right panel: ficha */}
        <div className="card admin-right" style={{ padding: 0 }}>
          {users.length > 0 && selectedIndex >= 0 ? (
            <div style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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