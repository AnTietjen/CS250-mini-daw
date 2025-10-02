// src/hooks/useElementSize.ts
import { useState, useLayoutEffect, useRef } from "react";

export function useElementSize<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === el) {
          const cr = entry.contentRect;
            setSize({ width: cr.width, height: cr.height });
        }
      }
    });
    ro.observe(el);
    // Initial measure
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => {
      ro.disconnect();
    };
  }, []);

  return [ref, size];
}
