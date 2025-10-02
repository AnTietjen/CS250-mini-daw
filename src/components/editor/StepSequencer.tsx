// src/components/editor/StepSequencer.tsx
import { useEffect, useMemo } from "react";
import { useTheme } from "../../store/theme";
import { useProject } from "../../store/project";
import { engine } from "../../audio/engine";
import { useElementSize } from "../../hooks/useElementSize";

const ROW_LABELS = ["Kick", "Snare", "Hat"];

export default function StepSequencer() {
  const drumSteps = useProject((s) => s.drumSteps);
  const toggle = useProject((s) => s.toggleDrumStep);

  // keep engine in sync whenever pattern changes
  useEffect(() => {
    engine.setDrumPattern(drumSteps);
  }, [drumSteps]);

  const [containerRef, size] = useElementSize<HTMLDivElement>();

  const { cell, gap } = useMemo(() => {
    const padding = 0; // internal container padding already in WindowFrame
    const labelCol = 80;
    const gap = 6;
    const steps = 16;
    const available = Math.max(0, size.width - padding - labelCol - (steps + 0) * gap); // approximate
    // derive cell size (min 18, max 42)
    const cell = Math.min(42, Math.max(18, Math.floor(available / steps)));
    return { cell, gap };
  }, [size.width]);

  const primary = useTheme(s => s.primary);
  return (
    <section ref={containerRef} style={{ width: "100%" }}>
      <h3 style={{ margin: "0 0 8px" }}>Step Sequencer</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `80px repeat(16, ${cell}px)`,
          gap,
          alignItems: "stretch",
        }}
      >
        {drumSteps.map((row, r) => (
          <div key={r} style={{ display: "contents" }}>
            <div style={{ alignSelf: "center", opacity: 0.9, fontSize: 12 }}>{ROW_LABELS[r]}</div>
            {row.map((on, c) => (
              <button
                key={c}
                onClick={() => toggle(r, c)}
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
                title={`Row ${r + 1}, Step ${c + 1}`}
              >
                {c + 1}
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
