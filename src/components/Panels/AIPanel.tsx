import { useState, useEffect, useCallback } from 'react';
import { EditParams, DEFAULT_PARAMS } from '../../types/editor';
import { PhotoMetadata, formatMetadataSummary } from '../../utils/exif';
import { analyzeAndEdit, getApiKey, setApiKey, clearApiKey } from '../../utils/autoEdit';
import { analyzeLocal } from '../../utils/localAutoEdit';
import {
  analyzeWithOllama, getOllamaUrl, setOllamaUrl, getOllamaModel, setOllamaModel,
  checkOllamaStatus, pullOllamaModel, OllamaStatus,
} from '../../utils/ollamaAutoEdit';
import { PanelSection } from '../UI/PanelSection';

interface Props {
  params: EditParams;
  onChange: (params: EditParams) => void;
  metadata: PhotoMetadata | null;
  imageDataUrl: string | null;
  imageLoaded: boolean;
}

type Tab = 'local' | 'ollama' | 'api';

function applyResult(
  result: { params: Partial<EditParams> },
  currentParams: EditParams,
): EditParams {
  return {
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
    vignette: result.params.vignette
      ? { ...DEFAULT_PARAMS.vignette, ...result.params.vignette }
      : DEFAULT_PARAMS.vignette,
    toneCurve: DEFAULT_PARAMS.toneCurve,
    rotation: currentParams.rotation,
    flipH: currentParams.flipH,
    flipV: currentParams.flipV,
  };
}

