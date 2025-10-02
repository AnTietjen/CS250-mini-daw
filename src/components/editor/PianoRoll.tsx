// src/components/editor/PianoRoll.tsx
import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { engine } from "../../audio/engine";
import { useElementSize } from "../../hooks/useElementSize";
import { usePiano } from "../../store/piano";
import { usePianoView } from "../../store/pianoView.ts";
import { useTheme } from "../../store/theme";

// Build full pitch list C0..C8 (inclusive C8) then reverse for UI (top = highest)
const buildPitchList = () => {
  const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const result: string[] = [];
  for (let octave = 0; octave <= 8; octave++) {
    for (const n of names) {
      if (octave === 8 && n !== "C") break; // only C8 terminal
      result.push(`${n}${octave}`);
    }
  }
  return result; // ascending
};
const PITCH_ASC = buildPitchList();
const ROW_PITCHES = [...PITCH_ASC].reverse();

const isBlackKey = (p: string) => p.includes("#");

export default function PianoRoll() {
  const notes = usePiano(s => s.notes);
  const primary = useTheme(s => s.primary);
  const addNote = usePiano(s => s.addNote);
  const resizeNote = usePiano(s => s.resizeNote);
  const setSelection = usePiano(s => s.setSelection);
  const deleteNote = usePiano(s => s.deleteNote);

  // Sync engine whenever note set changes (send explicit pitch string to avoid index mismatches)
  useEffect(() => {
    engine.setSynthNotes(notes.map(n => ({ id: n.id, pitchIndex: n.pitchIndex, pitch: ROW_PITCHES[n.pitchIndex], start: n.start, length: n.length })));
  }, [notes]);

  const [containerRef] = useElementSize<HTMLDivElement>();
  const vZoom = usePianoView((s: { vZoom: number }) => s.vZoom);
  const hZoom = usePianoView((s: { hZoom: number }) => s.hZoom);
  const { zoomInV, zoomOutV, zoomInH, zoomOutH } = usePianoView.getState();
  const { cellW, rowH, timelineSteps, rowCount } = useMemo(() => {
  const steps = 16;
    const baseCellW = 28;
    const baseRowH = 16; // slightly tighter default
    const cellW = Math.round(baseCellW * hZoom);
    const rowH = Math.round(baseRowH * vZoom);
    return { cellW, rowH, timelineSteps: steps, rowCount: ROW_PITCHES.length };
  }, [vZoom, hZoom]);

  // Inform engine of current pitch map (descending list)
  useEffect(() => {
    engine.setPitchMap(ROW_PITCHES);
  }, []);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [/*dragging*/ , setDragging] = useState<null | { id: string; anchorStart: number; anchorPitch: number; mode: 'move' | 'resize'; originX: number; originY: number }>(null);

  const startPosToStep = useCallback((clientX: number) => {
    const grid = gridRef.current;
    if (!grid) return 0;
    const rect = grid.getBoundingClientRect();
    const rel = clientX - rect.left + grid.scrollLeft; // include scroll offset
    return Math.max(0, Math.floor(rel / cellW)); // floor for left-edge snap (fix off-by-one)
  }, [cellW]);

  const clientYToPitch = useCallback((clientY: number) => {
    const grid = gridRef.current;
    if (!grid) return 0;
    const rect = grid.getBoundingClientRect();
    const rel = clientY - rect.top + grid.scrollTop;
    const row = Math.floor(rel / rowH);
    return Math.min(rowCount - 1, Math.max(0, row));
  }, [rowH, rowCount]);

  const onBackgroundClick = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Avoid adding if double click triggered delete just now
    const step = startPosToStep(e.clientX);
    const pitchIndex = clientYToPitch(e.clientY);
    // Default length was 4 (quarter note). Reduce to 2 (eighth note) per request.
    addNote({ pitchIndex, start: step, length: 2 });
  };

  const onNoteMouseDown = (e: React.MouseEvent, id: string, edge?: 'right') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const n = notes.find(n => n.id === id)!;
    setSelection([id]);
    // Movement disabled per request; only allow resize when grabbing right edge.
    if (edge) {
      setDragging({ id, anchorStart: n.start, anchorPitch: n.pitchIndex, mode: 'resize', originX: e.clientX, originY: e.clientY });
      window.addEventListener('mousemove', onWindowMove);
      window.addEventListener('mouseup', onWindowUp);
    }
  };

  const onWindowMove = (e: MouseEvent) => {
    setDragging(prev => {
      if (!prev) return prev;
      if (prev.mode !== 'resize') return prev; // movement disabled
      const deltaSteps = startPosToStep(e.clientX) - startPosToStep(prev.originX);
      const n = notes.find(n => n.id === prev.id);
      if (n) {
        const baseLen = n.length;
        resizeNote(prev.id, Math.max(1, baseLen + deltaSteps));
      }
      return prev;
    });
  };

  const onWindowUp = () => {
    setDragging(null);
    window.removeEventListener('mousemove', onWindowMove);
    window.removeEventListener('mouseup', onWindowUp);
  };

  // Delete selected notes with Delete or Backspace
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selected = notes.filter(n => n.selected);
        if (selected.length) {
          for (const n of selected) deleteNote(n.id);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notes, deleteNote]);

  useEffect(() => () => {
    window.removeEventListener('mousemove', onWindowMove);
    window.removeEventListener('mouseup', onWindowUp);
  }, []);

  const gridLines = [];
  for (let s = 0; s <= timelineSteps; s++) {
    const strong = s % 16 === 0;
    gridLines.push(
      <div key={s} style={{
        position: 'absolute',
        left: s * cellW,
        top: 0,
        width: 1,
        height: '100%',
        background: strong ? '#334155' : (s % 4 === 0 ? '#1e293b' : '#1e293b66'),
        pointerEvents: 'none'
      }} />
    );
  }

  return (
    <section ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px' }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Piano Roll</h3>
        <div style={{ display: 'flex', gap: 4, fontSize: 11 }}>
          <span style={{ opacity: 0.6 }}>V</span>
          <button style={zoomBtn} onClick={zoomOutV}>-</button>
          <button style={zoomBtn} onClick={zoomInV}>+</button>
          <span style={{ opacity: 0.6 }}>H</span>
          <button style={zoomBtn} onClick={zoomOutH}>-</button>
          <button style={zoomBtn} onClick={zoomInH}>+</button>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'auto', background: '#0f172a', border: '1px solid #1e293b' }}>
        {/* Keyboard labels */}
        <div style={{ position: 'sticky', left: 0, zIndex: 2 }}>
          {ROW_PITCHES.map((p) => (
            <div key={p} style={{
              height: rowH,
              width: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: 4,
              fontSize: 11,
              background: isBlackKey(p) ? '#020617' : '#0f172a',
              borderBottom: '1px solid #1e293b',
              boxSizing: 'border-box'
            }}>{p}</div>
          ))}
        </div>
        {/* Scrollable grid */}
        <div
          ref={gridRef}
          onMouseDown={onBackgroundClick}
          style={{
            position: 'relative',
            flex: 1,
            height: rowH * rowCount,
            minWidth: cellW * timelineSteps,
            backgroundSize: `${cellW}px ${rowH}px`,
            backgroundImage: `linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg,#1e293b 1px, transparent 1px)`,
            backgroundPosition: '0 0, 0 0',
            backgroundRepeat: 'repeat',
            cursor: 'crosshair',
            boxSizing: 'border-box'
          }}
        >
          {gridLines}
          {notes.map(n => {
            const top = n.pitchIndex * rowH;
            return (
              <div key={n.id}
                onMouseDown={(e) => onNoteMouseDown(e, n.id)}
                onContextMenu={(e) => { e.preventDefault(); deleteNote(n.id); }}
                style={{
                  position: 'absolute',
                  left: n.start * cellW,
                  top,
                  width: n.length * cellW - 2,
                  height: rowH - 2,
                  background: n.selected ? primary : primary + 'cc',
                  border: '1px solid '+ primary,
                  borderRadius: 4,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 10,
                  paddingLeft: 4,
                  color: '#fff',
                  userSelect: 'none'
                }}
                title={`${ROW_PITCHES[n.pitchIndex]} start ${n.start} len ${n.length}`}
              >
                {ROW_PITCHES[n.pitchIndex]}
                <div
                  onMouseDown={(e) => { onNoteMouseDown(e, n.id, 'right'); }}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    width: 6,
                    height: '100%',
                    cursor: 'ew-resize',
                    background: 'rgba(255,255,255,0.15)',
                    borderTopRightRadius: 4,
                    borderBottomRightRadius: 4,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Add keyboard deletion (Delete / Backspace) for selected notes
// Placed outside component for clarity not required; instead integrate inside.

const zoomBtn: React.CSSProperties = {
  width: 22,
  height: 22,
  padding: 0,
  border: '1px solid #334155',
  background: '#1e293b',
  color: '#e2e8f0',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: '1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
