import { useState, useRef, useCallback, useEffect } from 'react';
import { CropState } from '../../types/editor';

interface Props {
  crop: CropState;
  imageSize: { width: number; height: number };
  canvasEl: HTMLCanvasElement | null;
  onChange: (crop: CropState) => void;
  onApply: () => void;
  onCancel: () => void;
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;

const HANDLE_SIZE = 8;

const ASPECT_MAP: Record<string, number | null> = {
  'free': null, '1:1': 1, '4:3': 4/3, '16:9': 16/9, '3:2': 3/2, '9:16': 9/16,
};

export function CropOverlay({ crop, imageSize, canvasEl, onChange, onApply, onCancel }: Props) {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const startRef = useRef({ x: 0, y: 0, crop: { ...crop } });

  const getScale = useCallback(() => {
    if (!canvasEl) return { sx: 1, sy: 1, ox: 0, oy: 0 };
    const rect = canvasEl.getBoundingClientRect();
    const parent = canvasEl.parentElement!.getBoundingClientRect();
    return {
      sx: rect.width / imageSize.width,
      sy: rect.height / imageSize.height,
      ox: rect.left - parent.left,
      oy: rect.top - parent.top,
    };
  }, [imageSize, canvasEl]);

  const handleMouseDown = useCallback((e: React.MouseEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    setDragMode(mode);
    startRef.current = { x: e.clientX, y: e.clientY, crop: { ...crop } };
  }, [crop]);

  useEffect(() => {
    if (!dragMode) return;

    const ar = ASPECT_MAP[crop.aspectRatio];

    const handleMove = (e: MouseEvent) => {
      const { sx, sy } = getScale();
      const dx = (e.clientX - startRef.current.x) / sx;
      const dy = (e.clientY - startRef.current.y) / sy;
      const sc = startRef.current.crop;

      let nx = sc.x, ny = sc.y, nw = sc.width, nh = sc.height;

      if (dragMode === 'move') {
        nx = Math.max(0, Math.min(imageSize.width - sc.width, Math.round(sc.x + dx)));
        ny = Math.max(0, Math.min(imageSize.height - sc.height, Math.round(sc.y + dy)));
      } else {
        if (dragMode.includes('w')) { nx = sc.x + dx; nw = sc.width - dx; }
        if (dragMode.includes('e')) { nw = sc.width + dx; }
        if (dragMode.includes('n')) { ny = sc.y + dy; nh = sc.height - dy; }
        if (dragMode.includes('s')) { nh = sc.height + dy; }

        if (ar != null) {
          if (dragMode.includes('e') || dragMode.includes('w')) {
            nh = nw / ar;
            if (dragMode.includes('n')) ny = sc.y + sc.height - nh;
          } else {
            nw = nh * ar;
            if (dragMode.includes('w')) nx = sc.x + sc.width - nw;
          }
        }

        nw = Math.max(20, nw);
        nh = Math.max(20, nh);
        nx = Math.max(0, Math.min(imageSize.width - nw, nx));
        ny = Math.max(0, Math.min(imageSize.height - nh, ny));
      }

      onChange({ ...crop, x: Math.round(nx), y: Math.round(ny), width: Math.round(nw), height: Math.round(nh) });
    };

    const handleUp = () => setDragMode(null);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragMode, crop, imageSize, getScale, onChange]);

  const setAspect = (ratio: CropState['aspectRatio']) => {
    const ar = ASPECT_MAP[ratio];
    let w = crop.width, h = crop.height;
    if (ar) {
      if (w / h > ar) { w = h * ar; } else { h = w / ar; }
      w = Math.min(w, imageSize.width);
      h = Math.min(h, imageSize.height);
    }
    const x = Math.max(0, Math.min(imageSize.width - w, crop.x));
    const y = Math.max(0, Math.min(imageSize.height - h, crop.y));
    onChange({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h), aspectRatio: ratio });
  };

  const { sx, sy, ox, oy } = getScale();
  const left = ox + crop.x * sx;
  const top = oy + crop.y * sy;
  const width = crop.width * sx;
  const height = crop.height * sy;

  const handles: Array<{ mode: DragMode; className: string; cursor: string }> = [
    { mode: 'nw', className: '-top-1 -left-1', cursor: 'nwse-resize' },
    { mode: 'ne', className: '-top-1 -right-1', cursor: 'nesw-resize' },
    { mode: 'sw', className: '-bottom-1 -left-1', cursor: 'nesw-resize' },
    { mode: 'se', className: '-bottom-1 -right-1', cursor: 'nwse-resize' },
  ];

  return (
    <div className="absolute inset-0 z-20">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50 pointer-events-none" />

      {/* Crop region */}
      <div
        className="absolute border-2 border-white/80 cursor-move"
        style={{
          left, top, width, height,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
        }}
        onMouseDown={e => handleMouseDown(e, 'move')}
      >
        {/* Rule of thirds */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-0 right-0 border-t border-white/25" />
          <div className="absolute top-2/3 left-0 right-0 border-t border-white/25" />
          <div className="absolute top-0 bottom-0 left-1/3 border-l border-white/25" />
          <div className="absolute top-0 bottom-0 left-2/3 border-l border-white/25" />
        </div>

        {/* Corner handles */}
        {handles.map(h => (
          <div
            key={h.mode}
            className={`absolute bg-white border border-gray-500 ${h.className}`}
            style={{ width: HANDLE_SIZE, height: HANDLE_SIZE, cursor: h.cursor }}
            onMouseDown={e => handleMouseDown(e, h.mode)}
          />
        ))}
      </div>

      {/* Toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-panel/90 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
        <span className="text-[10px] text-text-secondary mr-1">비율:</span>
        {Object.keys(ASPECT_MAP).map(r => (
          <button
            key={r}
            onClick={() => setAspect(r as CropState['aspectRatio'])}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              crop.aspectRatio === r ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {r === 'free' ? '자유' : r}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        <span className="text-[10px] text-text-secondary">{crop.width}×{crop.height}</span>
        <div className="w-px h-4 bg-border mx-1" />
        <button onClick={onApply} className="px-3 py-0.5 text-[10px] bg-accent hover:bg-accent-hover text-white rounded">적용</button>
        <button onClick={onCancel} className="px-3 py-0.5 text-[10px] text-text-secondary hover:text-text-primary rounded">취소</button>
      </div>
    </div>
  );
}
