import { EditParams } from '../types/editor';

export interface LocalAnalysis {
  summary: string;
  recommendation: string;
  params: Partial<EditParams>;
  stats: ImageStats;
}

interface ImageStats {
  avgBrightness: number;    // 0~255
  brightnessStdDev: number; // contrast indicator
  avgSaturation: number;    // 0~1
  avgHue: number;           // 0~360
  colorTemp: number;        // estimated K
  dynamicRange: number;     // 0~1 (% of histogram used)
  shadowClip: number;       // % of pixels near black
  highlightClip: number;    // % of pixels near white
  dominantChannel: 'r' | 'g' | 'b' | 'neutral';
}

export function analyzeLocal(
  imageDataUrl: string,
  onProgress?: (status: string) => void,
): Promise<LocalAnalysis> {
  return new Promise((resolve) => {
    onProgress?.('이미지 분석 중...');

    const img = new Image();
    img.onload = () => {
      // Sample at max 512px for performance
      const maxSize = 512;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      onProgress?.('히스토그램 분석 중...');
      const stats = computeStats(pixels);

      onProgress?.('편집 파라미터 생성 중...');
      const params = generateParams(stats);
      const summary = generateSummary(stats);
      const recommendation = generateRecommendation(stats);

      resolve({ summary, recommendation, params, stats });
    };
    img.src = imageDataUrl;
  });
}

function computeStats(pixels: Uint8ClampedArray): ImageStats {
  const totalPixels = pixels.length / 4;
  let rSum = 0, gSum = 0, bSum = 0;
  let brightnessSum = 0;
  let satSum = 0;
  let hueX = 0, hueY = 0; // circular average for hue
  const histogram = new Uint32Array(256);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    rSum += r;
    gSum += g;
    bSum += b;

    // Luminance (perceived brightness)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    brightnessSum += lum;
    histogram[Math.round(lum)] = (histogram[Math.round(lum)] || 0) + 1;

    // HSL saturation
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 510; // 0~1
    let sat = 0;
    if (max !== min) {
      sat = l > 0.5
        ? (max - min) / (510 - max - min)
        : (max - min) / (max + min);
    }
    satSum += sat;

    // Hue (circular)
    if (max !== min) {
      let h = 0;
      const d = max - min;
      if (max === r) h = ((g - b) / d + 6) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      hueX += Math.cos(h * Math.PI / 180) * sat;
      hueY += Math.sin(h * Math.PI / 180) * sat;
    }
  }

  const avgBrightness = brightnessSum / totalPixels;
  const avgR = rSum / totalPixels;
  const avgG = gSum / totalPixels;
  const avgB = bSum / totalPixels;

  // Brightness standard deviation (contrast indicator)
  let varianceSum = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    varianceSum += (lum - avgBrightness) ** 2;
  }
  const brightnessStdDev = Math.sqrt(varianceSum / totalPixels);

  // Dynamic range: what % of 0-255 range is actually used
  let minBin = 255, maxBin = 0;
  for (let i = 0; i < 256; i++) {
    if (histogram[i] > totalPixels * 0.001) {
      minBin = Math.min(minBin, i);
      maxBin = Math.max(maxBin, i);
    }
  }
  const dynamicRange = (maxBin - minBin) / 255;

  // Shadow/highlight clipping
  let shadowClip = 0, highlightClip = 0;
  for (let i = 0; i < 10; i++) shadowClip += histogram[i] || 0;
  for (let i = 245; i < 256; i++) highlightClip += histogram[i] || 0;

  // Color temperature estimation from R/B ratio
  const rbRatio = avgR / Math.max(avgB, 1);
  let colorTemp: number;
  if (rbRatio > 1.5) colorTemp = 3000;      // very warm
  else if (rbRatio > 1.2) colorTemp = 4000;  // warm
  else if (rbRatio > 0.95) colorTemp = 5500; // neutral
  else if (rbRatio > 0.75) colorTemp = 7000; // cool
  else colorTemp = 9000;                      // very cool

  // Dominant channel
  let dominantChannel: 'r' | 'g' | 'b' | 'neutral' = 'neutral';
  const channelDiff = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB);
  if (channelDiff > 15) {
    if (avgR > avgG && avgR > avgB) dominantChannel = 'r';
    else if (avgG > avgR && avgG > avgB) dominantChannel = 'g';
    else dominantChannel = 'b';
  }

  // Average hue (circular mean)
  const avgHue = ((Math.atan2(hueY, hueX) * 180 / Math.PI) + 360) % 360;

  return {
    avgBrightness,
    brightnessStdDev,
    avgSaturation: satSum / totalPixels,
    avgHue,
    colorTemp,
    dynamicRange,
    shadowClip: shadowClip / totalPixels,
    highlightClip: highlightClip / totalPixels,
    dominantChannel,
  };
}

