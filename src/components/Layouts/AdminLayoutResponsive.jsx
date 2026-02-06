import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../../Firebase';
import { signOut } from 'firebase/auth';
import { useDevice } from '../../hooks/useDevice';

/**
 * AdminLayout - Layout responsive para el panel de administración
 * Detecta si es móvil y adapta la navegación
 */
export default function AdminLayout({ children, title = "Panel Admin" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useDevice();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate("/");
      setTimeout(() => {
        if (auth.currentUser) window.location.reload();
      }, 700);
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
        // (Eliminado: declaración incorrecta del hook dentro de función)
    }
  };

  // Menú completo para desktop
  const menuItemsDesktop = [
    { path: '/admin', label: '👥 Usuarios', icon: '👥' },
    { path: '/admin/agenda', label: '📅 Agenda', icon: '📅' },
    { path: '/admin/menus', label: '🍽️ Menús', icon: '🍽️' },
    { path: '/admin/tipodieta', label: '📋 Tipo Dieta', icon: '📋' },
    { path: '/admin/tarifas', label: '💰 Tarifas', icon: '💰' },
    { path: '/admin/pagos', label: '💳 Pagos', icon: '💳' },
    { path: '/admin/gym', label: '🏋️ GYM', icon: '🏋️' },
    { path: '/admin/mensajes', label: '💬 MSG', icon: '💬' },
  ];
  
  // Menú reducido para móvil (solo los esenciales)
  const menuItemsMobile = [
    { path: '/admin', label: '👥 Usuarios', icon: '👥' },
    { path: '/admin/agenda', label: '📅 Agenda', icon: '📅' },
    { path: '/admin/menus', label: '🍽️ Menús', icon: '🍽️' },
    { path: '/admin/pagos', label: '💳 Pagos', icon: '💳' },
    { path: '/admin/gym', label: '🏋️ GYM', icon: '🏋️' },
    { path: '/admin/mensajes', label: '💬 MSG', icon: '💬' },
  ];
  
  const menuItems = isMobile ? menuItemsMobile : menuItemsDesktop;

  const currentPath = location.pathname;

  if (isMobile) {
    return (
      <div style={styles.mobileContainer}>
        {/* Header superior */}
        <div style={styles.mobileHeader}>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{title}</span>
          <button style={styles.mobileLogoutButton} onClick={handleSignOut} title="Cerrar sesión">⎋</button>
        </div>
        {/* Contenido principal */}
        <div style={styles.mobileContent}>{children}</div>
        {/* Menú inferior fijo */}
        <nav style={styles.bottomNav}>
          {menuItems.map((item) => (
            <button
              key={item.path}
              style={{
                ...styles.bottomNavItem,
                ...(currentPath === item.path ? styles.bottomNavItemActive : {})
              }}
              onClick={() => navigate(item.path)}
              title={item.label}
            >
              <span style={styles.bottomNavIcon}>{item.icon}</span>
              {/* <span style={styles.bottomNavLabel}>{item.label}</span> */}
            </button>
          ))}
        </nav>
      </div>
    );
  } else {
    // Solo renderizar children en desktop, sin header superior
    return <>{children}</>;
  }
}

const styles = {
  // Estilos móviles
  mobileContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#f5f5f5',
  },
  mobileHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#2c3e50',
    color: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  hamburger: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  mobileTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  mobileLogoutButton: {
    background: '#e74c3c',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '6px 12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  mobileMenu: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e0e0e0',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    position: 'absolute',
    top: '56px',
    left: 0,
    right: 0,
    zIndex: 99,
  },
  mobileMenuItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '16px 20px',
    border: 'none',
    borderBottom: '1px solid #f0f0f0',
    backgroundColor: 'white',
    textAlign: 'left',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  mobileMenuItemActive: {
    backgroundColor: '#e3f2fd',
    borderLeft: '4px solid #2196F3',
    fontWeight: '600',
  },
  menuIcon: {
    marginRight: '12px',
    fontSize: '20px',
  },
  mobileContent: {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: '80px', // Espacio para la navegación inferior más grande
  },
  bottomNav: {
    display: 'flex',
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTop: '1px solid #e0e0e0',
    boxShadow: '0 -2px 4px rgba(0,0,0,0.1)',
    zIndex: 100,
    overflowX: 'auto', // Permitir scroll horizontal si es necesario
  },
  bottomNavItem: {
    flex: '1 1 0',
    minWidth: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 8px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#666',
    fontSize: '12px',
    margin: '0',
    touchAction: 'manipulation',
  },
  bottomNavItemActive: {
    color: '#2196F3',
    fontWeight: '600',
  },
  bottomNavIcon: {
    fontSize: '32px',
    marginBottom: '0',
    lineHeight: '1',
    display: 'block',
  },
  bottomNavLabel: {
    fontSize: '0',
    whiteSpace: 'nowrap',
    lineHeight: '1',
    marginTop: '0',
    display: 'none',
  },

  // Estilos desktop
  desktopContainer: {
    display: 'flex',
    height: '100vh',
  },
  desktopSidebar: {
    width: '250px',
    backgroundColor: '#2c3e50',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
  },
  desktopTitle: {
    marginTop: 0,
    marginBottom: '30px',
    fontSize: '24px',
  },
  desktopMenu: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  desktopMenuItem: {
    padding: '12px 16px',
    backgroundColor: 'transparent',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.2s',
  },
  desktopMenuItemActive: {
    backgroundColor: '#34495e',
    fontWeight: '600',
  },
  desktopLogout: {
    padding: '12px 16px',
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    marginTop: '20px',
  },
  desktopContent: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: '#f5f5f5',
  },
};
