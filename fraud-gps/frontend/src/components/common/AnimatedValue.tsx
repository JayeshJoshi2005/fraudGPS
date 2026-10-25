import { useEffect, useState } from 'react';
import { formatCurrency } from '../../utils/formatters';

// Currency interpolation stays in integer paise, including values above 2^53.
export function AnimatedValue({ value, money = false }: { value: string; money?: boolean }) {
  const [state, setState] = useState({ source: value, progress: 0 });
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let start: number | undefined;
    const finish = () => {
      cancelAnimationFrame(frame);
      setState({ source: value, progress: 1 });
    };
    const tick = (now: number) => {
      start ??= now;
      const progress = Math.min(1, (now - start) / 400);
      setState({ source: value, progress });
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const changed = () => {
      if (motion.matches) finish();
    };
    if (motion.matches) finish();
    else frame = requestAnimationFrame(tick);
    motion.addEventListener('change', changed);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener('change', changed);
    };
  }, [value]);
  const progress = state.source === value ? state.progress : 0;
  const final = money ? formatCurrency(value) : value;
  let display = final;
  if (progress < 1 && /^\d+(?:\.\d{1,2})?$/.test(value)) {
    const [whole, fraction = ''] = value.split('.');
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    const scaled = (cents * BigInt(Math.floor((1 - (1 - progress) ** 3) * 1000))) / 1000n;
    const intermediate = `${scaled / 100n}.${String(scaled % 100n).padStart(2, '0')}`;
    display = money ? formatCurrency(intermediate) : intermediate;
  }
  return (
    <span
      className="animated-value"
      aria-label={final}
      data-final={final}
      data-complete={progress === 1}
    >
      <span className="number-display" aria-hidden="true">
        {display}
      </span>
    </span>
  );
}
