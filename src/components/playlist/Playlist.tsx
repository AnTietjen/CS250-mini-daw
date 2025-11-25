import { useRef, useEffect, useState, useMemo } from 'react';
import usePlaylist from '../../store/playlist';
import { usePianoInstances } from '../../store/pianoInstances';
import { useDrumPatterns } from '../../store/drumPatterns';
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
  // const resizeClip = usePlaylist(s => s.resizeClip); // Disabled for fixed pattern length
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
  const createInstance = usePianoInstances(s => s.createInstance);
  const piList = useMemo(() => Object.keys(instances), [instances]);
  
  const drumPatterns = useDrumPatterns(s => s.patterns);
  const createDrumPattern = useDrumPatterns(s => s.createPattern);
  const drumList = useMemo(() => Object.keys(drumPatterns).length ? Object.keys(drumPatterns) : ['drums'], [drumPatterns]);

  useEffect(() => {
    if (piList.length && !piList.includes(selectedInst)) setSelectedInst(piList[0]);
  }, [piList]);
  const [selectedInst, setSelectedInst] = useState<string>(piList[0] ?? 'default');

  useEffect(() => {
    if (drumList.length && !drumList.includes(selectedDrum)) setSelectedDrum(drumList[0]);
  }, [drumList]);
  const [selectedDrum, setSelectedDrum] = useState<string>(drumList[0] ?? 'drums');
  
  const addSelectedPiano = () => {
    // Find first empty bar in piano lane
    const pianoClips = clips.filter(c => c.sourceKind === 'piano');
    const maxBar = pianoClips.reduce((max, c) => Math.max(max, c.startBar + c.lengthBars), 0);
    addClip({ sourceKind: 'piano', sourceId: selectedInst || 'default', startBar: maxBar, lengthBars: 1 });
  }

  const handleInstChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '___NEW___') {
      const newId = `pat-${Math.floor(Math.random()*10000)}`;
      createInstance(newId);
      setSelectedInst(newId);
    } else {
      setSelectedInst(val);
    }
  };

  const addSelectedDrums = () => {
    // Find first empty bar in drums lane
    const drumClips = clips.filter(c => c.sourceKind === 'drums');
    const maxBar = drumClips.reduce((max, c) => Math.max(max, c.startBar + c.lengthBars), 0);
    addClip({ sourceKind: 'drums', sourceId: selectedDrum || 'drums', startBar: maxBar, lengthBars: 1 });
  }

  const handleDrumChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '___NEW___') {
      const newId = `drums-${Math.floor(Math.random()*10000)}`;
      createDrumPattern(newId);
      setSelectedDrum(newId);
    } else {
      setSelectedDrum(val);
    }
  };

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
  // Resize handler removed
  const onWindowMove = (e: MouseEvent) => {
    setDrag(d => {
      if (!d) return d;
      const wrap = containerRef.current?.firstElementChild as HTMLElement | null;
      const left = (wrap?.getBoundingClientRect().left ?? 0);
      const relX = e.clientX - left;
      const barAt = Math.max(0, Math.round(relX / BAR_PX));
      if (d.mode === 'move') moveClip(d.id, barAt);
      // Resize logic removed
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
        <select value={selectedInst} onChange={handleInstChange} style={{ padding:6, borderRadius:6 }}>
          {piList.length ? piList.map(id => <option key={id} value={id}>{id}</option>) : <option value={'default'}>default</option>}
          <option value="___NEW___">+ New Pattern...</option>
        </select>
        <button onClick={addSelectedPiano} style={{ padding:'6px 10px' }}>+ Add Clip</button>
        
        <div style={{ width: 1, height: 20, background: '#1e293b', margin: '0 4px' }} />
        
        <select value={selectedDrum} onChange={handleDrumChange} style={{ padding:6, borderRadius:6 }}>
          {drumList.length ? drumList.map(id => <option key={id} value={id}>{id}</option>) : <option value={'drums'}>drums</option>}
          <option value="___NEW___">+ New Drums...</option>
        </select>
        <button onClick={addSelectedDrums} style={{ padding:'6px 10px' }}>+ Add Drums</button>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft: 'auto' }}>
          <span>Bars:</span>
          <input type="number" min={1} value={arrangementBars} onChange={e => setArrangementBars(Math.max(1, Number(e.target.value||1)))} style={{ width: 64, padding:'4px 6px', borderRadius:6 }} />
        </div>
      </div>
      <div style={{ padding: '6px 10px', fontSize: 12, color: '#9aa7bd', background:'#0b1220' }}>
        Tip: Drag clips to move. Shift+Click to multi-select. Delete removes, Ctrl+D duplicates. Double‑click to open editor. Right‑click toggles mute.
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
                  const existing = windowsList.find(w => w.kind === 'stepSequencer' && (w as any).patternId === c.sourceId);
                  if (existing) bringToFront(existing.id); else addStepSequencerWindow(c.sourceId);
                }
              }}
              onContextMenu={(e) => { e.preventDefault(); setMuted(c.id, !c.muted); }}
              title={`${c.sourceKind === 'drums' ? 'Drums' : c.sourceId} — Bar ${c.startBar} • ${c.lengthBars} bars`}
            >
              <div style={{ fontWeight: 700, pointerEvents:'none' }}>{c.sourceKind === 'drums' ? 'Drums' : c.sourceId}</div>
              <div style={{ fontSize: 12, pointerEvents:'none' }}>Bar {c.startBar} • {c.lengthBars} bars</div>
              {/* Resize handle removed to enforce fixed pattern length for now */}
              <button
                onMouseDown={(e) => { e.stopPropagation(); deleteClip(c.id); }}
                style={{ position: 'absolute', top: 2, right: 12, width: 16, height: 16, background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                title="Delete clip"
              >×</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
