import { useRef, useState, useCallback } from 'react';

interface Props {
  onFileSelect: (files: FileList | File[]) => void;
}

export function UploadScreen({ onFileSelect }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const isApple = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      onFileSelect([file]);
    }
  }, [onFileSelect]);

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div
        className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 transition-all cursor-pointer ${
          isDragging
            ? 'border-accent bg-accent/10 scale-105'
            : 'border-border hover:border-text-secondary'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="text-5xl opacity-40">
          {isDragging ? '✨' : '📸'}
        </div>
        <div className="text-center">
          <div className="text-lg font-medium text-text-primary mb-1">사진을 드래그하거나 클릭하세요</div>
          <div className="text-xs text-text-secondary">JPEG, PNG, WebP 지원</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={e => { if (e.target.files) onFileSelect(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* Apple Photos Guide */}
      {isApple && (
        <div className="w-full max-w-lg">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-2 text-xs text-accent hover:text-accent-hover transition-colors mx-auto"
          >
            <span></span>
            {showGuide ? '가이드 닫기' : '즐겨찾기(좋아요) 사진만 보려면?'}
          </button>

          {showGuide && (
            <div className="mt-3 bg-panel rounded-xl p-4 border border-border">
              <div className="text-sm font-medium text-text-primary mb-3">
                Apple 사진 즐겨찾기에서 바로 선택하기
              </div>

              {/* iPhone/iPad Guide */}
              <div className="mb-4">
                <div className="text-xs font-medium text-accent mb-2">iPhone / iPad</div>
                <ol className="text-xs text-text-secondary space-y-1.5 list-decimal list-inside">
                  <li>위의 업로드 영역을 탭하세요</li>
                  <li>사진 선택 화면이 열리면 좌측 상단 <span className="text-text-primary font-medium">"앨범"</span> 탭을 탭</li>
                  <li><span className="text-text-primary font-medium">"즐겨찾기"</span> 앨범 선택</li>
                  <li>원하는 사진을 탭하면 즉시 불러옵니다</li>
                </ol>
                <div className="mt-2 text-[10px] text-text-secondary bg-panel-light rounded px-2 py-1.5">
                  💡 iOS 16+에서는 사진 선택기가 자동으로 앨범 목록을 보여줍니다
                </div>
              </div>

              {/* Mac Guide */}
              <div>
                <div className="text-xs font-medium text-accent mb-2">macOS</div>
                <ol className="text-xs text-text-secondary space-y-1.5 list-decimal list-inside">
                  <li>위의 업로드 영역을 클릭하세요</li>
                  <li>파일 선택 창에서 좌측 사이드바의 <span className="text-text-primary font-medium">"사진"</span> 클릭</li>
                  <li>상단의 <span className="text-text-primary font-medium">"즐겨찾기"</span> 앨범 선택</li>
                  <li>사진을 선택하고 "열기" 클릭</li>
                </ol>
                <div className="mt-2 text-[10px] text-text-secondary bg-panel-light rounded px-2 py-1.5">
                  💡 macOS Finder에서 사진 앱 라이브러리에 직접 접근 가능합니다.
                  또는 사진 앱에서 즐겨찾기를 열고 여기로 드래그하세요!
                </div>
              </div>

              {/* Pro tip */}
              <div className="mt-4 pt-3 border-t border-border">
                <div className="text-[10px] text-accent font-medium mb-1">Pro Tip: 드래그 앤 드롭</div>
                <div className="text-[10px] text-text-secondary">
                  macOS에서 사진 앱을 열고 → 즐겨찾기 앨범을 선택 → 사진을 이 화면으로 드래그하면
                  파일 선택 없이 바로 편집할 수 있습니다!
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feature highlights */}
      <div className="flex gap-6 text-center mt-4">
        {[
          { icon: '🎨', label: 'Lightroom급 색보정' },
          { icon: '🤖', label: 'AI 자동편집' },
          { icon: '🔒', label: '100% 로컬 처리' },
        ].map(f => (
          <div key={f.label} className="flex flex-col items-center gap-1">
            <span className="text-2xl">{f.icon}</span>
            <span className="text-[10px] text-text-secondary">{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
