import { EditParams } from '../../types/editor';
import { Slider } from '../UI/Slider';
import { PanelSection } from '../UI/PanelSection';

interface Props {
  params: EditParams;
  onChange: (params: EditParams) => void;
}

export function VignettePanel({ params, onChange }: Props) {
  const v = params.vignette;

  const update = (key: keyof typeof v, value: number) => {
    onChange({ ...params, vignette: { ...v, [key]: value } });
  };

  return (
    <PanelSection title="비네팅" defaultOpen={false}>
      <Slider label="강도" value={v.amount} min={0} max={100} onChange={val => update('amount', val)} />
      <Slider label="중심점" value={v.midpoint} min={0} max={100} onChange={val => update('midpoint', val)} />
      <Slider label="원형도" value={v.roundness} min={-100} max={100} onChange={val => update('roundness', val)} />
      <Slider label="페더" value={v.feather} min={0} max={100} onChange={val => update('feather', val)} />
    </PanelSection>
  );
}