function generateParams(stats: ImageStats): Partial<EditParams> {
  const params: Partial<EditParams> = {};

  // --- Exposure correction ---
  // Always adjust toward target ~118 (slightly bright for pleasing look)
  const targetBrightness = 118;
  const brightnessDelta = targetBrightness - stats.avgBrightness;
  if (Math.abs(brightnessDelta) > 5) {
    params.exposure = clamp(brightnessDelta / 40, -2.0, 2.0);
  }

  // --- Contrast ---
  // Target stdDev ~55-65 for pleasing contrast
  if (stats.brightnessStdDev < 60) {
    params.contrast = clamp(Math.round((65 - stats.brightnessStdDev) * 1.2), 5, 50);
  } else if (stats.brightnessStdDev > 80) {
    params.contrast = clamp(Math.round((65 - stats.brightnessStdDev) * 0.6), -30, -5);
  }

  // --- Highlights / Shadows recovery ---
  // Always do some recovery for better dynamic range
  if (stats.highlightClip > 0.005) {
    params.highlights = clamp(Math.round(-stats.highlightClip * 2500), -70, -10);
  } else {
    params.highlights = -10; // gentle highlight recovery
  }
  if (stats.shadowClip > 0.005) {
    params.shadows = clamp(Math.round(stats.shadowClip * 2500), 10, 70);
  } else if (stats.avgBrightness < 130) {
    params.shadows = clamp(Math.round((130 - stats.avgBrightness) * 0.4), 5, 30);
  }

  // --- Color temperature ---
  const tempDiff = stats.colorTemp - 5800;
  if (Math.abs(tempDiff) > 200) {
    params.colorTemp = clamp(Math.round(5800 - tempDiff * 0.45), 3500, 8500);
  }

  // --- Saturation / Vibrance ---
  // Almost all photos benefit from vibrance boost
  if (stats.avgSaturation < 0.2) {
    params.vibrance = clamp(Math.round((0.35 - stats.avgSaturation) * 200), 15, 45);
    params.saturation = clamp(Math.round((0.25 - stats.avgSaturation) * 120), 5, 25);
  } else if (stats.avgSaturation < 0.4) {
    params.vibrance = clamp(Math.round((0.4 - stats.avgSaturation) * 120), 5, 25);
    params.saturation = clamp(Math.round((0.35 - stats.avgSaturation) * 80), 0, 15);
  } else if (stats.avgSaturation > 0.55) {
    params.saturation = clamp(Math.round((0.45 - stats.avgSaturation) * 80), -25, -5);
  }

  // --- Clarity ---
  // Almost all photos benefit from clarity
  if (stats.dynamicRange < 0.8) {
    params.clarity = clamp(Math.round((0.85 - stats.dynamicRange) * 60), 8, 30);
  } else {
    params.clarity = 8;
  }

  return params;
}

function generateSummary(stats: ImageStats): string {
  const parts: string[] = [];

  // Brightness
  if (stats.avgBrightness < 80) parts.push('어두운 이미지');
  else if (stats.avgBrightness < 120) parts.push('약간 어두운 이미지');
  else if (stats.avgBrightness > 180) parts.push('밝은 이미지');
  else parts.push('적정 밝기');

  // Contrast
  if (stats.brightnessStdDev < 40) parts.push('낮은 콘트라스트');
  else if (stats.brightnessStdDev > 80) parts.push('높은 콘트라스트');

  // Color
  if (stats.colorTemp < 4500) parts.push('차가운 색조');
  else if (stats.colorTemp > 6500) parts.push('따뜻한 색조');

  // Saturation
  if (stats.avgSaturation < 0.15) parts.push('낮은 채도');
  else if (stats.avgSaturation > 0.5) parts.push('높은 채도');

  // Clipping
  if (stats.highlightClip > 0.03) parts.push('하이라이트 클리핑');
  if (stats.shadowClip > 0.03) parts.push('섀도 클리핑');

  return parts.join(' · ');
}

function generateRecommendation(stats: ImageStats): string {
  const tips: string[] = [];

  if (stats.avgBrightness < 100)
    tips.push('노출을 올려 디테일을 살립니다');
  else if (stats.avgBrightness > 170)
    tips.push('노출을 낮춰 디테일을 복원합니다');

  if (stats.brightnessStdDev < 40)
    tips.push('콘트라스트를 높여 입체감을 더합니다');

  if (stats.highlightClip > 0.02)
    tips.push('하이라이트를 억제하여 날아간 부분을 복원합니다');

  if (stats.shadowClip > 0.02)
    tips.push('섀도를 올려 어두운 부분의 디테일을 살립니다');

  if (stats.avgSaturation < 0.15)
    tips.push('자연채도를 높여 색감을 살립니다');

  if (stats.dynamicRange < 0.6)
    tips.push('선명도를 높여 디테일을 강조합니다');

  // Always add general enhancement tips
  tips.push('하이라이트/섀도 복원으로 디테일을 살립니다');
  if (tips.length === 1)
    tips.push('전체적으로 밸런스를 최적화합니다');

  return tips.join('. ') + '.';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
