import { EditParams } from '../../types/editor';
import { Slider } from '../UI/Slider';
import { PanelSection } from '../UI/PanelSection';

interface Props {
  params: EditParams;
  onChange: (params: EditParams) => void;
}

export function ColorAdjustments({ params, onChange }: Props) {
  const set = (key: keyof EditParams, value: number) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <PanelSection title="색보정">
      <Slider label="색온도" value={params.colorTemp} min={2000} max={10000} step={100} unit="K" onChange={v => set('colorTemp', v)} />
      <Slider label="채도" value={params.saturation} min={-100} max={100} onChange={v => set('saturation', v)} />
      <Slider label="자연채도" value={params.vibrance} min={-100} max={100} onChange={v => set('vibrance', v)} />
    </PanelSection>
  );
}
