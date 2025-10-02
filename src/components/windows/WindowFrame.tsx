// src/components/windows/WindowFrame.tsx
import { useRef, useCallback, useEffect } from "react";
import { useWindows } from "../../store/windows";
import type { WindowState } from "../../store/windows";

interface Props {
  win: WindowState;
  children: React.ReactNode;
}

export function WindowFrame({ win, children }: Props) {
  const bringToFront = useWindows(s => s.bringToFront);
  const move = useWindows(s => s.move);
  const resize = useWindows(s => s.resize);
  const toggleMin = useWindows(s => s.toggleMin);

  const dragData = useRef<{ offX: number; offY: number; id: string } | null>(null);
  const sizeData = useRef<{ startW: number; startH: number; startX: number; startY: number; id: string } | null>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (dragData.current) {
      const { offX, offY, id } = dragData.current;
      move(id, e.clientX - offX, e.clientY - offY);
    } else if (sizeData.current) {
      const { startW, startH, startX, startY, id } = sizeData.current;
      const dw = e.clientX - startX;
      const dh = e.clientY - startY;
      resize(id, startW + dw, startH + dh);
    }
  }, [move, resize]);

  const endInteraction = useCallback(() => {
    dragData.current = null;
    sizeData.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endInteraction);
  }, [onPointerMove]);

  // Safety cleanup on unmount in case a drag/resize was mid-flight.
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endInteraction);
    };
  }, [onPointerMove, endInteraction]);

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).dataset.btn) return; // ignore clicks on buttons
    bringToFront(win.id);
    dragData.current = { offX: e.clientX - win.x, offY: e.clientY - win.y, id: win.id };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endInteraction);
  };

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    bringToFront(win.id);
    sizeData.current = { startW: win.w, startH: win.h, startX: e.clientX, startY: e.clientY, id: win.id };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endInteraction);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: win.x,
        top: win.y,
        width: win.w,
        height: win.minimized ? 36 : win.h,
        zIndex: win.z,
        display: "flex",
        flexDirection: "column",
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        overflow: "hidden",
        userSelect: "none",
      }}
      onPointerDown={() => bringToFront(win.id)}
    >
      <div
        onPointerDown={startDrag}
        style={{
          height: 36,
          background: "#334155",
          padding: "0 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 14,
          fontWeight: 600,
          cursor: "move",
          color: "#e2e8f0",
        }}
      >
        <span>{win.title}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            data-btn
            onClick={() => toggleMin(win.id)}
            style={buttonStyle}
            title={win.minimized ? "Restore" : "Minimize"}
          >
            {win.minimized ? "▢" : "_"}
          </button>
        </div>
      </div>
      {!win.minimized && (
        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
          {children}
        </div>
      )}
      {!win.minimized && (
        <div
          onPointerDown={startResize}
          style={{
            position: "absolute",
            width: 18,
            height: 18,
            right: 2,
            bottom: 2,
            cursor: "nwse-resize",
            background: "transparent",
          }}
          title="Resize"
        />
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 4,
  background: "#475569",
  border: "1px solid #64748b",
  color: "#f1f5f9",
  cursor: "pointer",
  fontSize: 12,
  lineHeight: "1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};
