// src/components/windows/WindowFrame.tsx
import React, { useRef, useCallback, useEffect, useMemo } from "react";
import { useWindows } from "../../store/windows";
import StepSequencer from "../editor/StepSequencer";
import PianoRoll from "../editor/PianoRoll";
import { usePianoInstances } from "../../store/pianoInstances";
import { engine } from "../../audio/engine";
import Transport from "../transport/Transport";
import TypingKeyboard from "../keyboard/TypingKeyboard";
import Mixer from "../mixer/ChannelMixer";
import Visualizer from "../visualizer/Visualizer";

interface Props { id: string }

export const WindowFrame: React.FC<Props> = React.memo(({ id }) => {
  const win = useWindows(s => s.windows.find(w => w.id === id)!);
  const bringToFront = useWindows(s => s.bringToFront);
  const move = useWindows(s => s.move);
  const resize = useWindows(s => s.resize);
  const toggleMin = useWindows(s => s.toggleMin);
  const close = useWindows(s => s.closeWindow);

  const dragData = useRef<{ offX: number; offY: number; id: string } | null>(null);
  const sizeData = useRef<{ startW: number; startH: number; startX: number; startY: number; id: string } | null>(null);
  const rafMove = useRef<number | null>(null);
  const lastMove = useRef<{ x: number; y: number } | null>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (dragData.current) {
      const { offX, offY, id } = dragData.current;
      lastMove.current = { x: e.clientX - offX, y: e.clientY - offY };
      if (rafMove.current == null) {
        rafMove.current = requestAnimationFrame(() => {
          rafMove.current = null;
          if (lastMove.current) move(id, lastMove.current.x, lastMove.current.y);
        });
      }
    } else if (sizeData.current) {
      const { startW, startH, startX, startY, id } = sizeData.current;
      const dw = e.clientX - startX;
      const dh = e.clientY - startY;
      // Throttle resize slightly via rAF as well
      lastMove.current = { x: startW + dw, y: startH + dh } as any;
      if (rafMove.current == null) {
        rafMove.current = requestAnimationFrame(() => {
          rafMove.current = null;
          if (lastMove.current) resize(id, (lastMove.current as any).x, (lastMove.current as any).y);
        });
      }
    }
  }, [move, resize]);

  const endInteraction = useCallback(() => {
    dragData.current = null;
    sizeData.current = null;
    if (rafMove.current != null) cancelAnimationFrame(rafMove.current);
    rafMove.current = null;
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

  // Create/delete piano instance tied to this window if it's a pianoRoll
  const createInstance = usePianoInstances(s => s.createInstance);
  const deleteInstance = usePianoInstances(s => s.deleteInstance);
  const getInst = usePianoInstances(s => s.instances[win.id]);
  useEffect(() => {
    if (win.kind === "pianoRoll") {
      createInstance(win.id);
      // Ensure engine synth and initialize with stored params if present
      engine.ensureInstanceSynth(win.id);
      const wave = getInst?.wave ?? 'sawtooth';
      const volume = getInst?.volume ?? 0.8;
      if (wave === 'piano') engine.setInstanceToPianoSampler(win.id);
      else engine.setInstanceToBasicSynth(win.id, wave as any);
      engine.setInstanceVolume(win.id, volume);
    }
    return () => {
      if (win.kind === "pianoRoll") {
        deleteInstance(win.id);
        engine.removePianoInstance(win.id);
      }
    };
  }, [win.kind, win.id, createInstance, deleteInstance]);

  const content = useMemo(() => {
    switch (win.kind) {
      case "stepSequencer": return <StepSequencer />;
      case "pianoRoll": return <PianoRoll instanceId={win.id} />;
      case "settings": return <Transport />;
      case "keyboard": return <TypingKeyboard instanceId={win.id} />;
      case "mixer": return <Mixer />;
  case "visualizer": return <Visualizer />;
      default: return <div>Unknown window: {win.kind}</div>;
    }
  }, [win.kind, win.id]);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate3d(${win.x}px, ${win.y}px, 0)`,
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
        willChange: "transform, width, height",
        contain: "layout paint",
        backfaceVisibility: "hidden",
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
          {win.kind === "pianoRoll" && (
            <button
              data-btn
              onClick={() => close(win.id)}
              style={buttonStyle}
              title="Close"
            >×</button>
          )}
        </div>
      </div>
      {!win.minimized && (
        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
          {content}
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
});

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
