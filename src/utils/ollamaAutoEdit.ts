import { EditParams } from '../types/editor';
import { PhotoMetadata, generateShootingContext } from './exif';

const OLLAMA_STORAGE_KEY = 'photolink-ollama-url';
const OLLAMA_MODEL_KEY = 'photolink-ollama-model';

export function getOllamaUrl(): string {
  return localStorage.getItem(OLLAMA_STORAGE_KEY) || 'http://localhost:11434';
}
export function setOllamaUrl(url: string) {
  localStorage.setItem(OLLAMA_STORAGE_KEY, url);
}
export function getOllamaModel(): string {
  return localStorage.getItem(OLLAMA_MODEL_KEY) || 'llava';
}
export function setOllamaModel(model: string) {
  localStorage.setItem(OLLAMA_MODEL_KEY, model);
}

export interface OllamaStatus {
  connected: boolean;
  models: string[];
  error?: string;
}

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  const url = getOllamaUrl();
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { connected: false, models: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = (data.models || []).map((m: { name: string }) => m.name);
    return { connected: true, models };
  } catch {
    return { connected: false, models: [] };
  }
}

export async function pullOllamaModel(
  model: string,
  onProgress?: (status: string) => void,
): Promise<void> {
  const url = getOllamaUrl();
  onProgress?.(`${model} 다운로드 시작...`);

  const res = await fetch(`${url}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model, stream: true }),
  });

  if (!res.ok) {
    throw new Error(`모델 다운로드 실패 (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('스트림을 읽을 수 없습니다');

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    for (const line of text.split('\n').filter(Boolean)) {
      try {
        const json = JSON.parse(line);
        if (json.total && json.completed) {
          const pct = Math.round((json.completed / json.total) * 100);
          onProgress?.(`${model} 다운로드 중... ${pct}%`);
        } else if (json.status) {
          onProgress?.(json.status);
        }
      } catch { /* skip malformed lines */ }
    }
  }
  onProgress?.(`${model} 설치 완료!`);
}

interface OllamaAnalysis {
  subject: string;
  mood: string;
  recommendation: string;
  params: Partial<EditParams>;
}

export async function analyzeWithOllama(
  imageDataUrl: string,
  metadata: PhotoMetadata,
  onProgress?: (status: string) => void,
): Promise<OllamaAnalysis> {
  const ollamaUrl = getOllamaUrl();
  const model = getOllamaModel();

  onProgress?.('이미지 준비 중...');

  // Resize for Ollama (max 512px to keep fast)
  const resizedBase64 = await resizeImage(imageDataUrl, 512);

  const shootingContext = generateShootingContext(metadata);

  const prompt = `You are a professional photo editor. Analyze this photo and suggest edit parameters.

## Shooting metadata
${shootingContext || '(No EXIF data)'}

## Respond ONLY with this JSON (no other text):
\`\`\`json
{
  "subject": "brief subject description",
  "mood": "mood/feeling of the photo",
  "recommendation": "editing direction in Korean (2-3 sentences)",
  "params": {
    "exposure": 0,
    "contrast": 0,
    "highlights": 0,
    "shadows": 0,
    "colorTemp": 5800,
    "saturation": 0,
    "vibrance": 0,
    "clarity": 0
  }
}
\`\`\`

Parameter ranges: exposure -3~+3, contrast/highlights/shadows/saturation/vibrance/clarity -100~+100, colorTemp 2000~10000.
Only include params that differ from defaults. Be bold with your edits.`;

  onProgress?.(`${model} 모델로 분석 중...`);

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      images: [resizedBase64],
      stream: false,
      options: { temperature: 0.3 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[PhotoLink Ollama] Error:', response.status, err);
    if (response.status === 404) {
      throw new Error(`모델 '${model}'을 찾을 수 없습니다. ollama pull ${model}로 설치하세요.`);
    }
    throw new Error(`Ollama 오류 (${response.status}): ${err.slice(0, 200)}`);
  }

  onProgress?.('응답 파싱 중...');

  const data = await response.json();
  const text = data.response || '';
  console.log('[PhotoLink Ollama] Response:', text.slice(0, 500));

  // Extract JSON
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*"params"[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM 응답에서 파라미터를 추출할 수 없습니다.');

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  const analysis: OllamaAnalysis = JSON.parse(jsonStr);

  // Clamp params
  const safeParams: Partial<EditParams> = {};
  const p = analysis.params;
  if (p.exposure !== undefined) safeParams.exposure = clamp(p.exposure, -3, 3);
  if (p.contrast !== undefined) safeParams.contrast = clamp(p.contrast, -100, 100);
  if (p.highlights !== undefined) safeParams.highlights = clamp(p.highlights, -100, 100);
  if (p.shadows !== undefined) safeParams.shadows = clamp(p.shadows, -100, 100);
  if (p.colorTemp !== undefined) safeParams.colorTemp = clamp(p.colorTemp, 2000, 10000);
  if (p.saturation !== undefined) safeParams.saturation = clamp(p.saturation, -100, 100);
  if (p.vibrance !== undefined) safeParams.vibrance = clamp(p.vibrance, -100, 100);
  if (p.clarity !== undefined) safeParams.clarity = clamp(p.clarity, -100, 100);

  return { ...analysis, params: safeParams };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

async function resizeImage(dataUrl: string, maxSize: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      resolve(base64);
    };
    img.src = dataUrl;
  });
}
