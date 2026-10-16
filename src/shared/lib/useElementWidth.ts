import { useLayoutEffect, useRef, useState } from 'react';

/** The rendered width of an element, kept current with a ResizeObserver.
    Charts draw at real pixel sizes instead of scaling a viewBox, so text stays
    at its real size (the 11px type floor holds on a phone). */
export function useElementWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}
