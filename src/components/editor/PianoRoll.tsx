// src/components/editor/PianoRoll.tsx
import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { engine } from "../../audio/engine";
import { useElementSize } from "../../hooks/useElementSize";
// import { usePiano } from "../../store/piano";
import { usePianoInstances } from "../../store/pianoInstances";
import { usePianoView } from "../../store/pianoView";
import { useTheme } from "../../store/theme";
import { useSnap, SNAP_TO_SUBSTEPS } from "../../store/snap";
import { usePlayhead } from "../../store/playhead";
import { useWindows } from "../../store/windows";
import { useMixer } from "../../store/mixer";
import Knob from "../controls/Knob";

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

const EMPTY_NOTES: ReadonlyArray<any> = Object.freeze([]);

// Mini component for mixer routing dropdown
function MixerRouting({ patternId }: { patternId: string }) {
  const primary = useTheme(s => s.primary);
  const channels = useMixer(s => s.channels);
  const routing = useMixer(s => s.routing);
  const setRouting = useMixer(s => s.setRouting);
  
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 12, alignItems: 'center' }}>
      <span style={{ opacity: 0.7 }}>→</span>
      <select
        value={routing[patternId] ?? 0}
        onChange={(e) => {
          const chId = Number(e.target.value);
          setRouting(patternId, chId);
          engine.setPatternRouting(patternId, chId);
        }}
        style={{ padding: '4px 8px', borderRadius: 6, background: '#1e293b', border: `1px solid ${primary}44`, color: '#e2e8f0', minWidth: 80 }}
        title="Route to mixer channel"
      >
        <option value={0}>Master</option>
        {channels.filter(c => c.id > 0).map(c => (
          <option key={c.id} value={c.id}>Insert {c.id}</option>
        ))}
      </select>
    </div>
  );
}

