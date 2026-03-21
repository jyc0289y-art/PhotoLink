import { EditParams } from '../../types/editor';
import { Slider } from '../UI/Slider';
import { PanelSection } from '../UI/PanelSection';

interface Props {
  params: EditParams;
  onChange: (params: EditParams) => void;
}

export function BasicAdjustments({ params, onChange }: Props) {
  const set = (key: keyof EditParams, value: number) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <PanelSection title="기본 보정">
      <Slider label="노출" value={params.exposure} min={-3} max={3} step={0.1} unit=" EV" onChange={v => set('exposure', v)} />
      <Slider label="콘트라스트" value={params.contrast} min={-100} max={100} onChange={v => set('contrast', v)} />
      <Slider label="하이라이트" value={params.highlights} min={-100} max={100} onChange={v => set('highlights', v)} />
      <Slider label="섀도" value={params.shadows} min={-100} max={100} onChange={v => set('shadows', v)} />
    </PanelSection>
  );
}
