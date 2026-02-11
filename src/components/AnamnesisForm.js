import React, { useState, useEffect, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../Firebase";
import { useNavigate } from "react-router-dom";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../Firebase";
import { useDevice } from "../hooks/useDevice";

export default function AnamnesisForm({ user, onUpdateUser, isAdmin }) {
  const navigate = useNavigate();
  const { isMobile } = useDevice();
  
  // Clave única para localStorage basada en el usuario
  const storageKey = `anamnesis_draft_${user.uid || user.id || user.email}`;
  
  // Cargar datos de localStorage si existen, sino usar datos del usuario
  const getInitialFormData = () => {
    try {
      const savedDraft = localStorage.getItem(storageKey);
      if (savedDraft) {
        return JSON.parse(savedDraft);
      }
    } catch (error) {
      console.error("Error al cargar borrador:", error);
    }
    
    // Datos iniciales del usuario
    return {
    // TIPO DE ATENCIÓN
    atencionOnline: user.anamnesis?.atencionOnline || false,
    notasEntrevista: user.anamnesis?.notasEntrevista || "",
    
    // DATOS LABORALES
    dedicacion: user.anamnesis?.dedicacion || "",
    tipoTrabajo: user.anamnesis?.tipoTrabajo || "",
    horarios: user.anamnesis?.horarios || "",
    turnoFijoVariable: user.anamnesis?.turnoFijoVariable || "",
    diasDescanso: user.anamnesis?.diasDescanso || "",
    desplazamientoTrabajo: user.anamnesis?.desplazamientoTrabajo || "",
    
    // MOTIVO DE LA VISITA
    objetivosCorto: user.anamnesis?.objetivosCorto || "",
    objetivosLargo: user.anamnesis?.objetivosLargo || "",
    gradoMotivacion: user.anamnesis?.gradoMotivacion || "",
    
    // HISTORIA PONDERAL
    estatura: user.anamnesis?.estatura || "",
    pesoActual: user.anamnesis?.pesoActual || "",
    pesoEstable: user.anamnesis?.pesoEstable || "",
    pesoMaximo: user.anamnesis?.pesoMaximo || "",
    pesoDeseado: user.anamnesis?.pesoDeseado || "",
    
    // DATOS CLÍNICOS
    patologias: user.anamnesis?.patologias || "",
    alergias: user.anamnesis?.alergias || "",
    intolerancias: user.anamnesis?.intolerancias || "",
    quienCocina: user.anamnesis?.quienCocina || "",
    dondeCompra: user.anamnesis?.dondeCompra || "",
    puntosDebiles: user.anamnesis?.puntosDebiles || "",
    
    // TEMAS DIGESTIVOS
    problemasDigestivos: user.anamnesis?.problemasDigestivos || "",
    cronicosAsociados: user.anamnesis?.cronicosAsociados || "",
    
    // PREFERENCIAS Y GUSTOS
    alimentosMasGustan: user.anamnesis?.alimentosMasGustan || "",
    alimentosMenosGustan: user.anamnesis?.alimentosMenosGustan || "",
    frecuenciaPasta: user.anamnesis?.frecuenciaPasta || "",
    frecuenciaLegumbres: user.anamnesis?.frecuenciaLegumbres || "",
    frecuenciaVerduras: user.anamnesis?.frecuenciaVerduras || "",
    frecuenciaPescado: user.anamnesis?.frecuenciaPescado || "",
    tipoCoccion: user.anamnesis?.tipoCoccion || "",
    numeroComidasDiarias: user.anamnesis?.numeroComidasDiarias || "",
    
    // ACTIVIDAD FÍSICA
    tiempoActividadFisica: user.anamnesis?.tiempoActividadFisica || "",
    tipoActividad: user.anamnesis?.tipoActividad || "",
    fatigaEntrenar: user.anamnesis?.fatigaEntrenar || "",
    horasSentada: user.anamnesis?.horasSentada || "",
    competirDeportivo: user.anamnesis?.competirDeportivo || "",
    
    // REVISIÓN Y SEGUIMIENTO
    frecuenciaRevision: user.anamnesis?.frecuenciaRevision || "",
    
    // PREFERENCIA DE PLAN NUTRICIONAL
    preferenciaPlan: user.anamnesis?.preferenciaPlan || "",
    
    // SUPLEMENTACIÓN
    malaExperienciaSuplementos: user.anamnesis?.malaExperienciaSuplementos || "",
    suplementosActuales: user.anamnesis?.suplementosActuales || "",
    suplementosBeneficios: user.anamnesis?.suplementosBeneficios || "",
    
    // FÁRMACOS
    farmacos: user.anamnesis?.farmacos || "",
    
    // SUEÑO
    calidadSueno: user.anamnesis?.calidadSueno || "",
    horasSueno: user.anamnesis?.horasSueno || "",
    calidadSuenoEscala: user.anamnesis?.calidadSuenoEscala || "",
    
    // LESIONES
    lesiones: user.anamnesis?.lesiones || "",
    lesionesGraves: user.anamnesis?.lesionesGraves || "",
    
    // MENSTRUACIÓN Y HÁBITO INTESTINAL
    menstruacion: user.anamnesis?.menstruacion || "",
    transitoIntestinal: user.anamnesis?.transitoIntestinal || "",
    
    // RUTINA ENTRE SEMANA
    diaAlimentacion: user.anamnesis?.diaAlimentacion || "",
    anadirComidas: user.anamnesis?.anadirComidas || "",
    
    // FIN DE SEMANA
    desvioFinSemana: user.anamnesis?.desvioFinSemana || "",
    viciosFinSemana: user.anamnesis?.viciosFinSemana || "",
    
    // ELIGE TU PLAN
    eligePlan: user.anamnesis?.eligePlan || "",
    eligePlanOtros: user.anamnesis?.eligePlanOtros || "",
    
    // TIPO DE DIETA
    tipoDieta: user.anamnesis?.tipoDieta || "",
    tipoDietaOtros: user.anamnesis?.tipoDietaOtros || "",
    
    // OTROS
    motivoConfianza: user.anamnesis?.motivoConfianza || "",
    otrasConsultas: user.anamnesis?.otrasConsultas || "",
    analitica: user.anamnesis?.analitica || "",
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [autoSaveStatus, setAutoSaveStatus] = useState("");
  
  // Referencias para los temporizadores de debounce
  const localStorageTimer = useRef(null);
  const firebaseTimer = useRef(null);
  const isInitialMount = useRef(true);

  // Estados para mostrar/ocultar secciones
  const [showTipoAtencion, setShowTipoAtencion] = useState(true);
  const [showNotasEntrevista, setShowNotasEntrevista] = useState(true);
  const [showDatosPersonales, setShowDatosPersonales] = useState(true);
  const [showObjetivos, setShowObjetivos] = useState(true);
  const [showHistoriaPonderal, setShowHistoriaPonderal] = useState(true);
  const [showDatosClinicos, setShowDatosClinicos] = useState(true);
  const [showTemasDigestivos, setShowTemasDigestivos] = useState(true);
  const [showPreferenciasGustos, setShowPreferenciasGustos] = useState(true);
  const [showActividadFisica, setShowActividadFisica] = useState(true);
  const [showRevisionSeguimiento, setShowRevisionSeguimiento] = useState(true);
  const [showPreferenciaPlan, setShowPreferenciaPlan] = useState(true);
  const [showSuplementacion, setShowSuplementacion] = useState(true);
  const [showFarmacos, setShowFarmacos] = useState(true);
  const [showSueno, setShowSueno] = useState(true);
  const [showEstiloVida, setShowEstiloVida] = useState(true);
  const [showIntolerancias, setShowIntolerancias] = useState(true);
  const [showPatologias, setShowPatologias] = useState(true);
  const [showMedicacion, setShowMedicacion] = useState(true);
  const [showDeporte, setShowDeporte] = useState(true);
  const [showLesiones, setShowLesiones] = useState(true);
  const [showMenstruacion, setShowMenstruacion] = useState(true);
  const [showRutinaSemana, setShowRutinaSemana] = useState(true);
  const [showFinSemana, setShowFinSemana] = useState(true);
  const [showEligePlan, setShowEligePlan] = useState(true);
  const [showPlanTooltip, setShowPlanTooltip] = useState(false);
  const [showTipoDieta, setShowTipoDieta] = useState(true);
  const [showOtros, setShowOtros] = useState(true);

  // Función para colapsar/expandir todas las secciones
  const toggleAllSections = (show) => {
    setShowTipoAtencion(show);
    setShowNotasEntrevista(show);
    setShowDatosPersonales(show);
    setShowObjetivos(show);
    setShowHistoriaPonderal(show);
    setShowDatosClinicos(show);
    setShowTemasDigestivos(show);
    setShowPreferenciasGustos(show);
    setShowActividadFisica(show);
    setShowRevisionSeguimiento(show);
    setShowPreferenciaPlan(show);
    setShowSuplementacion(show);
    setShowFarmacos(show);
    setShowSueno(show);
    setShowEstiloVida(show);
    setShowIntolerancias(show);
    setShowPatologias(show);
    setShowMedicacion(show);
    setShowDeporte(show);
    setShowLesiones(show);
    setShowMenstruacion(show);
    setShowRutinaSemana(show);
    setShowFinSemana(show);
    setShowEligePlan(show);
    setShowTipoDieta(show);
    setShowOtros(show);
  };

  // Verificar si todas las secciones están visibles
  const allSectionsVisible = showTipoAtencion && showNotasEntrevista && showDatosPersonales && showObjetivos && showHistoriaPonderal && 
    showDatosClinicos && showTemasDigestivos && showPreferenciasGustos && 
    showActividadFisica && showRevisionSeguimiento && showPreferenciaPlan && 
    showSuplementacion && showFarmacos && showSueno && showEstiloVida && 
    showIntolerancias && showPatologias && showMedicacion && showDeporte && 
    showLesiones && showMenstruacion && showRutinaSemana && showFinSemana && 
    showEligePlan && showTipoDieta && showOtros;

  // Estilos comunes
  const sectionStyle = { backgroundColor: "#f7fafc", padding: "24px", borderRadius: "8px" };
  const gridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", columnGap: "30px" };
  const labelStyle = { display: "block", marginBottom: "8px", fontWeight: "500", color: "#4a5568", fontSize: "14px" };
  const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "4px", border: "1px solid #cbd5e0", fontSize: "14px" };
  const titleStyle = { color: "#2d3748", fontSize: "18px", fontWeight: "600", marginBottom: "20px" };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Efecto para guardar en localStorage (autoguardado local inmediato)
  useEffect(() => {
    // No guardar en el montaje inicial
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Limpiar timer anterior
    if (localStorageTimer.current) {
      clearTimeout(localStorageTimer.current);
    }

    // Guardar en localStorage después de 2 segundos de inactividad
    localStorageTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(formData));
      } catch (error) {
        console.error("Error al guardar en localStorage:", error);
      }
    }, 2000);

    return () => {
      if (localStorageTimer.current) {
        clearTimeout(localStorageTimer.current);
      }
    };
  }, [formData, storageKey]);

  // Efecto para autoguardar en Firebase
  useEffect(() => {
    // No guardar en el montaje inicial
    if (isInitialMount.current) {
      return;
    }

    // Solo autoguardar si es admin
    if (!isAdmin) {
      return;
    }

    // Limpiar timer anterior
    if (firebaseTimer.current) {
      clearTimeout(firebaseTimer.current);
    }

    // Autoguardar en Firebase después de 10 segundos de inactividad
    firebaseTimer.current = setTimeout(async () => {
      try {
        const docId = user.uid || user.id || user.email;
        if (!docId) {
          throw new Error("No se pudo identificar al usuario");
        }
        
        const userRef = doc(db, "users", docId);
        await updateDoc(userRef, {
          anamnesis: formData,
        });
        
        // Limpiar localStorage después de guardar exitosamente
        localStorage.removeItem(storageKey);
        
        if (onUpdateUser) {
          onUpdateUser({ ...user, anamnesis: formData });
        }
      } catch (error) {
        console.error("Error en autoguardado:", error);
      }
    }, 10000);

    return () => {
      if (firebaseTimer.current) {
        clearTimeout(firebaseTimer.current);
      }
    };
  }, [formData, isAdmin, user, onUpdateUser, storageKey]);



  const handleSave = async () => {
    if (!isAdmin) {
      alert("Solo los administradores pueden editar la anamnesis");
      return;
    }

    setSaving(true);
    setSaveStatus("Guardando...");
    try {
      // Usar uid si está disponible, sino intentar con email
      const docId = user.uid || user.id || user.email;
      if (!docId) {
        throw new Error("No se pudo identificar al usuario");
      }
      
      const userRef = doc(db, "users", docId);
      await updateDoc(userRef, {
        anamnesis: formData,
      });
      
      // Limpiar localStorage después de guardar exitosamente
      localStorage.removeItem(storageKey);
      
      setSaveStatus("✅ Guardado correctamente");
      if (onUpdateUser) {
        onUpdateUser({ ...user, anamnesis: formData });
      }
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      console.error("Error al guardar anamnesis:", err);
      setSaveStatus("❌ Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="anamnesis-container" style={{ padding: "20px", textAlign: "center" }}>
        <p style={{ color: "#666", fontSize: "16px" }}>
          Esta sección solo está disponible para administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="anamnesis-container" style={{ padding: isMobile ? "12px 12px 80px 12px" : "20px 24px 80px 24px", width: "100%", boxSizing: "border-box", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isMobile ? "16px" : "24px" }}>
        <h2 style={{ color: "#4a5568", fontSize: isMobile ? "18px" : "24px", fontWeight: "600", margin: 0 }}>ANAMNESIS</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => {
              const userId = user.uid || user.id || user.email;
              const popup = window.open(
                `/anamnesis-popup/${userId}`,
                'AnamnesisPopup',
                'width=1200,height=800,scrollbars=yes,resizable=yes'
              );
              if (popup) {
                popup.focus();
              } else {
                alert('Por favor, permite las ventanas emergentes para esta función');
              }
            }}
            style={{
              padding: isMobile ? "8px 12px" : "10px 20px",
              borderRadius: "8px",
              border: "2px solid #48bb78",
              background: "white",
              color: "#48bb78",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: isMobile ? "13px" : "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#48bb78";
              e.target.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "white";
              e.target.style.color = "#48bb78";
            }}
          >
            {isMobile ? "🗗" : "🗗 Abrir en ventana nueva"}
          </button>
          <button
            type="button"
            onClick={() => toggleAllSections(!allSectionsVisible)}
            style={{
              padding: isMobile ? "8px 12px" : "10px 20px",
              borderRadius: "8px",
              border: "2px solid #4299e1",
              background: allSectionsVisible ? "#4299e1" : "white",
              color: allSectionsVisible ? "white" : "#4299e1",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: isMobile ? "13px" : "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s"
            }}
          >
            {allSectionsVisible ? (isMobile ? "➖" : "➖ Ocultar todo") : (isMobile ? "➕" : "➕ Mostrar todo")}
          </button>
        </div>
      </div>

      {/* Botón flotante de guardar */}
      <div style={{
        position: "fixed",
        bottom: "30px",
        right: "30px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "10px"
      }}>
        {saveStatus && (
          <div style={{
            backgroundColor: saveStatus.includes("✅") ? "#48bb78" : "#f56565",
            color: "white",
            padding: "8px 16px",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "500",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            animation: "fadeIn 0.3s ease-in"
          }}>
            {saveStatus}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            backgroundColor: "#4299e1",
            color: "white",
            padding: "14px 28px",
            borderRadius: "8px",
            border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
            fontWeight: "600",
            fontSize: "16px",
            boxShadow: "0 4px 12px rgba(66, 153, 225, 0.4)",
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) => {
            if (!saving) {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 6px 16px rgba(66, 153, 225, 0.5)";
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 4px 12px rgba(66, 153, 225, 0.4)";
          }}
        >
          {saving ? "💾 Guardando..." : "💾 Guardar cambios"}
        </button>
      </div>

      {/* TIPO DE ATENCIÓN */}
      <section style={{ backgroundColor: "#e6fffa", padding: isMobile ? "10px 12px" : "12px 16px", borderRadius: "6px", marginBottom: isMobile ? "12px" : "16px", border: "1px solid #38b2ac" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showTipoAtencion ? (isMobile ? "8px" : "10px") : "0" }}>
          <h3 style={{ margin: 0, fontSize: isMobile ? "14px" : "16px", fontWeight: "600", color: "#2c7a7b" }}>🌐 Tipo de Atención</h3>
          <button
            type="button"
            onClick={() => setShowTipoAtencion(!showTipoAtencion)}
            style={{
              padding: isMobile ? "4px 8px" : "6px 12px",
              borderRadius: "6px",
              border: "1px solid #38b2ac",
              background: "white",
              color: "#2c7a7b",
              cursor: "pointer",
              fontWeight: "500",
              fontSize: isMobile ? "16px" : "13px"
            }}
          >
            {showTipoAtencion ? "➖" : "➕"}
          </button>
        </div>
        {showTipoAtencion && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              cursor: "pointer",
              fontSize: isMobile ? "12px" : "13px",
              fontWeight: "500",
              color: "#2c7a7b"
            }}>
              <input
                type="checkbox"
                name="atencionOnline"
                checked={formData.atencionOnline}
                onChange={(e) => setFormData({...formData, atencionOnline: e.target.checked})}
                style={{ 
                  marginRight: "8px",
                  width: "16px",
                  height: "16px",
                  cursor: "pointer"
                }}
              />
              Cliente atendido online
            </label>
            {formData.atencionOnline && (
              <span style={{
                backgroundColor: "#38b2ac",
                color: "white",
                padding: "2px 8px",
                borderRadius: "10px",
                fontSize: "11px",
                fontWeight: "600"
              }}>
                ONLINE
              </span>
            )}
          </div>
        )}
      </section>

      {/* NOTAS DE ENTREVISTA */}
      <section style={{ backgroundColor: "#f7fafc", padding: isMobile ? "12px" : "20px", borderRadius: "8px", marginBottom: isMobile ? "12px" : "16px", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showNotasEntrevista ? (isMobile ? "8px" : "12px") : "0" }}>
          <label style={{ 
            display: "block",
            fontSize: isMobile ? "14px" : "16px",
            fontWeight: "600",
            color: "#2d3748",
            margin: 0
          }}>
            📝 Notas durante la entrevista
          </label>
          <button
            type="button"
            onClick={() => setShowNotasEntrevista(!showNotasEntrevista)}
            style={{
              padding: isMobile ? "4px 8px" : "6px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e0",
              background: "white",
              color: "#4a5568",
              cursor: "pointer",
              fontWeight: "500",
              fontSize: isMobile ? "16px" : "13px"
            }}
          >
            {showNotasEntrevista ? "➖" : "➕"}
          </button>
        </div>
        {showNotasEntrevista && (
          <textarea
            name="notasEntrevista"
            value={formData.notasEntrevista}
            onChange={(e) => setFormData({...formData, notasEntrevista: e.target.value})}
            placeholder="Escribe aquí las notas durante la entrevista con el cliente..."
            rows={isMobile ? 4 : 6}
            style={{
              width: "100%",
              padding: isMobile ? "10px" : "12px",
              border: "2px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: isMobile ? "13px" : "14px",
              fontFamily: "inherit",
              resize: "vertical",
              minHeight: isMobile ? "80px" : "120px",
              lineHeight: "1.5"
            }}
          />
        )}
      </section>
     
        {/* DATOS LABORALES */}
        <section style={{ backgroundColor: "#f7fafc", padding: "24px", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ color: "#2d3748", fontSize: "18px", fontWeight: "600", margin: 0 }}>
              DATOS LABORALES
            </h3>
            <button
              type="button"
              onClick={() => setShowDatosPersonales(!showDatosPersonales)}
              style={{
                backgroundColor: "#e2e8f0",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600",
                color: "#4a5568"
              }}
            >
              {showDatosPersonales ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showDatosPersonales && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", columnGap: "30px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4a5568", fontSize: "14px" }}>
                ¿A qué se dedica?:
              </label>
              <input
                type="text"
                name="dedicacion"
                value={formData.dedicacion}
                onChange={handleChange}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "4px", border: "1px solid #cbd5e0", fontSize: "14px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4a5568", fontSize: "14px" }}>
                ¿Cómo es su trabajo?:
              </label>
              <input
                type="text"
                name="tipoTrabajo"
                value={formData.tipoTrabajo}
                onChange={handleChange}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "4px", border: "1px solid #cbd5e0", fontSize: "14px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4a5568", fontSize: "14px" }}>
                Horarios:
              </label>
              <input
                type="text"
                name="horarios"
                value={formData.horarios}
                onChange={handleChange}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "4px", border: "1px solid #cbd5e0", fontSize: "14px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4a5568", fontSize: "14px" }}>
                ¿Turno fijo o variable?:
              </label>
              <input
                type="text"
                name="turnoFijoVariable"
                value={formData.turnoFijoVariable}
                onChange={handleChange}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "4px", border: "1px solid #cbd5e0", fontSize: "14px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4a5568", fontSize: "14px" }}>
                Días de descanso:
              </label>
              <input
                type="text"
                name="diasDescanso"
                value={formData.diasDescanso}
                onChange={handleChange}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "4px", border: "1px solid #cbd5e0", fontSize: "14px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4a5568", fontSize: "14px" }}>
                ¿Cómo se desplaza al trabajo?:
              </label>
              <input
                type="text"
                name="desplazamientoTrabajo"
                value={formData.desplazamientoTrabajo}
                onChange={handleChange}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "4px", border: "1px solid #cbd5e0", fontSize: "14px" }}
              />
            </div>
          </div>
          )}
        </section>

        {/* MOTIVO DE LA VISITA */}
        <section style={{ backgroundColor: "#f7fafc", padding: "24px", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ color: "#2d3748", fontSize: "18px", fontWeight: "600", margin: 0 }}>
              MOTIVO DE LA VISITA
            </h3>
            <button
              type="button"
              onClick={() => setShowObjetivos(!showObjetivos)}
              style={{
                backgroundColor: "#e2e8f0",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600",
                color: "#4a5568"
              }}
            >
              {showObjetivos ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showObjetivos && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", columnGap: "30px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4a5568", fontSize: "14px" }}>
                Objetivos a corto plazo:
              </label>
              <textarea
                name="objetivosCorto"
                value={formData.objetivosCorto}
                onChange={handleChange}
                rows="3"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "4px", border: "1px solid #cbd5e0", fontSize: "14px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4a5568", fontSize: "14px" }}>
                Objetivos a largo plazo:
              </label>
              <textarea
                name="objetivosLargo"
                value={formData.objetivosLargo}
                onChange={handleChange}
                rows="3"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "4px", border: "1px solid #cbd5e0", fontSize: "14px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4a5568", fontSize: "14px" }}>
                Grado de motivación (1-10):
              </label>
              <input
                type="number"
                min="1"
                max="10"
                name="gradoMotivacion"
                value={formData.gradoMotivacion}
                onChange={handleChange}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "4px", border: "1px solid #cbd5e0", fontSize: "14px" }}
              />
            </div>
          </div>
          )}
        </section>

        {/* HISTORIA PONDERAL */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              HISTORIA PONDERAL
            </h3>
            <button
              type="button"
              onClick={() => setShowHistoriaPonderal(!showHistoriaPonderal)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showHistoriaPonderal ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showHistoriaPonderal && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", columnGap: "30px" }}>
            <div>
              <label style={labelStyle}>
                Estatura (cm):
              </label>
              <input
                type="text"
                name="estatura"
                value={formData.estatura}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Peso actual (kg):
              </label>
              <input
                type="text"
                name="pesoActual"
                value={formData.pesoActual}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Peso estable (kg):
              </label>
              <input
                type="text"
                name="pesoEstable"
                value={formData.pesoEstable}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Peso máximo recordado (kg):
              </label>
              <input
                type="text"
                name="pesoMaximo"
                value={formData.pesoMaximo}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Peso deseado (kg):
              </label>
              <input
                type="text"
                name="pesoDeseado"
                value={formData.pesoDeseado}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
          </div>
          )}
        </section>

        {/* DATOS CLÍNICOS */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              DATOS CLÍNICOS
            </h3>
            <button
              type="button"
              onClick={() => setShowDatosClinicos(!showDatosClinicos)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showDatosClinicos ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showDatosClinicos && (
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>
                Patologías:
              </label>
              <textarea
                name="patologias"
                value={formData.patologias}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Alergias:
              </label>
              <textarea
                name="alergias"
                value={formData.alergias}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Intolerancias:
              </label>
              <textarea
                name="intolerancias"
                value={formData.intolerancias}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                ¿Quién cocina en casa?:
              </label>
              <input
                type="text"
                name="quienCocina"
                value={formData.quienCocina}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                ¿Dónde realiza la compra semanal?:
              </label>
              <input
                type="text"
                name="dondeCompra"
                value={formData.dondeCompra}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Puntos débiles en la alimentación:
              </label>
              <textarea
                name="puntosDebiles"
                value={formData.puntosDebiles}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
          </div>
          )}
        </section>

        {/* TEMAS DIGESTIVOS */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              TEMAS DIGESTIVOS
            </h3>
            <button
              type="button"
              onClick={() => setShowTemasDigestivos(!showTemasDigestivos)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showTemasDigestivos ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showTemasDigestivos && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "15px" }}>
            <div>
              <label style={labelStyle}>
                ¿Padece gases, pesadez, hinchazón u otros problemas digestivos?:
              </label>
              <textarea
                name="problemasDigestivos"
                value={formData.problemasDigestivos}
                onChange={handleChange}
                rows="3"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                ¿Son crónicos o se asocian a algún alimento?:
              </label>
              <textarea
                name="cronicosAsociados"
                value={formData.cronicosAsociados}
                onChange={handleChange}
                rows="3"
                style={inputStyle}
              />
            </div>
          </div>
          )}
        </section>

        {/* PREFERENCIAS Y GUSTOS */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              PREFERENCIAS Y GUSTOS
            </h3>
            <button
              type="button"
              onClick={() => setShowPreferenciasGustos(!showPreferenciasGustos)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showPreferenciasGustos ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showPreferenciasGustos && (
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>
                Alimentos que más le gustan:
              </label>
              <textarea
                name="alimentosMasGustan"
                value={formData.alimentosMasGustan}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Alimentos que menos le gustan:
              </label>
              <textarea
                name="alimentosMenosGustan"
                value={formData.alimentosMenosGustan}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Frecuencia de consumo - Pasta:
              </label>
              <input
                type="text"
                name="frecuenciaPasta"
                value={formData.frecuenciaPasta}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Frecuencia de consumo - Legumbres:
              </label>
              <input
                type="text"
                name="frecuenciaLegumbres"
                value={formData.frecuenciaLegumbres}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Frecuencia de consumo - Verduras:
              </label>
              <input
                type="text"
                name="frecuenciaVerduras"
                value={formData.frecuenciaVerduras}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Frecuencia de consumo - Pescado:
              </label>
              <input
                type="text"
                name="frecuenciaPescado"
                value={formData.frecuenciaPescado}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Tipo de cocción habitual:
              </label>
              <input
                type="text"
                name="tipoCoccion"
                value={formData.tipoCoccion}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Número de comidas diarias (especifique):
              </label>
              <input
                type="text"
                name="numeroComidasDiarias"
                value={formData.numeroComidasDiarias}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
          </div>
          )}
        </section>

        {/* ACTIVIDAD FÍSICA */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              ACTIVIDAD FÍSICA
            </h3>
            <button
              type="button"
              onClick={() => setShowActividadFisica(!showActividadFisica)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showActividadFisica ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showActividadFisica && (
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>
                Tiempo y días por semana de actividad:
              </label>
              <input
                type="text"
                name="tiempoActividadFisica"
                value={formData.tiempoActividadFisica}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Tipo de actividad:
              </label>
              <input
                type="text"
                name="tipoActividad"
                value={formData.tipoActividad}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                ¿Se siente fatigado al entrenar?:
              </label>
              <input
                type="text"
                name="fatigaEntrenar"
                value={formData.fatigaEntrenar}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Horas sentada al día:
              </label>
              <input
                type="text"
                name="horasSentada"
                value={formData.horasSentada}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>
                ¿Pretende competir en algún ámbito deportivo?:
              </label>
              <input
                type="text"
                name="competirDeportivo"
                value={formData.competirDeportivo}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
          </div>
          )}
        </section>

        {/* REVISIÓN Y SEGUIMIENTO */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              REVISIÓN Y SEGUIMIENTO
            </h3>
            <button
              type="button"
              onClick={() => setShowRevisionSeguimiento(!showRevisionSeguimiento)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showRevisionSeguimiento ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showRevisionSeguimiento && (
          <div>
            <label style={labelStyle}>
              ¿Cada cuánto desea volver a revisión?
            </label>
            <p style={{ fontSize: "12px", color: "#718096", marginBottom: "5px" }}>
              (En esta sesión se realizará pesaje, cambio de dieta, toma de medidas y valoración de evolución y bienestar general)
            </p>
            <input
              type="text"
              name="frecuenciaRevision"
              value={formData.frecuenciaRevision}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>
          )}
        </section>

        {/* PREFERENCIA DE PLAN NUTRICIONAL */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              PREFERENCIA DE PLAN NUTRICIONAL
            </h3>
            <button
              type="button"
              onClick={() => setShowPreferenciaPlan(!showPreferenciaPlan)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showPreferenciaPlan ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showPreferenciaPlan && (
          <div>
            <label style={labelStyle}>
              ¿Prefiere un menú sencillo y práctico o un plan más elaborado con mayor variedad de recetas?
            </label>
            <select
              name="preferenciaPlan"
              value={formData.preferenciaPlan}
              onChange={handleChange}
              style={inputStyle}
              required
            >
              <option value="">-- Seleccionar --</option>
              <option value="Menú sencillo (Sin recetas)">Menú sencillo (Sin recetas)</option>
              <option value="Menú completo (Con recetas)">Menú completo (Con recetas)</option>
            </select>
          </div>
          )}
        </section>

        {/* SUPLEMENTACIÓN */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              SUPLEMENTACIÓN
            </h3>
            <button
              type="button"
              onClick={() => setShowSuplementacion(!showSuplementacion)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showSuplementacion ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showSuplementacion && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "15px" }}>
            <div>
              <label style={labelStyle}>
                ¿Ha tenido alguna mala experiencia con suplementos?:
              </label>
              <textarea
                name="malaExperienciaSuplementos"
                value={formData.malaExperienciaSuplementos}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                ¿Qué suplementos toma actualmente?:
              </label>
              <textarea
                name="suplementosActuales"
                value={formData.suplementosActuales}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                ¿Algún suplemento que crea beneficioso?:
              </label>
              <textarea
                name="suplementosBeneficios"
                value={formData.suplementosBeneficios}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
          </div>
          )}
        </section>

        {/* FÁRMACOS */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              FÁRMACOS
            </h3>
            <button
              type="button"
              onClick={() => setShowFarmacos(!showFarmacos)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showFarmacos ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showFarmacos && (
          <div>
            <label style={labelStyle}>
              ¿Toma algún fármaco? (indique dosis y frecuencia):
            </label>
            <textarea
              name="farmacos"
              value={formData.farmacos}
              onChange={handleChange}
              rows="3"
              style={inputStyle}
            />
          </div>
          )}
        </section>

        {/* SUEÑO */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              SUEÑO
            </h3>
            <button
              type="button"
              onClick={() => setShowSueno(!showSueno)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showSueno ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showSueno && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px" }}>
            <div>
              <label style={labelStyle}>
                ¿Qué tal duerme?:
              </label>
              <input
                type="text"
                name="calidadSueno"
                value={formData.calidadSueno}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Horas de sueño:
              </label>
              <input
                type="text"
                name="horasSueno"
                value={formData.horasSueno}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Calidad del sueño (1-10):
              </label>
              <input
                type="number"
                min="1"
                max="10"
                name="calidadSuenoEscala"
                value={formData.calidadSuenoEscala}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
          </div>
          )}
        </section>

        {/* LESIONES */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              LESIONES
            </h3>
            <button
              type="button"
              onClick={() => setShowLesiones(!showLesiones)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showLesiones ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showLesiones && (
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>
                ¿Ha tenido lesiones?:
              </label>
              <textarea
                name="lesiones"
                value={formData.lesiones}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                ¿Alguna grave o con secuelas?:
              </label>
              <textarea
                name="lesionesGraves"
                value={formData.lesionesGraves}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
          </div>
          )}
        </section>

        {/* MENSTRUACIÓN Y HÁBITO INTESTINAL */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              MENSTRUACIÓN Y HÁBITO INTESTINAL
            </h3>
            <button
              type="button"
              onClick={() => setShowMenstruacion(!showMenstruacion)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showMenstruacion ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showMenstruacion && (
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>
                ¿Tiene menstruación? (si aplica):
              </label>
              <input
                type="text"
                name="menstruacion"
                value={formData.menstruacion}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                ¿Cómo es su tránsito intestinal?:
              </label>
              <input
                type="text"
                name="transitoIntestinal"
                value={formData.transitoIntestinal}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
          </div>
          )}
        </section>

        {/* RUTINA ENTRE SEMANA */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              RUTINA ENTRE SEMANA
            </h3>
            <button
              type="button"
              onClick={() => setShowRutinaSemana(!showRutinaSemana)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showRutinaSemana ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showRutinaSemana && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "15px" }}>
            <div>
              <label style={labelStyle}>
                Describa un día típico de alimentación:
              </label>
              <textarea
                name="diaAlimentacion"
                value={formData.diaAlimentacion}
                onChange={handleChange}
                rows="4"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                ¿Le gustaría añadir alguna comida más?:
              </label>
              <textarea
                name="anadirComidas"
                value={formData.anadirComidas}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
          </div>
          )}
        </section>

        {/* FIN DE SEMANA */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              FIN DE SEMANA
            </h3>
            <button
              type="button"
              onClick={() => setShowFinSemana(!showFinSemana)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showFinSemana ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showFinSemana && (
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>
                ¿Se desvía del plan los fines de semana?:
              </label>
              <textarea
                name="desvioFinSemana"
                value={formData.desvioFinSemana}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                ¿Tiene algún 'vicio' o costumbre de fin de semana?:
              </label>
              <textarea
                name="viciosFinSemana"
                value={formData.viciosFinSemana}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
          </div>
          )}
        </section>

        {/* ELIGE TU PLAN */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              ELIGE TU PLAN
            </h3>
            <button
              type="button"
              onClick={() => setShowEligePlan(!showEligePlan)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showEligePlan ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showEligePlan && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <label style={labelStyle}>
                Tipo de plan:
              </label>
              <button
                type="button"
                onClick={() => setShowPlanTooltip(!showPlanTooltip)}
                style={{
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: "20px",
                  height: "20px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  flexShrink: 0
                }}
              >
                ?
              </button>
            </div>
            
            {/* Tooltip de restricciones - solo visible al pulsar ? */}
            {showPlanTooltip && (
              <div style={{
                padding: "12px",
                backgroundColor: "#eff6ff",
                border: "1px solid #3b82f6",
                borderRadius: "6px",
                marginBottom: "12px",
                fontSize: "13px",
                lineHeight: "1.6",
                position: "relative"
              }}>
                <button
                  type="button"
                  onClick={() => setShowPlanTooltip(false)}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    background: "transparent",
                    border: "none",
                    fontSize: "18px",
                    cursor: "pointer",
                    color: "#1e40af",
                    padding: 0,
                    width: "20px",
                    height: "20px",
                    lineHeight: "1"
                  }}
                >
                  ×
                </button>
                <div style={{ fontWeight: "600", color: "#1e40af", marginBottom: "8px" }}>
                  ℹ️ Restricciones por plan:
                </div>
                <div style={{ color: "#1e3a8a" }}>
                  <div style={{ marginBottom: "4px" }}>
                    <strong>• Básico:</strong> SIN Ejercicios ni GYM (tiene Pesaje, Dieta, Lista Compra, Citas, Mensajes)
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    <strong>• Básico + Ejercicios:</strong> TODAS las pestañas
                  </div>
                  <div>
                    <strong>• Seguimiento:</strong> SOLO Pesaje y Citas
                  </div>
                </div>
              </div>
            )}
            
            <select
              name="eligePlan"
              value={formData.eligePlan}
              onChange={handleChange}
              style={inputStyle}
              required
            >
              <option value="">Seleccionar...</option>
              <option value="Basico">Básico</option>
              <option value="Basico + Ejercicios">Básico + Ejercicios</option>
              <option value="Seguimiento">Seguimiento</option>
              <option value="GYM">GYM</option>
            </select>
            
            {/* Eliminar campo de texto para "Otros" ya que se removió la opción */}
            {false && (
              <div style={{ marginTop: "15px" }}>
                <label style={labelStyle}>
                  Especificar plan:
                </label>
                <input
                  type="text"
                  name="eligePlanOtros"
                  value={formData.eligePlanOtros}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Escribe el tipo de plan..."
                />
              </div>
            )}
          </div>
          )}
        </section>

        {/* TIPO DE DIETA */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              TIPO DE DIETA
            </h3>
            <button
              type="button"
              onClick={() => setShowTipoDieta(!showTipoDieta)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showTipoDieta ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showTipoDieta && (
          <div>
            <label style={labelStyle}>
              Tipo de dieta:
            </label>
            <select
              name="tipoDieta"
              value={formData.tipoDieta}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value="">Seleccionar...</option>
              <option value="Bajada de PESO">Bajada de PESO</option>
              <option value="Ganancia Muscular">Ganancia Muscular</option>
              <option value="Subida de PESO">Subida de PESO</option>
              <option value="Bajada de Grasa">Bajada de Grasa</option>
              <option value="Subida de Musculo">Subida de Musculo</option>
              <option value="Otros">Otros</option>
            </select>
            
            {/* Campo de texto para "Otros" */}
            {formData.tipoDieta === "Otros" && (
              <div style={{ marginTop: "15px" }}>
                <label style={labelStyle}>
                  Especificar tipo de dieta:
                </label>
                <input
                  type="text"
                  name="tipoDietaOtros"
                  value={formData.tipoDietaOtros}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Escribe el tipo de dieta..."
                />
              </div>
            )}
          </div>
          )}
        </section>

        {/* OTROS */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>
              OTROS
            </h3>
            <button
              type="button"
              onClick={() => setShowOtros(!showOtros)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                color: "#2d3748",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              {showOtros ? "➖ Ocultar" : "➕ Mostrar"}
            </button>
          </div>
          {showOtros && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "15px" }}>
            <div>
              <label style={labelStyle}>
                ¿Qué le ha animado a confiar en mí? ¿Cómo conoció mis servicios?:
              </label>
              <textarea
                name="motivoConfianza"
                value={formData.motivoConfianza}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                ¿Desea comentar alguna otra duda o aspecto?:
              </label>
              <textarea
                name="otrasConsultas"
                value={formData.otrasConsultas}
                onChange={handleChange}
                rows="2"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Analítica reciente (adjuntar o comentar):
              </label>
              <textarea
                name="analitica"
                value={formData.analitica}
                onChange={handleChange}
                rows="2"
                placeholder="Si dispone de analítica reciente, por favor indíquela aquí..."
                style={inputStyle}
              />
            </div>
          </div>
          )}
        </section>
    </div>
  );
}
