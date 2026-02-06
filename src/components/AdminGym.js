import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, storage } from "../Firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

/**
 * AdminGym - Asignación de ejercicios a usuarios por días
 * Permite seleccionar un usuario y asignarle ejercicios organizados por días de la semana
 */
export default function AdminGym() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [ejercicios, setEjercicios] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [userEjerciciosPorDia, setUserEjerciciosPorDia] = useState({});
  const [diaActivo, setDiaActivo] = useState("Día 1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroNombre, setFiltroNombre] = useState("");
  const [showParamsModal, setShowParamsModal] = useState(false);
  const [ejercicioParaAgregar, setEjercicioParaAgregar] = useState(null);
  const [paramsForm, setParamsForm] = useState({
    series: "",
    repeticiones: "",
    peso: "",
    tiempo: "",
    intervalo: ""
  });
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Estados para gestión de categorías
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [editingCategoria, setEditingCategoria] = useState(null);
  const [modoCategoria, setModoCategoria] = useState("crear");

  // Estados para gestión de ejercicios
  const [showEjercicioModal, setShowEjercicioModal] = useState(false);
  const [formEjercicio, setFormEjercicio] = useState({
    nombre: "",
    categoria: "",
    descripcion: ""
  });
  const [editingEjercicio, setEditingEjercicio] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Vista activa: "asignacion" o "gestion"
  const [vistaActiva, setVistaActiva] = useState("asignacion");

  // Días de la semana
  const diasSemana = ["Día 1", "Día 2", "Día 3", "Día 4", "Día 5", "Día 6", "Día 7"];

  // Categorías por defecto (fallback si no hay en BD)
  const categoriasDefault = [
    "Jaula",
    "Peso Muerto",
    "Press Banca",
    "Cardio",
    "Piernas",
    "Brazos",
    "Espalda",
    "Abdomen",
    "Flexibilidad",
    "Funcional"
  ];

  // Cargar usuarios y ejercicios
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar categorías
      try {
        const catSnapshot = await getDocs(collection(db, "gym_categorias"));
        const catList = catSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).sort((a, b) => (a.orden || 0) - (b.orden || 0));
        
        if (catList.length > 0) {
          // Guardar objetos completos de categorías
          setCategorias(catList);
        } else {
          // Si no hay categorías en BD, usar las por defecto
          setCategorias(categoriasDefault);
        }
      } catch (err) {
        console.error("Error al cargar categorías:", err);
        setCategorias(categoriasDefault);
      }
      
      // Cargar usuarios (CAMBIO: 'usuarios' -> 'users' para contar bien los usuarios)
      // Si necesitas volver atrás, cambia 'users' por 'usuarios' en esta línea
      const usersSnapshot = await getDocs(collection(db, "users"));
      const usersList = usersSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((u) => {
          // Filtrar admins
          if (u.role === "admin" || u.rol === "admin") return false;
          // Filtrar usuarios sin nombre o email
          if (!u.nombre || !u.apellidos || !u.email) return false;
          // Filtrar usuarios con datos inválidos (solo "0" o vacíos)
          if (u.nombre === "0" || u.apellidos === "0") return false;
          // Filtrar solo usuarios activos (activo !== false permite que usuarios sin el campo se muestren)
          if (u.activo === false) return false;
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
      
      setUsuarios(usuariosUnicos);

      // Cargar ejercicios
      try {
        const q = query(collection(db, "gym_ejercicios"), orderBy("nombre", "asc"));
        const ejSnapshot = await getDocs(q);
        const ejList = ejSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEjercicios(ejList);
      } catch (err) {
        // Fallback sin orderBy
        const ejSnapshot = await getDocs(collection(db, "gym_ejercicios"));
        const ejList = ejSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEjercicios(ejList.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
    } catch (err) {
      console.error("Error al cargar datos:", err);
      alert("Error al cargar datos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

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
        videoUrl: videoUrl || editingEjercicio?.videoUrl || "",
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

  // Cuando se selecciona un usuario
  useEffect(() => {
    if (selectedUser) {
      const user = usuarios.find((u) => u.id === selectedUser);
      // Cargar ejercicios por día, si no existe inicializar vacío
      const ejerciciosPorDia = user?.ejerciciosPorDia || {};
      // Asegurar que todos los días existan (incluso vacíos)
      const ejerciciosCompletos = {};
      diasSemana.forEach(dia => {
        ejerciciosCompletos[dia] = ejerciciosPorDia[dia] || [];
      });
      setUserEjerciciosPorDia(ejerciciosCompletos);
    } else {
      // Resetear a estructura vacía
      const ejerciciosVacios = {};
      diasSemana.forEach(dia => {
        ejerciciosVacios[dia] = [];
      });
      setUserEjerciciosPorDia(ejerciciosVacios);
    }
  }, [selectedUser, usuarios]);

  // Filtrar ejercicios disponibles
  const ejerciciosFiltrados = ejercicios.filter((ej) => {
    const matchCategoria = !filtroCategoria || ej.categoria === filtroCategoria;
    const matchNombre = !filtroNombre || 
      ej.nombre.toLowerCase().includes(filtroNombre.toLowerCase());
    return matchCategoria && matchNombre;
  });

  // Añadir ejercicio a la lista del día actual
  const handleAgregarEjercicio = (ejercicio) => {
    if (!selectedUser) {
      alert("Selecciona un usuario primero");
      return;
    }

    // Verificar si ya está asignado en este día
    const ejerciciosDelDia = userEjerciciosPorDia[diaActivo] || [];
    const yaAsignado = ejerciciosDelDia.some((ej) => ej.id === ejercicio.id);
    if (yaAsignado) {
      alert(`Este ejercicio ya está asignado el ${diaActivo}`);
      return;
    }

    // Abrir modal para capturar parámetros
    setEjercicioParaAgregar(ejercicio);
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
    const ejerciciosDelDia = userEjerciciosPorDia[diaActivo] || [];
    
    const nuevoEjercicio = {
      id: ejercicioParaAgregar.id,
      nombre: ejercicioParaAgregar.nombre,
      categoria: ejercicioParaAgregar.categoria,
      videoUrl: ejercicioParaAgregar.videoUrl || null,
      orden: ejerciciosDelDia.length + 1,
      ...paramsForm
    };

    setUserEjerciciosPorDia({
      ...userEjerciciosPorDia,
      [diaActivo]: [...ejerciciosDelDia, nuevoEjercicio]
    });

    setShowParamsModal(false);
    setEjercicioParaAgregar(null);
  };

  // Eliminar ejercicio de la lista del día actual
  const handleEliminarDeLista = (ejercicioId) => {
    const ejerciciosDelDia = userEjerciciosPorDia[diaActivo] || [];
    const nuevaLista = ejerciciosDelDia
      .filter((ej) => ej.id !== ejercicioId)
      .map((ej, idx) => ({ ...ej, orden: idx + 1 })); // Re-ordenar
    
    setUserEjerciciosPorDia({
      ...userEjerciciosPorDia,
      [diaActivo]: nuevaLista
    });
  };

  // Subir ejercicio en el orden
  const handleSubir = (index) => {
    if (index === 0) return;
    const ejerciciosDelDia = [...(userEjerciciosPorDia[diaActivo] || [])];
    [ejerciciosDelDia[index - 1], ejerciciosDelDia[index]] = [ejerciciosDelDia[index], ejerciciosDelDia[index - 1]];
    // Actualizar orden
    setUserEjerciciosPorDia({
      ...userEjerciciosPorDia,
      [diaActivo]: ejerciciosDelDia.map((ej, idx) => ({ ...ej, orden: idx + 1 }))
    });
  };

  // Bajar ejercicio en el orden
  const handleBajar = (index) => {
    const ejerciciosDelDia = userEjerciciosPorDia[diaActivo] || [];
    if (index === ejerciciosDelDia.length - 1) return;
    const nuevaLista = [...ejerciciosDelDia];
    [nuevaLista[index], nuevaLista[index + 1]] = [nuevaLista[index + 1], nuevaLista[index]];
    // Actualizar orden
    setUserEjerciciosPorDia({
      ...userEjerciciosPorDia,
      [diaActivo]: nuevaLista.map((ej, idx) => ({ ...ej, orden: idx + 1 }))
    });
  };

  // Guardar ejercicios asignados
  const handleGuardar = async () => {
    if (!selectedUser) {
      alert("Selecciona un usuario");
      return;
    }

    try {
      setSaving(true);
      const userRef = doc(db, "users", selectedUser);
      await updateDoc(userRef, {
        ejerciciosPorDia: userEjerciciosPorDia,
        updatedAt: new Date().toISOString(),
      });
      alert("Ejercicios guardados correctamente");
      
      // Recargar usuarios para actualizar la lista
      await loadData();
    } catch (err) {
      console.error("Error al guardar ejercicios:", err);
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Contar total de ejercicios asignados
  const getTotalEjercicios = () => {
    return Object.values(userEjerciciosPorDia).reduce((total, ejercicios) => total + ejercicios.length, 0);
  };

  // Asignar tabla y enviar email
  const handleAsignarYEnviarEmail = async () => {
    if (!selectedUser) {
      alert("Selecciona un usuario primero");
      return;
    }

    const user = usuarios.find((u) => u.id === selectedUser);
    if (!user) return;

    const confirmar = window.confirm(
      `¿Desea asignar la tabla a ${user.nombre} ${user.apellidos} y enviar email de notificación?`
    );

    if (!confirmar) return;

    try {
      setSaving(true);
      
      // Guardar la tabla
      const userRef = doc(db, "users", selectedUser);
      await updateDoc(userRef, {
        ejerciciosPorDia: userEjerciciosPorDia,
        updatedAt: new Date().toISOString(),
      });

      // Enviar email
      await addDoc(collection(db, "mail"), {
        to: user.email,
        message: {
          subject: "Tu tabla de ejercicios ha sido actualizada 💪",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Tabla de Ejercicios Actualizada</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 40px 0;">
                    <table role="presentation" style="width: 600px; max-width: 90%; border-collapse: collapse; background-color: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                      <tr>
                        <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                          <h1 style="margin: 0; color: white; font-size: 28px; font-weight: bold;">💪 Tabla Actualizada</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 40px 30px;">
                          <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333;">Hola <strong>${user.nombre}</strong>,</p>
                          <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333;">
                            Tu tabla de ejercicios del GYM ha sido actualizada. Ya puedes acceder a la aplicación para ver tu nueva rutina.
                          </p>
                          <table role="presentation" style="width: 100%; margin: 30px 0;">
                            <tr>
                              <td align="center">
                                <a href="https://nutricionapp-b7b7d.web.app" 
                                   style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 8px rgba(249, 115, 22, 0.3);">
                                  Ver mi tabla 💪
                                </a>
                              </td>
                            </tr>
                          </table>
                          <p style="margin: 20px 0 0; font-size: 14px; line-height: 20px; color: #666;">
                            Si tienes alguna duda sobre los ejercicios, no dudes en consultarnos.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 12px 12px;">
                          <p style="margin: 0; font-size: 14px; color: #6b7280;">¡Mucho ánimo con tus entrenamientos! 🎯</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        },
      });

      alert("✅ Tabla asignada y email enviado correctamente");
      await loadData();
    } catch (err) {
      console.error("Error al asignar tabla:", err);
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Limpiar tabla del usuario
  const handleLimpiarTabla = async () => {
    if (!selectedUser) {
      alert("Selecciona un usuario primero");
      return;
    }

    const user = usuarios.find((u) => u.id === selectedUser);
    if (!user) return;

    const confirmar = window.confirm(
      `¿Estás seguro de que deseas limpiar toda la tabla de ejercicios de ${user.nombre} ${user.apellidos}?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmar) return;

    try {
      setSaving(true);
      
      // Limpiar todos los días
      const ejerciciosVacios = {};
      diasSemana.forEach(dia => {
        ejerciciosVacios[dia] = [];
      });

      const userRef = doc(db, "users", selectedUser);
      await updateDoc(userRef, {
        ejerciciosPorDia: ejerciciosVacios,
        updatedAt: new Date().toISOString(),
      });

      // Actualizar estado local
      setUserEjerciciosPorDia(ejerciciosVacios);

      alert("✅ Tabla limpiada correctamente");
      await loadData();
    } catch (err) {
      console.error("Error al limpiar tabla:", err);
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Funciones de drag and drop para reordenar ejercicios dentro del día
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const ejerciciosDelDia = [...(userEjerciciosPorDia[diaActivo] || [])];
    const draggedItem = ejerciciosDelDia[draggedIndex];
    
    // Eliminar el elemento de su posición original
    ejerciciosDelDia.splice(draggedIndex, 1);
    
    // Insertar en la nueva posición
    ejerciciosDelDia.splice(dropIndex, 0, draggedItem);
    
    // Actualizar orden
    const reordenados = ejerciciosDelDia.map((ej, idx) => ({ ...ej, orden: idx + 1 }));
    
    setUserEjerciciosPorDia({
      ...userEjerciciosPorDia,
      [diaActivo]: reordenados
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <p>Cargando...</p>
      </div>
    );
  }

  const ejerciciosDelDia = userEjerciciosPorDia[diaActivo] || [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          onClick={() => navigate("/admin")}
          style={styles.btnVolver}
        >
          ← Volver
        </button>
        <h2 style={styles.title}>🏋️ GYM</h2>
        <div style={styles.viewTabs}>
          <button
            onClick={() => setVistaActiva("asignacion")}
            style={{
              ...styles.tabButton,
              ...(vistaActiva === "asignacion" ? styles.tabButtonActive : {})
            }}
          >
            📋 Asignar Tablas
          </button>
          <button
            onClick={() => setVistaActiva("gestion")}
            style={{
              ...styles.tabButton,
              ...(vistaActiva === "gestion" ? styles.tabButtonActive : {})
            }}
          >
            ⚙️ Gestión
          </button>
        </div>
      </div>

      {/* VISTA ASIGNACIÓN */}
      {vistaActiva === "asignacion" && (
        <>
          {/* Selector de usuario */}
          <div style={styles.section}>
        <label style={styles.labelBig}>Asignar a:</label>
        <div style={styles.userSelectRow}>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            style={styles.selectUser}
          >
            <option value="">-- Seleccionar Usuario --</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.apellidos} {u.nombre} ({u.email})
              </option>
            ))}
          </select>
          
          {selectedUser && (
            <div style={styles.actionButtons}>
              <button
                onClick={handleAsignarYEnviarEmail}
                disabled={saving || getTotalEjercicios() === 0}
                style={{
                  ...styles.btnAsignar,
                  ...(saving || getTotalEjercicios() === 0 ? styles.btnDisabled : {})
                }}
              >
                {saving ? "Enviando..." : "📧 Asignar Tabla"}
              </button>
              <button
                onClick={handleLimpiarTabla}
                disabled={saving}
                style={{
                  ...styles.btnLimpiar,
                  ...(saving ? styles.btnDisabled : {})
                }}
              >
                🗑️ Limpiar Tabla
              </button>
            </div>
          )}
        </div>
        
        {selectedUser && getTotalEjercicios() > 0 && (
          <div style={styles.infoTotal}>
            Total de ejercicios asignados: <strong>{getTotalEjercicios()}</strong>
          </div>
        )}
      </div>

      {/* Pestañas de días */}
      {selectedUser && (
        <div style={styles.diasTabs}>
          {diasSemana.map((dia) => {
            const cantidadEjercicios = (userEjerciciosPorDia[dia] || []).length;
            return (
              <button
                key={dia}
                onClick={() => setDiaActivo(dia)}
                style={{
                  ...styles.diaTab,
                  ...(diaActivo === dia ? styles.diaTabActive : {})
                }}
              >
                <div style={styles.diaTabLabel}>{dia}</div>
                {cantidadEjercicios > 0 && (
                  <div style={styles.diaTabBadge}>{cantidadEjercicios}</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div style={styles.mainContent}>
        {/* Panel izquierdo: Lista de ejercicios disponibles */}
        <div style={styles.leftPanel}>
          <h3 style={styles.subtitle}>📋 Ejercicios Disponibles</h3>

          {/* Filtros */}
          <div style={styles.filtros}>
            <div style={styles.filtroGroup}>
              <label style={styles.label}>Filtro Categorías</label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                style={styles.select}
              >
                <option value="">Todas</option>
                {categorias.map((cat) => {
                  const catNombre = typeof cat === 'string' ? cat : cat.nombre;
                  return <option key={catNombre} value={catNombre}>{catNombre}</option>;
                })}
              </select>
            </div>

            <div style={styles.filtroGroup}>
              <label style={styles.label}>Filtro nombre</label>
              <input
                type="text"
                value={filtroNombre}
                onChange={(e) => setFiltroNombre(e.target.value)}
                placeholder="Buscar..."
                style={styles.input}
              />
            </div>
          </div>

          {/* Lista de ejercicios */}
          <div style={styles.ejerciciosList}>
            {ejerciciosFiltrados.length === 0 ? (
              <p style={styles.noData}>No hay ejercicios</p>
            ) : (
              ejerciciosFiltrados.map((ej) => (
                <div key={ej.id} style={styles.ejercicioItem}>
                  <div style={styles.ejercicioInfo}>
                    <div style={styles.ejercicioNombre}>{ej.nombre}</div>
                    <div style={styles.ejercicioCategoria}>{ej.categoria}</div>
                  </div>
                  <button
                    onClick={() => handleAgregarEjercicio(ej)}
                    style={styles.btnAdd}
                    disabled={!selectedUser}
                  >
                    ➕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel derecho: Ejercicios asignados al día seleccionado */}
        <div style={styles.rightPanel}>
          <div style={styles.rightHeader}>
            <h3 style={styles.subtitle}>
              {selectedUser 
                ? `✅ ${diaActivo} (${ejerciciosDelDia.length} ejercicios)` 
                : "⚠️ Selecciona un usuario"}
            </h3>
            {selectedUser && getTotalEjercicios() > 0 && (
              <button
                onClick={handleGuardar}
                style={styles.btnSave}
                disabled={saving}
              >
                {saving ? "Guardando..." : "💾 Guardar"}
              </button>
            )}
          </div>

          {!selectedUser ? (
            <p style={styles.noData}>Selecciona un usuario para asignar ejercicios</p>
          ) : ejerciciosDelDia.length === 0 ? (
            <p style={styles.noData}>No hay ejercicios asignados para {diaActivo}</p>
          ) : (
            <div style={styles.asignadosList}>
              {ejerciciosDelDia.map((ej, index) => (
                <div 
                  key={ej.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    ...styles.asignadoItem,
                    opacity: draggedIndex === index ? 0.5 : 1,
                    borderColor: dragOverIndex === index ? "#4caf50" : "#bbdefb",
                    borderWidth: dragOverIndex === index ? "3px" : "1px",
                    cursor: "grab",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={styles.dragHandle} title="Arrastrar para reordenar">
                    ⋮⋮
                  </div>
                  <div style={styles.ordenNum}>{index + 1}.</div>
                  <div style={styles.asignadoInfo}>
                    <div style={styles.asignadoNombre}>{ej.nombre}</div>
                    <div style={styles.asignadoCategoria}>{ej.categoria}</div>
                    {/* Mostrar parámetros */}
                    {(ej.series || ej.repeticiones || ej.peso || ej.tiempo || ej.intervalo) && (
                      <div style={styles.parametros}>
                        {ej.series && <span>📊 {ej.series}</span>}
                        {ej.repeticiones && <span>🔢 {ej.repeticiones}</span>}
                        {ej.peso && <span>⚖️ {ej.peso}</span>}
                        {ej.tiempo && <span>⏱️ {ej.tiempo}</span>}
                        {ej.intervalo && <span>⏸️ {ej.intervalo}</span>}
                      </div>
                    )}
                  </div>
                  <div style={styles.asignadoActions}>
                    <button
                      onClick={() => handleSubir(index)}
                      style={styles.btnOrden}
                      disabled={index === 0}
                      title="Subir"
                    >
                      ⬆️
                    </button>
                    <button
                      onClick={() => handleBajar(index)}
                      style={styles.btnOrden}
                      disabled={index === ejerciciosDelDia.length - 1}
                      title="Bajar"
                    >
                      ⬇️
                    </button>
                    <button
                      onClick={() => handleEliminarDeLista(ej.id)}
                      style={styles.btnRemove}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* VISTA GESTIÓN */}
      {vistaActiva === "gestion" && (
        <>
          {/* Sección de Categorías */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.subtitle}>📁 Categorías</h3>
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
                <p style={styles.noData}>No hay categorías. Crea una nueva o restaura las por defecto.</p>
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
                        ❌
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sección de Ejercicios */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.subtitle}>🏋️ Ejercicios</h3>
              <button onClick={handleNuevoEjercicio} style={styles.btnPrimary}>
                ➕ Nuevo Ejercicio
              </button>
            </div>
            <div style={styles.ejerciciosTable}>
              {ejercicios.length === 0 ? (
                <p style={styles.noData}>No hay ejercicios. Crea uno nuevo.</p>
              ) : (
                ejercicios.map(ej => (
                  <div key={ej.id} style={styles.ejercicioRow}>
                    <div style={styles.ejercicioRowInfo}>
                      <div style={styles.ejercicioRowNombre}>{ej.nombre}</div>
                      <div style={styles.ejercicioRowCategoria}>
                        📁 {ej.categoria}
                      </div>
                      {ej.videoUrl && (
                        <div style={styles.ejercicioRowVideo}>🎥 Video disponible</div>
                      )}
                    </div>
                    <div style={styles.ejercicioRowActions}>
                      <button 
                        onClick={() => handleEditarEjercicio(ej)}
                        style={styles.btnEdit}
                      >
                        ✏️ Editar
                      </button>
                      <button 
                        onClick={() => handleEliminarEjercicio(ej.id, ej.nombre)}
                        style={styles.btnDelete}
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* MODALES */}
      {/* Modal de parámetros del ejercicio (asignación) */}
      {showParamsModal && (
        <div style={styles.modalBackdrop} onClick={() => setShowParamsModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>
              ⚙️ Parámetros de {ejercicioParaAgregar?.nombre}
            </h3>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Series (ej: "3x10", "4 series")</label>
                <input
                  type="text"
                  value={paramsForm.series}
                  onChange={(e) => setParamsForm({ ...paramsForm, series: e.target.value })}
                  placeholder="3x10"
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Repeticiones (ej: "10-12", "15 reps")</label>
                <input
                  type="text"
                  value={paramsForm.repeticiones}
                  onChange={(e) => setParamsForm({ ...paramsForm, repeticiones: e.target.value })}
                  placeholder="10-12"
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Peso (ej: "20kg", "50% de 1RM")</label>
                <input
                  type="text"
                  value={paramsForm.peso}
                  onChange={(e) => setParamsForm({ ...paramsForm, peso: e.target.value })}
                  placeholder="20kg"
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Tiempo (ej: "30s", "2 minutos")</label>
                <input
                  type="text"
                  value={paramsForm.tiempo}
                  onChange={(e) => setParamsForm({ ...paramsForm, tiempo: e.target.value })}
                  placeholder="30s"
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Intervalo descanso (ej: "60s", "1-2 min")</label>
                <input
                  type="text"
                  value={paramsForm.intervalo}
                  onChange={(e) => setParamsForm({ ...paramsForm, intervalo: e.target.value })}
                  placeholder="60s"
                  style={styles.input}
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowParamsModal(false)} style={styles.btnCancel}>
                Cancelar
              </button>
              <button onClick={handleGuardarParams} style={styles.btnConfirm}>
                Agregar a {diaActivo}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Categoría */}
      {showCategoriaModal && (
        <div style={styles.modalBackdrop} onClick={() => setShowCategoriaModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>
              {modoCategoria === "crear" ? "📁 Nueva Categoría" : "✏️ Editar Categoría"}
            </h3>
            <div style={styles.formGroup}>
              <label style={styles.label}>Nombre</label>
              <input
                type="text"
                value={nuevaCategoria}
                onChange={(e) => setNuevaCategoria(e.target.value)}
                style={styles.input}
                placeholder="Ej: Cardio"
                autoFocus
              />
            </div>
            <div style={styles.modalActions}>
              <button onClick={() => setShowCategoriaModal(false)} style={styles.btnCancel}>
                Cancelar
              </button>
              <button onClick={handleGuardarCategoria} style={styles.btnConfirm}>
                {modoCategoria === "crear" ? "Crear" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ejercicio */}
      {showEjercicioModal && (
        <div style={styles.modalBackdrop} onClick={() => setShowEjercicioModal(false)}>
          <div style={{...styles.modal, maxWidth: "600px"}} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>
              {editingEjercicio ? "✏️ Editar Ejercicio" : "🏋️ Nuevo Ejercicio"}
            </h3>
            <div style={styles.formGroup}>
              <label style={styles.label}>Nombre *</label>
              <input
                type="text"
                value={formEjercicio.nombre}
                onChange={(e) => setFormEjercicio({...formEjercicio, nombre: e.target.value})}
                style={styles.input}
                placeholder="Ej: Press Banca"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Categoría *</label>
              <select
                value={formEjercicio.categoria}
                onChange={(e) => setFormEjercicio({...formEjercicio, categoria: e.target.value})}
                style={styles.select}
              >
                <option value="">Seleccionar...</option>
                {categorias.map(cat => (
                  <option key={typeof cat === 'string' ? cat : cat.nombre} value={typeof cat === 'string' ? cat : cat.nombre}>
                    {typeof cat === 'string' ? cat : cat.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Descripción</label>
              <textarea
                value={formEjercicio.descripcion}
                onChange={(e) => setFormEjercicio({...formEjercicio, descripcion: e.target.value})}
                style={{...styles.input, minHeight: "80px", resize: "vertical"}}
                placeholder="Descripción del ejercicio..."
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Video (opcional)</label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files[0])}
                style={styles.input}
              />
              {editingEjercicio?.videoUrl && !videoFile && (
                <p style={{fontSize: "14px", color: "#666", marginTop: "4px"}}>
                  🎥 Ya tiene video. Sube uno nuevo para reemplazarlo.
                </p>
              )}
            </div>
            <div style={styles.modalActions}>
              <button onClick={() => setShowEjercicioModal(false)} style={styles.btnCancel} disabled={uploading}>
                Cancelar
              </button>
              <button onClick={handleGuardarEjercicio} style={styles.btnConfirm} disabled={uploading}>
                {uploading ? "Guardando..." : editingEjercicio ? "Guardar" : "Crear"}
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
  btnVolver: {
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
  btnGestion: {
    marginLeft: "auto",
    padding: "10px 20px",
    backgroundColor: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 2px 4px rgba(25, 118, 210, 0.3)",
  },
  title: {
    margin: "0",
    fontSize: "28px",
    fontWeight: "600",
    color: "#333",
  },
  section: {
    marginBottom: "20px",
  },
  labelBig: {
    display: "block",
    marginBottom: "8px",
    fontSize: "16px",
    fontWeight: "600",
    color: "#333",
  },
  userSelectRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    flexWrap: "wrap",
  },
  selectUser: {
    flex: "1",
    minWidth: "300px",
    maxWidth: "500px",
    padding: "12px 16px",
    fontSize: "16px",
    border: "2px solid #1976d2",
    borderRadius: "8px",
    backgroundColor: "white",
    cursor: "pointer",
  },
  actionButtons: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginLeft: "auto",
  },
  btnAsignar: {
    padding: "12px 24px",
    backgroundColor: "#10b981",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)",
  },
  btnLimpiar: {
    padding: "12px 24px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 2px 4px rgba(239, 68, 68, 0.3)",
  },
  btnDisabled: {
    backgroundColor: "#9ca3af",
    cursor: "not-allowed",
    opacity: 0.6,
    boxShadow: "none",
  },
  infoTotal: {
    marginTop: "8px",
    padding: "10px 12px",
    backgroundColor: "#e3f2fd",
    borderRadius: "6px",
    fontSize: "14px",
    color: "#1976d2",
  },
  diasTabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  diaTab: {
    flex: "1",
    minWidth: "100px",
    padding: "12px 16px",
    backgroundColor: "white",
    border: "2px solid #e0e0e0",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s",
    position: "relative",
  },
  diaTabActive: {
    backgroundColor: "#1976d2",
    borderColor: "#1976d2",
    color: "white",
  },
  diaTabLabel: {
    fontSize: "14px",
    fontWeight: "600",
    textAlign: "center",
  },
  diaTabBadge: {
    position: "absolute",
    top: "-8px",
    right: "-8px",
    backgroundColor: "#4caf50",
    color: "white",
    borderRadius: "50%",
    width: "24px",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "700",
    border: "2px solid white",
  },
  mainContent: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
  },
  leftPanel: {
    backgroundColor: "white",
    border: "1px solid #e0e0e0",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  rightPanel: {
    backgroundColor: "white",
    border: "1px solid #e0e0e0",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  rightHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    gap: "12px",
  },
  subtitle: {
    margin: "0 0 16px 0",
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
  },
  filtros: {
    marginBottom: "16px",
  },
  filtroGroup: {
    marginBottom: "12px",
  },
  label: {
    display: "block",
    marginBottom: "6px",
    fontSize: "13px",
    fontWeight: "500",
    color: "#555",
  },
  select: {
    userSelect: "none",
  },
  dragHandle: {
    fontSize: "18px",
    color: "#999",
    cursor: "grab",
    padding: "0 4px",
    fontWeight: "700",
    letterSpacing: "-2px",
    width: "100%",
    padding: "8px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    backgroundColor: "white",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    boxSizing: "border-box",
  },
  ejerciciosList: {
    maxHeight: "500px",
    overflowY: "auto",
  },
  ejercicioItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    marginBottom: "8px",
    backgroundColor: "#f9f9f9",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    transition: "background-color 0.2s",
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
  btnAdd: {
    padding: "6px 12px",
    backgroundColor: "#4caf50",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "16px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  asignadosList: {
    maxHeight: "500px",
    overflowY: "auto",
  },
  asignadoItem: {
    display: "flex",
    alignItems: "center",
    padding: "12px",
    marginBottom: "8px",
    backgroundColor: "#f0f7ff",
    border: "1px solid #bbdefb",
    borderRadius: "8px",
    gap: "12px",
  },
  ordenNum: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#1976d2",
    minWidth: "30px",
  },
  asignadoInfo: {
    flex: 1,
  },
  asignadoNombre: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#333",
    marginBottom: "4px",
  },
  asignadoCategoria: {
    fontSize: "12px",
    color: "#1976d2",
    marginBottom: "6px",
  },
  parametros: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    fontSize: "11px",
    marginTop: "4px",
  },
  asignadoActions: {
    display: "flex",
    gap: "6px",
  },
  btnOrden: {
    padding: "6px 10px",
    backgroundColor: "white",
    color: "#333",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  btnRemove: {
    padding: "6px 10px",
    backgroundColor: "#ffebee",
    color: "#c62828",
    border: "1px solid #ef5350",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  btnSave: {
    padding: "10px 20px",
    backgroundColor: "#4caf50",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  noData: {
    textAlign: "center",
    color: "#999",
    padding: "40px 20px",
    fontSize: "14px",
  },
  modalBackdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    maxWidth: "500px",
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
  modalBody: {
    marginBottom: "24px",
  },
  formGroup: {
    marginBottom: "16px",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
  },
  btnCancel: {
    padding: "10px 20px",
    backgroundColor: "#e0e0e0",
    color: "#333",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  btnConfirm: {
    padding: "10px 20px",
    backgroundColor: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  // Estilos para tabs de vista
  viewTabs: {
    display: "flex",
    gap: "8px",
    marginLeft: "auto",
  },
  tabButton: {
    padding: "10px 20px",
    backgroundColor: "#f5f5f5",
    color: "#666",
    border: "2px solid #e0e0e0",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tabButtonActive: {
    backgroundColor: "#1976d2",
    color: "white",
    borderColor: "#1976d2",
  },
  // Estilos para gestión
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  btnPrimary: {
    padding: "10px 20px",
    backgroundColor: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 2px 4px rgba(25, 118, 210, 0.3)",
  },
  categoriasList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },
  categoriaChip: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    backgroundColor: "#e3f2fd",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: "500",
    color: "#1976d2",
  },
  btnChipEdit: {
    padding: "4px 8px",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
  },
  btnChipDelete: {
    padding: "4px 8px",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
  },
  ejerciciosTable: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  ejercicioRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
    border: "1px solid #e0e0e0",
  },
  ejercicioRowInfo: {
    flex: 1,
  },
  ejercicioRowNombre: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "4px",
  },
  ejercicioRowCategoria: {
    fontSize: "14px",
    color: "#666",
    marginBottom: "4px",
  },
  ejercicioRowVideo: {
    fontSize: "13px",
    color: "#1976d2",
  },
  ejercicioRowActions: {
    display: "flex",
    gap: "8px",
  },
  btnEdit: {
    padding: "8px 16px",
    backgroundColor: "#ff9800",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  btnDelete: {
    padding: "8px 16px",
    backgroundColor: "#f44336",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
};
