import React, { useState, useEffect } from 'react';
import { storage } from '../Firebase';
import { ref, listAll, getMetadata, deleteObject, getDownloadURL } from 'firebase/storage';
import { useDevice } from '../hooks/useDevice';
import { useNavigate } from 'react-router-dom';

/**
 * AdminRecursos - Componente para gestionar archivos en Firebase Storage
 * Permite ver, descargar y eliminar archivos de la carpeta mensajes/
 */
export default function AdminRecursos() {
  const { isMobile } = useDevice();
  const navigate = useNavigate();
  const [archivos, setArchivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('todos'); // 'todos', 'imagenes', 'videos', 'documentos'
  const [searchTerm, setSearchTerm] = useState('');
  const [totalSize, setTotalSize] = useState(0);

  useEffect(() => {
    loadArchivos();
  }, []);

  const loadArchivos = async () => {
    setLoading(true);
    setError('');
    try {
      // Cargar archivos de recursos/
      const recursosRef = ref(storage, 'recursos/');
      const resultRecursos = await listAll(recursosRef);
      
      // Cargar archivos de gym/videos/ (archivos antiguos)
      const gymRef = ref(storage, 'gym/videos/');
      const resultGym = await listAll(gymRef);
      
      // Combinar ambas listas
      const allItems = [...resultRecursos.items, ...resultGym.items];
      
      const archivosData = await Promise.all(
        allItems.map(async (itemRef) => {
          try {
            const metadata = await getMetadata(itemRef);
            const url = await getDownloadURL(itemRef);
            
            return {
              name: itemRef.name,
              fullPath: itemRef.fullPath,
              size: metadata.size,
              contentType: metadata.contentType,
              created: metadata.timeCreated,
              updated: metadata.updated,
              url: url
            };
          } catch (err) {
            console.error('Error al obtener metadata:', itemRef.name, err);
            return null;
          }
        })
      );

      const validArchivos = archivosData.filter(a => a !== null);
      
      // Ordenar por fecha (más recientes primero)
      validArchivos.sort((a, b) => new Date(b.created) - new Date(a.created));
      
      setArchivos(validArchivos);
      
      // Calcular tamaño total
      const total = validArchivos.reduce((sum, a) => sum + a.size, 0);
      setTotalSize(total);
    } catch (err) {
      console.error('Error al cargar archivos:', err);
      setError('Error al cargar los archivos');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (archivo) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar "${archivo.name}"?\n\nEsto eliminará el archivo permanentemente.`)) {
      return;
    }

    try {
      const fileRef = ref(storage, archivo.fullPath);
      await deleteObject(fileRef);
      
      // Actualizar la lista local
      setArchivos(archivos.filter(a => a.fullPath !== archivo.fullPath));
      setTotalSize(totalSize - archivo.size);
      
      setSuccess(`Archivo "${archivo.name}" eliminado correctamente`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error al eliminar archivo:', err);
      setError(`Error al eliminar el archivo: ${err.message}`);
      setTimeout(() => setError(''), 5000);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
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

  const getFileType = (contentType) => {
    if (!contentType) return 'otro';
    if (contentType.startsWith('image/')) return 'imagen';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.includes('pdf')) return 'pdf';
    if (contentType.includes('word') || contentType.includes('document')) return 'word';
    if (contentType.includes('excel') || contentType.includes('sheet')) return 'excel';
    return 'otro';
  };

  const getFileIcon = (contentType) => {
    const type = getFileType(contentType);
    switch (type) {
      case 'imagen': return '🖼️';
      case 'video': return '🎥';
      case 'pdf': return '📄';
      case 'word': return '📝';
      case 'excel': return '📊';
      default: return '📎';
    }
  };

  // Filtrar archivos
  const archivosFiltrados = archivos.filter(archivo => {
    // Filtro por tipo
    if (filter !== 'todos') {
      const type = getFileType(archivo.contentType);
      if (filter === 'imagenes' && type !== 'imagen') return false;
      if (filter === 'videos' && type !== 'video') return false;
      if (filter === 'documentos' && !['pdf', 'word', 'excel'].includes(type)) return false;
    }
    
    // Filtro por búsqueda
    if (searchTerm) {
      return archivo.name.toLowerCase().includes(searchTerm.toLowerCase());
    }
    
    return true;
  });

  const containerStyle = {
    padding: isMobile ? '16px' : '24px',
    maxWidth: '1400px',
    margin: '0 auto',
  };

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: isMobile ? '20px' : '30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '24px'
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Cargando archivos...
        </div>
      </div>
    );
  }

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

      {/* Header */}
      <div style={cardStyle}>
        <h2 style={{
          margin: '0 0 24px 0',
          fontSize: isMobile ? '22px' : '28px',
          color: '#2c3e50',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          📁 Recursos / Archivos
        </h2>

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

        {/* Estadísticas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            padding: '16px',
            backgroundColor: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #bfdbfe'
          }}>
            <div style={{ fontSize: '12px', color: '#0369a1', marginBottom: '4px' }}>Total archivos</div>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#0c4a6e' }}>{archivos.length}</div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            border: '1px solid #fde68a'
          }}>
            <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>Espacio usado</div>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#78350f' }}>{formatSize(totalSize)}</div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: '#f0fdf4',
            borderRadius: '8px',
            border: '1px solid #bbf7d0'
          }}>
            <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px' }}>Imágenes</div>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#14532d' }}>
              {archivos.filter(a => getFileType(a.contentType) === 'imagen').length}
            </div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: '#fce7f3',
            borderRadius: '8px',
            border: '1px solid #fbcfe8'
          }}>
            <div style={{ fontSize: '12px', color: '#9f1239', marginBottom: '4px' }}>Videos</div>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#881337' }}>
              {archivos.filter(a => getFileType(a.contentType) === 'video').length}
            </div>
          </div>
        </div>

        {/* Filtros y búsqueda */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '12px',
          marginBottom: '20px',
          alignItems: isMobile ? 'stretch' : 'center'
        }}>
          {/* Buscador */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Buscar por nombre..."
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: '15px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#2196F3'}
            onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
          />

          {/* Filtros de tipo */}
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            {['todos', 'imagenes', 'videos', 'documentos'].map(tipo => (
              <button
                key={tipo}
                onClick={() => setFilter(tipo)}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: filter === tipo ? '600' : '500',
                  color: filter === tipo ? 'white' : '#666',
                  backgroundColor: filter === tipo ? '#2196F3' : '#f5f5f5',
                  border: filter === tipo ? '2px solid #2196F3' : '2px solid #e0e0e0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  if (filter !== tipo) {
                    e.target.style.backgroundColor = '#e8e8e8';
                  }
                }}
                onMouseOut={(e) => {
                  if (filter !== tipo) {
                    e.target.style.backgroundColor = '#f5f5f5';
                  }
                }}
              >
                {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
              </button>
            ))}
          </div>

          {/* Botón recargar */}
          <button
            onClick={loadArchivos}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2196F3',
              backgroundColor: 'white',
              border: '2px solid #2196F3',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#2196F3';
              e.target.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'white';
              e.target.style.color = '#2196F3';
            }}
          >
            🔄 Recargar
          </button>
        </div>

        {/* Lista de archivos */}
        {archivosFiltrados.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: '#f9f9f9',
            borderRadius: '12px',
            color: '#666'
          }}>
            {searchTerm || filter !== 'todos' 
              ? 'No se encontraron archivos con los filtros aplicados'
              : 'No hay archivos en el storage'}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            {archivosFiltrados.map((archivo, index) => {
              const esImagen = getFileType(archivo.contentType) === 'imagen';
              const esVideo = getFileType(archivo.contentType) === 'video';
              
              return (
                <div
                  key={index}
                  style={{
                    backgroundColor: 'white',
                    border: '2px solid #e0e0e0',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#2196F3';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(33,150,243,0.2)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#e0e0e0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Vista previa */}
                  <div style={{
                    height: '160px',
                    backgroundColor: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    {esImagen ? (
                      <img
                        src={archivo.url}
                        alt={archivo.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : esVideo ? (
                      <video
                        src={archivo.url}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: '48px' }}>
                        {getFileIcon(archivo.contentType)}
                      </div>
                    )}
                  </div>

                  {/* Información */}
                  <div style={{ padding: '16px' }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#2c3e50',
                      marginBottom: '8px',
                      wordBreak: 'break-word',
                      lineHeight: '1.4'
                    }}>
                      {getFileIcon(archivo.contentType)} {archivo.name}
                    </div>
                    
                    <div style={{
                      fontSize: '12px',
                      color: '#666',
                      marginBottom: '12px'
                    }}>
                      <div>📦 {formatSize(archivo.size)}</div>
                      <div>📅 {formatDate(archivo.created)}</div>
                    </div>

                    {/* Acciones */}
                    <div style={{
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <a
                        href={archivo.url}
                        download={archivo.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          padding: '8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#2196F3',
                          backgroundColor: '#f0f9ff',
                          border: '1px solid #2196F3',
                          borderRadius: '6px',
                          textAlign: 'center',
                          textDecoration: 'none',
                          transition: 'all 0.2s',
                          cursor: 'pointer'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.backgroundColor = '#2196F3';
                          e.target.style.color = 'white';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.backgroundColor = '#f0f9ff';
                          e.target.style.color = '#2196F3';
                        }}
                      >
                        ⬇ Descargar
                      </a>
                      <button
                        onClick={() => handleDeleteFile(archivo)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#f44336',
                          backgroundColor: '#fff5f5',
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
                          e.target.style.backgroundColor = '#fff5f5';
                          e.target.style.color = '#f44336';
                        }}
                      >
                        🗑 Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
