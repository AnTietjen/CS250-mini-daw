import React, { useRef, useState } from "react";
import { previewSample } from "../../audio/preview";
import { useSamples } from "../../store/samples";
import { useProject, MAX_DRUM_LANES } from "../../store/project";

const SampleBrowser: React.FC = () => {
  const samples = useSamples((s) => s.samples);
  const addSamples = useSamples((s) => s.addSamples);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const laneCount = useProject((s) => s.drumLanes.length);
  const addDrumLaneFromSample = useProject((s) => s.addDrumLaneFromSample);

  const [err, setErr] = useState<string | null>(null);

  function addLane(sample: { name: string; url: string }) {
    const ok = addDrumLaneFromSample(sample);
    if (!ok) {
      setErr(`Maximum of ${MAX_DRUM_LANES} lanes reached`);
      window.clearTimeout((addLane as any)._t);
      (addLane as any)._t = window.setTimeout(() => setErr(null), 1800);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>Sample Browser</h3>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        style={{ marginBottom: 12 }}
        onChange={(e) => addSamples(e.target.files)}
      />
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
        Drum lanes: <strong>{laneCount}</strong> / {MAX_DRUM_LANES}
        {err ? <span style={{ color: "#ef4444", marginLeft: 8 }}>{err}</span> : null}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {samples.map((s, i) => (
          <li
            key={i}
            style={{
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <button
              style={{ padding: "2px 6px", borderRadius: 6 }}
              onClick={() => previewSample(s.url)}
              title="Preview"
            >
              ▶️
            </button>
            <button
              style={{ padding: "2px 6px", borderRadius: 6 }}
              onClick={() => addLane({ name: s.name, url: s.url })}
              disabled={laneCount >= MAX_DRUM_LANES}
              title={
                laneCount >= MAX_DRUM_LANES
                  ? "Lane limit reached"
                  : "Add to Step Sequencer"
              }
            >
              ＋
            </button>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SampleBrowser;