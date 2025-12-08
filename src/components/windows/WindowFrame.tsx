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
import SampleBrowser from "../rack/SampleBrowser";
import * as PlaylistModule from "../playlist/Playlist.tsx";
// In some dev builds the default export may be present under .default. Normalize it.
const Playlist = (PlaylistModule as any).default || (PlaylistModule as any);

interface Props { id: string }

export const WindowFrame: React.FC<Props> = React.memo(({ id }) => {
  const win = useWindows(s => s.windows.find(w => w.id === id)!);
  const bringToFront = useWindows(s => s.bringToFront);
  const move = useWindows(s => s.move);
  const resize = useWindows(s => s.resize);
  const toggleMin = useWindows(s => s.toggleMin);
  const close = useWindows(s => s.closeWindow);

  const dragData = useRef<{ offX: number; offY: number; id: string } | null>(null);
  const sizeData = useRef<{
    startW: number;
    startH: number;
    startX: number; // pointer
    startY: number; // pointer
    startLeft: number; // win.x at start
    startTop: number;  // win.y at start
    id: string;
    edges: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean };
  } | null>(null);
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
      const MIN_W = 200;
      const MIN_H = 120;
      const { startW, startH, startX, startY, startLeft, startTop, id, edges } = sizeData.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newW = startW;
      let newH = startH;
      let newX = startLeft;
      let newY = startTop;

      if (edges.right) newW = Math.max(MIN_W, startW + dx);
      if (edges.bottom) newH = Math.max(MIN_H, startH + dy);
      if (edges.left) {
        newW = Math.max(MIN_W, startW - dx);
        // shift x by the amount width decreased vs original
        newX = startLeft + (startW - newW);
      }
      if (edges.top) {
        newH = Math.max(MIN_H, startH - dy);
        newY = startTop + (startH - newH);
      }

      // Throttle move/resize via rAF as well
      lastMove.current = { x: newW, y: newH, posX: newX, posY: newY } as any;
      if (rafMove.current == null) {
        rafMove.current = requestAnimationFrame(() => {
          rafMove.current = null;
          if (lastMove.current) {
            const lm: any = lastMove.current;
            move(id, lm.posX, lm.posY);
            resize(id, lm.x, lm.y);
          }
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

  const startResize = (
    e: React.PointerEvent,
    edges: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean }
  ) => {
    e.stopPropagation();
    bringToFront(win.id);
    sizeData.current = {
      startW: win.w,
      startH: win.h,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: win.x,
      startTop: win.y,
      id: win.id,
      edges,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endInteraction);
  };

  // Create/delete piano instance tied to this window if it's a pianoRoll
  const createInstance = usePianoInstances(s => s.createInstance);
  const deleteInstance = usePianoInstances(s => s.deleteInstance);
  // Fix: Default to 'Melody Clip 1' for piano rolls if no instance is set, matching the useEffect creation logic
  const instId = (win as any).instanceId ?? (win.kind === 'pianoRoll' ? 'Melody Clip 1' : win.id);
  const getInst = usePianoInstances(s => s.instances[instId]);
  useEffect(() => {
    if (win.kind === "pianoRoll") {
      // Do not create instances tied to window IDs; rely on named instances only
      const instId = (win as any).instanceId ?? 'Melody Clip 1';
      createInstance(instId);
      engine.ensureInstanceSynth(instId);
      const wave = getInst?.wave ?? 'sawtooth';
      const volume = getInst?.volume ?? 0.8;
      if (wave === 'piano') engine.setInstanceToPianoSampler(instId);
      else engine.setInstanceToBasicSynth(instId, wave as any);
      engine.setInstanceVolume(instId, volume);
    }
    return () => {
      // persist instances
    };
  }, [win.kind, instId, createInstance, deleteInstance]);

  const content = useMemo(() => {
    switch (win.kind) {
      case "stepSequencer": return <StepSequencer patternId={(win as any).patternId} windowId={win.id} />;
      case "pianoRoll": return <PianoRoll instanceId={instId} windowId={win.id} />;
      case "settings": return <Transport />;
      case "keyboard": return <TypingKeyboard instanceId={win.id} />;
      case "playlist": return <Playlist />;
      case "mixer": return <Mixer />;
  case "visualizer": return <Visualizer />;
       case "sampleBrowser": return <SampleBrowser />;
      default: return <div>Unknown window: {win.kind}</div>;
    }
  }, [win.kind, win.id, instId, (win as any).patternId]);
  
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
        <div style={{ flex: 1, overflow: "auto", padding: 12, position: "relative" }}>
          {content}
          {/* Resize edges (thicker invisible hit areas) */}
          <div
            onPointerDown={(e) => startResize(e, { left: true })}
            style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, cursor: "ew-resize" }}
            title="Resize"
          />
          <div
            onPointerDown={(e) => startResize(e, { right: true })}
            style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, cursor: "ew-resize" }}
            title="Resize"
          />
          <div
            onPointerDown={(e) => startResize(e, { top: true })}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, cursor: "ns-resize" }}
            title="Resize"
          />
          <div
            onPointerDown={(e) => startResize(e, { bottom: true })}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 8, cursor: "ns-resize" }}
            title="Resize"
          />
          {/* Corner hit areas with appropriate cursors */}
          <div
            onPointerDown={(e) => startResize(e, { left: true, top: true })}
            style={{ position: "absolute", left: 0, top: 0, width: 12, height: 12, cursor: "nwse-resize" }}
            title="Resize"
          />
          <div
            onPointerDown={(e) => startResize(e, { right: true, top: true })}
            style={{ position: "absolute", right: 0, top: 0, width: 12, height: 12, cursor: "nesw-resize" }}
            title="Resize"
          />
          <div
            onPointerDown={(e) => startResize(e, { left: true, bottom: true })}
            style={{ position: "absolute", left: 0, bottom: 0, width: 12, height: 12, cursor: "nesw-resize" }}
            title="Resize"
          />
          <div
            onPointerDown={(e) => startResize(e, { right: true, bottom: true })}
            style={{ position: "absolute", right: 0, bottom: 0, width: 12, height: 12, cursor: "nwse-resize" }}
            title="Resize"
          />
        </div>
      )}
      {/* Legacy corner handle removed; corners covered by hit areas above */}
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
