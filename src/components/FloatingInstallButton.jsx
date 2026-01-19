import React, { useState, useEffect } from 'react';

/**
 * FloatingInstallButton - Botón flotante para instalar la PWA
 * Aparece en la esquina inferior derecha cuando la app no está instalada
 * Funciona en Android, iOS (Safari) y escritorio
 */
export default function FloatingInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada (standalone mode) - múltiples métodos
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
                    || window.navigator.standalone 
                    || document.referrer.includes('android-app://')
                    || window.location.search.includes('utm_source=homescreen')
                    || localStorage.getItem('pwa-installed') === 'true';
    
    setIsStandalone(standalone);

    // Si ya está instalada, marcar en localStorage y no mostrar
    if (standalone) {
      localStorage.setItem('pwa-installed', 'true');
      setIsVisible(false);
      return;
    }

    // Detectar iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Verificar si el usuario ya descartó el botón permanentemente
    const dismissedPermanently = localStorage.getItem('installButtonDismissedForever');
    if (dismissedPermanently === 'true') {
      setIsDismissed(true);
      return;
    }

    // Verificar si el usuario ya descartó el botón en esta sesión
    const dismissed = sessionStorage.getItem('installButtonDismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
      return;
    }

    // Mostrar el botón después de 3 segundos si no está instalada
    const timer = setTimeout(() => {
      if (!standalone) {
        setIsVisible(true);
      }
    }, 3000);

    // Listener para el evento beforeinstallprompt (Android, PC)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listener para detectar cuando se instala
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setIsVisible(false);
      localStorage.setItem('pwa-installed', 'true');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // En iOS mostramos instrucciones
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) {
      // Si no hay prompt disponible, mostrar instrucciones
      setShowIOSInstructions(true);
      return;
    }

    // Mostrar el prompt de instalación
    deferredPrompt.prompt();

    // Esperar la respuesta del usuario
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Usuario aceptó instalar la app');
      setIsVisible(false);
    } else {
      console.log('Usuario rechazó instalar la app');
    }

    // Limpiar el prompt
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
    // Guardar en localStorage para que no vuelva a aparecer nunca
    localStorage.setItem('installButtonDismissedForever', 'true');
  };

  // No mostrar si está instalada, descartada o no es visible
  if (isStandalone || isDismissed || !isVisible) {
    return null;
  }

  // Botón minimizado
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        style={styles.minimizedButton}
        aria-label="Expandir botón de instalación"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>
    );
  }

  // Botón expandido
  return (
    <>
      <div style={styles.floatingContainer}>
        {/* Botón de cerrar */}
        <button
          onClick={handleDismiss}
          style={styles.closeButton}
          aria-label="Cerrar"
        >
          ✕
        </button>

        {/* Botón de minimizar */}
        <button
          onClick={() => setIsMinimized(true)}
          style={styles.minimizeButton}
          aria-label="Minimizar"
        >
          −
        </button>

        {/* Contenido principal */}
        <div style={styles.content}>
          <div style={styles.icon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </div>
          <div style={styles.text}>
            <div style={styles.title}>Instalar App</div>
            <div style={styles.subtitle}>
              {isIOS ? 'Agregar a pantalla de inicio' : 'Acceso rápido sin navegador'}
            </div>
          </div>
        </div>

        {/* Botón de acción */}
        <button
          onClick={handleInstallClick}
          style={styles.installButton}
        >
          {isIOS ? 'Ver cómo instalar' : 'Instalar ahora'}
        </button>
      </div>

      {/* Modal de instrucciones para iOS */}
      {showIOSInstructions && (
        <div 
          style={styles.modalOverlay}
          onClick={() => setShowIOSInstructions(false)}
        >
          <div 
            style={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={styles.modalTitle}>
              {isIOS ? 'Instalar en iOS' : 'Instalar la App'}
            </h3>
            
            <div style={styles.modalContent}>
              {isIOS ? (
                <>
                  <p style={styles.modalText}>Para instalar la app en tu iPhone o iPad:</p>
                  
                  <ol style={styles.instructionsList}>
                    <li style={styles.instructionItem}>
                      Toca el botón <strong>Compartir</strong> 
                      <svg style={styles.inlineIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                        <polyline points="16 6 12 2 8 6"></polyline>
                        <line x1="12" y1="2" x2="12" y2="15"></line>
                      </svg>
                      {' '}en Safari
                    </li>
                    <li style={styles.instructionItem}>
                      Selecciona <strong>"Añadir a pantalla de inicio"</strong>
                      <svg style={styles.inlineIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </li>
                    <li style={styles.instructionItem}>
                      Toca <strong>"Añadir"</strong> para confirmar
                    </li>
                  </ol>
                  
                  <p style={styles.modalNote}>
                    💡 La app aparecerá en tu pantalla de inicio
                  </p>
                </>
              ) : (
                <>
                  <p style={styles.modalText}>Para instalar la aplicación:</p>
                  
                  <ul style={styles.instructionsList}>
                    <li style={styles.instructionItem}>
                      En <strong>Chrome/Edge</strong>: Busca el ícono ⚙️ en la barra de direcciones
                    </li>
                    <li style={styles.instructionItem}>
                      En el <strong>menú del navegador</strong>: Selecciona "Instalar app"
                    </li>
                    <li style={styles.instructionItem}>
                      O toca los tres puntos (⋮) y busca "Agregar a pantalla de inicio"
                    </li>
                  </ul>
                </>
              )}
            </div>
            
            <button
              onClick={() => setShowIOSInstructions(false)}
              style={styles.modalButton}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  floatingContainer: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
    padding: '16px',
    maxWidth: '320px',
    zIndex: 9999,
    animation: 'slideIn 0.3s ease-out',
    border: '2px solid #89e03e',
  },
  minimizedButton: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#89e03e',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(137, 224, 62, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    transition: 'transform 0.2s ease',
  },
  closeButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'transparent',
    border: 'none',
    fontSize: '20px',
    color: '#999',
    cursor: 'pointer',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'all 0.2s ease',
  },
  minimizeButton: {
    position: 'absolute',
    top: '8px',
    right: '40px',
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    color: '#999',
    cursor: 'pointer',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'all 0.2s ease',
  },
  content: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px',
  },
  icon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: '#89e03e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: {
    flex: 1,
    paddingTop: '4px',
  },
  title: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#333',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#666',
    lineHeight: '1.4',
  },
  installButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#89e03e',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    padding: '20px',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  modalTitle: {
    marginTop: 0,
    marginBottom: '16px',
    color: '#333',
    fontSize: '20px',
    fontWeight: '700',
  },
  modalContent: {
    fontSize: '15px',
    color: '#555',
    lineHeight: '1.6',
  },
  modalText: {
    marginBottom: '12px',
    marginTop: 0,
  },
  instructionsList: {
    paddingLeft: '20px',
    margin: '0 0 16px 0',
  },
  instructionItem: {
    marginBottom: '12px',
  },
  inlineIcon: {
    display: 'inline-block',
    marginLeft: '4px',
    verticalAlign: 'middle',
  },
  modalNote: {
    fontSize: '13px',
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 0,
  },
  modalButton: {
    marginTop: '20px',
    width: '100%',
    padding: '12px',
    backgroundColor: '#89e03e',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
