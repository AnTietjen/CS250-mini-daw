import { useRef, useEffect, useState, useMemo } from 'react';
import usePlaylist, { NUM_LANES } from '../../store/playlist';
import { usePianoInstances } from '../../store/pianoInstances';
import { useDrumPatterns } from '../../store/drumPatterns';
import { useWindows } from '../../store/windows';
import { useTheme } from '../../store/theme';
import { usePlayhead } from '../../store/playhead';

const BAR_PX = 140;
const LANE_H = 48;

export default function Playlist() {
  const clips = usePlaylist(s => s.clips);
  const arrangementBars = usePlaylist(s => s.arrangementBars);
  const addClip = usePlaylist(s => s.addClip);
  const moveClip = usePlaylist(s => s.moveClip);
  // const resizeClip = usePlaylist(s => s.resizeClip); // Disabled for fixed pattern length
  const deleteClip = usePlaylist(s => s.deleteClip);
  const duplicateClip = usePlaylist(s => s.duplicateClip);
  const moveClipToLane = usePlaylist(s => s.moveClipToLane);
  // keep refs to actions for future interaction (drag/resize/delete)
  // Intentionally not called yet in this MVP, but keep selectors for future interactions.
  const setMuted = usePlaylist(s => s.setMuted); // right-click or double-click behavior replaced; kept for context menu
  const openPianoRoll = useWindows(s => s.openPianoRoll);
  const openStepSequencer = useWindows(s => s.openStepSequencer);
  const setSelection = usePlaylist(s => s.setSelection);
  const clearSelection = usePlaylist(s => s.clearSelection);
  const setArrangementBars = usePlaylist(s => s.setArrangementBars);
  const primary = useTheme(s => s.primary);
  const substep = usePlayhead(s => s.substep);
  const bar = usePlayhead(s => s.bar);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<null | { id: string; startBar: number; startLane: number; originX: number; originY: number; mode: 'move' | 'resize' }>(null);

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
  const [selectedLane, setSelectedLane] = useState<number>(0);
  
  const addSelectedPiano = () => {
    // Add at selected lane, find first empty bar
    const laneClips = clips.filter(c => (c.lane ?? 0) === selectedLane);
    const maxBar = laneClips.reduce((max, c) => Math.max(max, c.startBar + c.lengthBars), 0);
    addClip({ sourceKind: 'piano', sourceId: selectedInst || 'default', startBar: maxBar, lengthBars: 1, lane: selectedLane });
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
    // Add at selected lane, find first empty bar
    const laneClips = clips.filter(c => (c.lane ?? 0) === selectedLane);
    const maxBar = laneClips.reduce((max, c) => Math.max(max, c.startBar + c.lengthBars), 0);
    addClip({ sourceKind: 'drums', sourceId: selectedDrum || 'drums', startBar: maxBar, lengthBars: 1, lane: selectedLane });
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
    setDrag({ id, startBar: c.startBar, startLane: c.lane ?? 0, originX: e.clientX - rect.left, originY: e.clientY - rect.top, mode: 'move' });
    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', onWindowUp);
  };
  
  const onWindowMove = (e: MouseEvent) => {
    setDrag(d => {
      if (!d) return d;
      const wrap = containerRef.current?.firstElementChild as HTMLElement | null;
      if (!wrap) return d;
      const rect = wrap.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const barAt = Math.max(0, Math.round(relX / BAR_PX));
      const laneAt = Math.max(0, Math.min(NUM_LANES - 1, Math.floor(relY / LANE_H)));
      if (d.mode === 'move') {
        moveClip(d.id, barAt);
        moveClipToLane(d.id, laneAt);
      }
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

  // Click on lane header or empty area to select lane
  const onLaneClick = (laneIndex: number) => {
    setSelectedLane(laneIndex);
  };

  return (
    <section style={{ display:'flex', flexDirection:'column', height: '100%', background: '#0a1628' }}>
      <div style={{ padding: 8, display: 'flex', gap: 12, alignItems: 'center', background: '#0b1220', borderBottom: `1px solid ${primary}33`, flexWrap: 'wrap' }}>
        <select value={selectedInst} onChange={handleInstChange} style={{ padding:6, borderRadius:6, background: '#1e293b', border: `1px solid ${primary}44`, color: '#e2e8f0' }}>
          {piList.length ? piList.map(id => <option key={id} value={id}>{id}</option>) : <option value={'default'}>default</option>}
          <option value="___NEW___">+ New Pattern...</option>
        </select>
        <button onClick={addSelectedPiano} style={{ padding:'6px 10px', borderRadius: 6, background: primary + '22', border: `1px solid ${primary}`, color: '#e2e8f0', cursor: 'pointer' }}>+ Add Melody</button>
        
        <div style={{ width: 1, height: 20, background: primary + '44', margin: '0 4px' }} />
        
        <select value={selectedDrum} onChange={handleDrumChange} style={{ padding:6, borderRadius:6, background: '#1e293b', border: `1px solid ${primary}44`, color: '#e2e8f0' }}>
          {drumList.length ? drumList.map(id => <option key={id} value={id}>{id}</option>) : <option value={'drums'}>drums</option>}
          <option value="___NEW___">+ New Drums...</option>
        </select>
        <button onClick={addSelectedDrums} style={{ padding:'6px 10px', borderRadius: 6, background: primary + '22', border: `1px solid ${primary}`, color: '#e2e8f0', cursor: 'pointer' }}>+ Add Drums</button>
        
        <div style={{ width: 1, height: 20, background: primary + '44', margin: '0 4px' }} />
        
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize: 12 }}>
          <span style={{ opacity: 0.7 }}>Lane:</span>
          <span style={{ fontWeight: 600, color: primary }}>{selectedLane + 1}</span>
        </div>
        
        <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft: 'auto', fontSize: 12 }}>
          <span style={{ opacity: 0.7 }}>Bars:</span>
          <input type="number" min={1} value={arrangementBars} onChange={e => setArrangementBars(Math.max(1, Number(e.target.value||1)))} style={{ width: 56, padding:'4px 6px', borderRadius:6, background: '#1e293b', border: `1px solid ${primary}44`, color: '#e2e8f0' }} />
        </div>
      </div>
      <div style={{ padding: '4px 10px', fontSize: 10, color: '#64748b', background:'#0b1220', borderBottom: '1px solid #1e293b22' }}>
        Drag to move • Shift+Click multi-select • Del removes • Ctrl+D duplicates • Double-click edits • Right-click mutes
      </div>
      <div ref={containerRef} style={{ flex:1, overflow: 'auto', background:'#071428' }} onMouseDown={() => clearSelection()}>
        <div style={{ display: 'flex', minHeight: LANE_H * NUM_LANES }}>
          {/* Lane headers */}
          <div style={{ width: 50, flexShrink: 0, background: '#0b1220', borderRight: '1px solid #1e293b' }}>
            {Array.from({ length: NUM_LANES }, (_, i) => (
              <div 
                key={i} 
                onClick={() => onLaneClick(i)}
                style={{ 
                  height: LANE_H, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: 10, 
                  color: selectedLane === i ? primary : '#64748b',
                  background: selectedLane === i ? '#1e293b' : 'transparent',
                  borderBottom: '1px solid #1e293b',
                  cursor: 'pointer',
                  fontWeight: selectedLane === i ? 600 : 400,
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>
          {/* Grid area */}
          <div style={{ position:'relative', minWidth: Math.max(arrangementBars * BAR_PX, 2000), flex: 1 }}>
            {/* Lane backgrounds */}
            {Array.from({ length: NUM_LANES }, (_, i) => (
              <div 
                key={`lane-${i}`} 
                onClick={() => onLaneClick(i)}
                style={{ 
                  position: 'absolute', 
                  left: 0, 
                  right: 0, 
                  top: i * LANE_H, 
                  height: LANE_H, 
                  background: i % 2 === 0 ? '#0b1935' : '#0a1628',
                  borderBottom: '1px solid #1e293b',
                  cursor: 'pointer',
                }} 
              />
            ))}
            {/* Bar lines - render plenty to fill visible area */}
            {Array.from({ length: Math.max(32, arrangementBars + 16) }, (_, i) => (
              <div 
                key={i} 
                style={{ 
                  position:'absolute', 
                  left: i*BAR_PX, 
                  top: 0, 
                  bottom: 0, 
                  width: 1, 
                  background: i < arrangementBars 
                    ? (i % 4 === 0 ? '#334155' : '#1e293b') 
                    : (i % 4 === 0 ? '#1e293b55' : '#1e293b33'),
                  zIndex: 1 
                }} 
              />
            ))}
            {/* Loop end marker */}
            <div style={{ 
              position:'absolute', 
              left: arrangementBars * BAR_PX - 2, 
              top: 0, 
              bottom: 0, 
              width: 3, 
              background: primary + '66',
              zIndex: 1,
              borderRight: `2px dashed ${primary}`,
            }} />
            {/* Playhead */}
            <div style={{ position:'absolute', top:0, bottom:0, width:2, background: primary, opacity: 0.9, transform: `translateX(${(bar + (substep/48)) * BAR_PX}px)`, willChange:'transform', pointerEvents:'none', zIndex: 3 }} />
            {/* Clips */}
            {clips.map((c) => (
              <div key={c.id}
                onMouseDown={(e) => { e.stopPropagation(); onClipMouseDown(e, c.id); }}
                style={{ 
                  position:'absolute', 
                  left: c.startBar * BAR_PX + 2, 
                  top: (c.lane ?? 0) * LANE_H + 4, 
                  width: c.lengthBars * BAR_PX - 4, 
                  height: LANE_H - 8, 
                  background: c.muted ? '#475569' : (c.selected ? primary : primary + 'cc'), 
                  border: '1px solid ' + primary, 
                  borderRadius: 4, 
                  padding: '4px 6px', 
                  boxSizing:'border-box', 
                  cursor: drag ? 'grabbing' : 'grab', 
                  userSelect:'none',
                  zIndex: 2,
                  overflow: 'hidden',
                }}
                onDoubleClick={() => {
                  // FL Studio-style: open singleton editor and switch to this pattern
                  if (c.sourceKind === 'piano') {
                    openPianoRoll(c.sourceId);
                  } else if (c.sourceKind === 'drums') {
                    openStepSequencer(c.sourceId);
                  }
                }}
                onContextMenu={(e) => { e.preventDefault(); setMuted(c.id, !c.muted); }}
                title={`${c.sourceKind === 'drums' ? 'Drums' : 'Melody'}: ${c.sourceId} — Bar ${c.startBar} • Lane ${(c.lane ?? 0) + 1}`}
              >
                <div style={{ fontWeight: 600, fontSize: 11, pointerEvents:'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.sourceKind === 'drums' ? '🥁' : '🎹'} {c.sourceId}
                </div>
                <button
                  onMouseDown={(e) => { e.stopPropagation(); deleteClip(c.id); }}
                  style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  title="Delete clip"
                >×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
