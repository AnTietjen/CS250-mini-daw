// src/components/editor/StepSequencer.tsx
import { useEffect, useMemo } from "react";
import { useTheme } from "../../store/theme";
import { useProject, MAX_DRUM_LANES, SUBSTEPS_PER_BAR } from "../../store/project";
import { engine } from "../../audio/engine";
import { useElementSize } from "../../hooks/useElementSize";
import { usePlayhead } from "../../store/playhead";
import { useSnap, SNAP_TO_SUBSTEPS } from "../../store/snap";

export default function StepSequencer() {
  const drumLanes = useProject((s) => s.drumLanes);
  const toggleDrumCell = useProject((s) => s.toggleDrumCell);
  const removeDrumLane = useProject((s) => s.removeDrumLane);

  useEffect(() => {
    engine.setDrumLanes(
      drumLanes.map((l) => ({
        id: l.id,
        name: l.name,
        source: l.source,
        pattern: l.pattern.slice(0, SUBSTEPS_PER_BAR),
      }))
    );
  }, [drumLanes]);

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

  const btn: React.CSSProperties = {
    padding: "2px 6px",
    borderRadius: 6,
    border: "1px solid #475569",
    background: "#334155",
    color: "#e5e7eb",
    fontSize: 12,
    cursor: "pointer",
  };

  return (
    <section ref={containerRef} style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          Lanes: <strong>{drumLanes.length}</strong> / {MAX_DRUM_LANES}
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
        <div
          style={{
            position: "absolute",
            left: 120,
            top: 0,
            width: 2,
            height: "100%",
            background: primary,
            opacity: 0.9,
            pointerEvents: "none",
            transform: `translate3d(${(substep / substepsPerCell) * (cell + gap)}px,0,0)`,
            willChange: "transform",
          }}
        />

        {drumLanes.map((lane, r) => (
          <div key={lane.id} style={{ display: "contents" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
              <span
                style={{
                  opacity: 0.95,
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                }}
              >
                {lane.name}
                {lane.source.type === "sample" ? " • sample" : ""}
              </span>
              <button title="Remove lane" onClick={() => removeDrumLane(r)} style={btn}>
                ✕
              </button>
            </div>

            {Array.from({ length: columns }).map((_, c) => {
              const subIndex = c * substepsPerCell;
              const endIndex = Math.min(48, subIndex + substepsPerCell);
              const on = lane.pattern.slice(subIndex, endIndex).some(Boolean);

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
                  onClick={() => toggleDrumCell(r, c, substepsPerCell)}
                  onMouseDown={(e) => e.currentTarget.blur()} // optional: drop focus immediately
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
                  title={`${lane.name} • Cell ${c + 1}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}