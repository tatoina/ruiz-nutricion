import React, { useEffect, useState } from "react";
import { db, storage } from "../Firebase";
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc,
  query,
  orderBy 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";

/**
 * AdminGymGestion - Gestión completa de GYM
 * - Crear/editar categorías
 * - Crear/editar ejercicios
 * - Drag & drop para asignar ejercicios a tabla
 * - Asignar tabla a usuarios
 */
export default function AdminGymGestion() {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState([]);
  const [ejercicios, setEjercicios] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para gestión de categorías
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [editingCategoria, setEditingCategoria] = useState(null);
  const [modoCategoria, setModoCategoria] = useState("crear"); // "crear" o "editar"
  
  // Estado para gestión de ejercicios
  const [showEjercicioModal, setShowEjercicioModal] = useState(false);
  const [formEjercicio, setFormEjercicio] = useState({
    nombre: "",
    categoria: "",
    descripcion: ""
  });
  const [editingEjercicio, setEditingEjercicio] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Estado para la tabla de asignación (drag & drop)
  const [tablaAsignacion, setTablaAsignacion] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("");
  
  // Estado para modal de parámetros del ejercicio
  const [showParamsModal, setShowParamsModal] = useState(false);
  const [ejercicioParaAgregar, setEjercicioParaAgregar] = useState(null);
  const [paramsForm, setParamsForm] = useState({
    series: "",
    repeticiones: "",
    peso: "",
    tiempo: "",
    intervalo: ""
  });
  const [editingParams, setEditingParams] = useState(null);
  const [editingParamsIndex, setEditingParamsIndex] = useState(null);
  
  // Filtros
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [nombreFiltro, setNombreFiltro] = useState("");
  
  const [saving, setSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar categorías
      const catSnapshot = await getDocs(collection(db, "gym_categorias"));
      const catList = catSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => (a.orden || 0) - (b.orden || 0));
      setCategorias(catList);
      
      // Cargar ejercicios
      try {
        const q = query(collection(db, "gym_ejercicios"), orderBy("nombre", "asc"));
        const ejSnapshot = await getDocs(q);
        const ejList = ejSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setEjercicios(ejList);
      } catch (err) {
        const ejSnapshot = await getDocs(collection(db, "gym_ejercicios"));
        const ejList = ejSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setEjercicios(ejList.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
      
      // Cargar todos los usuarios (socios) (CAMBIO: 'usuarios' -> 'users' para contar bien los usuarios)
      // Si necesitas volver atrás, cambia 'users' por 'usuarios' en esta línea
      const usersSnapshot = await getDocs(collection(db, "users"));
      const usersList = usersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(u => {
          // Filtrar usuarios sin datos válidos
          if (!u.nombre || !u.apellidos || !u.email) return false;
          // Filtrar usuarios con datos inválidos (solo "0" o vacíos)
          if (u.nombre === "0" || u.apellidos === "0") return false;
          // Filtrar admins
          if (u.role === "admin" || u.rol === "admin") return false;
          return true;
        })
        .sort((a, b) => {
          const nombreA = `${a.apellidos || ""} ${a.nombre || ""}`.toLowerCase();
          const nombreB = `${b.apellidos || ""} ${b.nombre || ""}`.toLowerCase();
          return nombreA.localeCompare(nombreB);
        });
      
      // Eliminar duplicados por email
      const usuariosUnicos = usersList.filter((user, index, self) => 
        index === self.findIndex((u) => u.email === user.email)
      );
      
      console.log("📋 Usuarios cargados:", usuariosUnicos.length, usuariosUnicos);
      setUsuarios(usuariosUnicos);
      
    } catch (err) {
      console.error("Error al cargar datos:", err);
      alert("Error al cargar datos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cargar tabla cuando se selecciona usuario
  useEffect(() => {
    if (usuarioSeleccionado) {
      const user = usuarios.find(u => u.id === usuarioSeleccionado);
      setTablaAsignacion(user?.tablaGym || []);
    } else {
      setTablaAsignacion([]);
    }
  }, [usuarioSeleccionado, usuarios]);

  // ========== GESTIÓN DE CATEGORÍAS ==========
  
  const handleNuevaCategoria = () => {
    setModoCategoria("crear");
    setEditingCategoria(null);
    setNuevaCategoria("");
    setShowCategoriaModal(true);
  };

  const handleEditarCategoria = (cat) => {
    setModoCategoria("editar");
    setEditingCategoria(cat);
    setNuevaCategoria(cat.nombre);
    setShowCategoriaModal(true);
  };

  const handleGuardarCategoria = async () => {
    if (!nuevaCategoria.trim()) {
      alert("Escribe un nombre para la categoría");
      return;
    }
    
    try {
      if (modoCategoria === "crear") {
        await addDoc(collection(db, "gym_categorias"), {
          nombre: nuevaCategoria.trim(),
          orden: categorias.length,
          createdAt: new Date().toISOString()
        });
      } else {
        // Editar
        await updateDoc(doc(db, "gym_categorias", editingCategoria.id), {
          nombre: nuevaCategoria.trim(),
          updatedAt: new Date().toISOString()
        });
      }
      setNuevaCategoria("");
      setShowCategoriaModal(false);
      setEditingCategoria(null);
      await loadData();
    } catch (err) {
      console.error("Error al guardar categoría:", err);
      alert("Error al guardar categoría: " + err.message);
    }
  };

  const handleEliminarCategoria = async (catId, nombre) => {
    if (!window.confirm(`¿Eliminar categoría "${nombre}"?`)) return;
    
    try {
      await deleteDoc(doc(db, "gym_categorias", catId));
      await loadData();
    } catch (err) {
      console.error("Error al eliminar categoría:", err);
      alert("Error: " + err.message);
    }
  };

  const handleRestaurarCategoriasDefault = async () => {
    if (!window.confirm("¿Restaurar las 10 categorías por defecto? Esto NO eliminará las categorías existentes.")) return;
    
    try {
      const categoriasDefault = [
        { nombre: "Jaula", orden: 1 },
        { nombre: "Peso Muerto", orden: 2 },
        { nombre: "Press Banca", orden: 3 },
        { nombre: "Cardio", orden: 4 },
        { nombre: "Piernas", orden: 5 },
        { nombre: "Brazos", orden: 6 },
        { nombre: "Espalda", orden: 7 },
        { nombre: "Abdomen", orden: 8 },
        { nombre: "Flexibilidad", orden: 9 },
        { nombre: "Funcional", orden: 10 }
      ];
      
      for (const cat of categoriasDefault) {
        await addDoc(collection(db, "gym_categorias"), {
          nombre: cat.nombre,
          orden: cat.orden,
          createdAt: new Date().toISOString()
        });
      }
      
      alert("✅ Categorías restauradas exitosamente");
      await loadData();
    } catch (err) {
      console.error("Error al restaurar categorías:", err);
      alert("Error al restaurar categorías: " + err.message);
    }
  };

  // ========== GESTIÓN DE EJERCICIOS ==========
  
  const handleNuevoEjercicio = () => {
    setEditingEjercicio(null);
    setFormEjercicio({
      nombre: "",
      categoria: "",
      descripcion: ""
    });
    setVideoFile(null);
    setShowEjercicioModal(true);
  };

  const handleEditarEjercicio = (ej) => {
    setEditingEjercicio(ej);
    setFormEjercicio({
      nombre: ej.nombre || "",
      categoria: ej.categoria || "",
      descripcion: ej.descripcion || ""
    });
    setVideoFile(null);
    setShowEjercicioModal(true);
  };

  const handleGuardarEjercicio = async () => {
    if (!formEjercicio.nombre.trim() || !formEjercicio.categoria) {
      alert("Nombre y categoría son obligatorios");
      return;
    }
    
    try {
      setUploading(true);
      let videoUrl = "";

      // Subir video si hay archivo
      if (videoFile) {
        const videoRef = ref(storage, `recursos/${Date.now()}_${videoFile.name}`);
        await uploadBytes(videoRef, videoFile);
        videoUrl = await getDownloadURL(videoRef);
      }

      const data = {
        nombre: formEjercicio.nombre.trim(),
        categoria: formEjercicio.categoria,
        descripcion: formEjercicio.descripcion.trim(),
        videoUrl: videoUrl,
        updatedAt: new Date().toISOString()
      };
      
      if (editingEjercicio) {
        await updateDoc(doc(db, "gym_ejercicios", editingEjercicio.id), data);
      } else {
        data.createdAt = new Date().toISOString();
        await addDoc(collection(db, "gym_ejercicios"), data);
      }
      
      setShowEjercicioModal(false);
      setVideoFile(null);
      await loadData();
    } catch (err) {
      console.error("Error al guardar ejercicio:", err);
      alert("Error: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleEliminarEjercicio = async (ejId, nombre) => {
    if (!window.confirm(`¿Eliminar ejercicio "${nombre}"?`)) return;
    
    try {
      await deleteDoc(doc(db, "gym_ejercicios", ejId));
      await loadData();
    } catch (err) {
      console.error("Error al eliminar ejercicio:", err);
      alert("Error: " + err.message);
    }
  };

  // ========== DRAG & DROP ==========
  
  const handleDragStart = (e, ejercicio) => {
    setDraggedItem(ejercicio);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!draggedItem) return;
    
    // Verificar si ya está en la tabla
    const yaExiste = tablaAsignacion.some(item => item.id === draggedItem.id);
    if (yaExiste) {
      alert("Este ejercicio ya está en la tabla");
      setDraggedItem(null);
      return;
    }
    
    // Abrir modal para capturar parámetros
    setEjercicioParaAgregar(draggedItem);
    setParamsForm({
      series: "",
      repeticiones: "",
      peso: "",
      tiempo: "",
      intervalo: ""
    });
    setShowParamsModal(true);
    setDraggedItem(null);
  };

  const handleAgregarEjercicioClick = (ejercicio) => {
    // Verificar si ya está en la tabla
    const yaExiste = tablaAsignacion.some(item => item.id === ejercicio.id);
    if (yaExiste) {
      alert("Este ejercicio ya está en la tabla");
      return;
    }
    
    // Abrir modal para capturar parámetros
    setEjercicioParaAgregar(ejercicio);
    setEditingParams(null);
    setEditingParamsIndex(null);
    setParamsForm({
      series: "",
      repeticiones: "",
      peso: "",
      tiempo: "",
      intervalo: ""
    });
    setShowParamsModal(true);
  };

  const handleGuardarParams = () => {
    if (editingParams !== null) {
      // Editando parámetros existentes
      const nuevaTabla = [...tablaAsignacion];
      nuevaTabla[editingParamsIndex] = {
        ...nuevaTabla[editingParamsIndex],
        ...paramsForm
      };
      setTablaAsignacion(nuevaTabla);
    } else {
      // Añadiendo nuevo ejercicio a la tabla
      const nuevoItem = {
        id: ejercicioParaAgregar.id,
        nombre: ejercicioParaAgregar.nombre,
        categoria: ejercicioParaAgregar.categoria,
        videoUrl: ejercicioParaAgregar.videoUrl || null,
        orden: tablaAsignacion.length + 1,
        ...paramsForm
      };
      setTablaAsignacion([...tablaAsignacion, nuevoItem]);
    }
    
    setShowParamsModal(false);
    setEjercicioParaAgregar(null);
    setEditingParams(null);
    setEditingParamsIndex(null);
  };

  const handleEditarParams = (item, index) => {
    setEjercicioParaAgregar(item);
    setEditingParams(item);
    setEditingParamsIndex(index);
    setParamsForm({
      series: item.series || "",
      repeticiones: item.repeticiones || "",
      peso: item.peso || "",
      tiempo: item.tiempo || "",
      intervalo: item.intervalo || ""
    });
    setShowParamsModal(true);
  };

  const handleEliminarDeTabla = (ejId) => {
    const nuevaTabla = tablaAsignacion
      .filter(item => item.id !== ejId)
      .map((item, idx) => ({ ...item, orden: idx + 1 }));
    setTablaAsignacion(nuevaTabla);
  };

  const handleMoverArriba = (index) => {
    if (index === 0) return;
    const nuevaTabla = [...tablaAsignacion];
    [nuevaTabla[index - 1], nuevaTabla[index]] = [nuevaTabla[index], nuevaTabla[index - 1]];
    setTablaAsignacion(nuevaTabla.map((item, idx) => ({ ...item, orden: idx + 1 })));
  };

  const handleMoverAbajo = (index) => {
    if (index === tablaAsignacion.length - 1) return;
    const nuevaTabla = [...tablaAsignacion];
    [nuevaTabla[index], nuevaTabla[index + 1]] = [nuevaTabla[index + 1], nuevaTabla[index]];
    setTablaAsignacion(nuevaTabla.map((item, idx) => ({ ...item, orden: idx + 1 })));
  };

  // ========== ASIGNAR TABLA A USUARIO ==========
  
  const handleAsignarTabla = async () => {
    if (!usuarioSeleccionado) {
      alert("Selecciona un usuario");
      return;
    }
    
    if (tablaAsignacion.length === 0) {
      alert("La tabla está vacía");
      return;
    }
    
    console.log("🎯 Asignando tabla a usuario:", usuarioSeleccionado);
    console.log("📋 Tabla a asignar:", tablaAsignacion);
    
    try {
      setSaving(true);
      const userRef = doc(db, "users", usuarioSeleccionado);
      console.log("📝 Actualizando usuario...");
      
      await updateDoc(userRef, {
        tablaGym: tablaAsignacion,
        updatedAt: new Date().toISOString()
      });
      
      console.log("✅ Tabla asignada exitosamente");
      alert("✅ Tabla asignada correctamente");
      await loadData();
    } catch (err) {
      console.error("❌ Error al asignar tabla:", err);
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filtrar ejercicios
  const ejerciciosFiltrados = ejercicios.filter(ej => {
    const matchCategoria = !categoriaFiltro || ej.categoria === categoriaFiltro;
    const matchNombre = !nombreFiltro || 
      ej.nombre.toLowerCase().includes(nombreFiltro.toLowerCase());
    return matchCategoria && matchNombre;
  });

  if (loading) {
    return <div style={styles.container}><p>Cargando...</p></div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/admin/gym')} style={styles.btnBack}>
          ← Volver a GYM
        </button>
        <h2 style={styles.mainTitle}>🏋️ Gestión GYM</h2>
      </div>

      {/* Sección de Categorías */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>📁 Categorías</h3>
          <div style={{ display: "flex", gap: "10px" }}>
            {categorias.length === 0 && (
              <button 
                onClick={handleRestaurarCategoriasDefault} 
                style={{ ...styles.btnPrimary, backgroundColor: "#ff9800" }}
                title="Restaurar las 10 categorías por defecto"
              >
                🔄 Restaurar Categorías
              </button>
            )}
            <button onClick={handleNuevaCategoria} style={styles.btnPrimary}>
              ➕ Nueva Categoría
            </button>
          </div>
        </div>
        <div style={styles.categoriasList}>
          {categorias.length === 0 ? (
            <p style={styles.noData}>No hay categorías. Crea una nueva.</p>
          ) : (
            categorias.map(cat => (
              <div key={cat.id} style={styles.categoriaChip}>
                <span>{cat.nombre}</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button 
                    onClick={() => handleEditarCategoria(cat)}
                    style={styles.btnChipEdit}
                    title="Editar"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => handleEliminarCategoria(cat.id, cat.nombre)}
                    style={styles.btnChipDelete}
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sección de Ejercicios y Asignación */}
      <div style={styles.mainGrid}>
        {/* Panel izquierdo: Lista de ejercicios */}
        <div style={styles.leftPanel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>💪 Ejercicios</h3>
            <button onClick={handleNuevoEjercicio} style={styles.btnSmall}>
              ➕ Subir Nuevo
            </button>
          </div>

          {/* Filtros */}
          <div style={styles.filtros}>
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              style={styles.select}
            >
              <option value="">Todas las categorías</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={nombreFiltro}
              onChange={(e) => setNombreFiltro(e.target.value)}
              style={styles.input}
            />
          </div>

          {/* Lista de ejercicios con drag */}
          <div style={styles.ejerciciosList}>
            {ejerciciosFiltrados.length === 0 ? (
              <p style={styles.noData}>No hay ejercicios</p>
            ) : (
              ejerciciosFiltrados.map(ej => (
                <div
                  key={ej.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, ej)}
                  style={styles.ejercicioCard}
                >
                  <div style={styles.ejercicioInfo}>
                    <div style={styles.ejercicioNombre}>📌 {ej.nombre}</div>
                    <div style={styles.ejercicioCategoria}>{ej.categoria}</div>
                  </div>
                  <div style={styles.ejercicioActions}>
                    <button 
                      onClick={() => handleAgregarEjercicioClick(ej)}
                      style={styles.btnAdd}
                      title="Agregar a tabla"
                    >
                      ➕
                    </button>
                    <button 
                      onClick={() => handleEditarEjercicio(ej)}
                      style={styles.btnIcon}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => handleEliminarEjercicio(ej.id, ej.nombre)}
                      style={styles.btnIcon}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel derecho: Tabla de asignación */}
        <div style={styles.rightPanel}>
          <h3 style={styles.panelTitle}>📋 Tabla de Asignación</h3>
          <p style={styles.hint}>⬅️ Arrastra ejercicios aquí</p>

          {/* Zona de drop */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={styles.dropZone}
          >
            {tablaAsignacion.length === 0 ? (
              <div style={styles.emptyDropZone}>
                <p>🎯 Arrastra ejercicios aquí</p>
                <p style={{ fontSize: "12px", color: "#999" }}>
                  O haz clic en un ejercicio de la izquierda
                </p>
              </div>
            ) : (
              <div style={styles.tablaList}>
                {tablaAsignacion.map((item, index) => (
                  <div key={item.id} style={styles.tablaItem}>
                    <div style={styles.tablaOrden}>{index + 1}</div>
                    <div style={styles.tablaInfo}>
                      <div style={styles.tablaNombre}>{item.nombre}</div>
                      <div style={styles.tablaCategoria}>{item.categoria}</div>
                      <div style={styles.tablaParams}>
                        {item.series && <span>Series: {item.series}</span>}
                        {item.repeticiones && <span>Reps: {item.repeticiones}</span>}
                        {item.peso && <span>Peso: {item.peso}</span>}
                        {item.tiempo && <span>Tiempo: {item.tiempo}</span>}
                        {item.intervalo && <span>Intervalo: {item.intervalo}</span>}
                      </div>
                    </div>
                    <div style={styles.tablaActions}>
                      <button 
                        onClick={() => handleEditarParams(item, index)}
                        style={styles.btnEdit2}
                        title="Editar parámetros"
                      >
                        ⚙️
                      </button>
                      <button 
                        onClick={() => handleMoverArriba(index)}
                        disabled={index === 0}
                        style={styles.btnOrden}
                      >
                        ⬆️
                      </button>
                      <button 
                        onClick={() => handleMoverAbajo(index)}
                        disabled={index === tablaAsignacion.length - 1}
                        style={styles.btnOrden}
                      >
                        ⬇️
                      </button>
                      <button 
                        onClick={() => handleEliminarDeTabla(item.id)}
                        style={styles.btnDelete}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sección de asignación a usuario */}
      <div style={styles.assignSection}>
        <h3 style={styles.sectionTitle}>👤 Asignar a Usuario</h3>
        <div style={styles.assignGrid}>
          <select
            value={usuarioSeleccionado}
            onChange={(e) => setUsuarioSeleccionado(e.target.value)}
            style={styles.selectLarge}
          >
            <option value="">-- Selecciona un socio --</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>
                {u.apellidos} {u.nombre} ({u.email})
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (window.confirm("¿Vaciar la tabla actual y empezar desde cero?")) {
                setTablaAsignacion([]);
              }
            }}
            disabled={!usuarioSeleccionado || tablaAsignacion.length === 0}
            style={styles.btnLimpiar}
          >
            🗑️ Vaciar Tabla
          </button>
          <button
            onClick={handleAsignarTabla}
            disabled={!usuarioSeleccionado || tablaAsignacion.length === 0 || saving}
            style={styles.btnAsignar}
          >
            {saving ? "Guardando..." : "💾 Asignar Tabla"}
          </button>
        </div>
      </div>

      {/* Modal de Categoría */}
      {showCategoriaModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCategoriaModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>
              {modoCategoria === "crear" ? "Nueva Categoría" : "Editar Categoría"}
            </h3>
            <input
              type="text"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              placeholder="Nombre de la categoría"
              style={styles.input}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button onClick={() => setShowCategoriaModal(false)} style={styles.btnSecondary}>
                Cancelar
              </button>
              <button onClick={handleGuardarCategoria} style={styles.btnPrimary}>
                {modoCategoria === "crear" ? "Crear" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ejercicio */}
      {showEjercicioModal && (
        <div style={styles.modalOverlay} onClick={() => setShowEjercicioModal(false)}>
          <div style={styles.modalLarge} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>
              {editingEjercicio ? "Editar Ejercicio" : "Nuevo Ejercicio"}
            </h3>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Nombre *</label>
              <input
                type="text"
                value={formEjercicio.nombre}
                onChange={(e) => setFormEjercicio({ ...formEjercicio, nombre: e.target.value })}
                style={styles.input}
                placeholder="Ej: Plancha frontal"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Categoría *</label>
              <select
                value={formEjercicio.categoria}
                onChange={(e) => setFormEjercicio({ ...formEjercicio, categoria: e.target.value })}
                style={styles.select}
              >
                <option value="">Selecciona...</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Descripción</label>
              <textarea
                value={formEjercicio.descripcion}
                onChange={(e) => setFormEjercicio({ ...formEjercicio, descripcion: e.target.value })}
                style={styles.textarea}
                rows={3}
                placeholder="Descripción del ejercicio..."
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Video (opcional)</label>
              <label style={styles.labelFile}>
                📹 Subir video del PC
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files[0])}
                  style={styles.fileInput}
                />
              </label>
              {videoFile && (
                <div style={styles.filePreview}>
                  ✅ {videoFile.name}
                  <button 
                    onClick={() => setVideoFile(null)} 
                    style={styles.btnRemoveFile}
                  >
                    ✕
                  </button>
                </div>
              )}
              {editingEjercicio?.videoUrl && !videoFile && (
                <div style={{ ...styles.filePreview, backgroundColor: "#e3f2fd", color: "#1976d2" }}>
                  📹 Video guardado
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowEjercicioModal(false)} style={styles.btnSecondary} disabled={uploading}>
                Cancelar
              </button>
              <button onClick={handleGuardarEjercicio} style={styles.btnPrimary} disabled={uploading}>
                {uploading ? "Subiendo archivos..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Parámetros del Ejercicio */}
      {showParamsModal && (
        <div style={styles.modalOverlay} onClick={() => setShowParamsModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>
              {editingParams ? "Editar Parámetros" : `Agregar: ${ejercicioParaAgregar?.nombre}`}
            </h3>
            
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Series</label>
                <input
                  type="text"
                  value={paramsForm.series}
                  onChange={(e) => setParamsForm({ ...paramsForm, series: e.target.value })}
                  placeholder="Ej: 3"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Repeticiones</label>
                <input
                  type="text"
                  value={paramsForm.repeticiones}
                  onChange={(e) => setParamsForm({ ...paramsForm, repeticiones: e.target.value })}
                  placeholder="Ej: 12"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Peso</label>
                <input
                  type="text"
                  value={paramsForm.peso}
                  onChange={(e) => setParamsForm({ ...paramsForm, peso: e.target.value })}
                  placeholder="Ej: 20kg"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Tiempo</label>
                <input
                  type="text"
                  value={paramsForm.tiempo}
                  onChange={(e) => setParamsForm({ ...paramsForm, tiempo: e.target.value })}
                  placeholder="Ej: 30seg"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Intervalo</label>
                <input
                  type="text"
                  value={paramsForm.intervalo}
                  onChange={(e) => setParamsForm({ ...paramsForm, intervalo: e.target.value })}
                  placeholder="Ej: 1min"
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowParamsModal(false)} style={styles.btnSecondary}>
                Cancelar
              </button>
              <button onClick={handleGuardarParams} style={styles.btnPrimary}>
                {editingParams ? "Actualizar" : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: "20px",
    maxWidth: "1600px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "24px",
  },
  btnBack: {
    padding: "10px 20px",
    backgroundColor: "#f5f5f5",
    color: "#333",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  mainTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: "600",
    color: "#333",
  },
  section: {
    marginBottom: "32px",
    padding: "20px",
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "600",
    color: "#333",
  },
  categoriasList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  categoriaChip: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    backgroundColor: "#e3f2fd",
    color: "#1976d2",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: "500",
  },
  btnChipEdit: {
    background: "none",
    border: "none",
    color: "#1976d2",
    cursor: "pointer",
    fontSize: "14px",
    padding: "0 4px",
  },
  btnChipDelete: {
    background: "none",
    border: "none",
    color: "#1976d2",
    cursor: "pointer",
    fontSize: "16px",
    padding: "0 4px",
    fontWeight: "bold",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
    marginBottom: "24px",
  },
  leftPanel: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  rightPanel: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  panelTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
  },
  hint: {
    fontSize: "13px",
    color: "#666",
    margin: "0 0 12px 0",
  },
  filtros: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "16px",
  },
  ejerciciosList: {
    maxHeight: "500px",
    overflowY: "auto",
  },
  ejercicioCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    marginBottom: "8px",
    backgroundColor: "#f9f9f9",
    border: "2px dashed #ddd",
    borderRadius: "8px",
    cursor: "grab",
    transition: "all 0.2s",
  },
  ejercicioInfo: {
    flex: 1,
  },
  ejercicioNombre: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#333",
    marginBottom: "4px",
  },
  ejercicioCategoria: {
    fontSize: "12px",
    color: "#1976d2",
    backgroundColor: "#e3f2fd",
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "10px",
  },
  ejercicioActions: {
    display: "flex",
    gap: "4px",
  },
  btnIcon: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    padding: "4px 8px",
  },
  dropZone: {
    minHeight: "400px",
    border: "3px dashed #2196F3",
    borderRadius: "12px",
    padding: "16px",
    backgroundColor: "#f0f7ff",
  },
  emptyDropZone: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "350px",
    color: "#666",
  },
  tablaList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  tablaItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    backgroundColor: "white",
    border: "1px solid #bbdefb",
    borderRadius: "8px",
  },
  tablaOrden: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#1976d2",
    minWidth: "30px",
    textAlign: "center",
  },
  tablaInfo: {
    flex: 1,
  },
  tablaNombre: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#333",
  },
  tablaCategoria: {
    fontSize: "12px",
    color: "#1976d2",
  },
  tablaActions: {
    display: "flex",
    gap: "6px",
  },
  tablaParams: {
    fontSize: "11px",
    color: "#666",
    marginTop: "6px",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  btnAdd: {
    padding: "4px 8px",
    backgroundColor: "#4caf50",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
  },
  btnEdit2: {
    padding: "4px 8px",
    backgroundColor: "#ff9800",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
  },
  btnOrden: {
    padding: "4px 8px",
    backgroundColor: "white",
    border: "1px solid #ddd",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
  },
  btnDelete: {
    padding: "4px 10px",
    backgroundColor: "#ffebee",
    color: "#c62828",
    border: "1px solid #ef5350",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
  },
  assignSection: {
    padding: "20px",
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  assignGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "16px",
    marginTop: "16px",
  },
  selectLarge: {
    padding: "12px 16px",
    fontSize: "16px",
    border: "2px solid #1976d2",
    borderRadius: "8px",
    backgroundColor: "white",
  },
  btnLimpiar: {
    padding: "12px 24px",
    backgroundColor: "#ff9800",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
  },
  btnAsignar: {
    padding: "12px 24px",
    backgroundColor: "#4caf50",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
  },
  btnPrimary: {
    padding: "10px 20px",
    backgroundColor: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "10px 20px",
    backgroundColor: "#f5f5f5",
    color: "#333",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  btnSmall: {
    padding: "6px 12px",
    backgroundColor: "#4caf50",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    backgroundColor: "white",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontFamily: "inherit",
    resize: "vertical",
    boxSizing: "border-box",
  },
  label: {
    display: "block",
    marginBottom: "6px",
    fontSize: "14px",
    fontWeight: "500",
    color: "#555",
  },
  formGroup: {
    marginBottom: "16px",
  },
  noData: {
    textAlign: "center",
    color: "#999",
    padding: "20px",
    fontSize: "14px",
  },
  labelFile: {
    display: "inline-block",
    padding: "10px 16px",
    backgroundColor: "#f0f7ff",
    color: "#1976d2",
    border: "2px dashed #2196F3",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "background-color 0.2s",
  },
  fileInput: {
    display: "none",
  },
  filePreview: {
    marginTop: "8px",
    padding: "8px 12px",
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
    borderRadius: "6px",
    fontSize: "13px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  btnRemoveFile: {
    background: "none",
    border: "none",
    color: "#c62828",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
    padding: "0 4px",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    maxWidth: "400px",
    width: "90%",
  },
  modalLarge: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    maxWidth: "600px",
    width: "90%",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalTitle: {
    margin: "0 0 20px 0",
    fontSize: "20px",
    fontWeight: "600",
    color: "#333",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
  },
};
