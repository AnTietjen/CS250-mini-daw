// src/components/editor/StepSequencer.tsx
import { useEffect, useMemo } from "react";
import { useTheme } from "../../store/theme";
import { useProject } from "../../store/project";
import { engine } from "../../audio/engine";
import { useElementSize } from "../../hooks/useElementSize";
import { usePlayhead } from "../../store/playhead";
import { useSnap, SNAP_TO_SUBSTEPS } from "../../store/snap";

const ROW_LABELS = ["Kick", "Snare", "Hat"];

export default function StepSequencer() {
  const drumPattern = useProject((s) => s.drumPattern);
  const toggleDrumCell = useProject((s) => s.toggleDrumCell);

  // keep engine in sync whenever pattern changes
  useEffect(() => {
    engine.setDrumPattern(drumPattern);
  }, [drumPattern]);

  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const substep = usePlayhead(s => s.substep);

  const snap = useSnap(s => s.snap);
  const substepsPerCell = SNAP_TO_SUBSTEPS[snap];
  const { cell, gap, columns } = useMemo(() => {
    const padding = 0; // internal container padding already in WindowFrame
    const labelCol = 80;
    const gap = 6;
    // 4 beats per bar, 12 substeps per beat => 48 substeps per bar
    const cellsPerBeat = Math.max(1, Math.floor(12 / substepsPerCell));
    const columns = cellsPerBeat * 4;
    const available = Math.max(0, size.width - padding - labelCol - (columns + 0) * gap); // approximate
    // derive cell size (min 18, max 42)
    const cell = Math.min(42, Math.max(18, Math.floor(available / columns)));
    return { cell, gap, columns };
  }, [size.width, substepsPerCell]);

  const primary = useTheme(s => s.primary);
  return (
    <section ref={containerRef} style={{ width: "100%" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `80px repeat(${columns}, ${cell}px)`,
          gap,
          alignItems: "stretch",
          position: 'relative'
        }}
      >
        {/* Playhead line across the grid: 3 substeps per step */}
        <div style={{
          position: 'absolute',
          left: 80,
          top: 0,
          width: 2,
          height: '100%',
          background: primary,
          opacity: 0.9,
          pointerEvents: 'none',
          transform: `translate3d(${(substep / substepsPerCell) * (cell + gap)}px, 0, 0)`,
          willChange: 'transform'
        }} />
        {drumPattern.map((row, r) => (
          <div key={r} style={{ display: "contents" }}>
            <div style={{ alignSelf: "center", opacity: 0.9, fontSize: 12 }}>{ROW_LABELS[r]}</div>
            {Array.from({ length: columns }).map((_, c) => {
              const subIndex = c * substepsPerCell;
              const endIndex = Math.min(48, subIndex + substepsPerCell);
              const on = row.slice(subIndex, endIndex).some(Boolean);
              return (
              <button
                key={c}
                onClick={() => toggleDrumCell(r, c, substepsPerCell)}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: 6,
                  border: "1px solid #475569",
                  background: on ? primary : "#1e293b",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: Math.max(10, Math.min(14, cell * 0.4)),
                  display: "flex",
                  alignItems: "center",
                   justifyContent: "center",
                  padding: 0,
                }}
                title={`Row ${r + 1}, Cell ${c + 1}`}
              >
                <span style={{ opacity: 0.8 }}>{c + 1}</span>
              </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
