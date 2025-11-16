import { useRef, useEffect, useState, useMemo } from 'react';
import usePlaylist from '../../store/playlist';
import { usePianoInstances } from '../../store/pianoInstances';
import { useWindows } from '../../store/windows';
import { useTheme } from '../../store/theme';
import { usePlayhead } from '../../store/playhead';

const BAR_PX = 140;
const LANE_H = 64;

export default function Playlist() {
  const clips = usePlaylist(s => s.clips);
  const arrangementBars = usePlaylist(s => s.arrangementBars);
  const addClip = usePlaylist(s => s.addClip);
  const moveClip = usePlaylist(s => s.moveClip);
  const resizeClip = usePlaylist(s => s.resizeClip);
  const deleteClip = usePlaylist(s => s.deleteClip);
  const duplicateClip = usePlaylist(s => s.duplicateClip);
  // keep refs to actions for future interaction (drag/resize/delete)
  // Intentionally not called yet in this MVP, but keep selectors for future interactions.
  const setMuted = usePlaylist(s => s.setMuted); // right-click or double-click behavior replaced; kept for context menu
  const addPianoWindow = useWindows(s => s.addPianoWindow);
  const addStepSequencerWindow = useWindows(s => s.addStepSequencerWindow);
  const bringToFront = useWindows(s => s.bringToFront);
  const windowsList = useWindows(s => s.windows);
  const setSelection = usePlaylist(s => s.setSelection);
  const clearSelection = usePlaylist(s => s.clearSelection);
  const setArrangementBars = usePlaylist(s => s.setArrangementBars);
  const primary = useTheme(s => s.primary);
  const substep = usePlayhead(s => s.substep);
  const bar = usePlayhead(s => s.bar);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [/*drag*/ , setDrag] = useState<null | { id: string; startBar: number; originX: number; mode: 'move' | 'resize' }>(null);

  useEffect(() => {
    // placeholder: nothing yet
  }, [clips]);

  const instances = usePianoInstances(s => s.instances);
  const piList = useMemo(() => Object.keys(instances), [instances]);
  useEffect(() => {
    if (piList.length && !piList.includes(selectedInst)) setSelectedInst(piList[0]);
  }, [piList]);
  const [selectedInst, setSelectedInst] = useState<string>(piList[0] ?? 'default');
  const addDefaultPiano = () => {
    addClip({ sourceKind: 'piano', sourceId: selectedInst || 'default', startBar: arrangementBars, lengthBars: 1 });
  }

  const addDrums = () => {
    addClip({ sourceKind: 'drums', sourceId: 'drums', startBar: arrangementBars, lengthBars: 1 });
  }

  const onClipMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return;
    const c = clips.find(c => c.id === id); if (!c) return;
    const append = e.shiftKey;
    setSelection([id], append);
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    setDrag({ id, startBar: c.startBar, originX: e.clientX - rect.left, mode: 'move' });
    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', onWindowUp);
  };
  const onResizeMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const c = clips.find(c => c.id === id); if (!c) return;
    const rect = (e.currentTarget.parentElement?.parentElement as HTMLElement).getBoundingClientRect();
    setDrag({ id, startBar: c.startBar, originX: e.clientX - rect.left, mode: 'resize' });
    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', onWindowUp);
  };
  const onWindowMove = (e: MouseEvent) => {
    setDrag(d => {
      if (!d) return d;
      const wrap = containerRef.current?.firstElementChild as HTMLElement | null;
      const left = (wrap?.getBoundingClientRect().left ?? 0);
      const relX = e.clientX - left;
      const barAt = Math.max(0, Math.round(relX / BAR_PX));
      if (d.mode === 'move') moveClip(d.id, barAt);
      if (d.mode === 'resize') resizeClip(d.id, Math.max(1, barAt - (clips.find(c => c.id === d.id)?.startBar ?? 0)));
      return d;
    });
  };
  const onWindowUp = () => {
    setDrag(null);
    window.removeEventListener('mousemove', onWindowMove);
    window.removeEventListener('mouseup', onWindowUp);
  };

  useEffect(() => () => { window.removeEventListener('mousemove', onWindowMove); window.removeEventListener('mouseup', onWindowUp); }, []);

  // Keyboard handlers for delete and duplicate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        const selected = clips.filter(c => c.selected);
        if (selected.length) {
          selected.forEach(c => deleteClip(c.id));
          e.preventDefault();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        const selected = clips.filter(c => c.selected);
        if (selected.length) {
          selected.forEach(c => duplicateClip(c.id));
          e.preventDefault();
        }
      }
      // quick shrink/grow arrangement
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { setArrangementBars(arrangementBars + 1); e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { setArrangementBars(Math.max(1, arrangementBars - 1)); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clips, arrangementBars]);

  return (
    <section style={{ display:'flex', flexDirection:'column', height: '100%' }}>
      <div style={{ padding: 8, display: 'flex', gap: 12, alignItems: 'center', background: '#0b1220', borderBottom: '1px solid #1e293b' }}>
        <select value={selectedInst} onChange={(e)=>setSelectedInst(e.target.value)} style={{ padding:6, borderRadius:6 }}>
          {piList.length ? piList.map(id => <option key={id} value={id}>{id}</option>) : <option value={'default'}>default</option>}
        </select>
        <button onClick={addDefaultPiano} style={{ padding:'6px 10px' }}>+ Piano Clip</button>
        <button onClick={addDrums} style={{ padding:'6px 10px' }}>+ Drums Clip</button>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft: 'auto' }}>
          <span>Bars:</span>
          <input type="number" min={1} value={arrangementBars} onChange={e => setArrangementBars(Math.max(1, Number(e.target.value||1)))} style={{ width: 64, padding:'4px 6px', borderRadius:6 }} />
        </div>
      </div>
      <div style={{ padding: '6px 10px', fontSize: 12, color: '#9aa7bd', background:'#0b1220' }}>
        Tip: Drag clips to move, drag right edge to resize. Shift+Click to multi-select. Delete removes, Ctrl+D duplicates. Double‑click to open editor. Right‑click toggles mute.
      </div>
      <div ref={containerRef} style={{ flex:1, overflow: 'auto', background:'#071428', padding: 12 }} onMouseDown={() => clearSelection()}>
        <div style={{ position:'relative', minWidth: arrangementBars*BAR_PX, height: LANE_H*2, border: '1px solid #1e293b', borderRadius: 6, background:'#0b1935' }}>
          {Array.from({ length: arrangementBars }, (_, i) => (
            <div key={i} style={{ position:'absolute', left: i*BAR_PX, top: 0, bottom: 0, width: 1, background:'#1e293b' }} />
          ))}
          {/* Playhead */}
          <div style={{ position:'absolute', top:0, bottom:0, width:2, background: primary, opacity: 0.9, transform: `translateX(${(bar + (substep/48)) * BAR_PX}px)`, willChange:'transform', pointerEvents:'none' }} />
          {clips.map((c) => (
            <div key={c.id}
              onMouseDown={(e) => onClipMouseDown(e, c.id)}
              style={{ position:'absolute', left: c.startBar * BAR_PX, top: (c.sourceKind === 'drums' ? 8 : (LANE_H + 8)), width: c.lengthBars * BAR_PX - 6, height: LANE_H-16, background: c.muted ? '#475569' : (c.selected ? primary : primary + 'cc'), border: '1px solid ' + primary, borderRadius: 6, padding: '6px', boxSizing:'border-box', cursor:'grab', userSelect:'none' }}
              onDoubleClick={() => {
                if (c.sourceKind === 'piano') {
                  // open piano editor for the instance id referenced by the clip
                  const existing = windowsList.find(w => w.kind === 'pianoRoll' && (w as any).instanceId === c.sourceId);
                  if (existing) bringToFront(existing.id); else addPianoWindow(c.sourceId);
                } else if (c.sourceKind === 'drums') {
                  // open step sequencer to edit drums
                  const existing = windowsList.find(w => w.kind === 'stepSequencer');
                  if (existing) bringToFront(existing.id); else addStepSequencerWindow();
                }
              }}
              onContextMenu={(e) => { e.preventDefault(); setMuted(c.id, !c.muted); }}
              title={`${c.sourceKind === 'drums' ? 'Drums' : c.sourceId} — Bar ${c.startBar} • ${c.lengthBars} bars`}
            >
              <div style={{ fontWeight: 700, pointerEvents:'none' }}>{c.sourceKind === 'drums' ? 'Drums' : c.sourceId}</div>
              <div style={{ fontSize: 12, pointerEvents:'none' }}>Bar {c.startBar} • {c.lengthBars} bars</div>
              <div onMouseDown={(e)=> onResizeMouseDown(e, c.id)} style={{ position:'absolute', right:0, top:0, width:8, height:'100%', cursor:'ew-resize', background:'rgba(255,255,255,0.18)', borderTopRightRadius:6, borderBottomRightRadius:6 }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
