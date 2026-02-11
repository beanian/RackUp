import { useRef, useEffect } from 'react';

interface Props {
  value: number;
  duration?: number;
  className?: string;
}

export default function AnimatedNumber({ value, duration = 400, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const from = prevRef.current;
    const to = value;
    prevRef.current = value;

    if (from === to) {
      el.textContent = String(to);
      return;
    }

    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out: t * (2 - t)
      const eased = progress * (2 - progress);
      const current = Math.round(from + (to - from) * eased);
      el.textContent = String(current);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