export default function PianoRoll({ instanceId, windowId }: { instanceId?: string; windowId?: string }) {
  // FL Studio-style: get all instances for dropdown
  const instances = usePianoInstances(s => s.instances);
  const createInstance = usePianoInstances(s => s.createInstance);
  const setEditorInstance = useWindows(s => s.setEditorInstance);
  const instanceList = useMemo(() => Object.keys(instances), [instances]);

  // Helper: next "Melody Clip N" name
  const nextMelodyName = useMemo(() => {
    const base = "Melody Clip ";
    const nums = instanceList
      .map(id => {
        const m = id.startsWith(base) ? Number(id.slice(base.length)) : NaN;
        return Number.isFinite(m) ? m : null;
      })
      .filter((n): n is number => n !== null);
    const max = nums.length ? Math.max(...nums) : 1; // if only "Melody Clip 1" exists, next is 2
    return `${base}${max + 1}`;
  }, [instanceList]);

  // Ensure the default instance exists synchronously (only Melody Clip 1)
  useEffect(() => {
    if (instanceList.length === 0) {
      createInstance('Melody Clip 1');
      if (windowId) setEditorInstance(windowId, 'Melody Clip 1');
    }
  }, [instanceList.length, createInstance, setEditorInstance, windowId]);

  // Resolve current id: prefer provided if it exists, else Melody Clip 1
  const resolvedId = instances[instanceId ?? ''] ? (instanceId as string) : 'Melody Clip 1';
  const id = resolvedId;

  // Remove auto-create for arbitrary IDs; only ensure synth if the instance exists
  useEffect(() => {
    if (instances[id]) {
      engine.ensureInstanceSynth(id);
    }
  }, [id, instances]);

  const notes = usePianoInstances(s => s.instances[id]?.notes ?? EMPTY_NOTES);
  const primary = useTheme(s => s.primary);
  const addNote = usePianoInstances(s => s.addNote);
  const resizeNote = usePianoInstances(s => s.resizeNote);
  const setSelection = usePianoInstances(s => s.setSelection);
  const deleteNote = usePianoInstances(s => s.deleteNote);
  const wave = usePianoInstances(s => s.instances[id]?.wave || 'sawtooth');
  const setWave = usePianoInstances(s => s.setWave);
  const volume = usePianoInstances(s => s.instances[id]?.volume ?? 0.8);
  const setVolume = usePianoInstances(s => s.setVolume);
  const lastInsertLen = usePianoInstances(s => s.instances[id]?.lastInsertLen ?? 3); // default 16th = 3 substeps
  const snap = useSnap(s => s.snap);
  const substepsPerCell = SNAP_TO_SUBSTEPS[snap];
  const substep = usePlayhead(s => s.substep);
  // noise retained in engine but not exposed in UI per request

  // Keep engine in sync with per-instance instrument params
  useEffect(() => {
    if (!instances[id]) return;
    if (wave === 'piano') engine.setInstanceToPianoSampler(id);
    else engine.setInstanceToBasicSynth(id, wave as any);
  }, [id, wave, instances]);
  useEffect(() => {
    if (!instances[id]) return;
    engine.setInstanceVolume(id, volume);
  }, [id, volume, instances]);

  // Sync engine whenever note set changes (send explicit pitch string to avoid index mismatches)
  useEffect(() => {
    if (!instances[id]) return;
    engine.setSynthNotesForInstance(id, notes.map(n => ({
      id: n.id,
      pitchIndex: n.pitchIndex,
      pitch: ROW_PITCHES[n.pitchIndex],
      start: n.start,
      length: n.length
    })));
  }, [notes, id, instances]);

  const [containerRef] = useElementSize<HTMLDivElement>();
  const scrollRef = useRef<HTMLDivElement | null>(null); // <-- scroll container
  const vZoom = usePianoView((s: { vZoom: number }) => s.vZoom);
  const hZoom = usePianoView((s: { hZoom: number }) => s.hZoom);
  const { zoomInV, zoomOutV, zoomInH, zoomOutH } = usePianoView.getState();
  const { cellW, rowH, timelineCells, rowCount } = useMemo(() => {
    // One bar: 4 beats. We render N cells per beat depending on snap.
    const cellsPerBeat = 12 / substepsPerCell; // 12 substeps per beat
    const cellsPerBar = Math.round(4 * cellsPerBeat);
    const baseCellW = 28;
    const baseRowH = 16;
    const cellW = Math.round(baseCellW * hZoom);
    const rowH = Math.round(baseRowH * vZoom);
    return { cellW, rowH, timelineCells: cellsPerBar, rowCount: ROW_PITCHES.length };
  }, [vZoom, hZoom, substepsPerCell]);

  // Inform engine of current pitch map (descending list)
  useEffect(() => {
    engine.setPitchMap(ROW_PITCHES);
  }, []);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [/*dragging*/ , setDragging] = useState<null | { id: string; anchorStart: number; anchorPitch: number; mode: 'move' | 'resize'; originX: number; originY: number }>(null);

  const startPosToSubstep = useCallback((clientX: number) => {
    const grid = gridRef.current;
    if (!grid) return 0;
    const rect = grid.getBoundingClientRect();
    const rel = clientX - rect.left + grid.scrollLeft; // include scroll offset
    const cellIndex = Math.max(0, Math.floor(rel / cellW));
    return cellIndex * substepsPerCell;
  }, [cellW, substepsPerCell]);

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
    const startSub = startPosToSubstep(e.clientX);
    const pitchIndex = clientYToPitch(e.clientY);
    // Default to last insert length (16th=3) instead of current snap cell size
    const len = Math.max(1, lastInsertLen);
    addNote(id, { pitchIndex, start: startSub, length: len });
  };

  const onNoteMouseDown = (e: React.MouseEvent, id: string, edge?: 'right') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const n = notes.find(n => n.id === id)!;
  setSelection(id, [id]);
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
      const deltaSub = startPosToSubstep(e.clientX) - startPosToSubstep(prev.originX);
      const n = notes.find(n => n.id === prev.id);
      if (n) {
        const baseLen = n.length;
        // snap resize in increments of substepsPerCell
        const snapped = Math.round((baseLen + deltaSub) / substepsPerCell) * substepsPerCell;
        // Update note and remember last inserted length for future notes
        resizeNote(id, prev.id, Math.max(substepsPerCell, snapped));
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
          for (const n of selected) deleteNote(id, n.id);
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
  for (let c = 0; c <= timelineCells; c++) {
    // visual accents: bar lines every cellsPerBeat*4; beat lines every cellsPerBeat
    const cellsPerBeat = 12 / substepsPerCell;
    const barEvery = Math.round(cellsPerBeat * 4);
    const isBar = c % barEvery === 0;
    const isBeat = c % cellsPerBeat === 0;
    gridLines.push(
      <div key={c} style={{
        position: 'absolute',
        left: c * cellW,
        top: 0,
        width: 1,
        height: '100%',
        background: isBar ? '#334155' : (isBeat ? '#1e293b' : '#1e293b66'),
        pointerEvents: 'none'
      }} />
    );
  }

  // If no valid instance yet, show minimal placeholder
  if (!instances[id]) {
    return (
      <section style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', border: '1px solid #1e293b' }}>
        <div style={{ color: '#e2e8f0', fontSize: 12, opacity: 0.8 }}>
          Creating first piano pattern...
        </div>
      </section>
    );
  }

  // Restore saved scroll position when this piano roll mounts or id changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const saved = usePianoView.getState().getScroll(id);
    if (saved) {
      el.scrollLeft = saved.left;
      el.scrollTop = saved.top;
    }
  }, [id]);

  // Persist scroll position on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      usePianoView.getState().setScroll(id, el.scrollLeft, el.scrollTop);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [id]);

  // Palette for column bands (groups of 4 cells)
  const COL_A = '#0b1830'; // darker
  const COL_B = '#0d1c38'; // slightly lighter

  return (
    <section ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 4px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* FL Studio-style pattern selector */}
          <div style={{ display: 'flex', gap: 6, fontSize: 12, alignItems: 'center' }}>
            Pattern:
            <select 
              value={id} 
              onChange={e => {
                const val = e.target.value;
                if (val === '___NEW___') {
                  const newId = nextMelodyName;
                  createInstance(newId);
                  if (windowId) setEditorInstance(windowId, newId);
                } else {
                  if (windowId) setEditorInstance(windowId, val);
                }
              }}
              style={{ padding: '4px 8px', borderRadius: 6, minWidth: 100, background: '#1e293b', border: `1px solid ${primary}44`, color: '#e2e8f0' }}
            >
              {instanceList.map(pid => <option key={pid} value={pid}>{pid}</option>)}
              <option value="___NEW___">+ New Pattern...</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: 12, alignItems: 'center' }}>
            Wave:
            <select value={wave} onChange={e => { const t = e.target.value as any; setWave(id, t); }} style={{ padding: '4px 8px', borderRadius: 6, background: '#1e293b', border: `1px solid ${primary}44`, color: '#e2e8f0' }}>
              <option value="sine">Sine</option>
              <option value="square">Square</option>
              <option value="sawtooth">Saw</option>
              <option value="triangle">Triangle</option>
              <option value="piano">Piano (Sampled)</option>
            </select>
          </div>
          <MixerRouting patternId={id} />
          <div style={{ display: 'flex', gap: 4, fontSize: 11 }}>
            <span style={{ opacity: 0.6 }}>V</span>
            <button style={zoomBtn} onClick={zoomOutV}>-</button>
            <button style={zoomBtn} onClick={zoomInV}>+</button>
            <span style={{ opacity: 0.6 }}>H</span>
            <button style={zoomBtn} onClick={zoomOutH}>-</button>
            <button style={zoomBtn} onClick={zoomInH}>+</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Knob value={volume} onChange={(v) => { setVolume(id, v); }} size={28} color={primary} label="Volume" showLabel={false} />
        </div>
      </div>
      
      <div
        ref={scrollRef}
        style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'auto', background: '#0f172a', border: '1px solid #1e293b' }}
      >
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
            minWidth: cellW * timelineCells,
            backgroundSize: `${cellW}px ${rowH}px`,
            backgroundImage: `linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg,#1e293b 1px, transparent 1px)`,
            backgroundPosition: '0 0, 0 0',
            backgroundRepeat: 'repeat',
            cursor: 'crosshair',
            boxSizing: 'border-box'
          }}
        >
          {/* Base-4 column bands */}
          {Array.from({ length: timelineCells }, (_, c) => {
            const bandColor = Math.floor(c / 4) % 2 === 0 ? COL_A : COL_B;
            return (
              <div
                key={`colband-${c}`}
                style={{
                  position: 'absolute',
                  left: c * cellW,
                  top: 0,
                  width: cellW,
                  height: '100%',
                  background: bandColor,
                  opacity: 0.5,
                  pointerEvents: 'none',
                }}
              />
            );
          })}

          {/* Darker rows for black keys */}
          {ROW_PITCHES.map((p, i) => (
            isBlackKey(p) ? (
              <div
                key={`rowbg-${p}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: i * rowH,
                  right: 0,
                  height: rowH,
                  background: '#071326', // darker stripe
                  opacity: 0.7,
                  pointerEvents: 'none',
                }}
              />
            ) : null
          ))}

          {gridLines}
          {/* Playhead line */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 2,
            height: '100%',
            background: primary,
            opacity: 0.9,
            pointerEvents: 'none',
            transform: `translate3d(${(substep / substepsPerCell) * cellW}px, 0, 0)`,
            willChange: 'transform'
          }} />
          {notes.map(n => {
            const top = n.pitchIndex * rowH;
            return (
              <div key={n.id}
                onMouseDown={(e) => onNoteMouseDown(e, n.id)}
                onContextMenu={(e) => { e.preventDefault(); deleteNote(id, n.id); }}
                style={{
                  position: 'absolute',
                  left: (n.start / substepsPerCell) * cellW,
                  top,
                  width: (n.length / substepsPerCell) * cellW - 2,
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
                title={`${ROW_PITCHES[n.pitchIndex]} start ${n.start} len ${n.length} (substeps)`}
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