export function AIPanel({ params, onChange, metadata, imageDataUrl, imageLoaded }: Props) {
  const [tab, setTab] = useState<Tab>('local');

  // Local state
  const [localLoading, setLocalLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState('');
  const [localResult, setLocalResult] = useState<{ summary: string; recommendation: string } | null>(null);
  const [localError, setLocalError] = useState('');

  // Ollama state
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState('');
  const [ollamaResult, setOllamaResult] = useState<{ subject: string; mood: string; recommendation: string } | null>(null);
  const [ollamaError, setOllamaError] = useState('');
  const [ollamaUrlInput, setOllamaUrlInput] = useState(getOllamaUrl());
  const [ollamaModelInput, setOllamaModelInput] = useState(getOllamaModel());
  const [ollamaConnStatus, setOllamaConnStatus] = useState<OllamaStatus | null>(null);
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [ollamaPulling, setOllamaPulling] = useState(false);
  const [ollamaPullStatus, setOllamaPullStatus] = useState('');
  const [showOllamaSetup, setShowOllamaSetup] = useState(false);

  // API state
  const [apiKey, setApiKeyState] = useState(getApiKey() || '');
  const [showKeyInput, setShowKeyInput] = useState(!getApiKey());
  const [apiLoading, setApiLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState('');
  const [apiResult, setApiResult] = useState<{ subject: string; mood: string; recommendation: string } | null>(null);
  const [apiError, setApiError] = useState('');

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      setApiKey(apiKey.trim());
      setShowKeyInput(false);
    }
  };

  // Check Ollama connection when tab opens
  const checkOllama = useCallback(async () => {
    setOllamaChecking(true);
    setOllamaUrl(ollamaUrlInput);
    const status = await checkOllamaStatus();
    setOllamaConnStatus(status);
    setOllamaChecking(false);
    if (!status.connected) setShowOllamaSetup(true);
  }, [ollamaUrlInput]);

  useEffect(() => {
    if (tab === 'ollama' && !ollamaConnStatus) {
      checkOllama();
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePullModel = async (model: string) => {
    setOllamaPulling(true);
    setOllamaPullStatus('');
    setOllamaError('');
    try {
      await pullOllamaModel(model, setOllamaPullStatus);
      setOllamaModelInput(model);
      setOllamaModel(model);
      // Refresh status
      const status = await checkOllamaStatus();
      setOllamaConnStatus(status);
    } catch (err) {
      setOllamaError(err instanceof Error ? err.message : '다운로드 실패');
    } finally {
      setOllamaPulling(false);
    }
  };

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // --- Local ---
  const handleLocalEdit = async () => {
    if (!imageDataUrl || !imageLoaded) return;
    setLocalLoading(true);
    setLocalError('');
    setLocalResult(null);
    setLocalStatus('시작 중...');
    try {
      const result = await analyzeLocal(imageDataUrl, setLocalStatus);
      setLocalResult({ summary: result.summary, recommendation: result.recommendation });
      onChange(applyResult(result, params));
      setLocalStatus('완료!');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '알 수 없는 오류');
      setLocalStatus('');
    } finally {
      setLocalLoading(false);
    }
  };

  // --- Ollama ---
  const handleOllamaEdit = async () => {
    if (!imageDataUrl || !imageLoaded) return;
    setOllamaUrl(ollamaUrlInput);
    setOllamaModel(ollamaModelInput);
    setOllamaLoading(true);
    setOllamaError('');
    setOllamaResult(null);
    setOllamaStatus('시작 중...');
    try {
      const result = await analyzeWithOllama(imageDataUrl, metadata || {}, setOllamaStatus);
      setOllamaResult({ subject: result.subject, mood: result.mood, recommendation: result.recommendation });
      onChange(applyResult(result, params));
      setOllamaStatus('완료!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setOllamaError(`Ollama 서버에 연결할 수 없습니다 (${ollamaUrlInput}). Ollama가 실행 중인지 확인하세요.`);
      } else {
        setOllamaError(msg);
      }
      setOllamaStatus('');
    } finally {
      setOllamaLoading(false);
    }
  };

  // --- API ---
  const handleApiEdit = async () => {
    const key = getApiKey();
    if (!key) { setShowKeyInput(true); return; }
    if (!imageDataUrl || !imageLoaded) return;
    setApiLoading(true);
    setApiError('');
    setApiResult(null);
    setApiStatus('시작 중...');
    try {
      const result = await analyzeAndEdit(imageDataUrl, metadata || {}, key, setApiStatus);
      setApiResult({ subject: result.subject, mood: result.mood, recommendation: result.recommendation });
      onChange(applyResult(result, params));
      setApiStatus('완료!');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : '알 수 없는 오류');
      setApiStatus('');
    } finally {
      setApiLoading(false);
    }
  };

  const tabStyle = (t: Tab, active: string) =>
    `flex-1 py-1.5 text-[10px] font-medium transition-colors ${
      tab === t ? `${active} text-white` : 'bg-panel-light text-text-secondary hover:text-text-primary'
    }`;

  return (
    <PanelSection title="자동편집" defaultOpen={true}>
      {/* EXIF summary */}
      {metadata && Object.keys(metadata).length > 0 && (
        <div className="text-[10px] text-text-secondary bg-panel-light rounded px-2 py-1.5 leading-relaxed">
          {formatMetadataSummary(metadata)}
        </div>
      )}

      {/* 3-tab switcher */}
      <div className="flex rounded-lg overflow-hidden border border-border">
        <button onClick={() => setTab('local')} className={tabStyle('local', 'bg-accent')}>
          자동보정
        </button>
        <button onClick={() => setTab('ollama')} className={tabStyle('ollama', 'bg-emerald-600')}>
          로컬 LLM
        </button>
        <button onClick={() => setTab('api')} className={tabStyle('api', 'bg-purple-600')}>
          유료 API
        </button>
      </div>

      {/* ===== Local tab ===== */}
      {tab === 'local' && (
        <>
          <button
            onClick={handleLocalEdit}
            disabled={localLoading || !imageLoaded}
            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {localLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {localStatus}
              </span>
            ) : '자동 보정'}
          </button>

          {localError && (
            <div className="text-[10px] text-red-400 bg-red-400/10 rounded px-2 py-1.5">{localError}</div>
          )}
          {localResult && (
            <div className="flex flex-col gap-1.5 bg-panel-light rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-accent font-medium">분석 결과</div>
              <div className="text-xs text-text-primary leading-relaxed">
                <span className="text-text-secondary">상태:</span> {localResult.summary}
              </div>
              <div className="text-xs text-text-primary leading-relaxed">
                <span className="text-text-secondary">보정:</span> {localResult.recommendation}
              </div>
            </div>
          )}
          <div className="text-[10px] text-text-secondary leading-relaxed">
            히스토그램·색온도·채도를 분석하여 자동 보정. API 불필요, 즉시 실행.
          </div>
        </>
      )}

      {/* ===== Ollama tab ===== */}
      {tab === 'ollama' && (
        <>
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${
              ollamaChecking ? 'bg-yellow-400 animate-pulse' :
              ollamaConnStatus?.connected ? 'bg-emerald-400' : 'bg-red-400'
            }`} />
            <span className="text-[10px] text-text-secondary flex-1">
              {ollamaChecking ? '연결 확인 중...' :
               ollamaConnStatus?.connected
                 ? `연결됨 · 모델 ${ollamaConnStatus.models.length}개`
                 : 'Ollama 미연결'}
            </span>
            <button
              onClick={checkOllama}
              disabled={ollamaChecking}
              className="text-[10px] text-text-secondary hover:text-emerald-400 transition-colors"
            >
              재확인
            </button>
          </div>

          {/* Mobile warning */}
          {isMobile && (
            <div className="text-[10px] text-yellow-400 bg-yellow-400/10 rounded px-2 py-1.5 leading-relaxed">
              모바일에서는 로컬 LLM을 실행할 수 없습니다. PC에서 Ollama를 설치하거나, &ldquo;자동보정&rdquo; 탭의 로컬 분석을 이용하세요.
            </div>
          )}

          {/* Setup guide (when not connected) */}
          {!ollamaConnStatus?.connected && showOllamaSetup && !isMobile && (
            <div className="flex flex-col gap-2 bg-panel-light rounded-lg p-2.5">
              <div className="text-[10px] text-emerald-400 font-medium">Ollama 설치 가이드</div>
              <div className="text-[10px] text-text-secondary leading-relaxed">
                AI 사진 분석을 로컬에서 무료로 실행하려면 Ollama를 설치하세요.
              </div>
              <a
                href="https://ollama.com/download"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-all text-center block"
              >
                Ollama 다운로드 (무료)
              </a>
              <div className="text-[10px] text-text-secondary leading-relaxed">
                1. 위 버튼으로 Ollama 설치<br/>
                2. 설치 후 아래 &ldquo;연결 확인&rdquo; 클릭<br/>
                3. 비전 모델 설치 (아래 버튼 클릭)
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={ollamaUrlInput}
                  onChange={e => setOllamaUrlInput(e.target.value)}
                  className="flex-1 bg-surface text-text-primary text-[10px] rounded px-2 py-1 border border-border focus:border-emerald-500 outline-none"
                  placeholder="http://localhost:11434"
                />
                <button
                  onClick={checkOllama}
                  className="text-[10px] bg-surface hover:bg-border text-text-secondary px-2 py-1 rounded transition-colors"
                >
                  연결 확인
                </button>
              </div>
            </div>
          )}

          {/* Connected: model install + analysis */}
          {ollamaConnStatus?.connected && (
            <>
              {/* Model selector + install */}
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-1.5 items-center">
                  <span className="text-[10px] text-text-secondary shrink-0">모델:</span>
                  <select
                    value={ollamaModelInput}
                    onChange={e => { setOllamaModelInput(e.target.value); setOllamaModel(e.target.value); }}
                    className="flex-1 bg-panel-light text-text-primary text-[10px] rounded px-2 py-1 border border-border focus:border-emerald-500 outline-none"
                  >
                    {ollamaConnStatus.models.length > 0 ? (
                      ollamaConnStatus.models.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))
                    ) : (
                      <option value="">모델 없음</option>
                    )}
                  </select>
                </div>

                {/* Quick model install buttons */}
                {!ollamaConnStatus.models.some(m => m.includes('llava') || m.includes('moondream')) && (
                  <div className="bg-panel-light rounded-lg p-2 flex flex-col gap-1.5">
                    <div className="text-[10px] text-yellow-400">비전 모델이 설치되지 않았습니다</div>
                    <div className="text-[10px] text-text-secondary">사진 분석에는 비전 모델이 필요합니다. 아래에서 설치하세요.</div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <div className="text-[10px] text-emerald-400 font-medium">AI 비전 모델 설치</div>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { name: 'moondream', size: '~1.7GB', desc: '빠름, 가벼움 (추천)' },
                      { name: 'llava:7b', size: '~4.7GB', desc: '균형잡힌 성능' },
                      { name: 'llava:13b', size: '~8GB', desc: '고품질 분석' },
                      { name: 'llava-llama3', size: '~5.5GB', desc: '최신 모델' },
                    ].map(m => {
                      const installed = ollamaConnStatus.models.some(im => im.includes(m.name.split(':')[0]));
                      return (
                        <button
                          key={m.name}
                          onClick={() => {
                            if (!installed && !ollamaPulling) {
                              if (confirm(`${m.name} (${m.size})을 다운로드하시겠습니까?\n\n${m.desc}\n용량: ${m.size}\n다운로드에 시간이 걸릴 수 있습니다.`)) {
                                handlePullModel(m.name);
                              }
                            }
                          }}
                          disabled={installed || ollamaPulling}
                          className={`w-full flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
                            installed
                              ? 'bg-emerald-600/20 text-emerald-400 cursor-default'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                          } disabled:opacity-60`}
                        >
                          <div className="flex flex-col items-start">
                            <div className="text-xs font-medium">{m.name}</div>
                            <div className="text-[10px] opacity-80">{m.desc} · {m.size}</div>
                          </div>
                          <div className="text-xs font-medium shrink-0 ml-2">
                            {installed ? '✓ 설치됨' : '설치'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pull progress */}
                {ollamaPulling && (
                  <div className="flex items-center gap-2 text-[10px] text-emerald-400">
                    <span className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                    {ollamaPullStatus}
                  </div>
                )}
              </div>

              {/* Analysis button */}
              <button
                onClick={handleOllamaEdit}
                disabled={ollamaLoading || !imageLoaded || ollamaConnStatus.models.length === 0}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {ollamaLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {ollamaStatus}
                  </span>
                ) : 'LLM 분석 + 자동편집'}
              </button>
            </>
          )}

          {ollamaError && (
            <div className="text-[10px] text-red-400 bg-red-400/10 rounded px-2 py-1.5">{ollamaError}</div>
          )}
          {ollamaResult && (
            <div className="flex flex-col gap-1.5 bg-panel-light rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium">LLM 분석 결과</div>
              <div className="text-xs text-text-primary leading-relaxed">
                <span className="text-text-secondary">피사체:</span> {ollamaResult.subject}
              </div>
              <div className="text-xs text-text-primary leading-relaxed">
                <span className="text-text-secondary">분위기:</span> {ollamaResult.mood}
              </div>
              <div className="text-xs text-text-primary leading-relaxed">
                <span className="text-text-secondary">편집 방향:</span> {ollamaResult.recommendation}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== API tab ===== */}
      {tab === 'api' && (
        <>
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
                className="bg-panel-light text-text-primary text-xs rounded px-2 py-1.5 border border-border focus:border-purple-500 outline-none"
                onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
              />
              <button
                onClick={handleSaveKey}
                disabled={!apiKey.trim()}
                className="py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors disabled:opacity-40"
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

          <button
            onClick={handleApiEdit}
            disabled={apiLoading || !imageLoaded}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-accent hover:from-purple-500 hover:to-accent-hover text-white text-sm font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {apiLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {apiStatus}
              </span>
            ) : 'AI 사진 분석 + 자동편집'}
          </button>

          {apiError && (
            <div className="text-[10px] text-red-400 bg-red-400/10 rounded px-2 py-1.5">{apiError}</div>
          )}
          {apiResult && (
            <div className="flex flex-col gap-1.5 bg-panel-light rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-purple-400 font-medium">AI 분석 결과</div>
              <div className="text-xs text-text-primary leading-relaxed">
                <span className="text-text-secondary">피사체:</span> {apiResult.subject}
              </div>
              <div className="text-xs text-text-primary leading-relaxed">
                <span className="text-text-secondary">분위기:</span> {apiResult.mood}
              </div>
              <div className="text-xs text-text-primary leading-relaxed">
                <span className="text-text-secondary">편집 방향:</span> {apiResult.recommendation}
              </div>
            </div>
          )}
          <div className="text-[10px] text-text-secondary leading-relaxed">
            Claude Vision API로 피사체를 분석합니다. API 키 필요 (유료).
          </div>
        </>
      )}
    </PanelSection>
  );
}
