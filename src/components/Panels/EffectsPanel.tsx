import { EditParams } from '../../types/editor';
import { Slider } from '../UI/Slider';
import { PanelSection } from '../UI/PanelSection';

interface Props {
  params: EditParams;
  onChange: (params: EditParams) => void;
}

export function EffectsPanel({ params, onChange }: Props) {
  return (
    <PanelSection title="효과" defaultOpen={false}>
      <Slider
        label="클래리티"
        value={params.clarity}
        min={-100}
        max={100}
        onChange={v => onChange({ ...params, clarity: v })}
      />
      <div className="text-[10px] text-text-secondary uppercase tracking-wider mt-2">필름 그레인</div>
      <Slider
        label="강도"
        value={params.grain.amount}
        min={0}
        max={100}
        onChange={v => onChange({ ...params, grain: { ...params.grain, amount: v } })}
      />
      <Slider
        label="크기"
        value={params.grain.size}
        min={0}
        max={100}
        onChange={v => onChange({ ...params, grain: { ...params.grain, size: v } })}
      />
      <div className="mt-2 pt-2 border-t border-border">
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={params.selectiveColor.enabled}
            onChange={e => onChange({
              ...params,
              selectiveColor: { ...params.selectiveColor, enabled: e.target.checked },
            })}
            className="accent-accent"
          />
          선택적 컬러
        </label>
        {params.selectiveColor.enabled && (
          <div className="mt-2 flex flex-col gap-2">
            <Slider
              label="탈색 강도"
              value={params.selectiveColor.desaturateStrength}
              min={0}
              max={100}
              onChange={v => onChange({
                ...params,
                selectiveColor: { ...params.selectiveColor, desaturateStrength: v },
              })}
            />
            <div className="text-[10px] text-text-secondary">보존 색상 범위 (프리셋으로 설정)</div>
          </div>
        )}
      </div>
    </PanelSection>
  );
}
