import { useState } from 'react';
import { EditParams, DEFAULT_PARAMS } from '../../types/editor';
import { PhotoMetadata, formatMetadataSummary } from '../../utils/exif';
import { analyzeAndEdit, getApiKey, setApiKey, clearApiKey } from '../../utils/autoEdit';
import { PanelSection } from '../UI/PanelSection';

interface Props {
  params: EditParams;
  onChange: (params: EditParams) => void;
  metadata: PhotoMetadata | null;
  imageDataUrl: string | null;
  imageLoaded: boolean;
}

export function AIPanel({ params, onChange, metadata, imageDataUrl, imageLoaded }: Props) {
  const [apiKey, setApiKeyState] = useState(getApiKey() || '');
  const [showKeyInput, setShowKeyInput] = useState(!getApiKey());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [analysis, setAnalysis] = useState<{
    subject: string;
    mood: string;
    recommendation: string;
  } | null>(null);
  const [error, setError] = useState('');

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      setApiKey(apiKey.trim());
      setShowKeyInput(false);
    }
  };

  const handleAutoEdit = async () => {
    const key = getApiKey();
    if (!key) {
      setShowKeyInput(true);
      return;
    }
    if (!imageDataUrl || !imageLoaded) return;

    setLoading(true);
    setError('');
    setAnalysis(null);
    setStatus('시작 중...');

    try {
      const result = await analyzeAndEdit(
        imageDataUrl,
        metadata || {},
        key,
        setStatus,
      );

      setAnalysis({
        subject: result.subject,
        mood: result.mood,
        recommendation: result.recommendation,
      });

      // Apply AI-suggested params
      const next: EditParams = {
        ...DEFAULT_PARAMS,
        ...result.params,
        hsl: result.params.hsl
          ? { ...DEFAULT_PARAMS.hsl, ...result.params.hsl }
          : DEFAULT_PARAMS.hsl,
        splitToning: result.params.splitToning
          ? { ...DEFAULT_PARAMS.splitToning, ...result.params.splitToning }
          : DEFAULT_PARAMS.splitToning,
        grain: result.params.grain
          ? { ...DEFAULT_PARAMS.grain, ...result.params.grain }
          : DEFAULT_PARAMS.grain,
        selectiveColor: DEFAULT_PARAMS.selectiveColor,
        // Preserve transforms
        rotation: params.rotation,
        flipH: params.flipH,
        flipV: params.flipV,
      };
      onChange(next);
      setStatus('완료!');
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelSection title="AI 자동편집" defaultOpen={true}>
      {/* EXIF summary */}
      {metadata && Object.keys(metadata).length > 0 && (
        <div className="text-[10px] text-text-secondary bg-panel-light rounded px-2 py-1.5 leading-relaxed">
          {formatMetadataSummary(metadata)}
        </div>
      )}

      {/* API Key */}
      {showKeyInput ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] text-text-secondary">
            Claude API 키를 입력하세요. 키는 브라우저에만 저장됩니다.
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKeyState(e.target.value)}
            placeholder="sk-ant-..."
            className="bg-panel-light text-text-primary text-xs rounded px-2 py-1.5 border border-border focus:border-accent outline-none"
            onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
          />
          <button
            onClick={handleSaveKey}
            disabled={!apiKey.trim()}
            className="py-1 text-xs bg-accent hover:bg-accent-hover text-white rounded transition-colors disabled:opacity-40"
          >
            저장
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <div className="text-[10px] text-green-400 flex-1">API 키 설정됨</div>
          <button
            onClick={() => { clearApiKey(); setApiKeyState(''); setShowKeyInput(true); }}
            className="text-[10px] text-text-secondary hover:text-red-400 transition-colors"
          >
            변경
          </button>
        </div>
      )}

      {/* Auto Edit Button */}
      <button
        onClick={handleAutoEdit}
        disabled={loading || !imageLoaded}
        className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-accent hover:from-purple-500 hover:to-accent-hover text-white text-sm font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {status}
          </span>
        ) : (
          '사진 분석 + 자동편집'
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="text-[10px] text-red-400 bg-red-400/10 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      {/* AI Analysis Result */}
      {analysis && (
        <div className="flex flex-col gap-1.5 bg-panel-light rounded-lg p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-accent font-medium">AI 분석 결과</div>
          <div className="text-xs text-text-primary leading-relaxed">
            <span className="text-text-secondary">피사체:</span> {analysis.subject}
          </div>
          <div className="text-xs text-text-primary leading-relaxed">
            <span className="text-text-secondary">분위기:</span> {analysis.mood}
          </div>
          <div className="text-xs text-text-primary leading-relaxed">
            <span className="text-text-secondary">편집 방향:</span> {analysis.recommendation}
          </div>
        </div>
      )}

      <div className="text-[10px] text-text-secondary leading-relaxed">
        EXIF 메타데이터 + 시각 분석으로 피사체를 판별하고 최적의 편집을 자동 적용합니다.
      </div>
    </PanelSection>
  );
}
