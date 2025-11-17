import React, { useState, useEffect } from "react";
import { db } from "../Firebase";
import { collection, getDocs } from "firebase/firestore";

export default function AdminCalendar({ onSelectDateTime, selectedDate, selectedTime }) {
  const [allAppointments, setAllAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState("week"); // "week" o "day"

  // Horario de trabajo: 9:00 - 20:00
  const workHours = Array.from({ length: 12 }, (_, i) => i + 9); // 9 a 20

  useEffect(() => {
    loadAllAppointments();
  }, []);

  const loadAllAppointments = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const appointments = [];
      
      usersSnap.docs.forEach(doc => {
        const data = doc.data();
        const userName = `${data.nombre || ""} ${data.apellidos || ""}`.trim() || "Sin nombre";
        const userCitas = data.citas || [];
        
        userCitas.forEach(cita => {
          appointments.push({
            ...cita,
            userName,
            userId: doc.id,
            userEmail: data.email || ""
          });
        });
      });

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

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const getAppointmentsForSlot = (date, hour) => {
    const dateStr = formatDate(date);
    const hourStr = hour.toString().padStart(2, '0');
    
    return allAppointments.filter(apt => {
      if (apt.fecha !== dateStr) return false;
      const aptHour = parseInt(apt.hora.split(':')[0]);
      return aptHour === hour;
    });
  };

  const isSlotSelected = (date, hour) => {
    if (!selectedDate || !selectedTime) return false;
    const dateStr = formatDate(date);
    const hourStr = `${hour.toString().padStart(2, '0')}:00`;
    return selectedDate === dateStr && selectedTime === hourStr;
  };

  const handleSlotClick = (date, hour) => {
    const dateStr = formatDate(date);
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    if (onSelectDateTime) {
      onSelectDateTime(dateStr, timeStr);
    }
  };

  const weekDays = getWeekDays();

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

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
        Cargando calendario...
      </div>
    );
  }

  return (
    <div style={{ background: "white", borderRadius: "10px", padding: "16px" }}>
      {/* Header con navegación */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "16px",
        flexWrap: "wrap",
        gap: "10px"
      }}>
        <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#15803d" }}>
          📅 Agenda de Citas
        </h4>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button 
            onClick={goToPreviousWeek}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              background: "white",
              cursor: "pointer",
              fontWeight: "500"
            }}
          >
            ← Anterior
          </button>
          <button 
            onClick={goToToday}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #16a34a",
              background: "#f0fdf4",
              color: "#15803d",
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            Hoy
          </button>
          <button 
            onClick={goToNextWeek}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              background: "white",
              cursor: "pointer",
              fontWeight: "500"
            }}
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* Calendario semanal */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "60px repeat(7, minmax(100px, 1fr))",
          gap: "1px",
          background: "#e2e8f0",
          border: "1px solid #e2e8f0",
          minWidth: "800px"
        }}>
          {/* Cabecera con días */}
          <div style={{ 
            background: "#f8fafc", 
            padding: "8px 4px", 
            fontWeight: "600",
            fontSize: "11px",
            color: "#64748b"
          }}>
            Hora
          </div>
          {weekDays.map((day, idx) => {
            const isToday = formatDate(day) === formatDate(new Date());
            return (
              <div 
                key={idx}
                style={{ 
                  background: isToday ? "#dcfce7" : "#f8fafc",
                  padding: "8px 4px", 
                  textAlign: "center",
                  fontWeight: "600",
                  fontSize: "11px",
                  color: isToday ? "#15803d" : "#64748b"
                }}
              >
                <div>{day.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase()}</div>
                <div style={{ fontSize: "13px", marginTop: "2px" }}>
                  {day.getDate()}/{day.getMonth() + 1}
                </div>
              </div>
            );
          })}

          {/* Filas de horas */}
          {workHours.map(hour => (
            <React.Fragment key={hour}>
              {/* Columna de hora */}
              <div style={{ 
                background: "#f8fafc",
                padding: "8px 4px",
                fontSize: "11px",
                fontWeight: "600",
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                {hour}:00
              </div>

              {/* Celdas para cada día */}
              {weekDays.map((day, dayIdx) => {
                const appointments = getAppointmentsForSlot(day, hour);
                const isSelected = isSlotSelected(day, hour);
                const isEmpty = appointments.length === 0;

                return (
                  <div
                    key={`${hour}-${dayIdx}`}
                    onClick={() => isEmpty && handleSlotClick(day, hour)}
                    style={{
                      background: isSelected 
                        ? "#fef3c7" 
                        : isEmpty 
                          ? "white" 
                          : "#fee2e2",
                      padding: "4px",
                      minHeight: "60px",
                      cursor: isEmpty ? "pointer" : "default",
                      position: "relative",
                      border: isSelected ? "2px solid #f59e0b" : "none",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      if (isEmpty) e.currentTarget.style.background = "#f0fdf4";
                    }}
                    onMouseLeave={(e) => {
                      if (isEmpty && !isSelected) e.currentTarget.style.background = "white";
                    }}
                  >
                    {appointments.map((apt, aptIdx) => (
                      <div 
                        key={aptIdx}
                        style={{
                          background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                          color: "white",
                          padding: "4px 6px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: "600",
                          marginBottom: "2px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                        title={`${apt.userName} - ${apt.hora}${apt.notas ? '\n' + apt.notas : ''}`}
                      >
                        <div>👤 {apt.userName}</div>
                        <div style={{ fontSize: "9px", opacity: 0.9 }}>🕐 {apt.hora}</div>
                      </div>
                    ))}
                    {isEmpty && (
                      <div style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        color: "#cbd5e1",
                        fontSize: "20px",
                        opacity: 0
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = "0.3"}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}
                      >
                        +
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Leyenda */}
      <div style={{ 
        display: "flex", 
        gap: "16px", 
        marginTop: "12px", 
        fontSize: "12px",
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "16px", height: "16px", background: "white", border: "1px solid #e2e8f0", borderRadius: "3px" }}></div>
          <span style={{ color: "#64748b" }}>Libre</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "16px", height: "16px", background: "#fee2e2", border: "1px solid #e2e8f0", borderRadius: "3px" }}></div>
          <span style={{ color: "#64748b" }}>Ocupado</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "16px", height: "16px", background: "#fef3c7", border: "2px solid #f59e0b", borderRadius: "3px" }}></div>
          <span style={{ color: "#64748b" }}>Seleccionado</span>
        </div>
      </div>

      <div style={{ 
        marginTop: "12px", 
        padding: "10px", 
        background: "#f0fdf4", 
        borderRadius: "6px",
        fontSize: "12px",
        color: "#15803d"
      }}>
        💡 <strong>Tip:</strong> Haz clic en una hora libre (blanca) para seleccionarla y asignar la cita
      </div>
    </div>
  );
}
