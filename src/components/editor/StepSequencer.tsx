// src/components/editor/StepSequencer.tsx
import { useEffect } from "react";
import { useProject } from "../../store/project";
import { engine } from "../../audio/engine";

const ROW_LABELS = ["Kick", "Snare", "Hat"];

export default function StepSequencer() {
  const drumSteps = useProject((s) => s.drumSteps);
  const toggle = useProject((s) => s.toggleDrumStep);

  // keep engine in sync whenever pattern changes
  useEffect(() => {
    engine.setDrumPattern(drumSteps);
  }, [drumSteps]);

  return (
    <section>
      <h3 style={{ margin: "12px 0" }}>Step Sequencer (16 steps)</h3>
      <div style={{ display: "grid", gridTemplateColumns: "80px repeat(16, 28px)", gap: 6 }}>
        {drumSteps.map((row, r) => (
          <div key={r} style={{ display: "contents" }}>
            <div style={{ alignSelf: "center", opacity: 0.9 }}>{ROW_LABELS[r]}</div>
            {row.map((on, c) => (
              <button
                key={c}
                onClick={() => toggle(r, c)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "1px solid #666",
                  background: on ? "#6ee7b7" : "#1f2937",
                  color: "#fff",
                  cursor: "pointer",
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
