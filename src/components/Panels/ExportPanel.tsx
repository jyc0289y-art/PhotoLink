import { useState, useEffect, useRef } from 'react';
import { ExportSettings } from '../../types/editor';
import { PanelSection } from '../UI/PanelSection';
import { Slider } from '../UI/Slider';

interface Props {
  exportSettings: ExportSettings;
  onExportSettingsChange: (settings: ExportSettings) => void;
  onExport: () => void;
  imageLoaded: boolean;
  originalSize: { width: number; height: number } | null;
}

export function ExportPanel({ exportSettings, onExportSettingsChange, onExport, imageLoaded, originalSize }: Props) {
  const [estimatedSize, setEstimatedSize] = useState<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!originalSize) return;
    // Rough estimate
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const pixels = originalSize.width * originalSize.height;
      if (exportSettings.format === 'png') {
        setEstimatedSize(`~${(pixels * 3 / 1024 / 1024).toFixed(1)} MB`);
      } else {
        const factor = exportSettings.quality / 100;
        const bytes = pixels * 3 * factor * 0.15;
        if (bytes > 1024 * 1024) {
          setEstimatedSize(`~${(bytes / 1024 / 1024).toFixed(1)} MB`);
        } else {
          setEstimatedSize(`~${(bytes / 1024).toFixed(0)} KB`);
        }
      }
    }, 200);
  }, [exportSettings, originalSize]);

  return (
    <PanelSection title="내보내기" defaultOpen={false}>
      <div className="flex gap-2">
        {(['jpeg', 'png'] as const).map(fmt => (
          <button
            key={fmt}
            onClick={() => onExportSettingsChange({ ...exportSettings, format: fmt })}
            className={`flex-1 py-1 text-xs rounded transition-colors ${
              exportSettings.format === fmt
                ? 'bg-accent text-white'
                : 'bg-panel-light text-text-secondary hover:text-text-primary'
            }`}
          >
            {fmt.toUpperCase()}
          </button>
        ))}
      </div>
      {exportSettings.format === 'jpeg' && (
        <Slider
          label="품질"
          value={exportSettings.quality}
          min={1}
          max={100}
          onChange={v => onExportSettingsChange({ ...exportSettings, quality: v })}
        />
      )}
      <div className="flex items-center gap-2 text-xs">
        <label className="text-text-secondary">긴 변 제한:</label>
        <select
          value={exportSettings.maxLongEdge ?? 'none'}
          onChange={e => {
            const v = e.target.value;
            onExportSettingsChange({
              ...exportSettings,
              maxLongEdge: v === 'none' ? null : parseInt(v),
            });
          }}
          className="bg-panel-light text-text-primary text-xs rounded px-2 py-1 border border-border"
        >
          <option value="none">원본</option>
          <option value="3840">3840px (4K)</option>
          <option value="1920">1920px (FHD)</option>
          <option value="1280">1280px (HD)</option>
          <option value="1080">1080px (인스타)</option>
          <option value="800">800px (웹)</option>
        </select>
      </div>
      {estimatedSize && (
        <div className="text-[10px] text-text-secondary">예상 크기: {estimatedSize}</div>
      )}
      <button
        onClick={onExport}
        disabled={!imageLoaded}
        className="w-full py-2 mt-1 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded transition-colors disabled:opacity-40"
      >
        다운로드
      </button>
    </PanelSection>
  );
}
