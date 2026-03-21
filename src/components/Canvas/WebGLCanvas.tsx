import { useEffect, useRef } from 'react';
import { WebGLEngine } from '../../utils/webgl';
import { EditParams } from '../../types/editor';

interface Props {
  image: HTMLImageElement | null;
  params: EditParams;
  showOriginal: boolean;
  onEngineReady: (engine: WebGLEngine) => void;
}

export function WebGLCanvas({ image, params, showOriginal, onEngineReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WebGLEngine | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const onEngineReadyRef = useRef(onEngineReady);
  onEngineReadyRef.current = onEngineReady;

  // Initialize engine ONCE (stable ref via useRef pattern)
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new WebGLEngine(canvasRef.current);
    engineRef.current = engine;
    onEngineReadyRef.current(engine);
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load image when it changes
  useEffect(() => {
    if (!image || !engineRef.current) return;
    engineRef.current.loadImage(image);

    // Store original for before/after comparison
    const origCanvas = document.createElement('canvas');
    origCanvas.width = image.width;
    origCanvas.height = image.height;
    const ctx = origCanvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    originalCanvasRef.current = origCanvas;

    // Trigger initial render
    engineRef.current.render(params);
  }, [image]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render on every param change
  useEffect(() => {
    if (!engineRef.current || !image) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (engineRef.current) {
        engineRef.current.render(params);
      }
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [params, image]);

  return (
    <div className="flex-1 flex items-center justify-center overflow-hidden bg-surface relative">
      <canvas
        ref={canvasRef}
        className="max-w-full max-h-full object-contain"
        style={{
          display: image ? 'block' : 'none',
          transform: `rotate(${params.rotation}deg) scaleX(${params.flipH ? -1 : 1}) scaleY(${params.flipV ? -1 : 1})`,
        }}
      />
      {showOriginal && originalCanvasRef.current && image && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface">
          <img
            src={originalCanvasRef.current.toDataURL()}
            alt="original"
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `rotate(${params.rotation}deg) scaleX(${params.flipH ? -1 : 1}) scaleY(${params.flipV ? -1 : 1})`,
            }}
          />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full">
            원본
          </div>
        </div>
      )}
      {!image && (
        <div className="text-text-secondary text-sm">이미지를 열어주세요</div>
      )}
    </div>
  );
}
