import { useState } from 'react';
import { EditParams, HSLChannel } from '../../types/editor';
import { Slider } from '../UI/Slider';
import { PanelSection } from '../UI/PanelSection';

interface Props {
  params: EditParams;
  onChange: (params: EditParams) => void;
}

const CHANNELS: { key: HSLChannel; label: string; color: string }[] = [
  { key: 'red', label: '레드', color: '#ef4444' },
  { key: 'orange', label: '오렌지', color: '#f97316' },
  { key: 'yellow', label: '옐로', color: '#eab308' },
  { key: 'green', label: '그린', color: '#22c55e' },
  { key: 'aqua', label: '아쿠아', color: '#06b6d4' },
  { key: 'blue', label: '블루', color: '#3b82f6' },
  { key: 'purple', label: '퍼플', color: '#8b5cf6' },
  { key: 'magenta', label: '마젠타', color: '#ec4899' },
];

export function HSLPanel({ params, onChange }: Props) {
  const [activeChannel, setActiveChannel] = useState<HSLChannel>('red');

  const ch = params.hsl[activeChannel];
  const setHSL = (prop: 'hue' | 'saturation' | 'luminance', value: number) => {
    onChange({
      ...params,
      hsl: {
        ...params.hsl,
        [activeChannel]: { ...ch, [prop]: value },
      },
    });
  };

  return (
    <PanelSection title="HSL" defaultOpen={false}>
      <div className="flex flex-wrap gap-1 mb-1">
        {CHANNELS.map(c => (
          <button
            key={c.key}
            onClick={() => setActiveChannel(c.key)}
            className={`w-6 h-6 rounded-full border-2 transition-all ${
              activeChannel === c.key ? 'border-white scale-110' : 'border-transparent opacity-60'
            }`}
            style={{ backgroundColor: c.color }}
            title={c.label}
          />
        ))}
      </div>
      <div className="text-xs text-text-secondary mb-1">{CHANNELS.find(c => c.key === activeChannel)?.label}</div>
      <Slider label="색상" value={ch.hue} min={-30} max={30} onChange={v => setHSL('hue', v)} />
      <Slider label="채도" value={ch.saturation} min={-100} max={100} onChange={v => setHSL('saturation', v)} />
      <Slider label="밝기" value={ch.luminance} min={-100} max={100} onChange={v => setHSL('luminance', v)} />
    </PanelSection>
  );
}
