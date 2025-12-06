// src/components/editor/StepSequencer.tsx
import { useEffect, useMemo } from "react";
import { useTheme } from "../../store/theme";
import { useDrumPatterns } from "../../store/drumPatterns";
import { engine } from "../../audio/engine";
import { useElementSize } from "../../hooks/useElementSize";
import { usePlayhead } from "../../store/playhead";
import { useSnap, SNAP_TO_SUBSTEPS } from "../../store/snap";
import { useWindows } from "../../store/windows";
import { useMixer } from "../../store/mixer";
import type { DrumType } from "../../store/mixer";

const ROW_LABELS: { name: string; drum: DrumType }[] = [
  { name: "Kick", drum: "kick" },
  { name: "Snare", drum: "snare" },
  { name: "Hat", drum: "hat" },
];

// Individual drum routing dropdown
function DrumRouting({ drum, label }: { drum: DrumType; label: string }) {
  const primary = useTheme(s => s.primary);
  const channels = useMixer(s => s.channels);
  const drumRouting = useMixer(s => s.drumRouting);
  const setDrumRouting = useMixer(s => s.setDrumRouting);
  
  return (
    <select
      value={drumRouting[drum] ?? 0}
      onChange={(e) => {
        const chId = Number(e.target.value);
        setDrumRouting(drum, chId);
        engine.setDrumRouting(drum, chId);
      }}
      style={{ 
        padding: '2px 4px', 
        borderRadius: 4, 
        background: '#1e293b', 
        border: `1px solid ${primary}33`, 
        color: '#94a3b8', 
        fontSize: 9,
        width: 60,
      }}
      title={`Route ${label} to mixer channel`}
    >
      <option value={0}>Master</option>
      {channels.filter(c => c.id > 0).map(c => (
        <option key={c.id} value={c.id}>Ins {c.id}</option>
      ))}
    </select>
  );
}

export default function StepSequencer({ patternId, windowId }: { patternId?: string; windowId?: string }) {
  // FL Studio-style: get all patterns for dropdown
  const allPatterns = useDrumPatterns(s => s.patterns);
  const createPattern = useDrumPatterns(s => s.createPattern);
  const setEditorPattern = useWindows(s => s.setEditorPattern);
  const patternList = useMemo(() => Object.keys(allPatterns), [allPatterns]);

  // Compute next Drum Clip name (Drum Clip 1, 2, …)
  const nextDrumName = useMemo(() => {
    const base = "Drum Clip ";
    const nums = patternList
      .map(id => {
        const m = id.startsWith(base) ? Number(id.slice(base.length)) : NaN;
        return Number.isFinite(m) ? m : null;
      })
      .filter((n): n is number => n !== null);
    const max = nums.length ? Math.max(...nums) : 1;
    return `${base}${max + 1}`;
  }, [patternList]);

  const id = patternId || patternList[0] || 'Drum Clip 1';
  const patterns = useDrumPatterns(s => s.patterns);
  const toggleCell = useDrumPatterns(s => s.toggleCell);

  // Ensure pattern exists
  useEffect(() => {
    createPattern(id);
  }, [id, createPattern]);

  const pattern = patterns[id]?.rows || [
    Array(48).fill(false),
    Array(48).fill(false),
    Array(48).fill(false)
  ];

  // keep engine in sync whenever pattern changes
  useEffect(() => {
    engine.setDrumPattern(id, pattern);
  }, [id, pattern]);

  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const substep = usePlayhead((s) => s.substep);
  const snap = useSnap((s) => s.snap);
  const substepsPerCell = SNAP_TO_SUBSTEPS[snap];

  const { cell, gap, columns } = useMemo(() => {
    const labelCol = 120;
    const gap = 6;
    const cellsPerBeat = Math.max(1, Math.floor(12 / substepsPerCell));
    const columns = cellsPerBeat * 4;
    const available = Math.max(0, size.width - labelCol - (columns + 0) * gap);
    const cell = Math.min(42, Math.max(18, Math.floor(available / columns)));
    return { cell, gap, columns };
  }, [size.width, substepsPerCell]);

  const primary = useTheme((s) => s.primary);
  const primaryAlt = useTheme((s) => s.primaryAlt);

  const PALETTE_A_OFF = "#1e293b";
  const PALETTE_B_OFF = "#142233";

  // const btn: React.CSSProperties = {
  //   padding: "2px 6px",
  //   borderRadius: 6,
  //   border: "1px solid #475569",
  //   background: "#334155",
  //   color: "#e5e7eb",
  //   fontSize: 12,
  //   cursor: "pointer",
  // };

  return (
    <section ref={containerRef} style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        {/* FL Studio-style pattern selector */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
          Pattern:
          <select 
            value={id} 
            onChange={e => {
              const val = e.target.value;
              if (val === '___NEW___') {
                const newId = nextDrumName; // use sequential Drum Clip naming
                createPattern(newId);
                if (windowId) setEditorPattern(windowId, newId);
              } else {
                if (windowId) setEditorPattern(windowId, val);
              }
            }}
            style={{ padding: '4px 8px', borderRadius: 6, minWidth: 100, background: '#1e293b', border: `1px solid ${useTheme.getState().primary}44`, color: '#e2e8f0' }}
          >
            {patternList.map(pid => <option key={pid} value={pid}>{pid}</option>)}
            <option value="___NEW___">+ New Pattern...</option>
          </select>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `120px repeat(${columns}, ${cell}px)`,
          gap,
          alignItems: "stretch",
          position: "relative",
        }}
      >
        {/* Playhead line across the grid: 3 substeps per step */}
        <div style={{
          position: 'absolute',
          left: 120,
          top: 0,
          width: 2,
          height: '100%',
          background: primary,
          opacity: 0.9,
          pointerEvents: 'none',
          transform: `translate3d(${(substep / substepsPerCell) * (cell + gap)}px, 0, 0)`,
          willChange: 'transform'
        }} />
        {pattern.map((row, r) => (
          <div key={r} style={{ display: "contents" }}>
            <div style={{ alignSelf: "center", display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ opacity: 0.9, fontSize: 12, minWidth: 40 }}>{ROW_LABELS[r].name}</span>
              <DrumRouting drum={ROW_LABELS[r].drum} label={ROW_LABELS[r].name} />
            </div>
            {Array.from({ length: columns }).map((_, c) => {
              const subIndex = c * substepsPerCell;
              const endIndex = Math.min(48, subIndex + substepsPerCell);
              const on = row.slice(subIndex, endIndex).some(Boolean);

              const paletteIndex = Math.floor(c / 4) % 2;
              const bg = on
                ? paletteIndex === 0
                  ? primary
                  : primaryAlt
                : paletteIndex === 0
                ? PALETTE_A_OFF
                : PALETTE_B_OFF;

              return (
              <button
                key={c}
                onClick={() => toggleCell(id, r, c, substepsPerCell)}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: 6,
                  border: "1px solid #475569",
                  background: bg,
                  cursor: "pointer",
                  fontSize: 0,
                  padding: 0,
                  transition: "background 120ms",
                  outline: "none", // removes white focus outline
                }}
                title={`${ROW_LABELS[r].name} • Cell ${c + 1}`}
              />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}