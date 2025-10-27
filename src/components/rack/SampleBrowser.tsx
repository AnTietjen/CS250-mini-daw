import React, { useRef } from "react";
import { previewSample } from "../../audio/preview";
import { useSamples } from "../../store/samples";

const SampleBrowser: React.FC = () => {
  const samples = useSamples(s => s.samples);
  const addSamples = useSamples(s => s.addSamples);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ padding: 16 }}>
      <h3>Sample Browser</h3>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        style={{ marginBottom: 12 }}
        onChange={e => addSamples(e.target.files)}
      />
      <ul style={{ listStyle: "none", padding: 0 }}>
        {samples.map((s, i) => (
          <li key={i} style={{ marginBottom: 8 }}>
            <button
              style={{ marginRight: 8 }}
              onClick={() => previewSample(s.url)}
            >▶️</button>
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SampleBrowser;