import { CropState } from '../../types/editor';
import { PanelSection } from '../UI/PanelSection';

interface Props {
  crop: CropState | null;
  onCropChange: (crop: CropState | null) => void;
  onApply: () => void;
  onCancel: () => void;
  imageSize: { width: number; height: number } | null;
}

const ASPECT_RATIOS: Array<{ label: string; value: CropState['aspectRatio'] }> = [
  { label: '자유', value: 'free' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '16:9', value: '16:9' },
  { label: '3:2', value: '3:2' },
  { label: '9:16', value: '9:16' },
];

export function CropPanel({ crop, onCropChange, onApply, onCancel, imageSize }: Props) {
  const startCrop = (ratio: CropState['aspectRatio']) => {
    if (!imageSize) return;
    const { width, height } = imageSize;

    let cw = width;
    let ch = height;

    const ratioMap: Record<string, number> = {
      '1:1': 1,
      '4:3': 4 / 3,
      '16:9': 16 / 9,
      '3:2': 3 / 2,
      '9:16': 9 / 16,
    };

    if (ratio !== 'free' && ratioMap[ratio]) {
      const ar = ratioMap[ratio];
      if (width / height > ar) {
        cw = Math.round(height * ar);
        ch = height;
      } else {
        cw = width;
        ch = Math.round(width / ar);
      }
    }

    onCropChange({
      x: Math.round((width - cw) / 2),
      y: Math.round((height - ch) / 2),
      width: cw,
      height: ch,
      aspectRatio: ratio,
    });
  };

  return (
    <PanelSection title="자르기" defaultOpen={false}>
      {!crop ? (
        <>
          <div className="text-[10px] text-text-secondary mb-2">비율을 선택하면 자르기가 시작됩니다</div>
          <div className="grid grid-cols-3 gap-1">
            {ASPECT_RATIOS.map(ar => (
              <button
                key={ar.value}
                onClick={() => startCrop(ar.value)}
                disabled={!imageSize}
                className="text-[10px] py-1.5 bg-surface hover:bg-border text-text-secondary hover:text-text-primary rounded transition-colors disabled:opacity-40"
              >
                {ar.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="text-[10px] text-text-secondary mb-2">
            {crop.width} × {crop.height} ({crop.aspectRatio})
          </div>
          <div className="grid grid-cols-3 gap-1 mb-2">
            {ASPECT_RATIOS.map(ar => (
              <button
                key={ar.value}
                onClick={() => startCrop(ar.value)}
                className={`text-[10px] py-1.5 rounded transition-colors ${
                  crop.aspectRatio === ar.value
                    ? 'bg-accent text-white'
                    : 'bg-surface hover:bg-border text-text-secondary'
                }`}
              >
                {ar.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onApply}
              className="flex-1 text-xs bg-accent hover:bg-accent-hover text-white py-1.5 rounded transition-colors"
            >
              적용
            </button>
            <button
              onClick={onCancel}
              className="flex-1 text-xs bg-surface hover:bg-border text-text-secondary py-1.5 rounded transition-colors"
            >
              취소
            </button>
          </div>
        </>
      )}
    </PanelSection>
  );
}
