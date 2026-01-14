import React, { useState, useEffect } from 'react';

/**
 * InstallPrompt - Banner discreto para instalar la PWA
 * Aparece en la parte superior cuando la app no está instalada
 * Se puede cerrar y no volverá a aparecer en la sesión
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
                    || window.navigator.standalone 
                    || document.referrer.includes('android-app://');
    
    setIsStandalone(standalone);

    // Si está instalada, guardar en localStorage y no mostrar nunca más
    if (standalone) {
      localStorage.setItem('pwaInstalled', 'true');
      setIsVisible(false);
      return;
    }

    // Verificar si el usuario ya instaló la app anteriormente
    const wasInstalled = localStorage.getItem('pwaInstalled') === 'true';
    if (wasInstalled) {
      setIsVisible(false);
      return;
    }

    // Detectar iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Verificar si el usuario ya descartó el banner en esta sesión
    const dismissed = sessionStorage.getItem('installPromptDismissed');
    if (dismissed === 'true') {
      return;
    }

    // Mostrar el banner después de 2 segundos
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

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
      localStorage.setItem('pwaInstalled', 'true');
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
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) {
      setShowIOSInstructions(true);
      return;
    }

    // Mostrar el prompt de instalación
    deferredPrompt.prompt();

    // Esperar la respuesta del usuario
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsVisible(false);
      localStorage.setItem('pwaInstalled', 'true');
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('installPromptDismissed', 'true');
  };

  if (isStandalone || !isVisible) {
    return null;
  }

  return (
    <>
      {/* Banner de instalación */}
      <div style={styles.banner}>
        <div style={styles.bannerContent}>
          <div style={styles.iconContainer}>
            <span style={styles.icon}>📱</span>
          </div>
          <div style={styles.textContainer}>
            <div style={styles.title}>Instala la app</div>
            <div style={styles.subtitle}>
              {isIOS 
                ? 'Toca el botón de compartir y luego "Añadir a inicio"'
                : 'Accede más rápido y recibe notificaciones'}
            </div>
          </div>
          <button onClick={handleInstallClick} style={styles.installButton}>
            Instalar
          </button>
          <button onClick={handleDismiss} style={styles.closeButton}>
            ✕
          </button>
        </div>
      </div>

      {/* Modal de instrucciones para iOS */}
      {showIOSInstructions && (
        <div style={styles.modal} onClick={() => setShowIOSInstructions(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Cómo instalar la app</h3>
              <button 
                onClick={() => setShowIOSInstructions(false)} 
                style={styles.modalCloseButton}
              >
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              {isIOS ? (
                <>
                  <p style={styles.modalText}>En Safari (iOS):</p>
                  <ol style={styles.modalList}>
                    <li>Toca el botón de compartir <span style={styles.iosIcon}>⎙</span> (abajo en iPhone, arriba en iPad)</li>
                    <li>Desliza y selecciona "Añadir a la pantalla de inicio"</li>
                    <li>Confirma tocando "Añadir"</li>
                  </ol>
                </>
              ) : (
                <>
                  <p style={styles.modalText}>Para instalar la aplicación:</p>
                  <ul style={styles.modalList}>
                    <li>En Chrome/Edge: Busca el ícono <span style={styles.installIcon}>⊕</span> en la barra de direcciones</li>
                    <li>O abre el menú del navegador (⋮) y selecciona "Instalar app"</li>
                    <li>También puedes usar "Agregar a pantalla de inicio"</li>
                  </ul>
                </>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button 
                onClick={() => setShowIOSInstructions(false)} 
                style={styles.modalButton}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  banner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e0e0e0',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    zIndex: 9999,
    animation: 'slideDown 0.3s ease-out',
  },
  bannerContent: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    maxWidth: '1200px',
    margin: '0 auto',
    gap: '12px',
  },
  iconContainer: {
    flexShrink: 0,
  },
  icon: {
    fontSize: '24px',
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '2px',
  },
  subtitle: {
    fontSize: '12px',
    color: '#7f8c8d',
    lineHeight: '1.3',
  },
  installButton: {
    backgroundColor: '#89e03e',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    flexShrink: 0,
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#95a5a6',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
    flexShrink: 0,
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 20px 12px 20px',
    borderBottom: '1px solid #e0e0e0',
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#2c3e50',
  },
  modalCloseButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '24px',
    color: '#95a5a6',
    cursor: 'pointer',
    padding: '0',
    lineHeight: 1,
  },
  modalBody: {
    padding: '20px',
  },
  modalText: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    color: '#2c3e50',
    fontWeight: '500',
  },
  modalList: {
    margin: '8px 0',
    paddingLeft: '24px',
    fontSize: '14px',
    color: '#34495e',
    lineHeight: '1.8',
  },
  iosIcon: {
    fontSize: '18px',
    verticalAlign: 'middle',
  },
  installIcon: {
    fontSize: '16px',
    fontWeight: 'bold',
    verticalAlign: 'middle',
  },
  modalFooter: {
    padding: '12px 20px 20px 20px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  modalButton: {
    backgroundColor: '#89e03e',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};
