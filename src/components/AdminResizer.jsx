import React, { useEffect, useRef, useState } from "react";

/**
 * AdminResizer.jsx
 * - Drag-to-resize para .admin-left (mouse + touch)
 * - Toggle collapse/expand por botón o doble-click
 * - Persiste ancho en localStorage (clave: "admin-left-width" y "admin-left-width-collapsed")
 *
 * Inserción mínima recomendada:
 * - Reemplaza la <div className="resizer"> existente por <AdminResizer /> entre .admin-left y .admin-right
 *
 * No modifica nada fuera de .admin-left/.admin-right y localStorage.
 */

export default function AdminResizer({ min = 200, max = 720, storageKey = "admin-left-width" }) {
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const resizerRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);

  // Restore saved width and collapsed state on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const w = Number(saved);
      const left = document.querySelector(".admin-left");
      if (left && Number.isFinite(w) && w > 0) {
        const width = Math.max(min, Math.min(max, w));
        left.style.width = `${width}px`;
        left.style.flex = `0 0 ${width}px`;
      }
    }
    const collapsedSaved = localStorage.getItem(`${storageKey}-collapsed`);
    if (collapsedSaved) {
      const left = document.querySelector(".admin-left");
      if (left) {
        left.classList.add("collapsed");
        left.style.width = "64px";
        left.style.flex = "0 0 64px";
        setCollapsed(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onMove = (clientX) => {
      const left = document.querySelector(".admin-left");
      if (!left || !draggingRef.current) return;
      const dx = clientX - startXRef.current;
      let newWidth = startWidthRef.current + dx;
      newWidth = Math.max(min, Math.min(max, newWidth));
      left.style.width = `${newWidth}px`;
      left.style.flex = `0 0 ${newWidth}px`;
      localStorage.setItem(storageKey, String(newWidth));
    };

    const handleMouseMove = (ev) => onMove(ev.clientX);
    const handleTouchMove = (ev) => { if (ev.touches && ev.touches[0]) onMove(ev.touches[0].clientX); };

    const stopDrag = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("mouseup", stopDrag);
      document.removeEventListener("touchend", stopDrag);
    };

    const res = resizerRef.current;
    if (!res) return;

    const startDrag = (clientX) => {
      const left = document.querySelector(".admin-left");
      if (!left) return;
      // if currently collapsed, expand to previous width before dragging
      if (left.classList.contains("collapsed")) {
        left.classList.remove("collapsed");
        const prev = Number(left.getAttribute("data-prev-width")) || Number(localStorage.getItem(storageKey)) || 360;
        const width = Math.max(min, Math.min(max, prev));
        left.style.width = `${width}px`;
        left.style.flex = `0 0 ${width}px`;
        localStorage.setItem(`${storageKey}-collapsed`, "");
        localStorage.setItem(storageKey, String(width));
        setCollapsed(false);
      }
      draggingRef.current = true;
      startXRef.current = clientX;
      startWidthRef.current = left.getBoundingClientRect().width;
      document.body.style.cursor = "col-resize";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("mouseup", stopDrag);
      document.addEventListener("touchend", stopDrag);
    };

    const onMouseDown = (e) => { e.preventDefault(); startDrag(e.clientX); };
    const onTouchStart = (e) => { if (e.touches && e.touches[0]) startDrag(e.touches[0].clientX); };

    res.addEventListener("mousedown", onMouseDown);
    res.addEventListener("touchstart", onTouchStart, { passive: false });

    const onDblClick = () => toggleCollapse();
    res.addEventListener("dblclick", onDblClick);

    return () => {
      res.removeEventListener("mousedown", onMouseDown);
      res.removeEventListener("touchstart", onTouchStart);
      res.removeEventListener("dblclick", onDblClick);
      stopDrag();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, storageKey]);

  const toggleCollapse = () => {
    const left = document.querySelector(".admin-left");
    if (!left) return;
    if (!collapsed) {
      // collapse to a slim sidebar (64px) and remember previous width
      left.setAttribute("data-prev-width", left.getBoundingClientRect().width || "");
      left.classList.add("collapsed");
      left.style.width = "64px";
      left.style.flex = "0 0 64px";
      localStorage.setItem(`${storageKey}-collapsed`, "1");
      setCollapsed(true);
    } else {
      // restore previous width (from attribute or storage)
      const prev = Number(left.getAttribute("data-prev-width")) || Number(localStorage.getItem(storageKey)) || 360;
      left.classList.remove("collapsed");
      const width = Math.max(min, Math.min(max, prev));
      left.style.width = `${width}px`;
      left.style.flex = `0 0 ${width}px`;
      localStorage.setItem(storageKey, String(width));
      localStorage.removeItem(`${storageKey}-collapsed`);
      setCollapsed(false);
    }
  };

  const onKey = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCollapse(); } };

  return (
    <div
      ref={resizerRef}
      className="resizer resizer--draggable"
      role="separator"
      aria-orientation="vertical"
      aria-label={collapsed ? "Expandir panel izquierdo" : "Redimensionar panel izquierdo"}
      tabIndex={0}
      onKeyDown={onKey}
      style={{ display: "inline-block", cursor: "col-resize", userSelect: "none", touchAction: "none", height: "100%" }}
    >
      <div className="resizer-controls" style={{ display: "flex", alignItems: "center", height: "100%", padding: "8px 4px", gap: 6 }}>
        <button
          className="btn ghost resizer-toggle"
          aria-pressed={collapsed}
          onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}
          title={collapsed ? "Expandir panel" : "Ocultar panel"}
          style={{ padding: "6px 8px" }}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
    </div>
  );
}