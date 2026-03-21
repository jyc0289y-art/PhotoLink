import { EditParams } from '../../types/editor';
import { Slider } from '../UI/Slider';
import { PanelSection } from '../UI/PanelSection';

interface Props {
  params: EditParams;
  onChange: (params: EditParams) => void;
}

export function SplitToningPanel({ params, onChange }: Props) {
  const st = params.splitToning;
  const set = (key: string, value: number) => {
    onChange({
      ...params,
      splitToning: { ...st, [key]: value },
    });
  };

  return (
    <PanelSection title="스플릿 토닝" defaultOpen={false}>
      <div className="text-[10px] text-text-secondary uppercase tracking-wider mt-1">섀도</div>
      <Slider label="색상" value={st.shadowHue} min={0} max={360} onChange={v => set('shadowHue', v)} />
      <Slider label="채도" value={st.shadowSat} min={0} max={100} onChange={v => set('shadowSat', v)} />
      <div className="text-[10px] text-text-secondary uppercase tracking-wider mt-2">하이라이트</div>
      <Slider label="색상" value={st.highlightHue} min={0} max={360} onChange={v => set('highlightHue', v)} />
      <Slider label="채도" value={st.highlightSat} min={0} max={100} onChange={v => set('highlightSat', v)} />
      <div className="mt-2" />
      <Slider label="밸런스" value={st.balance} min={-100} max={100} onChange={v => set('balance', v)} />
    </PanelSection>
  );
}
