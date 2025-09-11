// src/components/editor/PianoRoll.tsx
import { useEffect } from "react";
import { useProject } from "../../store/project";
import { engine } from "../../audio/engine";

const ROW_PITCHES = ["B4","A#4","A4","G#4","G4","F#4","F4","E4","D#4","D4","C#4","C4"]; // top→bottom

const isBlackKey = (p: string) => p.includes("#");

export default function PianoRoll() {
  const synthGrid = useProject((s) => s.synthGrid);
  const toggleSynthCell = useProject((s) => s.toggleSynthCell);

  useEffect(() => {
    engine.setSynthGrid(synthGrid);
  }, [synthGrid]);

  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ margin: "12px 0" }}>Piano Roll (12-note chromatic × 16 steps)</h3>
      <div style={{ display: "grid", gridTemplateColumns: "80px repeat(16, 28px)", gap: 6 }}>
        {synthGrid.map((row, r) => (
          <div key={r} style={{ display: "contents" }}>
            {/* Keyboard labels */}
            <div
              style={{
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 8,
                opacity: 0.9,
              }}
            >
              {ROW_PITCHES[r]}
            </div>
            {row.map((on, c) => (
              <button
                key={c}
                onClick={() => toggleSynthCell(r, c)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (on) toggleSynthCell(r, c); // right-click to remove
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "1px solid #444",
                  background: on
                    ? "#60a5fa"
                    : isBlackKey(ROW_PITCHES[r])
                    ? "#0f172a"
                    : "#111827",
                  color: "#fff",
                  cursor: "pointer",
                }}
                title={`Note ${ROW_PITCHES[r]} @ step ${c + 1}`}
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
