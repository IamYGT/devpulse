import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function AnimatedCounter({
  value,
  duration = 800,
  prefix = "",
  suffix = "",
}: Props) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const fromRef = useRef<number>(0);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = fromRef.current + (value - fromRef.current) * eased;

      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  // Format: show decimals only if the target value has them
  const isInteger = Number.isInteger(value);
  const formatted = isInteger
    ? Math.round(display).toLocaleString("tr-TR")
    : display.toFixed(1);

  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontVariantNumeric: "tabular-nums",
        fontFeatureSettings: '"tnum"',
      }}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
