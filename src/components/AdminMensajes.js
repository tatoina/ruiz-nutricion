import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../Firebase';
import { useDevice } from '../hooks/useDevice';
import { useNavigate } from 'react-router-dom';

/**
 * AdminMensajes - Componente para enviar mensajes a usuarios y ver solicitudes recibidas
 * Permite enviar mensajes individuales, solo a admin, o a todos los usuarios
 * También muestra las solicitudes de cambio de tabla GYM de los usuarios
 */
export default function AdminMensajes() {
  const { isMobile } = useDevice();
  const navigate = useNavigate();
  const [mensaje, setMensaje] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [solicitudesRecibidas, setSolicitudesRecibidas] = useState([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [mensajesAdmin, setMensajesAdmin] = useState([]);
  const [filterMensajes, setFilterMensajes] = useState('todos'); // 'todos', 'leidos', 'no_leidos'

  // Cargar usuarios y solicitudes
  useEffect(() => {
    loadUsers();
    loadSolicitudes();
  }, []);

  const loadUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => 
          u.email !== 'admin@admin.es' && // Excluir admin de la lista
          u.nombre && u.nombre.trim() !== '' && // Tener nombre
          u.apellidos && u.apellidos.trim() !== '' // Tener apellidos
        )
        .sort((a, b) => {
          const apellidoA = (a.apellidos || '').trim().toLowerCase();
          const apellidoB = (b.apellidos || '').trim().toLowerCase();
          return apellidoA.localeCompare(apellidoB);
        });
      setUsuarios(usersList);
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
      setError('Error al cargar usuarios');
    }
  };

  const loadSolicitudes = async () => {
    setLoadingSolicitudes(true);
    try {
      const q = query(collection(db, 'mensajes_admin'), orderBy('creadoEn', 'desc'));
      const solicitudesSnapshot = await getDocs(q);
      const allMensajes = solicitudesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Separar mensajes del admin de solicitudes de usuarios
      const mensajesDelAdmin = allMensajes.filter(m => m.creadoPor === 'admin');
      const solicitudesDeUsuarios = allMensajes.filter(m => m.creadoPor !== 'admin');
      
      setMensajesAdmin(mensajesDelAdmin);
      setSolicitudesRecibidas(solicitudesDeUsuarios);
    } catch (err) {
      console.error('Error al cargar solicitudes:', err);
    } finally {
      setLoadingSolicitudes(false);
    }
  };

  const handleEliminarSolicitud = async (solicitudId, esAdmin = false) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este mensaje?')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'mensajes_admin', solicitudId));
      
      if (esAdmin) {
        setMensajesAdmin(mensajesAdmin.filter(s => s.id !== solicitudId));
      } else {
        setSolicitudesRecibidas(solicitudesRecibidas.filter(s => s.id !== solicitudId));
      }
      
      setSuccess('Mensaje eliminado correctamente');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error al eliminar mensaje:', err);
      setError('Error al eliminar el mensaje');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleMarcarLeida = async (solicitudId, leidoActual, esAdmin = false) => {
    try {
      await updateDoc(doc(db, 'mensajes_admin', solicitudId), {
        leido: !leidoActual
      });
      
      if (esAdmin) {
        setMensajesAdmin(mensajesAdmin.map(s => 
          s.id === solicitudId ? { ...s, leido: !leidoActual } : s
        ));
      } else {
        setSolicitudesRecibidas(solicitudesRecibidas.map(s => 
          s.id === solicitudId ? { ...s, leido: !leidoActual } : s
        ));
      }
    } catch (err) {
      console.error('Error al marcar mensaje:', err);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Sin fecha';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Fecha no válida';
    }
  };

  const handleEnviarMensaje = async (tipo) => {
    if (!mensaje.trim()) {
      setError('Por favor escribe un mensaje');
      return;
    }

    if (tipo === 'seleccionados' && selectedUserIds.length === 0) {
      setError('Por favor selecciona al menos un usuario');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const mensajeData = {
        contenido: mensaje.trim(),
        creadoEn: serverTimestamp(),
        leido: false,
        creadoPor: 'admin'
      };

      if (tipo === 'seleccionados') {
        // Enviar a usuarios seleccionados
        const promises = selectedUserIds.map(userId => 
          addDoc(collection(db, 'users', userId, 'mensajes'), mensajeData)
        );
        await Promise.all(promises);
        setSuccess(`Mensaje enviado a ${selectedUserIds.length} usuarios seleccionados`);
      } else if (tipo === 'admin') {
        // Enviar solo para el admin
        await addDoc(collection(db, 'mensajes_admin'), mensajeData);
        setSuccess('Mensaje guardado para el admin');
      } else if (tipo === 'todos') {
        // Enviar a todos los usuarios
        const promises = usuarios.map(user => 
          addDoc(collection(db, 'users', user.id, 'mensajes'), mensajeData)
        );
        await Promise.all(promises);
        setSuccess(`Mensaje enviado a ${usuarios.length} usuarios`);
      }

      // Limpiar formulario
      setMensaje('');
      setSelectedUserIds([]);

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      setError('Error al enviar el mensaje');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar usuarios por búsqueda
  const usuariosFiltrados = usuarios.filter(user => {
    if (!busqueda.trim()) return true;
    const searchLower = busqueda.toLowerCase();
    const nombreCompleto = `${user.apellidos}, ${user.nombre}`.toLowerCase();
    return nombreCompleto.includes(searchLower);
  });

  const containerStyle = {
    padding: isMobile ? '16px' : '24px',
    maxWidth: isMobile ? '100%' : '1400px',
    margin: '0 auto',
  };

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: isMobile ? '20px' : '30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  };

  return (
    <div style={containerStyle}>
      {/* Botón volver */}
      <button
        onClick={() => navigate('/admin')}
        style={{
          marginBottom: '16px',
          padding: '10px 16px',
          fontSize: '14px',
          fontWeight: '600',
          color: '#666',
          backgroundColor: '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          e.target.style.backgroundColor = '#e5e5e5';
          e.target.style.borderColor = '#ccc';
        }}
        onMouseOut={(e) => {
          e.target.style.backgroundColor = '#f5f5f5';
          e.target.style.borderColor = '#ddd';
        }}
      >
        ← Volver
      </button>

      {/* Layout de dos columnas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* COLUMNA IZQUIERDA: Enviar mensajes */}
        <div style={cardStyle}>
          <h2 style={{
            margin: '0 0 24px 0',
            fontSize: isMobile ? '22px' : '28px',
            color: '#2c3e50',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            💬 Enviar Mensaje
          </h2>

        {/* Cuadro de texto para el mensaje */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#555'
          }}>
            Mensaje:
          </label>
          <textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Escribe tu mensaje aquí..."
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
            }}
            onFocus={(e) => e.target.style.borderColor = '#2196F3'}
            onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
          />
        </div>

        {/* Selector de usuarios con checkboxes */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#555'
          }}>
            Seleccionar usuarios:
          </label>
          
          {/* Campo de búsqueda */}
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar por nombre o apellido..."
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '15px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              marginBottom: '12px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#2196F3'}
            onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
          />
          
          {/* Lista con checkboxes */}
          <div style={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            padding: '8px',
            backgroundColor: 'white'
          }}>
            {/* Opción para seleccionar/deseleccionar todos */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              cursor: 'pointer',
              backgroundColor: '#f0f9ff',
              borderRadius: '6px',
              marginBottom: '8px',
              fontWeight: '600',
              borderBottom: '2px solid #bfdbfe'
            }}>
              <input
                type="checkbox"
                checked={selectedUserIds.length === usuariosFiltrados.length && usuariosFiltrados.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedUserIds(usuariosFiltrados.map(u => u.id));
                  } else {
                    setSelectedUserIds([]);
                  }
                }}
                style={{
                  width: '18px',
                  height: '18px',
                  marginRight: '10px',
                  cursor: 'pointer'
                }}
              />
              <span style={{ color: '#0369a1' }}>
                {selectedUserIds.length === usuariosFiltrados.length && usuariosFiltrados.length > 0 ? '☑ Deseleccionar todos' : '☐ Seleccionar todos'}
                {selectedUserIds.length > 0 && ` (${selectedUserIds.length} seleccionados)`}
              </span>
            </label>

            {usuariosFiltrados.length === 0 ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#666',
                fontSize: '15px'
              }}>
                {busqueda ? `No se encontraron usuarios con "${busqueda}"` : 'No hay usuarios disponibles'}
              </div>
            ) : (
              usuariosFiltrados.map(user => (
                <label
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s',
                    backgroundColor: selectedUserIds.includes(user.id) ? '#f0fdf4' : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedUserIds.includes(user.id)) {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedUserIds.includes(user.id)) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUserIds([...selectedUserIds, user.id]);
                      } else {
                        setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                      }
                    }}
                    style={{
                      width: '16px',
                      height: '16px',
                      marginRight: '8px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '14px' }}>
                    {user.apellidos && user.nombre 
                      ? `${user.apellidos}, ${user.nombre}`
                      : `${user.nombre || ''} ${user.apellidos || ''}`.trim() || user.email}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Botones de acción */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => handleEnviarMensaje('seleccionados')}
            disabled={loading || selectedUserIds.length === 0}
            style={{
              flex: 1,
              padding: '14px 20px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              backgroundColor: selectedUserIds.length > 0 ? '#2196F3' : '#ccc',
              border: 'none',
              borderRadius: '8px',
              cursor: selectedUserIds.length > 0 ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              if (selectedUserIds.length > 0 && !loading) e.target.style.backgroundColor = '#1976D2';
            }}
            onMouseOut={(e) => {
              if (selectedUserIds.length > 0) e.target.style.backgroundColor = '#2196F3';
            }}
          >
            📤 Enviar a seleccionados ({selectedUserIds.length})
          </button>

          <button
            onClick={() => handleEnviarMensaje('admin')}
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px 20px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              backgroundColor: loading ? '#ccc' : '#FF9800',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              if (!loading) e.target.style.backgroundColor = '#F57C00';
            }}
            onMouseOut={(e) => {
              if (!loading) e.target.style.backgroundColor = '#FF9800';
            }}
          >
            📝 Solo para Admin
          </button>

          <button
            onClick={() => handleEnviarMensaje('todos')}
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px 20px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              backgroundColor: loading ? '#ccc' : '#4CAF50',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              if (!loading) e.target.style.backgroundColor = '#45a049';
            }}
            onMouseOut={(e) => {
              if (!loading) e.target.style.backgroundColor = '#4CAF50';
            }}
          >
            📢 Enviar a TODOS
          </button>
        </div>

        {/* Mensajes de estado */}
        {success && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#d4edda',
            color: '#155724',
            borderRadius: '8px',
            marginTop: '16px',
            border: '1px solid #c3e6cb'
          }}>
            ✅ {success}
          </div>
        )}

        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '8px',
            marginTop: '16px',
            border: '1px solid #f5c6cb'
          }}>
            ❌ {error}
          </div>
        )}

        {loading && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#d1ecf1',
            color: '#0c5460',
            borderRadius: '8px',
            marginTop: '16px',
            border: '1px solid #bee5eb',
            textAlign: 'center'
          }}>
            ⏳ Enviando mensaje...
          </div>
        )}

        {/* Información */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#666'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>ℹ️ Información:</p>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li><strong>Seleccionados:</strong> Marca los checkboxes de los usuarios a los que quieres enviar el mensaje</li>
            <li><strong>Solo para Admin:</strong> Guarda el mensaje solo para ti (aparecerá cuando inicies sesión)</li>
            <li><strong>Enviar a TODOS:</strong> Envía el mensaje a todos los usuarios registrados ({usuarios.length} usuarios)</li>
          </ul>
        </div>
      </div>

      {/* COLUMNA DERECHA: Mensajes recibidos */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Sección de mensajes personales del admin */}
        <div style={cardStyle}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: isMobile ? '20px' : '24px',
              color: '#2c3e50',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
            📝 Mis Mensajes Personales
            {mensajesAdmin.length > 0 && (
              <span style={{
                fontSize: '14px',
                fontWeight: 'normal',
                color: '#666',
                backgroundColor: '#f0f0f0',
                padding: '4px 12px',
                borderRadius: '12px'
              }}>
                {mensajesAdmin.length}
              </span>
            )}
          </h2>

          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setFilterMensajes('todos')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: filterMensajes === 'todos' ? '600' : '500',
                color: filterMensajes === 'todos' ? 'white' : '#666',
                backgroundColor: filterMensajes === 'todos' ? '#2196F3' : '#f5f5f5',
                border: filterMensajes === 'todos' ? '2px solid #2196F3' : '2px solid #e0e0e0',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Todos ({mensajesAdmin.length})
            </button>
            <button
              onClick={() => setFilterMensajes('no_leidos')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: filterMensajes === 'no_leidos' ? '600' : '500',
                color: filterMensajes === 'no_leidos' ? 'white' : '#666',
                backgroundColor: filterMensajes === 'no_leidos' ? '#2196F3' : '#f5f5f5',
                border: filterMensajes === 'no_leidos' ? '2px solid #2196F3' : '2px solid #e0e0e0',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              No leídos ({mensajesAdmin.filter(m => !m.leido).length})
            </button>
            <button
              onClick={() => setFilterMensajes('leidos')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: filterMensajes === 'leidos' ? '600' : '500',
                color: filterMensajes === 'leidos' ? 'white' : '#666',
                backgroundColor: filterMensajes === 'leidos' ? '#2196F3' : '#f5f5f5',
                border: filterMensajes === 'leidos' ? '2px solid #2196F3' : '2px solid #e0e0e0',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Leídos ({mensajesAdmin.filter(m => m.leido).length})
            </button>
          </div>
        </div>

        {loadingSolicitudes ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            Cargando mensajes...
          </div>
        ) : mensajesAdmin.filter(m => {
          if (filterMensajes === 'leidos') return m.leido;
          if (filterMensajes === 'no_leidos') return !m.leido;
          return true;
        }).length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: '#f9f9f9',
            borderRadius: '12px',
            color: '#666'
          }}>
            <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📭</p>
            <p style={{ margin: 0 }}>
              {filterMensajes === 'todos' && 'No tienes mensajes personales'}
              {filterMensajes === 'leidos' && 'No tienes mensajes leídos'}
              {filterMensajes === 'no_leidos' && 'No tienes mensajes sin leer'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mensajesAdmin.filter(m => {
              if (filterMensajes === 'leidos') return m.leido;
              if (filterMensajes === 'no_leidos') return !m.leido;
              return true;
            }).map(mensaje => (
              <div
                key={mensaje.id}
                style={{
                  backgroundColor: mensaje.leido ? '#f9f9f9' : 'white',
                  border: mensaje.leido ? '2px solid #e0e0e0' : '2px solid #2196F3',
                  borderRadius: '12px',
                  padding: isMobile ? '14px' : '18px',
                  boxShadow: mensaje.leido ? 'none' : '0 2px 8px rgba(33,150,243,0.1)'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: mensaje.leido ? '#888' : '#2196F3',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {mensaje.leido ? '✓ Leído' : '● No leído'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#999' }}>•</span>
                      <span style={{ fontSize: '12px', color: '#999' }}>
                        {formatDate(mensaje.creadoEn)}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    flexShrink: 0
                  }}>
                    <button
                      onClick={() => handleMarcarLeida(mensaje.id, mensaje.leido, true)}
                      title={mensaje.leido ? 'Marcar como no leído' : 'Marcar como leído'}
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        color: '#2196F3',
                        backgroundColor: 'transparent',
                        border: '1px solid #2196F3',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.backgroundColor = '#2196F3';
                        e.target.style.color = 'white';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#2196F3';
                      }}
                    >
                      {mensaje.leido ? '✕' : '✓'}
                    </button>
                    <button
                      onClick={() => handleEliminarSolicitud(mensaje.id, true)}
                      title="Eliminar mensaje"
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        color: '#f44336',
                        backgroundColor: 'transparent',
                        border: '1px solid #f44336',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.backgroundColor = '#f44336';
                        e.target.style.color = 'white';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#f44336';
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>

                <div style={{
                  fontSize: '15px',
                  lineHeight: '1.6',
                  color: mensaje.leido ? '#666' : '#2c3e50',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {mensaje.contenido}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sección de solicitudes recibidas */}
      <div style={cardStyle}>
        <h2 style={{
          margin: '0 0 16px 0',
          fontSize: isMobile ? '20px' : '24px',
          color: '#2c3e50',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          📥 Solicitudes Recibidas
          {solicitudesRecibidas.length > 0 && (
            <span style={{
              fontSize: '14px',
              fontWeight: 'normal',
              color: '#666',
              backgroundColor: '#f0f0f0',
              padding: '4px 12px',
              borderRadius: '12px'
            }}>
              {solicitudesRecibidas.length}
            </span>
          )}
        </h2>

        {loadingSolicitudes ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            Cargando solicitudes...
          </div>
        ) : solicitudesRecibidas.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: '#f9f9f9',
            borderRadius: '12px',
            color: '#666'
          }}>
            <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📭</p>
            <p style={{ margin: 0 }}>No hay solicitudes pendientes</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {solicitudesRecibidas.map(solicitud => (
              <div
                key={solicitud.id}
                style={{
                  backgroundColor: solicitud.leido ? '#f9f9f9' : 'white',
                  border: solicitud.leido ? '2px solid #e0e0e0' : '2px solid #2196F3',
                  borderRadius: '12px',
                  padding: isMobile ? '14px' : '18px',
                  boxShadow: solicitud.leido ? 'none' : '0 2px 8px rgba(33,150,243,0.1)'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: solicitud.leido ? '#888' : '#2196F3',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {solicitud.leido ? '✓ Leído' : '● No leído'}
                      </span>
                      {solicitud.tipo === 'solicitud_tabla_gym' && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: 'white',
                          backgroundColor: '#FF9800',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          🏋️ TABLA GYM
                        </span>
                      )}
                      <span style={{
                        fontSize: '12px',
                        color: '#999'
                      }}>
                        •
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: '#999'
                      }}>
                        {formatDate(solicitud.creadoEn)}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    flexShrink: 0
                  }}>
                    <button
                      onClick={() => handleMarcarLeida(solicitud.id, solicitud.leido)}
                      title={solicitud.leido ? 'Marcar como no leído' : 'Marcar como leído'}
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        color: '#2196F3',
                        backgroundColor: 'transparent',
                        border: '1px solid #2196F3',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.backgroundColor = '#2196F3';
                        e.target.style.color = 'white';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#2196F3';
                      }}
                    >
                      {solicitud.leido ? '✕' : '✓'}
                    </button>
                    <button
                      onClick={() => handleEliminarSolicitud(solicitud.id)}
                      title="Eliminar solicitud"
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        color: '#f44336',
                        backgroundColor: 'transparent',
                        border: '1px solid #f44336',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.backgroundColor = '#f44336';
                        e.target.style.color = 'white';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#f44336';
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>

                <div style={{
                  fontSize: '15px',
                  lineHeight: '1.6',
                  color: solicitud.leido ? '#666' : '#2c3e50',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {solicitud.contenido}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
    </div>
  );
}
