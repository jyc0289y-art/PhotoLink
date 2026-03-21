import { EditParams } from '../../types/editor';
import { PanelSection } from '../UI/PanelSection';

interface Props {
  params: EditParams;
  onChange: (params: EditParams) => void;
}

export function TransformPanel({ params, onChange }: Props) {
  const rotate = (deg: number) => {
    onChange({ ...params, rotation: ((params.rotation + deg) % 360 + 360) % 360 });
  };

  return (
    <PanelSection title="변환" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => rotate(-90)}
          className="py-1.5 text-xs bg-panel-light hover:bg-border rounded transition-colors text-text-secondary hover:text-text-primary"
        >
          ↺ 90° 반시계
        </button>
        <button
          onClick={() => rotate(90)}
          className="py-1.5 text-xs bg-panel-light hover:bg-border rounded transition-colors text-text-secondary hover:text-text-primary"
        >
          ↻ 90° 시계
        </button>
        <button
          onClick={() => onChange({ ...params, flipH: !params.flipH })}
          className={`py-1.5 text-xs rounded transition-colors ${
            params.flipH ? 'bg-accent text-white' : 'bg-panel-light text-text-secondary hover:text-text-primary hover:bg-border'
          }`}
        >
          ↔ 좌우 반전
        </button>
        <button
          onClick={() => onChange({ ...params, flipV: !params.flipV })}
          className={`py-1.5 text-xs rounded transition-colors ${
            params.flipV ? 'bg-accent text-white' : 'bg-panel-light text-text-secondary hover:text-text-primary hover:bg-border'
          }`}
        >
          ↕ 상하 반전
        </button>
      </div>
    </PanelSection>
  );
}
