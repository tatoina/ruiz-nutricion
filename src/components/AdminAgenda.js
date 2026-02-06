import React, { useState, useEffect } from "react";
import { auth, db } from "../Firebase";
import { onAuthStateChanged, getIdTokenResult } from "firebase/auth";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useDevice } from "../hooks/useDevice";

/**
 * AdminAgenda — Vista de agenda completa para administradores
 * Muestra un calendario semanal con intervalos de 30 minutos
 * Permite navegar entre semanas y ver huecos libres/ocupados
 * RESPONSIVE: Adapta la vista para móvil
 */
export default function AdminAgenda() {
  const ADMIN_EMAILS = ["admin@admin.es"];
  const navigate = useNavigate();
  const { isMobile } = useDevice(); // Detectar móvil
  
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allAppointments, setAllAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [allUsers, setAllUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [viewMode, setViewMode] = useState(isMobile ? "dia" : "semana"); // "dia", "semana" o "mes"
  const [selectedDate, setSelectedDate] = useState(new Date()); // Fecha seleccionada para vista día
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Estados para tamaños redimensionables
  const [daySlotHeight, setDaySlotHeight] = useState(isMobile ? 80 : 100); // Altura de slots en vista día
  const [monthCellHeight, setMonthCellHeight] = useState(isMobile ? 80 : 120); // Altura de celdas en vista mes

  // Horario de trabajo: 10:00 - 21:00 en intervalos de 30 minutos
  const timeSlots = [];
  for (let hour = 10; hour <= 21; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 21) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const tokenResult = await getIdTokenResult(user);
        const hasClaimAdmin = !!tokenResult?.claims?.admin;
        const byEmail = ADMIN_EMAILS.includes(user.email.toLowerCase());
        
        // Verificar también el campo 'rol' en Firestore
        let hasRolAdmin = false;
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            hasRolAdmin = userDoc.data().rol === "admin";
          }
        } catch (err) {
          console.error("Error checking rol in Firestore:", err);
        }
        
        setIsAdmin(hasClaimAdmin || byEmail || hasRolAdmin);
        
        if (hasClaimAdmin || byEmail || hasRolAdmin) {
          loadAllAppointments();
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const loadAllAppointments = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const appointments = [];
      const users = [];
      
      usersSnap.docs.forEach(doc => {
        const data = doc.data();
        const userName = `${data.nombre || ""} ${data.apellidos || ""}`.trim() || "Sin nombre";
        const userCitas = data.citas || [];
        
        // Solo agregar usuarios que tengan al menos nombre o email válido
        const hasValidData = (data.nombre && data.nombre.trim()) || 
                            (data.apellidos && data.apellidos.trim()) || 
                            (data.email && data.email.trim() && data.email !== "0");
        
        if (hasValidData) {
          // Guardar info del usuario
          users.push({
            id: doc.id,
            nombre: data.nombre || "",
            apellidos: data.apellidos || "",
            email: data.email || "",
            fullName: userName
          });
        }
        
        userCitas.forEach(cita => {
          appointments.push({
            ...cita,
            userName,
            userId: doc.id,
            userEmail: data.email || ""
          });
        });
      });

      // Ordenar usuarios por apellidos
      users.sort((a, b) => {
        const aLast = a.apellidos.toLowerCase();
        const bLast = b.apellidos.toLowerCase();
        return aLast.localeCompare(bLast);
      });

      setAllUsers(users);
      setAllAppointments(appointments);
    } catch (err) {
      console.error("Error loading all appointments:", err);
    } finally {
      setLoading(false);
    }
  };

  const getWeekDays = () => {
    const start = new Date(currentWeek);
    start.setDate(start.getDate() - start.getDay() + 1); // Lunes
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getMonthDays = () => {
    const start = new Date(currentWeek.getFullYear(), currentWeek.getMonth(), 1);
    const end = new Date(currentWeek.getFullYear(), currentWeek.getMonth() + 1, 0);
    const days = [];
    
    // Empezar desde el lunes anterior al primer día del mes
    const firstDay = new Date(start);
    firstDay.setDate(firstDay.getDate() - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1));
    
    // Calcular cuántos días necesitamos (siempre 35 o 42 días para cuadrícula completa)
    const totalDays = 35; // 5 semanas
    
    for (let i = 0; i < totalDays; i++) {
      const day = new Date(firstDay);
      day.setDate(firstDay.getDate() + i);
      days.push(day);
    }
    
    return days;
  };

  const formatDate = (date) => {
    // Asegurarse de que la fecha se trate como local, no UTC
    let d;
    if (typeof date === 'string') {
      // Si ya es string, parsearlo como fecha local
      const [year, month, day] = date.split('-');
      d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      d = new Date(date);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTodayString = () => {
    const today = new Date();
    return formatDate(today);
  };

  const getAppointmentForSlot = (date, timeSlot) => {
    const dateStr = formatDate(date);
    return allAppointments.find(apt => apt.fecha === dateStr && apt.hora === timeSlot);
  };

  const goToPreviousWeek = () => {
    const prev = new Date(currentWeek);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeek(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(currentWeek);
    next.setDate(next.getDate() + 7);
    setCurrentWeek(next);
  };

  const goToPreviousMonth = () => {
    const prev = new Date(currentWeek);
    prev.setMonth(prev.getMonth() - 1);
    setCurrentWeek(prev);
  };

  const goToNextMonth = () => {
    const next = new Date(currentWeek);
    next.setMonth(next.getMonth() + 1);
    setCurrentWeek(next);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentWeek(today);
    setSelectedDate(today);
  };

  const goToPreviousDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
    setCurrentWeek(prev); // Mantener sincronizada la semana
  };

  const goToNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
    setCurrentWeek(next); // Mantener sincronizada la semana
  };

  const getDayName = (date) => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return days[date.getDay()];
  };

  const getMonthName = (date) => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return months[date.getMonth()];
  };

  const handleSlotClick = (date, timeSlot) => {
    const appointment = getAppointmentForSlot(date, timeSlot);
    if (appointment) {
      // Abrir modal de edición
      handleEditAppointment(appointment);
      return;
    }
    // Abrir modal para agendar
    setSelectedSlot({ date: formatDate(date), time: timeSlot });
    setSelectedTime(timeSlot);
    setSelectedUserId("");
    setAppointmentNotes("");
    setShowModal(true);
  };

  const handleEditAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setShowEditModal(true);
  };

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment || !window.confirm('¿Estás seguro de que quieres eliminar esta cita?')) {
      return;
    }

    try {
      const { doc, updateDoc, arrayRemove } = await import("firebase/firestore");
      const userRef = doc(db, "users", selectedAppointment.userId);
      
      // Crear objeto de cita sin userId y userName
      const { userId, userName, userEmail, ...citaToRemove } = selectedAppointment;
      
      await updateDoc(userRef, {
        citas: arrayRemove(citaToRemove)
      });

      await loadAllAppointments();
      setShowEditModal(false);
      setSelectedAppointment(null);
      
      alert("✅ Cita eliminada correctamente");
    } catch (err) {
      console.error("Error al eliminar cita:", err);
      alert("❌ Error al eliminar la cita: " + err.message);
    }
  };

  const handleRescheduleAppointment = async (newDate, newTime) => {
    if (!selectedAppointment) return;

    try {
      const { doc, updateDoc, arrayRemove, arrayUnion } = await import("firebase/firestore");
      const userRef = doc(db, "users", selectedAppointment.userId);
      
      // Crear objeto de cita sin userId y userName
      const { userId, userName, userEmail, ...oldCita } = selectedAppointment;
      
      // Nueva cita con la fecha/hora actualizada
      const newCita = {
        ...oldCita,
        fecha: newDate,
        hora: newTime
      };
      
      // Eliminar cita antigua y agregar nueva
      await updateDoc(userRef, {
        citas: arrayRemove(oldCita)
      });
      
      await updateDoc(userRef, {
        citas: arrayUnion(newCita)
      });

      await loadAllAppointments();
      setShowEditModal(false);
      setSelectedAppointment(null);
      
      alert("✅ Cita reprogramada correctamente");
    } catch (err) {
      console.error("Error al reprogramar cita:", err);
      alert("❌ Error al reprogramar la cita: " + err.message);
    }
  };

  const handleAddAppointment = async () => {
    if (!selectedUserId || !selectedSlot || !selectedTime) {
      alert("Por favor completa todos los campos requeridos");
      return;
    }

    try {
      const { doc, updateDoc, arrayUnion, getDoc, addDoc, collection: firestoreCollection } = await import("firebase/firestore");
      const userRef = doc(db, "users", selectedUserId);
      
      const newAppointment = {
        fecha: selectedSlot.date,
        hora: selectedTime,
        notas: appointmentNotes,
        creadoEn: new Date().toISOString()
      };
      
      await updateDoc(userRef, {
        citas: arrayUnion(newAppointment)
      });

      // Obtener datos del usuario para el email
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const userName = `${userData.nombre || ""} ${userData.apellidos || ""}`.trim();
      const userEmail = userData.email;

      // Si está conectado a Google Calendar, sincronizar
      if (googleCalendarConnected) {
        await syncAppointmentToGoogle(newAppointment, userName);
      }

      // Enviar email de confirmación al usuario
      if (userEmail) {
        try {
          const emailData = {
            to: userEmail,
            message: {
              subject: '✅ Cita confirmada - Nutrición Ruiz',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f0fdf4; border-radius: 12px;">
                  <h2 style="color: #15803d; text-align: center;">✅ Cita Confirmada</h2>
                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="font-size: 16px; color: #333;">Hola <strong>${userName}</strong>,</p>
                    <p style="font-size: 16px; color: #333;">Tu cita ha sido agendada exitosamente:</p>
                    <div style="background: #f0fdf4; padding: 15px; border-left: 4px solid #16a34a; margin: 15px 0;">
                      <p style="margin: 5px 0; font-size: 16px;"><strong>📅 Fecha:</strong> ${new Date(selectedSlot.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      <p style="margin: 5px 0; font-size: 16px;"><strong>🕐 Hora:</strong> ${selectedTime}</p>
                      ${appointmentNotes ? `<p style="margin: 5px 0; font-size: 14px;"><strong>📝 Notas:</strong> ${appointmentNotes}</p>` : ''}
                    </div>
                    <p style="font-size: 14px; color: #666;">Por favor, llega 5 minutos antes de tu cita.</p>
                    <p style="font-size: 14px; color: #666;">Si necesitas cancelar o modificar tu cita, ponte en contacto con nosotros.</p>
                  </div>
                  <p style="text-align: center; color: #666; font-size: 12px;">Nutrición Ruiz - Cuidando tu salud</p>
                </div>
              `
            }
          };
          await addDoc(firestoreCollection(db, "mail"), emailData);
          console.log("Email de confirmación enviado a", userEmail);
        } catch (emailErr) {
          console.error("Error enviando email:", emailErr);
          // No bloquear si falla el email
        }
      }

      // Recargar citas
      await loadAllAppointments();
      
      // Cerrar modal
      setShowModal(false);
      setSelectedSlot(null);
      setSelectedUserId("");
      setAppointmentNotes("");
      setSelectedTime("10:00");
      
      alert("✅ Cita agendada correctamente. Se ha enviado un email de confirmación al paciente.");
    } catch (err) {
      console.error("Error al agregar cita:", err);
      alert("❌ Error al agendar la cita: " + err.message);
    }
  };

  // Google Calendar Integration usando Google Identity Services (GIS)
  const connectGoogleCalendar = async () => {
    try {
      setSyncing(true);
      
      // CLIENT_ID configurado para Google Calendar API
      const CLIENT_ID = '23998467905-stm4uekacs9ff51dbgunuqql9k6ts96j.apps.googleusercontent.com';
      const SCOPES = 'https://www.googleapis.com/auth/calendar';
      
      // Verificar que se haya configurado el CLIENT_ID
      if (CLIENT_ID.includes('TU_CLIENT_ID')) {
        alert('❌ Error: Debes configurar tu CLIENT_ID de Google en AdminAgenda.js (línea ~247).\n\nSigue las instrucciones en GOOGLE_CALENDAR_SETUP.md');
        setSyncing(false);
        return;
      }

      const gapi = window.gapi;
      const google = window.google;
      
      if (!gapi || !google) {
        alert('❌ Error: Google API no está cargada. Recarga la página.');
        setSyncing(false);
        return;
      }

      // Cargar la API de Calendar
      await new Promise((resolve, reject) => {
        gapi.load('client', {callback: resolve, onerror: reject});
      });

      await gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
      });

      // Usar Google Identity Services (GIS) para autenticación
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            console.error('Error en tokenResponse:', tokenResponse);
            alert('❌ Error al obtener token de acceso');
            setSyncing(false);
            return;
          }
          
          // Token recibido correctamente
          setGoogleCalendarConnected(true);
          
          // Sincronizar citas existentes
          try {
            await syncAllAppointmentsToGoogle();
            alert("✅ Google Calendar conectado y citas sincronizadas");
          } catch (err) {
            console.error("Error sincronizando citas:", err);
            alert("✅ Google Calendar conectado (algunas citas no se sincronizaron)");
          }
          
          setSyncing(false);
        },
        error_callback: (error) => {
          console.error('Error en OAuth:', error);
          alert('❌ Error al conectar con Google Calendar');
          setSyncing(false);
        }
      });

      // Solicitar token (abrirá popup)
      tokenClient.requestAccessToken({prompt: 'consent'});
      
    } catch (err) {
      console.error("Error:", err);
      alert("❌ Error al conectar con Google Calendar: " + err.message);
      setSyncing(false);
    }
  };

  const syncAppointmentToGoogle = async (appointment, userName) => {
    try {
      const gapi = window.gapi;
      const dateTime = `${appointment.fecha}T${appointment.hora}:00`;
      const endDateTime = new Date(dateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + 60); // Duración de 1 hora

      const event = {
        summary: `Cita con ${userName}`,
        description: appointment.notas || 'Cita de nutrición',
        start: {
          dateTime: dateTime,
          timeZone: 'Europe/Madrid'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'Europe/Madrid'
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 }
          ]
        }
      };

      const request = gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event
      });

      await request.execute();
      console.log("Cita sincronizada con Google Calendar");
    } catch (err) {
      console.error("Error sincronizando con Google Calendar:", err);
    }
  };

  const syncAllAppointmentsToGoogle = async () => {
    try {
      for (const appointment of allAppointments) {
        await syncAppointmentToGoogle(appointment, appointment.userName);
      }
      console.log("Todas las citas sincronizadas");
    } catch (err) {
      console.error("Error sincronizando todas las citas:", err);
    }
  };

  const disconnectGoogleCalendar = () => {
    try {
      const gapi = window.gapi;
      const google = window.google;
      if (google && google.accounts && google.accounts.oauth2 && gapi && gapi.client) {
        // Con GIS, simplemente revocar el token
        const token = gapi.client.getToken();
        if (token) {
          google.accounts.oauth2.revoke(token.access_token, () => {
            console.log('Token revocado');
          });
        }
      }
      setGoogleCalendarConnected(false);
      alert("✅ Google Calendar desconectado");
    } catch (err) {
      console.error("Error desconectando:", err);
      setGoogleCalendarConnected(false);
    }
  };

  // Auth checks
  if (!currentUser) {
    return (
      <div className="layout" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <div className="card" style={{ maxWidth: 480, textAlign: "center", padding: "30px" }}>
          <h3>Cargando...</h3>
          <p style={{ color: "#666" }}>Verificando autenticación</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="layout" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <div className="card" style={{ maxWidth: 480, textAlign: "center", padding: "30px" }}>
          <h3>Acceso restringido</h3>
          <p style={{ color: "#666" }}>No tienes permisos para acceder a la agenda de administrador</p>
          <button className="btn primary" style={{ marginTop: "16px" }} onClick={() => navigate("/")}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const weekDays = getWeekDays();
  const monthDays = getMonthDays();
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  // Determinar el título según el modo de vista
  const getViewTitle = () => {
    if (viewMode === "dia") {
      const day = selectedDate;
      return `${getDayName(day)} ${day.getDate()} ${getMonthName(day)} ${day.getFullYear()}`;
    } else if (viewMode === "semana") {
      return `${getDayName(weekStart)} ${weekStart.getDate()} ${getMonthName(weekStart)} - ${getDayName(weekEnd)} ${weekEnd.getDate()} ${getMonthName(weekEnd)} ${weekEnd.getFullYear()}`;
    } else {
      return `${getMonthName(currentWeek)} ${currentWeek.getFullYear()}`;
    }
  };

  // Funciones de navegación según el modo
  const handlePrevious = () => {
    if (viewMode === "dia") goToPreviousDay();
    else if (viewMode === "semana") goToPreviousWeek();
    else goToPreviousMonth();
  };

  const handleNext = () => {
    if (viewMode === "dia") goToNextDay();
    else if (viewMode === "semana") goToNextWeek();
    else goToNextMonth();
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
      padding: isMobile ? "12px" : "20px"
    }}>
      <div style={{ 
        maxWidth: viewMode === "mes" ? "1800px" : "1600px", 
        margin: "0 auto",
        background: "white",
        borderRadius: isMobile ? "8px" : "12px",
        padding: isMobile ? "12px" : "24px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.07)"
      }}>
        {/* Header */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: isMobile ? "16px" : "24px",
          paddingBottom: isMobile ? "12px" : "16px",
          borderBottom: "2px solid #e5e7eb",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div style={{ width: isMobile ? "100%" : "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: isMobile ? "18px" : "24px", fontWeight: "700", color: "#15803d" }}>
                📅 Agenda de Citas
              </h2>
              <div style={{
                background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                color: "white",
                padding: isMobile ? "4px 10px" : "6px 14px",
                borderRadius: "20px",
                fontSize: isMobile ? "11px" : "13px",
                fontWeight: "700",
                boxShadow: "0 2px 4px rgba(22, 163, 74, 0.3)",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <span>📍</span>
                <span>HOY: {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
            <p style={{ 
              margin: "4px 0 0 0", 
              fontSize: viewMode === "mes" ? (isMobile ? "16px" : "20px") : (isMobile ? "12px" : "14px"), 
              color: viewMode === "mes" ? "#15803d" : "#64748b",
              fontWeight: viewMode === "mes" ? "700" : "400"
            }}>
              {getViewTitle()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
            {/* Selector de vista */}
            <div style={{ 
              display: "flex", 
              gap: "4px", 
              background: "#f1f5f9", 
              padding: "4px", 
              borderRadius: "8px",
              marginRight: isMobile ? "0" : "12px",
              width: isMobile ? "100%" : "auto"
            }}>
              <button
                onClick={() => setViewMode("dia")}
                style={{
                  padding: isMobile ? "8px 12px" : "6px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: viewMode === "dia" ? "#16a34a" : "transparent",
                  color: viewMode === "dia" ? "white" : "#64748b",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: isMobile ? "12px" : "13px",
                  transition: "all 0.2s",
                  flex: isMobile ? 1 : "initial"
                }}
              >
                📅 Día
              </button>
              <button
                onClick={() => setViewMode("semana")}
                style={{
                  padding: isMobile ? "8px 12px" : "6px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: viewMode === "semana" ? "#16a34a" : "transparent",
                  color: viewMode === "semana" ? "white" : "#64748b",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: isMobile ? "12px" : "13px",
                  transition: "all 0.2s",
                  flex: isMobile ? 1 : "initial"
                }}
              >
                📅 Semana
              </button>
              <button
                onClick={() => setViewMode("mes")}
                style={{
                  padding: isMobile ? "8px 12px" : "6px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: viewMode === "mes" ? "#16a34a" : "transparent",
                  color: viewMode === "mes" ? "white" : "#64748b",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: isMobile ? "12px" : "13px",
                  transition: "all 0.2s",
                  flex: isMobile ? 1 : "initial"
                }}
              >
                📆 Mes
              </button>
            </div>

            {/* Controles de zoom/redimensionamiento para vista día y mes */}
            {(viewMode === "dia" || viewMode === "mes") && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "#f1f5f9",
                padding: "4px 8px",
                borderRadius: "8px",
                marginRight: isMobile ? "0" : "8px"
              }}>
                <button
                  onClick={() => {
                    if (viewMode === "dia") {
                      setDaySlotHeight(Math.max(60, daySlotHeight - 20));
                    } else {
                      setMonthCellHeight(Math.max(60, monthCellHeight - 20));
                    }
                  }}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "none",
                    background: "white",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#64748b"
                  }}
                  title="Reducir tamaño"
                >
                  🔍−
                </button>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>
                  {viewMode === "dia" ? Math.round(daySlotHeight) : Math.round(monthCellHeight)}px
                </span>
                <button
                  onClick={() => {
                    if (viewMode === "dia") {
                      setDaySlotHeight(Math.min(200, daySlotHeight + 20));
                    } else {
                      setMonthCellHeight(Math.min(200, monthCellHeight + 20));
                    }
                  }}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "none",
                    background: "white",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#64748b"
                  }}
                  title="Aumentar tamaño"
                >
                  🔍+
                </button>
              </div>
            )}
            
            <button 
              onClick={handlePrevious}
              style={{
                padding: isMobile ? "8px 12px" : "8px 16px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                background: "white",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: isMobile ? "12px" : "14px",
                transition: "all 0.2s",
                flex: isMobile ? 1 : "initial"
              }}
            >
              ← {isMobile ? "" : "Anterior"}
            </button>
            <button 
              onClick={goToToday}
              style={{
                padding: isMobile ? "8px 12px" : "8px 16px",
                borderRadius: "8px",
                border: "2px solid #16a34a",
                background: "#f0fdf4",
                color: "#15803d",
                cursor: "pointer",
                fontWeight: "700",
                fontSize: isMobile ? "12px" : "14px",
                transition: "all 0.2s",
                flex: isMobile ? 1 : "initial"
              }}
            >
              Hoy
            </button>
            <button 
              onClick={handleNext}
              style={{
                padding: isMobile ? "8px 12px" : "8px 16px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                background: "white",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: isMobile ? "12px" : "14px",
                transition: "all 0.2s",
                flex: isMobile ? 1 : "initial"
              }}
            >
              {isMobile ? "" : "Siguiente"} →
            </button>
            {/* Botón de sincronización Google Calendar - Solo Desktop */}
            {!isMobile && (
              googleCalendarConnected ? (
                <button 
                  onClick={disconnectGoogleCalendar}
                  disabled={syncing}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "2px solid #16a34a",
                    background: "#f0fdf4",
                    color: "#15803d",
                    cursor: syncing ? "not-allowed" : "pointer",
                    fontWeight: "700",
                    fontSize: "14px",
                    marginLeft: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  ✅ Google Calendar
                </button>
              ) : (
                <button 
                  onClick={connectGoogleCalendar}
                  disabled={syncing}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "2px solid #3b82f6",
                    background: "white",
                    color: "#3b82f6",
                    cursor: syncing ? "not-allowed" : "pointer",
                    fontWeight: "700",
                    fontSize: "14px",
                    marginLeft: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    opacity: syncing ? 0.6 : 1
                  }}
                >
                  {syncing ? "⏳ Conectando..." : "🔗 Conectar Google Calendar"}
                </button>
              )
            )}
            
            {!isMobile && (
              <button 
                onClick={() => navigate("/admin")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #dc2626",
                  background: "white",
                  color: "#dc2626",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "14px",
                  marginLeft: "12px"
                }}
              >
                ← Volver
              </button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
            <div>Cargando agenda...</div>
          </div>
        )}

        {/* Calendar grid - Vista Día */}
        {!loading && viewMode === "dia" && (
          <div style={{ 
            overflowX: "hidden", 
            overflowY: "auto", 
            maxHeight: isMobile ? "calc(100vh - 220px)" : "calc(100vh - 250px)" 
          }}>
            <div style={{
              background: "white",
              borderRadius: "8px"
            }}>
              {/* Header del día */}
              <div style={{
                padding: isMobile ? "12px" : "16px",
                background: "#f0fdf4",
                borderRadius: "8px 8px 0 0",
                borderBottom: "2px solid #16a34a",
                textAlign: "center"
              }}>
                <div style={{ fontSize: isMobile ? "16px" : "18px", fontWeight: "700", color: "#15803d" }}>
                  {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>

              {/* Slots de tiempo */}
              <div style={{ padding: isMobile ? "8px" : "12px" }}>
                {timeSlots.map((timeSlot, idx) => {
                  const appointment = getAppointmentForSlot(selectedDate, timeSlot);
                  const now = new Date();
                  const slotTime = new Date(selectedDate);
                  const [hour, minute] = timeSlot.split(':');
                  slotTime.setHours(parseInt(hour), parseInt(minute), 0, 0);
                  const isPast = slotTime < now && formatDate(selectedDate) === getTodayString();
                  
                  return (
                    <div 
                      key={idx}
                      onClick={() => !isPast && handleSlotClick(selectedDate, timeSlot)}
                      style={{
                        display: "flex",
                        alignItems: "stretch",
                        marginBottom: "8px",
                        borderRadius: "8px",
                        border: `2px solid ${appointment ? '#ef4444' : isPast ? '#e5e7eb' : '#d1fae5'}`,
                        overflow: "hidden",
                        cursor: appointment || isPast ? (appointment ? "pointer" : "default") : "pointer",
                        transition: "all 0.2s",
                        opacity: isPast ? 0.5 : 1,
                        background: appointment ? "#fef2f2" : isPast ? "#f9fafb" : "white",
                        minHeight: `${daySlotHeight}px`
                      }}
                      onMouseEnter={(e) => {
                        if (!isPast) {
                          e.currentTarget.style.boxShadow = "0 2px 8px rgba(22, 163, 74, 0.2)";
                          e.currentTarget.style.transform = "translateX(2px)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isPast) {
                          e.currentTarget.style.boxShadow = "none";
                          e.currentTarget.style.transform = "translateX(0)";
                        }
                      }}
                    >
                      {/* Hora */}
                      <div style={{
                        minWidth: isMobile ? "65px" : "80px",
                        padding: isMobile ? "12px 8px" : "16px 12px",
                        background: appointment ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" : isPast ? "#f1f5f9" : "#f0fdf4",
                        color: appointment ? "white" : isPast ? "#94a3b8" : "#15803d",
                        fontWeight: "700",
                        fontSize: isMobile ? "14px" : "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRight: `2px solid ${appointment ? '#dc2626' : isPast ? '#e5e7eb' : '#d1fae5'}`
                      }}>
                        {timeSlot}
                      </div>

                      {/* Contenido */}
                      <div style={{
                        flex: 1,
                        padding: isMobile ? "12px" : "16px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center"
                      }}>
                        {appointment ? (
                          <>
                            <div style={{
                              fontSize: isMobile ? "14px" : "16px",
                              fontWeight: "700",
                              color: "#dc2626",
                              marginBottom: "4px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px"
                            }}>
                              <span>👤</span>
                              <span>{appointment.userName}</span>
                            </div>
                            {appointment.notas && (
                              <div style={{
                                fontSize: isMobile ? "12px" : "14px",
                                color: "#64748b",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                              }}>
                                <span>📝</span>
                                <span>{appointment.notas}</span>
                              </div>
                            )}
                            {appointment.userEmail && (
                              <div style={{
                                fontSize: "12px",
                                color: "#94a3b8",
                                marginTop: "4px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                              }}>
                                <span>✉️</span>
                                <span>{appointment.userEmail}</span>
                              </div>
                            )}
                          </>
                        ) : isPast ? (
                          <div style={{
                            fontSize: isMobile ? "13px" : "14px",
                            color: "#94a3b8",
                            fontStyle: "italic"
                          }}>
                            Horario pasado
                          </div>
                        ) : (
                          <div style={{
                            fontSize: isMobile ? "13px" : "14px",
                            color: "#16a34a",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                          }}>
                            <span style={{ fontSize: "20px" }}>+</span>
                            <span>Disponible - Toca para agendar</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Calendar grid - Vista Semana */}
        {!loading && viewMode === "semana" && (
          <div style={{ 
            overflowX: "auto", 
            overflowY: "auto", 
            maxHeight: isMobile ? "calc(100vh - 220px)" : "calc(100vh - 250px)" 
          }}>
            <table style={{ 
              width: "100%", 
              borderCollapse: "collapse",
              minWidth: isMobile ? "600px" : "900px"
            }}>
              <thead>
                <tr>
                  <th style={{ 
                    border: "1px solid #e5e7eb",
                    padding: isMobile ? "8px 4px" : "12px 8px",
                    background: "#f9fafb",
                    fontWeight: "600",
                    fontSize: isMobile ? "11px" : "13px",
                    color: "#374151",
                    textAlign: "center",
                    width: isMobile ? "50px" : "80px",
                    position: "sticky",
                    left: 0,
                    top: 0,
                    zIndex: 20
                  }}>
                    Hora
                  </th>
                  {weekDays.map((day, idx) => {
                    const isToday = formatDate(day) === getTodayString();
                    return (
                      <th key={idx} style={{ 
                        border: "1px solid #e5e7eb",
                        padding: isMobile ? "8px 4px" : "12px 8px",
                        background: isToday ? "#dcfce7" : "#f9fafb",
                        fontWeight: "600",
                        fontSize: isMobile ? "10px" : "13px",
                        color: isToday ? "#15803d" : "#374151",
                        textAlign: "center",
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                        minWidth: isMobile ? "70px" : "auto"
                      }}>
                        <div>{getDayName(day)}</div>
                        <div style={{ fontSize: isMobile ? "14px" : "16px", marginTop: "4px", fontWeight: "700" }}>
                          {day.getDate()}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((timeSlot, timeIdx) => (
                  <tr key={timeIdx}>
                    <td style={{ 
                      border: "1px solid #e5e7eb",
                      padding: isMobile ? "6px 2px" : "8px",
                      background: "#f9fafb",
                      fontWeight: "600",
                      fontSize: isMobile ? "10px" : "12px",
                      color: "#64748b",
                      textAlign: "center",
                      position: "sticky",
                      left: 0,
                      zIndex: 5
                    }}>
                      {timeSlot}
                    </td>
                    {weekDays.map((day, dayIdx) => {
                      const appointment = getAppointmentForSlot(day, timeSlot);
                      const isToday = formatDate(day) === getTodayString();
                      
                      return (
                        <td 
                          key={dayIdx} 
                          onClick={() => handleSlotClick(day, timeSlot)}
                          style={{ 
                            border: "1px solid #e5e7eb",
                            padding: isMobile ? "2px" : "4px",
                            background: appointment ? "#fee2e2" : (isToday ? "#f0fdf4" : "white"),
                            height: isMobile ? "40px" : "50px",
                            verticalAlign: "top",
                            cursor: "pointer",
                            transition: "background 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = isToday ? "#dcfce7" : "#f3f4f6";
                          }}
                          onMouseLeave={(e) => {
                            if (!appointment) {
                              e.currentTarget.style.background = isToday ? "#f0fdf4" : "white";
                            } else {
                              e.currentTarget.style.background = "#fee2e2";
                            }
                          }}
                        >
                          {appointment ? (
                            <div style={{
                              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                              color: "white",
                              padding: isMobile ? "2px 3px" : "4px 6px",
                              borderRadius: "4px",
                              fontSize: isMobile ? "9px" : "11px",
                              fontWeight: "600",
                              height: "100%",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center"
                            }}>
                              <div style={{ 
                                overflow: "hidden", 
                                textOverflow: "ellipsis", 
                                whiteSpace: "nowrap" 
                              }}>
                                {isMobile ? appointment.userName.split(' ')[0] : appointment.userName}
                              </div>
                              {!isMobile && appointment.notas && (
                                <div style={{ 
                                  fontSize: "10px", 
                                  opacity: 0.9,
                                  marginTop: "2px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap"
                                }}>
                                  {appointment.notas}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ 
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: isMobile ? "16px" : "20px",
                              color: "#16a34a",
                              opacity: 0.4
                            }}>
                              +
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Calendar grid - Vista Mes */}
        {!loading && viewMode === "mes" && (
          <div style={{ 
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: isMobile ? "calc(100vh - 220px)" : "calc(100vh - 250px)"
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: isMobile ? "2px" : "4px",
              minWidth: isMobile ? "100%" : "800px"
            }}>
              {/* Headers de días */}
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dayName, idx) => (
                <div key={idx} style={{
                  padding: isMobile ? "8px 4px" : "12px",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  textAlign: "center",
                  fontWeight: "700",
                  fontSize: isMobile ? "10px" : "13px",
                  color: "#374151"
                }}>
                  {isMobile ? dayName.substring(0, 1) : dayName}
                </div>
              ))}
              
              {/* Días del mes */}
              {monthDays.map((day, idx) => {
                const isToday = formatDate(day) === getTodayString();
                const isCurrentMonth = day.getMonth() === currentWeek.getMonth();
                const dayAppointments = allAppointments.filter(apt => apt.fecha === formatDate(day));
                
                return (
                  <div 
                    key={idx}
                    onClick={(e) => {
                      if (isCurrentMonth) {
                        // Si hace clic en el área vacía (no en una cita), abrir modal para agendar
                        if (e.target === e.currentTarget || e.target.textContent.includes('Agendar') || e.target.textContent === day.getDate().toString()) {
                          // Abrir modal para agendar cita en este día
                          setSelectedDate(day);
                          setSelectedSlot({ date: formatDate(day), time: '10:00' });
                          setSelectedTime('10:00');
                          setSelectedUserId("");
                          setAppointmentNotes("");
                          setShowModal(true);
                        }
                      }
                    }}
                    style={{
                      border: `2px solid ${isToday ? '#16a34a' : '#e5e7eb'}`,
                      background: isToday ? '#f0fdf4' : (isCurrentMonth ? 'white' : '#f9fafb'),
                      minHeight: `${monthCellHeight}px`,
                      padding: isMobile ? "4px" : "8px",
                      borderRadius: isMobile ? "4px" : "8px",
                      opacity: isCurrentMonth ? 1 : 0.5,
                      cursor: isCurrentMonth ? "pointer" : "default",
                      transition: "all 0.2s",
                      display: "flex",
                      flexDirection: "column"
                    }}
                    onMouseEnter={(e) => {
                      if (isCurrentMonth) {
                        e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div style={{
                      fontWeight: "700",
                      fontSize: isMobile ? "12px" : "16px",
                      color: isToday ? '#16a34a' : (isCurrentMonth ? '#0f172a' : '#94a3b8'),
                      marginBottom: isMobile ? "2px" : "6px",
                      textAlign: "center"
                    }}>
                      {day.getDate()}
                    </div>
                    
                    {/* Lista de citas del día */}
                    <div style={{ 
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: isMobile ? "2px" : "3px",
                      overflow: "hidden"
                    }}>
                      {dayAppointments.slice(0, isMobile ? 2 : 3).map((apt, aptIdx) => (
                        <div 
                          key={aptIdx}
                          data-appointment="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Abrir modal de edición de cita
                            handleEditAppointment(apt);
                          }}
                          style={{
                            cursor: "pointer",
                            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                            color: "white",
                            padding: isMobile ? "2px 4px" : "3px 6px",
                            borderRadius: "4px",
                            fontSize: isMobile ? "8px" : "10px",
                            fontWeight: "600",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {isMobile ? `${apt.hora.substring(0, 5)}` : `${apt.hora} - ${apt.userName}`}
                        </div>
                      ))}
                      {dayAppointments.length > (isMobile ? 2 : 3) && (
                        <div style={{
                          fontSize: isMobile ? "8px" : "10px",
                          color: "#64748b",
                          fontWeight: "600",
                          marginTop: "2px",
                          textAlign: "center"
                        }}>
                          +{dayAppointments.length - (isMobile ? 2 : 3)}
                        </div>
                      )}
                      {dayAppointments.length === 0 && isCurrentMonth && (
                        <div style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: isMobile ? "10px" : "12px",
                          color: "#16a34a",
                          opacity: 0.5,
                          fontWeight: "600",
                          transition: "opacity 0.2s"
                        }}>
                          + Agendar
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ 
          marginTop: isMobile ? "12px" : "20px", 
          padding: isMobile ? "8px" : "12px",
          background: "#f9fafb",
          borderRadius: "8px",
          display: "flex",
          gap: isMobile ? "12px" : "20px",
          flexWrap: "wrap",
          fontSize: isMobile ? "11px" : "13px",
          marginBottom: isMobile ? "80px" : "0",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", gap: isMobile ? "12px" : "20px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ 
                width: "20px", 
                height: "20px", 
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                borderRadius: "4px"
              }}></div>
              <span>Ocupado</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ 
                width: "20px", 
                height: "20px", 
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "4px"
              }}></div>
              <span>Libre</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ 
                width: "20px", 
                height: "20px", 
                background: "#f0fdf4",
                border: "1px solid #16a34a",
                borderRadius: "4px"
              }}></div>
              <span>Hoy</span>
            </div>
          </div>
          
          {/* Ayuda de redimensionamiento */}
          {(viewMode === "dia" || viewMode === "mes") && !isMobile && (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "6px",
              color: "#64748b",
              fontSize: "12px",
              fontStyle: "italic"
            }}>
              <span>💡</span>
              <span>Usa los botones 🔍+/− para ajustar el tamaño de las celdas</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal para agendar cita */}
      {showModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: isMobile ? "16px" : "0"
        }}
        onClick={() => setShowModal(false)}
        >
          <div 
            style={{
              background: "white",
              borderRadius: "12px",
              padding: isMobile ? "16px" : "24px",
              maxWidth: "500px",
              width: isMobile ? "100%" : "90%",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: isMobile ? "18px" : "20px", fontWeight: "700", color: "#15803d" }}>
              ➕ Agendar nueva cita
            </h3>

            {selectedSlot && (
              <div style={{
                background: "#f0fdf4",
                border: "2px solid #16a34a",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "20px"
              }}>
                <div style={{ fontSize: "14px", color: "#15803d", fontWeight: "600", marginBottom: "4px" }}>
                  📅 {new Date(selectedSlot.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", color: "#64748b", marginBottom: "6px", fontWeight: "600" }}>
                Hora de la cita *
              </label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "2px solid #e2e8f0",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                {timeSlots.map(slot => {
                  const dateKey = selectedSlot?.date || formatDate(selectedDate);
                  const existingAppointment = allAppointments.find(apt => apt.fecha === dateKey && apt.hora === slot);
                  return (
                    <option key={slot} value={slot} disabled={!!existingAppointment}>
                      {slot} {existingAppointment ? '(Ocupado)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", color: "#64748b", marginBottom: "6px", fontWeight: "600" }}>
                Seleccionar paciente *
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "2px solid #e2e8f0",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                <option value="">-- Selecciona un paciente --</option>
                {allUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.apellidos}, {user.nombre} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", color: "#64748b", marginBottom: "6px", fontWeight: "600" }}>
                Notas (opcional)
              </label>
              <textarea
                value={appointmentNotes}
                onChange={(e) => setAppointmentNotes(e.target.value)}
                placeholder="Ej: Primera consulta, revisión mensual..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "2px solid #e2e8f0",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "2px solid #e2e8f0",
                  background: "white",
                  color: "#64748b",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddAppointment}
                disabled={!selectedUserId}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: selectedUserId ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" : "#e2e8f0",
                  color: selectedUserId ? "white" : "#94a3b8",
                  fontWeight: "700",
                  cursor: selectedUserId ? "pointer" : "not-allowed",
                  fontSize: "14px"
                }}
              >
                ✅ Confirmar cita
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar/eliminar cita */}
      {showEditModal && selectedAppointment && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: isMobile ? "16px" : "0"
        }}
        onClick={() => setShowEditModal(false)}
        >
          <div 
            style={{
              background: "white",
              borderRadius: "12px",
              padding: isMobile ? "16px" : "24px",
              maxWidth: "500px",
              width: isMobile ? "100%" : "90%",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: isMobile ? "18px" : "20px", fontWeight: "700", color: "#dc2626" }}>
              📝 Editar cita
            </h3>

            {/* Información actual de la cita */}
            <div style={{
              background: "#fee2e2",
              border: "2px solid #dc2626",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "20px"
            }}>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#dc2626", marginBottom: "8px" }}>
                👤 {selectedAppointment.userName}
              </div>
              <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "4px" }}>
                📅 {new Date(selectedAppointment.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "4px" }}>
                🕐 {selectedAppointment.hora}
              </div>
              {selectedAppointment.notas && (
                <div style={{ fontSize: "14px", color: "#64748b", marginTop: "8px" }}>
                  📝 {selectedAppointment.notas}
                </div>
              )}
              {selectedAppointment.userEmail && (
                <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "8px" }}>
                  ✉️ {selectedAppointment.userEmail}
                </div>
              )}
            </div>

            {/* Opciones de reprogramación */}
            <div style={{ 
              background: "#f0fdf4", 
              borderRadius: "8px", 
              padding: "16px",
              marginBottom: "20px"
            }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "700", color: "#15803d" }}>
                🔄 Reprogramar cita
              </h4>
              
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#64748b", marginBottom: "6px", fontWeight: "600" }}>
                  Nueva fecha
                </label>
                <input
                  type="date"
                  defaultValue={selectedAppointment.fecha}
                  id="newDate"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "2px solid #d1fae5",
                    fontSize: "14px",
                    fontWeight: "500"
                  }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#64748b", marginBottom: "6px", fontWeight: "600" }}>
                  Nueva hora
                </label>
                <select
                  defaultValue={selectedAppointment.hora}
                  id="newTime"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "2px solid #d1fae5",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer"
                  }}
                >
                  {timeSlots.map(slot => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  const newDate = document.getElementById('newDate').value;
                  const newTime = document.getElementById('newTime').value;
                  handleRescheduleAppointment(newDate, newTime);
                }}
                style={{
                  width: "100%",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  color: "white",
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                🔄 Reprogramar
              </button>
            </div>

            {/* Botones de acción */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
              <button
                onClick={handleDeleteAppointment}
                style={{
                  flex: 1,
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  color: "white",
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                🗑️ Eliminar
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                style={{
                  flex: 1,
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "2px solid #e2e8f0",
                  background: "white",
                  color: "#64748b",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navegación inferior para móvil eliminada (ahora la gestiona el layout) */}
    </div>
  );
}
