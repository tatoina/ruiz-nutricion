import React, { useState, useEffect } from "react";
import { auth, db } from "../Firebase";
import { onAuthStateChanged, getIdTokenResult } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

/**
 * AdminAgenda — Vista de agenda completa para administradores
 * Muestra un calendario semanal con intervalos de 30 minutos
 * Permite navegar entre semanas y ver huecos libres/ocupados
 */
export default function AdminAgenda() {
  const ADMIN_EMAILS = ["admin@admin.es"];
  const navigate = useNavigate();
  
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
  const [viewMode, setViewMode] = useState("semana"); // "semana" o "mes"
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
        setIsAdmin(hasClaimAdmin || byEmail);
        
        if (hasClaimAdmin || byEmail) {
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
        
        // Guardar info del usuario
        users.push({
          id: doc.id,
          nombre: data.nombre || "",
          apellidos: data.apellidos || "",
          email: data.email || "",
          fullName: userName
        });
        
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
    return date.toISOString().split('T')[0];
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
    setCurrentWeek(new Date());
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
      // Ya hay una cita, no hacer nada
      return;
    }
    // Abrir modal para agendar
    setSelectedSlot({ date: formatDate(date), time: timeSlot });
    setSelectedUserId("");
    setAppointmentNotes("");
    setShowModal(true);
  };

  const handleAddAppointment = async () => {
    if (!selectedUserId || !selectedSlot) {
      alert("Por favor selecciona un usuario");
      return;
    }

    try {
      const { doc, updateDoc, arrayUnion, getDoc } = await import("firebase/firestore");
      const userRef = doc(db, "users", selectedUserId);
      
      const newAppointment = {
        fecha: selectedSlot.date,
        hora: selectedSlot.time,
        notas: appointmentNotes,
        creadoEn: new Date().toISOString()
      };
      
      await updateDoc(userRef, {
        citas: arrayUnion(newAppointment)
      });

      // Si está conectado a Google Calendar, sincronizar
      if (googleCalendarConnected) {
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        const userName = `${userData.nombre || ""} ${userData.apellidos || ""}`.trim();
        await syncAppointmentToGoogle(newAppointment, userName);
      }

      // Recargar citas
      await loadAllAppointments();
      
      // Cerrar modal
      setShowModal(false);
      setSelectedSlot(null);
      setSelectedUserId("");
      setAppointmentNotes("");
      
      alert("✅ Cita agendada correctamente");
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
  const displayDays = viewMode === "semana" ? weekDays : monthDays;
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
      padding: "20px"
    }}>
      <div style={{ 
        maxWidth: viewMode === "mes" ? "1800px" : "1600px", 
        margin: "0 auto",
        background: "white",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.07)"
      }}>
        {/* Header */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "24px",
          paddingBottom: "16px",
          borderBottom: "2px solid #e5e7eb",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#15803d" }}>
              📅 Agenda de Citas
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748b" }}>
              {viewMode === "semana" ? (
                `${getDayName(weekStart)} ${weekStart.getDate()} ${getMonthName(weekStart)} - ${getDayName(weekEnd)} ${weekEnd.getDate()} ${getMonthName(weekEnd)} ${weekEnd.getFullYear()}`
              ) : (
                `${getMonthName(currentWeek)} ${currentWeek.getFullYear()}`
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Selector de vista */}
            <div style={{ 
              display: "flex", 
              gap: "4px", 
              background: "#f1f5f9", 
              padding: "4px", 
              borderRadius: "8px",
              marginRight: "12px"
            }}>
              <button
                onClick={() => setViewMode("semana")}
                style={{
                  padding: "6px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: viewMode === "semana" ? "#16a34a" : "transparent",
                  color: viewMode === "semana" ? "white" : "#64748b",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                  transition: "all 0.2s"
                }}
              >
                📅 Semana
              </button>
              <button
                onClick={() => setViewMode("mes")}
                style={{
                  padding: "6px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: viewMode === "mes" ? "#16a34a" : "transparent",
                  color: viewMode === "mes" ? "white" : "#64748b",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                  transition: "all 0.2s"
                }}
              >
                📆 Mes
              </button>
            </div>
            <button 
              onClick={viewMode === "semana" ? goToPreviousWeek : goToPreviousMonth}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                background: "white",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "all 0.2s"
              }}
            >
              ← Anterior
            </button>
            <button 
              onClick={goToToday}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "2px solid #16a34a",
                background: "#f0fdf4",
                color: "#15803d",
                cursor: "pointer",
                fontWeight: "700",
                fontSize: "14px",
                transition: "all 0.2s"
              }}
            >
              Hoy
            </button>
            <button 
              onClick={viewMode === "semana" ? goToNextWeek : goToNextMonth}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                background: "white",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "all 0.2s"
              }}
            >
              Siguiente →
            </button>
            {/* Botón de sincronización Google Calendar */}
            {googleCalendarConnected ? (
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
            )}
            
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
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
            <div>Cargando agenda...</div>
          </div>
        )}

        {/* Calendar grid - Vista Semana */}
        {!loading && viewMode === "semana" && (
          <div style={{ 
            overflowX: "auto", 
            overflowY: "auto", 
            maxHeight: "calc(100vh - 250px)" 
          }}>
            <table style={{ 
              width: "100%", 
              borderCollapse: "collapse",
              minWidth: "900px"
            }}>
              <thead>
                <tr>
                  <th style={{ 
                    border: "1px solid #e5e7eb",
                    padding: "12px 8px",
                    background: "#f9fafb",
                    fontWeight: "600",
                    fontSize: "13px",
                    color: "#374151",
                    textAlign: "center",
                    width: "80px",
                    position: "sticky",
                    left: 0,
                    top: 0,
                    zIndex: 20
                  }}>
                    Hora
                  </th>
                  {weekDays.map((day, idx) => {
                    const isToday = formatDate(day) === formatDate(new Date());
                    return (
                      <th key={idx} style={{ 
                        border: "1px solid #e5e7eb",
                        padding: "12px 8px",
                        background: isToday ? "#dcfce7" : "#f9fafb",
                        fontWeight: "600",
                        fontSize: "13px",
                        color: isToday ? "#15803d" : "#374151",
                        textAlign: "center",
                        position: "sticky",
                        top: 0,
                        zIndex: 10
                      }}>
                        <div>{getDayName(day)}</div>
                        <div style={{ fontSize: "16px", marginTop: "4px" }}>
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
                      padding: "8px",
                      background: "#f9fafb",
                      fontWeight: "600",
                      fontSize: "12px",
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
                      const isToday = formatDate(day) === formatDate(new Date());
                      
                      return (
                        <td 
                          key={dayIdx} 
                          onClick={() => !appointment && handleSlotClick(day, timeSlot)}
                          style={{ 
                            border: "1px solid #e5e7eb",
                            padding: "4px",
                            background: appointment ? "#fee2e2" : (isToday ? "#f0fdf4" : "white"),
                            height: "50px",
                            verticalAlign: "top",
                            cursor: appointment ? "default" : "pointer",
                            transition: "background 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            if (!appointment) {
                              e.currentTarget.style.background = isToday ? "#dcfce7" : "#f3f4f6";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!appointment) {
                              e.currentTarget.style.background = isToday ? "#f0fdf4" : "white";
                            }
                          }}
                        >
                          {appointment ? (
                            <div style={{
                              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                              color: "white",
                              padding: "4px 6px",
                              borderRadius: "4px",
                              fontSize: "11px",
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
                                {appointment.userName}
                              </div>
                              {appointment.notas && (
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
                              fontSize: "20px",
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
            maxHeight: "calc(100vh - 250px)"
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "4px",
              minWidth: "800px"
            }}>
              {/* Headers de días */}
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dayName, idx) => (
                <div key={idx} style={{
                  padding: "12px",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  textAlign: "center",
                  fontWeight: "700",
                  fontSize: "13px",
                  color: "#374151"
                }}>
                  {dayName}
                </div>
              ))}
              
              {/* Días del mes */}
              {monthDays.map((day, idx) => {
                const isToday = formatDate(day) === formatDate(new Date());
                const isCurrentMonth = day.getMonth() === currentWeek.getMonth();
                const dayAppointments = allAppointments.filter(apt => apt.fecha === formatDate(day));
                
                return (
                  <div 
                    key={idx}
                    style={{
                      border: `2px solid ${isToday ? '#16a34a' : '#e5e7eb'}`,
                      background: isToday ? '#f0fdf4' : (isCurrentMonth ? 'white' : '#f9fafb'),
                      minHeight: "100px",
                      padding: "8px",
                      borderRadius: "8px",
                      opacity: isCurrentMonth ? 1 : 0.5,
                      cursor: "pointer",
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
                      fontSize: "16px",
                      color: isToday ? '#16a34a' : (isCurrentMonth ? '#0f172a' : '#94a3b8'),
                      marginBottom: "6px"
                    }}>
                      {day.getDate()}
                    </div>
                    
                    {/* Lista de citas del día */}
                    <div style={{ 
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px",
                      overflow: "hidden"
                    }}>
                      {dayAppointments.slice(0, 3).map((apt, aptIdx) => (
                        <div 
                          key={aptIdx}
                          style={{
                            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                            color: "white",
                            padding: "3px 6px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "600",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {apt.hora} - {apt.userName}
                        </div>
                      ))}
                      {dayAppointments.length > 3 && (
                        <div style={{
                          fontSize: "10px",
                          color: "#64748b",
                          fontWeight: "600",
                          marginTop: "2px"
                        }}>
                          +{dayAppointments.length - 3} más
                        </div>
                      )}
                      {dayAppointments.length === 0 && isCurrentMonth && (
                        <div style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "20px",
                          color: "#16a34a",
                          opacity: 0.3
                        }}>
                          +
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
          marginTop: "20px", 
          padding: "12px",
          background: "#f9fafb",
          borderRadius: "8px",
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
          fontSize: "13px"
        }}>
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
          zIndex: 1000
        }}
        onClick={() => setShowModal(false)}
        >
          <div 
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: "700", color: "#15803d" }}>
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
                <div style={{ fontSize: "18px", color: "#16a34a", fontWeight: "700" }}>
                  🕐 {selectedSlot.time}
                </div>
              </div>
            )}

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
    </div>
  );
}
