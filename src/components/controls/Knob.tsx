import React, { useRef, useState, useEffect } from 'react';

type KnobProps = {
  value: number; // 0..1
  onChange: (v: number) => void;
  size?: number; // px
  color?: string;
  label?: string;
  step?: number; // optional quantization (0..1)
  showLabel?: boolean; // render label text under knob
};

// Simple circular knob with -135deg..+135deg sweep
export const Knob: React.FC<KnobProps> = ({ value, onChange, size = 42, color = '#10b981', label, step, showLabel = true }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<null | { startY: number; startVal: number }>(null);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const quantize = (v: number) => {
    if (!step || step <= 0) return v;
    const s = Math.max(0.0001, step);
    return Math.round(v / s) * s;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setDragging(d => {
        if (!d) return d;
        const dy = d.startY - e.clientY; // up increases value
        const sensitivity = 0.005; // 200px drag covers full range
        let next = d.startVal + dy * sensitivity;
        next = quantize(clamp(next));
        onChange(next);
        return d;
      });
    };
    const onUp = () => setDragging(null);
    if (dragging) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp, { once: true });
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, onChange]);

  const angle = -135 + value * 270; // deg

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        ref={ref}
        onMouseDown={(e) => setDragging({ startY: e.clientY, startVal: value })}
        title={label ? `${label}: ${Math.round(value * 100)}%` : `${Math.round(value * 100)}%`}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#0b1220',
          border: '1px solid #334155',
          position: 'relative',
          cursor: 'ns-resize',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)'
        }}
      >
        {/* Indicator arc (simple) */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 2,
          height: size * 0.38,
          background: color,
          transform: `translate(-50%, -100%) rotate(${angle}deg)`,
          transformOrigin: '50% 100%',
          borderRadius: 1,
        }} />
        {/* Center dot */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: size * 0.2, height: size * 0.2, borderRadius: '50%', background: '#111827'
        }} />
      </div>
      {label && showLabel && <div style={{ fontSize: 11, opacity: 0.8 }}>{label}</div>}
    </div>
  );
};

export default Knob;
