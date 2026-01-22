import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../Firebase';
import { useDevice } from '../hooks/useDevice';

/**
 * MensajesUsuario - Componente para que los usuarios vean y gestionen sus mensajes
 * Permite marcar como leído/no leído y eliminar mensajes
 */
export default function MensajesUsuario({ user }) {
  const { isMobile } = useDevice();
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos'); // 'todos', 'leidos', 'no_leidos'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Cargar mensajes del usuario
  useEffect(() => {
    if (!user?.id) return;
    loadMensajes();
  }, [user]);

  const loadMensajes = async () => {
    try {
      setLoading(true);
      const mensajesRef = collection(db, 'users', user.id, 'mensajes');
      const q = query(mensajesRef, orderBy('creadoEn', 'desc'));
      const mensajesSnapshot = await getDocs(q);
      
      const mensajesList = mensajesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setMensajes(mensajesList);
    } catch (err) {
      console.error('Error al cargar mensajes:', err);
      setError('Error al cargar los mensajes');
    } finally {
      setLoading(false);
    }
  };

  // Marcar mensaje como leído/no leído
  const toggleLeido = async (mensajeId, leidoActual) => {
    try {
      const mensajeRef = doc(db, 'users', user.id, 'mensajes', mensajeId);
      await updateDoc(mensajeRef, {
        leido: !leidoActual
      });

      // Actualizar estado local
      setMensajes(mensajes.map(m => 
        m.id === mensajeId ? { ...m, leido: !leidoActual } : m
      ));
      
      setSuccess(!leidoActual ? 'Mensaje marcado como leído' : 'Mensaje marcado como no leído');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error al actualizar mensaje:', err);
      setError('Error al actualizar el mensaje');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Eliminar mensaje
  const deleteMensaje = async (mensajeId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este mensaje?')) {
      return;
    }

    try {
      const mensajeRef = doc(db, 'users', user.id, 'mensajes', mensajeId);
      await deleteDoc(mensajeRef);

      // Actualizar estado local
      setMensajes(mensajes.filter(m => m.id !== mensajeId));
      
      setSuccess('Mensaje eliminado');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error al eliminar mensaje:', err);
      setError('Error al eliminar el mensaje');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Formatear fecha
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Sin fecha';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      
      // Menos de 1 minuto
      if (diff < 60000) {
        return 'Hace un momento';
      }
      
      // Menos de 1 hora
      if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
      }
      
      // Menos de 1 día
      if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
      }
      
      // Menos de 1 semana
      if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `Hace ${days} día${days > 1 ? 's' : ''}`;
      }
      
      // Fecha completa
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return 'Fecha no válida';
    }
  };

  // Filtrar mensajes según filtro seleccionado
  const mensajesFiltrados = mensajes.filter(m => {
    if (filter === 'leidos') return m.leido;
    if (filter === 'no_leidos') return !m.leido;
    return true; // 'todos'
  });

  const containerStyle = {
    padding: isMobile ? '12px' : '20px',
    maxWidth: '900px',
    margin: '0 auto',
  };

  const headerStyle = {
    marginBottom: '20px',
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'stretch' : 'center',
    gap: '12px'
  };

  const filterButtonStyle = (active) => ({
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: active ? '600' : '500',
    color: active ? 'white' : '#666',
    backgroundColor: active ? '#2196F3' : '#f5f5f5',
    border: active ? '2px solid #2196F3' : '2px solid #e0e0e0',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flex: isMobile ? '1' : 'auto'
  });

  const mensajeCardStyle = (leido) => ({
    backgroundColor: leido ? '#f9f9f9' : 'white',
    border: leido ? '2px solid #e0e0e0' : '2px solid #2196F3',
    borderRadius: '12px',
    padding: isMobile ? '14px' : '18px',
    marginBottom: '12px',
    boxShadow: leido ? 'none' : '0 2px 8px rgba(33,150,243,0.1)',
    transition: 'all 0.2s'
  });

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Cargando mensajes...
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Mensajes de éxito/error */}
      {success && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          backgroundColor: '#d4edda',
          color: '#155724',
          border: '1px solid #c3e6cb',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          ✓ {success}
        </div>
      )}
      
      {error && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          ✗ {error}
        </div>
      )}

      {/* Header con título y filtros */}
      <div style={headerStyle}>
        <h3 style={{ 
          margin: 0, 
          fontSize: isMobile ? '20px' : '24px',
          color: '#2c3e50',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          💬 Mis Mensajes
          {mensajesFiltrados.length > 0 && (
            <span style={{
              fontSize: '14px',
              color: '#666',
              fontWeight: 'normal'
            }}>
              ({mensajesFiltrados.length})
            </span>
          )}
        </h3>

        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setFilter('todos')}
            style={filterButtonStyle(filter === 'todos')}
            onMouseOver={(e) => {
              if (filter !== 'todos') {
                e.target.style.backgroundColor = '#e8e8e8';
              }
            }}
            onMouseOut={(e) => {
              if (filter !== 'todos') {
                e.target.style.backgroundColor = '#f5f5f5';
              }
            }}
          >
            Todos ({mensajes.length})
          </button>
          <button
            onClick={() => setFilter('no_leidos')}
            style={filterButtonStyle(filter === 'no_leidos')}
            onMouseOver={(e) => {
              if (filter !== 'no_leidos') {
                e.target.style.backgroundColor = '#e8e8e8';
              }
            }}
            onMouseOut={(e) => {
              if (filter !== 'no_leidos') {
                e.target.style.backgroundColor = '#f5f5f5';
              }
            }}
          >
            No leídos ({mensajes.filter(m => !m.leido).length})
          </button>
          <button
            onClick={() => setFilter('leidos')}
            style={filterButtonStyle(filter === 'leidos')}
            onMouseOver={(e) => {
              if (filter !== 'leidos') {
                e.target.style.backgroundColor = '#e8e8e8';
              }
            }}
            onMouseOut={(e) => {
              if (filter !== 'leidos') {
                e.target.style.backgroundColor = '#f5f5f5';
              }
            }}
          >
            Leídos ({mensajes.filter(m => m.leido).length})
          </button>
        </div>
      </div>

      {/* Lista de mensajes */}
      {mensajesFiltrados.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: '#f9f9f9',
          borderRadius: '12px',
          color: '#666'
        }}>
          {filter === 'todos' && 'No tienes mensajes'}
          {filter === 'leidos' && 'No tienes mensajes leídos'}
          {filter === 'no_leidos' && 'No tienes mensajes sin leer'}
        </div>
      ) : (
        <div>
          {mensajesFiltrados.map(mensaje => (
            <div key={mensaje.id} style={mensajeCardStyle(mensaje.leido)}>
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
                    onClick={() => toggleLeido(mensaje.id, mensaje.leido)}
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
                    onClick={() => deleteMensaje(mensaje.id)}
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

              {/* Archivos adjuntos */}
              {mensaje.archivos && mensaje.archivos.length > 0 && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: mensaje.leido ? '#fafafa' : '#f0f9ff',
                  borderRadius: '8px',
                  border: `1px solid ${mensaje.leido ? '#e0e0e0' : '#bfdbfe'}`
                }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#555',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    📎 Archivos adjuntos ({mensaje.archivos.length})
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '10px'
                  }}>
                    {mensaje.archivos.map((archivo, index) => {
                      const esImagen = archivo.tipo.startsWith('image/');
                      const esVideo = archivo.tipo.startsWith('video/');
                      const esPDF = archivo.tipo.includes('pdf');
                      
                      return (
                        <div
                          key={index}
                          style={{
                            backgroundColor: 'white',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            transition: 'all 0.2s'
                          }}
                        >
                          {/* Vista previa para imágenes */}
                          {esImagen && (
                            <a
                              href={archivo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'block' }}
                            >
                              <img
                                src={archivo.url}
                                alt={archivo.nombre}
                                style={{
                                  width: '100%',
                                  height: '150px',
                                  objectFit: 'cover',
                                  cursor: 'pointer'
                                }}
                                onMouseOver={(e) => e.target.style.opacity = '0.8'}
                                onMouseOut={(e) => e.target.style.opacity = '1'}
                              />
                            </a>
                          )}
                          
                          {/* Vista previa para videos */}
                          {esVideo && (
                            <video
                              src={archivo.url}
                              controls
                              style={{
                                width: '100%',
                                maxHeight: '200px',
                                backgroundColor: '#000'
                              }}
                            />
                          )}
                          
                          {/* Icono para documentos */}
                          {!esImagen && !esVideo && (
                            <div style={{
                              height: '100px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#f5f5f5',
                              fontSize: '48px'
                            }}>
                              {esPDF ? '📄' : '📎'}
                            </div>
                          )}
                          
                          {/* Información del archivo */}
                          <div style={{
                            padding: '10px',
                            borderTop: '1px solid #e0e0e0'
                          }}>
                            <div style={{
                              fontSize: '12px',
                              color: '#2c3e50',
                              fontWeight: '500',
                              marginBottom: '4px',
                              wordBreak: 'break-word',
                              lineHeight: '1.3'
                            }}>
                              {archivo.nombre}
                            </div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <span style={{
                                fontSize: '11px',
                                color: '#999'
                              }}>
                                {archivo.tamaño ? `${(archivo.tamaño / 1024).toFixed(1)} KB` : ''}
                              </span>
                              <a
                                href={archivo.url}
                                download={archivo.nombre}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '11px',
                                  color: '#2196F3',
                                  textDecoration: 'none',
                                  fontWeight: '600',
                                  padding: '4px 8px',
                                  backgroundColor: '#f0f9ff',
                                  borderRadius: '4px',
                                  transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => {
                                  e.target.style.backgroundColor = '#e0f2fe';
                                }}
                                onMouseOut={(e) => {
                                  e.target.style.backgroundColor = '#f0f9ff';
                                }}
                              >
                                ⬇ Descargar
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
