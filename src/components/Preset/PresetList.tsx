import { Preset } from '../../types/editor';
import { PanelSection } from '../UI/PanelSection';

interface Props {
  presets: Preset[];
  onApply: (preset: Preset) => void;
  onDelete?: (id: string) => void;
  onSave: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export function PresetList({ presets, onApply, onDelete, onSave, onExport, onImport }: Props) {
  return (
    <PanelSection title="프리셋" defaultOpen={false}>
      <div className="flex gap-1 mb-2">
        <button
          onClick={onSave}
          className="flex-1 py-1 text-[10px] bg-accent hover:bg-accent-hover text-white rounded transition-colors"
        >
          현재값 저장
        </button>
        <button
          onClick={onExport}
          className="py-1 px-2 text-[10px] bg-panel-light hover:bg-border text-text-secondary rounded transition-colors"
        >
          내보내기
        </button>
        <label className="py-1 px-2 text-[10px] bg-panel-light hover:bg-border text-text-secondary rounded transition-colors cursor-pointer">
          가져오기
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
            }}
          />
        </label>
      </div>
      <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
        {presets.map(preset => (
          <div
            key={preset.id}
            className="group flex items-center gap-1"
          >
            <button
              onClick={() => onApply(preset)}
              className="flex-1 text-left px-2 py-1.5 text-xs bg-panel-light hover:bg-border rounded transition-colors"
              title={preset.description}
            >
              <div className="text-text-primary">{preset.name}</div>
              <div className="text-[10px] text-text-secondary truncate">{preset.description}</div>
            </button>
            {!preset.isBuiltIn && onDelete && (
              <button
                onClick={() => onDelete(preset.id)}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs px-1 transition-opacity"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </PanelSection>
  );
}
