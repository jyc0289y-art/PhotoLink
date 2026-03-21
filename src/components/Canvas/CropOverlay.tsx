import { CropState } from '../../types/editor';

interface Props {
  imageHeight: number;
  crop: CropState;
  onChange: (crop: CropState) => void;
  onApply: () => void;
  onCancel: () => void;
}

const ASPECT_RATIOS: Record<string, number | null> = {
  'free': null,
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '3:2': 3 / 2,
  '9:16': 9 / 16,
};

export function CropOverlay({ imageHeight, crop, onChange, onApply, onCancel }: Props) {
  const setAspect = (ratio: CropState['aspectRatio']) => {
    const ar = ASPECT_RATIOS[ratio];
    if (ar) {
      let w = crop.width;
      let h = w / ar;
      if (h > imageHeight) {
        h = imageHeight;
        w = h * ar;
      }
      onChange({ ...crop, aspectRatio: ratio, width: Math.round(w), height: Math.round(h) });
    } else {
      onChange({ ...crop, aspectRatio: ratio });
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
      <div className="pointer-events-auto bg-panel/90 backdrop-blur-sm rounded-lg p-3 mb-3 flex items-center gap-2">
        <span className="text-xs text-text-secondary mr-1">비율:</span>
        {Object.keys(ASPECT_RATIOS).map(r => (
          <button
            key={r}
            onClick={() => setAspect(r as CropState['aspectRatio'])}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              crop.aspectRatio === r ? 'bg-accent text-white' : 'bg-panel-light text-text-secondary hover:text-text-primary'
            }`}
          >
            {r === 'free' ? '자유' : r}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        <button onClick={onApply} className="px-3 py-0.5 text-xs bg-accent hover:bg-accent-hover text-white rounded transition-colors">
          적용
        </button>
        <button onClick={onCancel} className="px-3 py-0.5 text-xs bg-panel-light text-text-secondary hover:text-text-primary rounded transition-colors">
          취소
        </button>
      </div>
      <div className="text-[10px] text-text-secondary">
        {crop.width} × {crop.height}px
      </div>
    </div>
  );
}
