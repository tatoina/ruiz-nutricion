import React, { useState, useEffect } from 'react';

/**
 * InstallButton - Botón para instalar la PWA
 * Funciona en Android, iOS (Safari) y escritorio (Chrome, Edge, etc.)
 */
export default function InstallButton({ style = {}, className = "" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
                    || window.navigator.standalone 
                    || document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // Detectar iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Listener para el evento beforeinstallprompt (Android, PC)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listener para detectar cuando se instala
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsStandalone(true);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
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
      // Si no hay prompt disponible, mostrar mensaje
      alert('Para instalar la aplicación:\n\n• En Chrome/Edge: Busca el ícono de instalación en la barra de direcciones\n• En el menú del navegador: Busca "Instalar app" o "Agregar a pantalla de inicio"');
      return;
    }

    // Mostrar el prompt de instalación
    deferredPrompt.prompt();

    // Esperar la respuesta del usuario
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Usuario aceptó instalar la app');
    } else {
      console.log('Usuario rechazó instalar la app');
    }

    // Limpiar el prompt
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  // Mostrar el botón siempre, excepto si ya está instalada
  if (isStandalone) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className={`btn primary ${className}`}
        style={{
          background: 'linear-gradient(135deg, #89e03e 0%, #6bc02d 100%)',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(137, 224, 62, 0.3)',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          ...style
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(137, 224, 62, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(137, 224, 62, 0.3)';
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        {isIOS ? 'Instalar App' : 'Instalar App'}
      </button>

      {/* Modal de instrucciones para iOS */}
      {showIOSInstructions && (
        <div 
          style={{
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
            padding: '20px'
          }}
          onClick={() => setShowIOSInstructions(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: '#333', fontSize: '20px', fontWeight: '700' }}>
              Instalar en iOS
            </h3>
            
            <div style={{ marginTop: '16px', fontSize: '15px', color: '#555', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '12px' }}>Para instalar la app en tu iPhone o iPad:</p>
              
              <ol style={{ paddingLeft: '20px', margin: '0' }}>
                <li style={{ marginBottom: '12px' }}>
                  Toca el botón <strong>Compartir</strong> 
                  <svg style={{ display: 'inline-block', marginLeft: '4px', verticalAlign: 'middle' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                    <polyline points="16 6 12 2 8 6"></polyline>
                    <line x1="12" y1="2" x2="12" y2="15"></line>
                  </svg>
                  {' '}en la barra de navegación de Safari
                </li>
                <li style={{ marginBottom: '12px' }}>
                  Desplázate y selecciona <strong>"Añadir a pantalla de inicio"</strong>
                  <svg style={{ display: 'inline-block', marginLeft: '4px', verticalAlign: 'middle' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </li>
                <li>
                  Toca <strong>"Añadir"</strong> para confirmar
                </li>
              </ol>
              
              <p style={{ marginTop: '16px', fontSize: '13px', color: '#888', fontStyle: 'italic' }}>
                La app aparecerá en tu pantalla de inicio como cualquier otra aplicación.
              </p>
            </div>
            
            <button
              onClick={() => setShowIOSInstructions(false)}
              style={{
                marginTop: '20px',
                width: '100%',
                padding: '12px',
                backgroundColor: '#007AFF',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
