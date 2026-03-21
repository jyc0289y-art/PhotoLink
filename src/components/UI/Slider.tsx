import { useCallback } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step = 1, unit = '', onChange }: SliderProps) {
  const handleDoubleClick = useCallback(() => {
    const defaultVal = min < 0 ? 0 : min;
    onChange(defaultVal);
  }, [min, onChange]);

  const displayValue = step < 1 ? value.toFixed(1) : Math.round(value);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary font-mono text-[11px]">{displayValue}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        onDoubleClick={handleDoubleClick}
        className="w-full"
      />
    </div>
  );
}
