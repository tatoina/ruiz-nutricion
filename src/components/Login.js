import React, { useState, useEffect } from "react";
import { requestNotificationPermissionAndSaveToken } from "../fcm-setup";
import "./estilos.css";
import { signInWithEmailAndPassword, updatePassword, sendPasswordResetEmail } from "firebase/auth";
import logger from "../utils/logger";
import { auth, db } from "../Firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import logo from "../assets/logo.png";
import { useNavigate } from "react-router-dom";
import { useDevice } from "../hooks/useDevice";
import { APP_VERSION } from "../config/version";

export default function Login({ onLogin /* onShowRegister no usado ahora */ }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const { isMobile } = useDevice();

  const navigate = useNavigate();

  // Detectar si la PWA está instalada y capturar el prompt de instalación
  useEffect(() => {
    // Verificar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
    }

    // Capturar el evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detectar cuando se instala
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallOrRefresh = async () => {
    // Si hay prompt de instalación disponible y no está instalada, instalar
    if (deferredPrompt && !isInstalled) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstalled(true);
      }
    } else {
      // Si no hay instalación disponible o ya está instalada, hacer refresh
      // Intenta desregistrar el service worker si existe
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.unregister();
        }
      }
      // Limpia la caché de la app
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }
      // Recarga la página
      window.location.reload(true);
    }
  };

  const today = new Date();
  const dateStr = today
    .toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .replace(/^./, (c) => c.toUpperCase());

  const deviceIcon = isMobile ? "📱" : "💻";
  const deviceLabel = isMobile ? "Móvil" : "PC";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const user = cred?.user;
      const normalizedEmail = String(user?.email || "").trim().toLowerCase();
      logger.debug("[LOGIN] signIn success", { uid: user?.uid, email: user?.email, normalizedEmail });

      // Verificar si debe cambiar la contraseña
      if (normalizedEmail !== "admin@admin.es") {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().mustChangePassword) {
          navigate("/cambiar-password", { state: { firstLogin: true } });
          return;
        }
      }

      // Solicitar y guardar token FCM tras login exitoso
      try {
        await requestNotificationPermissionAndSaveToken(user.uid);
      } catch (fcmErr) {
        logger.error("[LOGIN] Error FCM:", fcmErr);
      }

      if (onLogin && typeof onLogin === "function") {
        try {
          // Pass the firebase user object (callback or wrapper will normalize as needed)
          onLogin(user);
          logger.debug("[LOGIN] onLogin callback invoked.");
        } catch (cbErr) {
          logger.error("[LOGIN] onLogin callback threw:", cbErr);
          // As fallback, navigate based on email
          if (normalizedEmail === "admin@admin.es") {
            navigate("/admin");
          } else {
            navigate("/mi-ficha");
          }
        }
      } else {
        // Fallback navigation if no callback provided
        if (normalizedEmail === "admin@admin.es") {
          navigate("/admin");
        } else {
          navigate("/mi-ficha");
        }
      }
    } catch (err) {
      setError(err?.message || "Error al iniciar sesión");
      logger.error("[LOGIN] signIn error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Registrarse se ha movido a la cabecera (sólo visible para admin).
  // Por eso eliminamos el link/btn de registro dentro de esta vista de login.

  return (
    <div className="login-page">
      <div className="login-card card">
        <img
          src={logo}
          alt="App logo"
          className="login-logo"
          style={{ cursor: 'pointer' }}
          title="Refrescar aplicación"
          onClick={handleInstallOrRefresh}
        />

        <form onSubmit={handleSubmit} className="login-form" autoComplete="on" aria-label="Formulario de acceso">
          <label htmlFor="email" className="sr-only">Correo</label>
          <input
            id="email"
            className="input"
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />

          <label htmlFor="pass" className="sr-only">Contraseña</label>
          <input
            id="pass"
            className="input"
            type="password"
            placeholder="Contraseña"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
            autoComplete="current-password"
          />

          {error && (
            <div className="mensaje error" role="alert" aria-live="polite" style={{ marginTop: 10 }}>
              {error}
            </div>
          )}

          <div className="actions" style={{ marginTop: 12 }}>
            <button
              type="submit"
              className="btn primary full-width"
              disabled={loading}
              aria-busy={loading ? "true" : "false"}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>
          {/* Botón para recuperar contraseña */}
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <button
              type="button"
              className="btn ghost"
              style={{ fontSize: 14, color: '#2563eb', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
              onClick={async () => {
                if (!email) {
                  setError('Introduce tu correo para recuperar la contraseña.');
                  return;
                }
                try {
                  await sendPasswordResetEmail(auth, email.trim());
                  setError('Se ha enviado un email para restablecer tu contraseña.');
                } catch (err) {
                  setError('No se pudo enviar el email de recuperación.');
                }
              }}
            >
              ¿Has olvidado tu contraseña?
            </button>
          </div>
          {/* Fecha y versión debajo del botón Entrar */}
          <div style={{ marginTop: 18, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            <div className="login-date">{dateStr}</div>
            <div className="app-version" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <span style={{ fontSize: '16px' }}>{deviceIcon}</span>
              <span>{deviceLabel}</span>
              <span style={{ marginLeft: '4px', opacity: 0.7 }}>v{APP_VERSION}</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}