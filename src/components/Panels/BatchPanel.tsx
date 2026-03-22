import { useState, useCallback, useRef } from 'react';
import { EditParams, ExportSettings, DEFAULT_PARAMS } from '../../types/editor';
import { PanelSection } from '../UI/PanelSection';
import { WebGLEngine } from '../../utils/webgl';

interface Props {
  params: EditParams;
  exportSettings: ExportSettings;
}

interface BatchFile {
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

export function BatchPanel({ params, exportSettings }: Props) {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const handleFiles = useCallback((fileList: FileList) => {
    const imageFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    setFiles(imageFiles.map(f => ({ file: f, status: 'pending' as const })));
  }, []);

  const processAll = useCallback(async () => {
    if (files.length === 0) return;
    setProcessing(true);
    abortRef.current = false;
    setProgress({ current: 0, total: files.length });

    // Create offscreen canvas + WebGL engine for batch processing
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 1;
    offCanvas.height = 1;
    let engine: WebGLEngine | null = null;
    try {
      engine = new WebGLEngine(offCanvas);
    } catch (err) {
      setProcessing(false);
      return;
    }

    const hasParamChanges = JSON.stringify(params) !== JSON.stringify(DEFAULT_PARAMS);

    for (let i = 0; i < files.length; i++) {
      if (abortRef.current) break;

      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'processing' } : f
      ));
      setProgress({ current: i + 1, total: files.length });

      try {
        const img = await loadImage(files[i].file);

        // Apply max long edge
        let processImg: HTMLImageElement | HTMLCanvasElement = img;
        if (exportSettings.maxLongEdge) {
          const longEdge = Math.max(img.width, img.height);
          if (longEdge > exportSettings.maxLongEdge) {
            const scale = exportSettings.maxLongEdge / longEdge;
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = Math.round(img.width * scale);
            tmpCanvas.height = Math.round(img.height * scale);
            const ctx = tmpCanvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, tmpCanvas.width, tmpCanvas.height);
            processImg = tmpCanvas;
          }
        }

        engine.loadImage(processImg);

        if (hasParamChanges) {
          engine.render(params);
        } else {
          engine.render(DEFAULT_PARAMS);
        }

        // Export
        const resultCanvas = engine.getCanvas();
        const rotated = params.rotation === 90 || params.rotation === 270;
        const w = rotated ? resultCanvas.height : resultCanvas.width;
        const h = rotated ? resultCanvas.width : resultCanvas.height;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = w;
        exportCanvas.height = h;
        const ctx = exportCanvas.getContext('2d')!;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate((params.rotation * Math.PI) / 180);
        ctx.scale(params.flipH ? -1 : 1, params.flipV ? -1 : 1);
        const drawW = rotated ? h : w;
        const drawH = rotated ? w : h;
        ctx.drawImage(resultCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        const mimeType = exportSettings.format === 'png' ? 'image/png' : 'image/jpeg';
        const quality = exportSettings.format === 'jpeg' ? exportSettings.quality / 100 : undefined;

        const blob = await new Promise<Blob | null>(resolve => exportCanvas.toBlob(resolve, mimeType, quality));
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const ext = exportSettings.format === 'png' ? 'png' : 'jpg';
          const baseName = files[i].file.name.replace(/\.[^.]+$/, '');
          a.href = url;
          a.download = `${baseName}_edit.${ext}`;
          a.click();
          URL.revokeObjectURL(url);
        }

        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'done' } : f
        ));
      } catch (err) {
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'error', error: String(err) } : f
        ));
      }
    }

    engine.destroy();
    setProcessing(false);
  }, [files, params, exportSettings]);

  const handleAbort = () => {
    abortRef.current = true;
  };

  const doneCount = files.filter(f => f.status === 'done').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <PanelSection title="일괄 편집" defaultOpen={false}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />

      {files.length === 0 ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full text-xs bg-surface hover:bg-border text-text-secondary py-2 rounded transition-colors"
        >
          이미지 여러 장 선택
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-text-secondary">
            {files.length}장 선택됨 · 완료 {doneCount}{errorCount > 0 && ` · 오류 ${errorCount}`}
          </div>

          {/* File list */}
          <div className="max-h-28 overflow-y-auto flex flex-col gap-0.5">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <span className={
                  f.status === 'done' ? 'text-green-400' :
                  f.status === 'error' ? 'text-red-400' :
                  f.status === 'processing' ? 'text-accent' :
                  'text-text-secondary'
                }>
                  {f.status === 'done' ? '✓' : f.status === 'error' ? '✗' : f.status === 'processing' ? '⟳' : '○'}
                </span>
                <span className="text-text-secondary truncate flex-1">{f.file.name}</span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {processing && (
            <div className="w-full bg-surface rounded-full h-1.5">
              <div
                className="bg-accent h-1.5 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          )}

          <div className="text-[10px] text-text-secondary">
            현재 편집 파라미터가 모든 이미지에 적용됩니다
          </div>

          <div className="flex gap-1">
            {!processing ? (
              <>
                <button
                  onClick={processAll}
                  className="flex-1 text-xs bg-accent hover:bg-accent-hover text-white py-1.5 rounded transition-colors"
                >
                  일괄 적용 및 저장
                </button>
                <button
                  onClick={() => { setFiles([]); }}
                  className="text-xs bg-surface hover:bg-border text-text-secondary px-2 py-1.5 rounded transition-colors"
                >
                  초기화
                </button>
              </>
            ) : (
              <button
                onClick={handleAbort}
                className="flex-1 text-xs bg-red-600 hover:bg-red-700 text-white py-1.5 rounded transition-colors"
              >
                중단
              </button>
            )}
          </div>
        </div>
      )}
    </PanelSection>
  );
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load: ${file.name}`));
    };
    img.src = url;
  });
}
