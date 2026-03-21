import { EditParams } from '../types/editor';
import { PhotoMetadata, generateShootingContext } from './exif';

const STORAGE_KEY = 'photolink-api-key';

export function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setApiKey(key: string) {
  localStorage.setItem(STORAGE_KEY, key);
}

export function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY);
}

interface AIAnalysis {
  subject: string;
  mood: string;
  recommendation: string;
  params: Partial<EditParams>;
}

export async function analyzeAndEdit(
  imageDataUrl: string,
  metadata: PhotoMetadata,
  apiKey: string,
  onProgress?: (status: string) => void,
): Promise<AIAnalysis> {
  onProgress?.('사진 분석 중...');

  const shootingContext = generateShootingContext(metadata);

  // Resize image for API (max 1024px long edge to save tokens)
  const resizedBase64 = await resizeForAPI(imageDataUrl, 1024);

  const prompt = `당신은 전문 사진 편집자입니다. 이 사진을 분석하고 최적의 편집 파라미터를 제안해주세요.

## 촬영 메타데이터
${shootingContext || '(EXIF 없음 — 시각적 분석에 의존)'}

## 분석 요청

1. **피사체 판별**: 사진의 주 피사체가 무엇인지, 촬영자가 어떤 부분에 매료되어 셔터를 눌렀을지 추론
2. **분위기 판별**: 사진이 전달하는 감정/무드 (따뜻한, 차가운, 몽환적, 긴장감, 평화로운 등)
3. **편집 방향**: 피사체와 분위기를 극대화하는 편집 전략
4. **구체적 파라미터**: 아래 JSON 형식으로 편집 파라미터를 제안

## 파라미터 범위
- exposure: -3.0 ~ +3.0 (EV 스톱)
- contrast: -100 ~ +100
- highlights: -100 ~ +100
- shadows: -100 ~ +100
- colorTemp: 2000 ~ 10000 (K, 기본 5800)
- saturation: -100 ~ +100
- vibrance: -100 ~ +100
- clarity: -100 ~ +100
- grain.amount: 0 ~ 100
- grain.size: 0 ~ 100
- splitToning.shadowHue: 0~360, shadowSat: 0~100
- splitToning.highlightHue: 0~360, highlightSat: 0~100
- splitToning.balance: -100~100
- HSL 채널 (red/orange/yellow/green/aqua/blue/purple/magenta): hue -30~+30, saturation -100~+100, luminance -100~+100

## 응답 형식 (반드시 이 JSON 구조로)
\`\`\`json
{
  "subject": "피사체 설명 (1~2문장)",
  "mood": "분위기/감정 (1문장)",
  "recommendation": "편집 방향 설명 (2~3문장)",
  "params": {
    "exposure": 0,
    "contrast": 0,
    "highlights": 0,
    "shadows": 0,
    "colorTemp": 5800,
    "saturation": 0,
    "vibrance": 0,
    "clarity": 0,
    "grain": { "amount": 0, "size": 50 },
    "splitToning": { "shadowHue": 0, "shadowSat": 0, "highlightHue": 0, "highlightSat": 0, "balance": 0 },
    "hsl": {
      "red": { "hue": 0, "saturation": 0, "luminance": 0 },
      "orange": { "hue": 0, "saturation": 0, "luminance": 0 },
      "yellow": { "hue": 0, "saturation": 0, "luminance": 0 },
      "green": { "hue": 0, "saturation": 0, "luminance": 0 },
      "aqua": { "hue": 0, "saturation": 0, "luminance": 0 },
      "blue": { "hue": 0, "saturation": 0, "luminance": 0 },
      "purple": { "hue": 0, "saturation": 0, "luminance": 0 },
      "magenta": { "hue": 0, "saturation": 0, "luminance": 0 }
    }
  }
}
\`\`\`

중요: 기본값(0)과 다른 파라미터만 포함해도 됩니다. 피사체와 분위기에 맞는 과감한 편집을 제안하세요. 보수적인 편집보다 사진의 잠재력을 끌어내는 편집을 해주세요.`;

  onProgress?.('AI가 피사체를 분석하고 있습니다...');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: resizedBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[PhotoLink AI] API error:', response.status, err);
    if (response.status === 401) throw new Error('API 키가 유효하지 않습니다.');
    if (response.status === 429) throw new Error('API 요청 한도 초과. 잠시 후 다시 시도해주세요.');
    throw new Error(`API 오류 (${response.status}): ${err}`);
  }

  onProgress?.('편집 파라미터를 생성하고 있습니다...');

  const data = await response.json();
  console.log('[PhotoLink AI] API response:', JSON.stringify(data).slice(0, 500));
  const text = data.content[0].text;
  console.log('[PhotoLink AI] Extracted text:', text.slice(0, 300));

  // Extract JSON from response
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*"params"[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 응답에서 파라미터를 추출할 수 없습니다.');

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  const analysis: AIAnalysis = JSON.parse(jsonStr);

  // Merge with defaults safely
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

  if (p.grain) {
    safeParams.grain = {
      amount: clamp(p.grain.amount || 0, 0, 100),
      size: clamp(p.grain.size || 50, 0, 100),
    };
  }

  if (p.splitToning) {
    safeParams.splitToning = {
      shadowHue: clamp(p.splitToning.shadowHue || 0, 0, 360),
      shadowSat: clamp(p.splitToning.shadowSat || 0, 0, 100),
      highlightHue: clamp(p.splitToning.highlightHue || 0, 0, 360),
      highlightSat: clamp(p.splitToning.highlightSat || 0, 0, 100),
      balance: clamp(p.splitToning.balance || 0, -100, 100),
    };
  }

  if (p.hsl) {
    const defaultCh = { hue: 0, saturation: 0, luminance: 0 };
    const channels = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'] as const;
    const hsl: Record<string, typeof defaultCh> = {};
    for (const ch of channels) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const src = (p.hsl as any)[ch];
      if (src) {
        hsl[ch] = {
          hue: clamp(src.hue || 0, -30, 30),
          saturation: clamp(src.saturation || 0, -100, 100),
          luminance: clamp(src.luminance || 0, -100, 100),
        };
      } else {
        hsl[ch] = { ...defaultCh };
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    safeParams.hsl = hsl as any;
  }

  return { ...analysis, params: safeParams };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

async function resizeForAPI(dataUrl: string, maxSize: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Return base64 without prefix
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      resolve(base64);
    };
    img.src = dataUrl;
  });
}
