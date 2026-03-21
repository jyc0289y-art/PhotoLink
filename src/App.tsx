import { useState, useCallback, useRef, useEffect } from 'react';
import { WebGLCanvas } from './components/Canvas/WebGLCanvas';
import { BasicAdjustments } from './components/Panels/BasicAdjustments';
import { ColorAdjustments } from './components/Panels/ColorAdjustments';
import { HSLPanel } from './components/Panels/HSLPanel';
import { SplitToningPanel } from './components/Panels/SplitToningPanel';
import { EffectsPanel } from './components/Panels/EffectsPanel';
import { TransformPanel } from './components/Panels/TransformPanel';
import { ExportPanel } from './components/Panels/ExportPanel';
import { AIPanel } from './components/Panels/AIPanel';
import { PresetList } from './components/Preset/PresetList';
import { UploadScreen } from './components/UI/UploadScreen';
import { useEditHistory } from './hooks/useEditHistory';
import { usePresets } from './hooks/usePresets';
import { DEFAULT_PARAMS, Preset, ExportSettings } from './types/editor';
import { WebGLEngine } from './utils/webgl';
import { readExif, PhotoMetadata, formatMetadataSummary } from './utils/exif';

function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageInfo, setImageInfo] = useState<{ name: string; width: number; height: number } | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<PhotoMetadata | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({ format: 'jpeg', quality: 85, maxLongEdge: null });
  const engineRef = useRef<WebGLEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { params, setParams, undo, redo, canUndo, canRedo, reset } = useEditHistory();
  const { allPresets, savePreset, deletePreset, exportPresets, importPresets } = usePresets();

  const handleEngineReady = useCallback((engine: WebGLEngine) => {
    engineRef.current = engine;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
        if (e.key === 'o') { e.preventDefault(); fileInputRef.current?.click(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleFileOpen = useCallback(async (files: FileList | File[]) => {
    const file = files[0];
    if (!file) return;

    // Read EXIF metadata from the original file
    const exifData = await readExif(file);
    setMetadata(exifData);

    // Read file as data URL for AI analysis
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);

    const img = new Image();
    img.onload = () => {
      const MAX_PREVIEW = 2048;
      const longEdge = Math.max(img.width, img.height);
      if (longEdge > MAX_PREVIEW) {
        const scale = MAX_PREVIEW / longEdge;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const resizedImg = new Image();
        resizedImg.onload = () => {
          setImage(resizedImg);
          setImageInfo({ name: file.name, width: img.width, height: img.height });
          reset();
        };
        resizedImg.src = canvas.toDataURL();
      } else {
        setImage(img);
        setImageInfo({ name: file.name, width: img.width, height: img.height });
        reset();
      }
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }, [reset]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFileOpen(e.target.files);
    e.target.value = '';
  }, [handleFileOpen]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      handleFileOpen([file]);
    }
  }, [handleFileOpen]);

  const handleExport = useCallback(() => {
    if (!engineRef.current || !image) return;
    const canvas = engineRef.current.getCanvas();

    const rotated = params.rotation === 90 || params.rotation === 270;
    const w = rotated ? canvas.height : canvas.width;
    const h = rotated ? canvas.width : canvas.height;

    let exportW = w;
    let exportH = h;
    if (exportSettings.maxLongEdge) {
      const longEdge = Math.max(w, h);
      if (longEdge > exportSettings.maxLongEdge) {
        const scale = exportSettings.maxLongEdge / longEdge;
        exportW = Math.round(w * scale);
        exportH = Math.round(h * scale);
      }
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;
    const ctx = exportCanvas.getContext('2d')!;

    ctx.save();
    ctx.translate(exportW / 2, exportH / 2);
    ctx.rotate((params.rotation * Math.PI) / 180);
    ctx.scale(params.flipH ? -1 : 1, params.flipV ? -1 : 1);

    const drawW = rotated ? exportH : exportW;
    const drawH = rotated ? exportW : exportH;
    ctx.drawImage(canvas, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const mimeType = exportSettings.format === 'png' ? 'image/png' : 'image/jpeg';
    const quality = exportSettings.format === 'jpeg' ? exportSettings.quality / 100 : undefined;

    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ext = exportSettings.format === 'png' ? 'png' : 'jpg';
      a.href = url;
      a.download = `photolink_${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    }, mimeType, quality);
  }, [image, params, exportSettings]);

  const handleApplyPreset = useCallback((preset: Preset) => {
    setParams(prev => {
      const p = preset.params;
      const next = { ...DEFAULT_PARAMS };
      return {
        ...next,
        ...p,
        hsl: p.hsl ? { ...next.hsl, ...p.hsl } : next.hsl,
        splitToning: p.splitToning ? { ...next.splitToning, ...p.splitToning } : next.splitToning,
        grain: p.grain ? { ...next.grain, ...p.grain } : next.grain,
        selectiveColor: p.selectiveColor ? { ...next.selectiveColor, ...p.selectiveColor } : next.selectiveColor,
        rotation: prev.rotation,
        flipH: prev.flipH,
        flipV: prev.flipV,
      };
    });
  }, [setParams]);

  const handleSavePreset = useCallback(() => {
    const name = prompt('프리셋 이름:');
    if (!name) return;
    const desc = prompt('설명 (선택):') || '';
    savePreset({ name, description: desc, params });
  }, [params, savePreset]);

  return (
    <div
      className="flex flex-col h-full select-none"
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-panel border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-accent">PhotoLink</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={handleInputChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            열기
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="text-xs text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
            title="실행취소 (Ctrl+Z)"
          >
            ↩ 취소
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="text-xs text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
            title="재실행 (Ctrl+Shift+Z)"
          >
            ↪ 재실행
          </button>
          <div className="w-px h-3 bg-border" />
          <button
            onClick={reset}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            초기화
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onMouseDown={() => setShowOriginal(true)}
            onMouseUp={() => setShowOriginal(false)}
            onMouseLeave={() => setShowOriginal(false)}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
            title="누르고 있으면 원본 표시"
          >
            원본 비교
          </button>
          <button
            onClick={handleExport}
            disabled={!image}
            className="text-xs bg-accent hover:bg-accent-hover text-white px-3 py-1 rounded transition-colors disabled:opacity-40"
          >
            내보내기
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Canvas (always mounted) + Upload Screen */}
        <WebGLCanvas
          image={image}
          params={params}
          showOriginal={showOriginal}
          onEngineReady={handleEngineReady}
        />
        {!image && (
          <div className="absolute inset-0 z-10">
            <UploadScreen onFileSelect={handleFileOpen} />
          </div>
        )}

        {/* Right Panel */}
        <div className="w-64 bg-panel border-l border-border overflow-y-auto shrink-0">
          <AIPanel
            params={params}
            onChange={setParams}
            metadata={metadata}
            imageDataUrl={imageDataUrl}
            imageLoaded={!!image}
          />
          <BasicAdjustments params={params} onChange={setParams} />
          <ColorAdjustments params={params} onChange={setParams} />
          <HSLPanel params={params} onChange={setParams} />
          <SplitToningPanel params={params} onChange={setParams} />
          <EffectsPanel params={params} onChange={setParams} />
          <TransformPanel params={params} onChange={setParams} />
          <PresetList
            presets={allPresets}
            onApply={handleApplyPreset}
            onDelete={deletePreset}
            onSave={handleSavePreset}
            onExport={exportPresets}
            onImport={importPresets}
          />
          <ExportPanel
            exportSettings={exportSettings}
            onExportSettingsChange={setExportSettings}
            onExport={handleExport}
            imageLoaded={!!image}
            originalSize={imageInfo ? { width: imageInfo.width, height: imageInfo.height } : null}
          />
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-panel border-t border-border text-[10px] text-text-secondary shrink-0">
        <div className="flex items-center gap-2">
          <span>{imageInfo ? `${imageInfo.name} — ${imageInfo.width}×${imageInfo.height}` : '이미지를 드래그하거나 열기 버튼을 눌러주세요'}</span>
          {metadata && Object.keys(metadata).length > 0 && (
            <>
              <span className="text-border">|</span>
              <span>{formatMetadataSummary(metadata)}</span>
            </>
          )}
        </div>
        <div>PhotoLink — AI 사진 편집기</div>
      </div>
    </div>
  );
}

export default App;
