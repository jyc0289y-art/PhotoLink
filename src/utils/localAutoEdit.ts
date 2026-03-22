import { EditParams } from '../types/editor';

export type SceneType = 'portrait' | 'landscape' | 'night' | 'backlit' | 'macro' | 'general';

export interface LocalAnalysis {
  summary: string;
  recommendation: string;
  params: Partial<EditParams>;
  stats: ImageStats;
  sceneType: SceneType;
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
  // Scene detection helpers
  centerBrightness: number;  // center region avg brightness
  edgeBrightness: number;    // edge region avg brightness
  skinToneRatio: number;     // ratio of skin-tone pixels (0~1)
  greenRatio: number;        // ratio of green-dominant pixels
  blueRatio: number;         // ratio of blue-sky pixels
  darkPixelRatio: number;    // ratio of very dark pixels (<30)
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
      const stats = computeStats(pixels, canvas.width, canvas.height);

      onProgress?.('사진 유형 감지 중...');
      const sceneType = detectScene(stats);

      onProgress?.('편집 파라미터 생성 중...');
      const params = generateParams(stats, sceneType);
      const summary = generateSummary(stats, sceneType);
      const recommendation = generateRecommendation(stats, sceneType);

      resolve({ summary, recommendation, params, stats, sceneType });
    };
    img.src = imageDataUrl;
  });
}

function computeStats(pixels: Uint8ClampedArray, width: number, height: number): ImageStats {
  const totalPixels = pixels.length / 4;
  let rSum = 0, gSum = 0, bSum = 0;
  let brightnessSum = 0;
  let satSum = 0;
  let hueX = 0, hueY = 0;
  const histogram = new Uint32Array(256);

  // Region accumulators for scene detection
  let centerBrightnessSum = 0, centerCount = 0;
  let edgeBrightnessSum = 0, edgeCount = 0;
  let skinToneCount = 0;
  let greenDominantCount = 0;
  let blueSkyCount = 0;
  let darkPixelCount = 0;

  const cx = width / 2, cy = height / 2;
  const centerRadiusSq = (Math.min(width, height) * 0.3) ** 2;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    rSum += r;
    gSum += g;
    bSum += b;

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    brightnessSum += lum;
    histogram[Math.round(lum)] = (histogram[Math.round(lum)] || 0) + 1;

    // Dark pixel detection
    if (lum < 30) darkPixelCount++;

    // Region detection
    const px = (i / 4) % width;
    const py = Math.floor((i / 4) / width);
    const distSq = (px - cx) ** 2 + (py - cy) ** 2;
    if (distSq < centerRadiusSq) {
      centerBrightnessSum += lum;
      centerCount++;
    } else {
      edgeBrightnessSum += lum;
      edgeCount++;
    }

    // Skin tone detection (YCbCr-based)
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && lum > 60 && lum < 230) {
      skinToneCount++;
    }

    // Green dominant (foliage/landscape)
    if (g > r * 1.1 && g > b * 1.2 && g > 50) greenDominantCount++;

    // Blue sky detection
    if (b > r * 1.3 && b > g * 1.1 && b > 100 && lum > 100) blueSkyCount++;

    // HSL saturation
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 510;
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

  let varianceSum = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    varianceSum += (lum - avgBrightness) ** 2;
  }
  const brightnessStdDev = Math.sqrt(varianceSum / totalPixels);

  let minBin = 255, maxBin = 0;
  for (let i = 0; i < 256; i++) {
    if (histogram[i] > totalPixels * 0.001) {
      minBin = Math.min(minBin, i);
      maxBin = Math.max(maxBin, i);
    }
  }
  const dynamicRange = (maxBin - minBin) / 255;

  let shadowClip = 0, highlightClip = 0;
  for (let i = 0; i < 10; i++) shadowClip += histogram[i] || 0;
  for (let i = 245; i < 256; i++) highlightClip += histogram[i] || 0;

  const rbRatio = avgR / Math.max(avgB, 1);
  let colorTemp: number;
  if (rbRatio > 1.5) colorTemp = 3000;
  else if (rbRatio > 1.2) colorTemp = 4000;
  else if (rbRatio > 0.95) colorTemp = 5500;
  else if (rbRatio > 0.75) colorTemp = 7000;
  else colorTemp = 9000;

  let dominantChannel: 'r' | 'g' | 'b' | 'neutral' = 'neutral';
  const channelDiff = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB);
  if (channelDiff > 15) {
    if (avgR > avgG && avgR > avgB) dominantChannel = 'r';
    else if (avgG > avgR && avgG > avgB) dominantChannel = 'g';
    else dominantChannel = 'b';
  }

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
    centerBrightness: centerCount > 0 ? centerBrightnessSum / centerCount : avgBrightness,
    edgeBrightness: edgeCount > 0 ? edgeBrightnessSum / edgeCount : avgBrightness,
    skinToneRatio: skinToneCount / totalPixels,
    greenRatio: greenDominantCount / totalPixels,
    blueRatio: blueSkyCount / totalPixels,
    darkPixelRatio: darkPixelCount / totalPixels,
  };
}

function detectScene(stats: ImageStats): SceneType {
  // Night scene: very dark overall
  if (stats.avgBrightness < 60 && stats.darkPixelRatio > 0.4) return 'night';

  // Backlit: center is much darker than edges, or strong highlight clipping
  if (stats.edgeBrightness - stats.centerBrightness > 40 && stats.highlightClip > 0.02) return 'backlit';

  // Portrait: significant skin tones in center
  if (stats.skinToneRatio > 0.15) return 'portrait';

  // Landscape: high green/blue ratio
  if (stats.greenRatio > 0.15 || (stats.greenRatio > 0.08 && stats.blueRatio > 0.05)) return 'landscape';

  // Macro: typically high saturation, medium brightness, low dynamic range subject
  if (stats.avgSaturation > 0.4 && stats.dynamicRange < 0.6 && stats.brightnessStdDev < 50) return 'macro';

  return 'general';
}

function generateParams(stats: ImageStats, scene: SceneType): Partial<EditParams> {
  const params: Partial<EditParams> = {};

  // Conservative brightness targets — preserve original feel, only correct obvious issues
  const targetBrightness: Record<SceneType, number> = {
    portrait: 118,    // gentle lift only
    landscape: 112,   // natural
    night: 65,        // preserve mood
    backlit: 105,     // moderate recovery
    macro: 115,       // clean
    general: 112,     // subtle — don't over-brighten
  };

  // --- Exposure correction (conservative: only fix clearly under/over-exposed) ---
  const target = targetBrightness[scene];
  const brightnessDelta = target - stats.avgBrightness;
  if (scene === 'night') {
    if (brightnessDelta > 15) {
      params.exposure = clamp(brightnessDelta / 80, 0.1, 0.6);
    }
  } else if (scene === 'backlit') {
    params.exposure = clamp(brightnessDelta / 50, -0.5, 1.0);
  } else {
    // Only correct if noticeably off (>10 brightness delta)
    if (Math.abs(brightnessDelta) > 10) {
      params.exposure = clamp(brightnessDelta / 60, -1.0, 1.0);
    }
  }

  // --- Contrast (subtle: preserve texture and detail) ---
  const contrastTargets: Record<SceneType, { low: number; high: number; gain: number }> = {
    portrait: { low: 50, high: 80, gain: 0.5 },
    landscape: { low: 55, high: 85, gain: 0.8 },
    night: { low: 45, high: 90, gain: 0.4 },
    backlit: { low: 50, high: 80, gain: 0.6 },
    macro: { low: 55, high: 80, gain: 0.6 },
    general: { low: 55, high: 80, gain: 0.6 },
  };
  const ct = contrastTargets[scene];
  if (stats.brightnessStdDev < ct.low) {
    params.contrast = clamp(Math.round((ct.low - stats.brightnessStdDev) * ct.gain), 3, 25);
  } else if (stats.brightnessStdDev > ct.high) {
    params.contrast = clamp(Math.round((70 - stats.brightnessStdDev) * 0.4), -20, -3);
  }

  // --- Highlights / Shadows (minimal: only recover clipped areas, preserve micro-contrast) ---
  if (scene === 'backlit') {
    params.highlights = clamp(Math.round(-stats.highlightClip * 2000), -60, -15);
    params.shadows = clamp(Math.round(stats.shadowClip * 2000 + 15), 15, 50);
  } else if (scene === 'night') {
    params.highlights = stats.highlightClip > 0.01 ? clamp(Math.round(-stats.highlightClip * 1500), -35, -5) : 0;
    params.shadows = clamp(Math.round(stats.shadowClip * 1000), 0, 20);
  } else {
    // Only recover if actually clipped — don't apply shadows lift "just because"
    if (stats.highlightClip > 0.01) {
      params.highlights = clamp(Math.round(-stats.highlightClip * 1500), -50, -5);
    }
    if (stats.shadowClip > 0.01) {
      params.shadows = clamp(Math.round(stats.shadowClip * 1500), 5, 35);
    }
  }

  // --- Color temperature (gentle: only correct obvious color casts) ---
  const tempDiff = stats.colorTemp - 5800;
  if (scene === 'night') {
    if (tempDiff < -800) {
      params.colorTemp = clamp(Math.round(5800 - tempDiff * 0.2), 4800, 6500);
    }
  } else if (scene === 'portrait') {
    if (Math.abs(tempDiff) > 400) {
      params.colorTemp = clamp(Math.round(5900 - tempDiff * 0.25), 4500, 7000);
    }
  } else {
    if (Math.abs(tempDiff) > 400) {
      params.colorTemp = clamp(Math.round(5800 - tempDiff * 0.3), 4000, 7500);
    }
  }

  // --- Saturation / Vibrance (restrained: enhance subtly, never over-saturate) ---
  if (scene === 'portrait') {
    params.vibrance = clamp(Math.round((0.3 - stats.avgSaturation) * 80), 0, 15);
  } else if (scene === 'landscape') {
    params.vibrance = clamp(Math.round((0.4 - stats.avgSaturation) * 100), 5, 25);
    params.saturation = clamp(Math.round((0.35 - stats.avgSaturation) * 50), 0, 12);
  } else if (scene === 'night') {
    if (stats.avgSaturation < 0.2) {
      params.vibrance = clamp(Math.round((0.22 - stats.avgSaturation) * 80), 3, 12);
    }
  } else {
    if (stats.avgSaturation < 0.2) {
      params.vibrance = clamp(Math.round((0.3 - stats.avgSaturation) * 100), 5, 20);
      params.saturation = clamp(Math.round((0.22 - stats.avgSaturation) * 60), 0, 10);
    } else if (stats.avgSaturation < 0.35) {
      params.vibrance = clamp(Math.round((0.35 - stats.avgSaturation) * 60), 3, 15);
    } else if (stats.avgSaturation > 0.55) {
      params.saturation = clamp(Math.round((0.5 - stats.avgSaturation) * 50), -15, -3);
    }
  }

  // --- Clarity (conservative: preserve texture, avoid washing out fine detail) ---
  if (scene === 'portrait') {
    params.clarity = clamp(Math.round((0.75 - stats.dynamicRange) * 10), 0, 8);
  } else if (scene === 'landscape') {
    params.clarity = clamp(Math.round((0.85 - stats.dynamicRange) * 40), 8, 25);
  } else if (scene === 'night') {
    params.clarity = clamp(Math.round((0.75 - stats.dynamicRange) * 15), 0, 10);
  } else {
    if (stats.dynamicRange < 0.8) {
      params.clarity = clamp(Math.round((0.8 - stats.dynamicRange) * 30), 5, 18);
    } else {
      params.clarity = 5;
    }
  }

  // No automatic vignette — let user apply manually if desired

  return params;
}

function generateSummary(stats: ImageStats, scene: SceneType): string {
  const sceneNames: Record<SceneType, string> = {
    portrait: '인물 사진',
    landscape: '풍경 사진',
    night: '야경/저조도',
    backlit: '역광 사진',
    macro: '접사/클로즈업',
    general: '일반 사진',
  };

  const parts: string[] = [`[${sceneNames[scene]}]`];

  if (stats.avgBrightness < 80) parts.push('어두운 이미지');
  else if (stats.avgBrightness < 120) parts.push('약간 어두운 이미지');
  else if (stats.avgBrightness > 180) parts.push('밝은 이미지');
  else parts.push('적정 밝기');

  if (stats.brightnessStdDev < 40) parts.push('낮은 콘트라스트');
  else if (stats.brightnessStdDev > 80) parts.push('높은 콘트라스트');

  if (stats.colorTemp < 4500) parts.push('차가운 색조');
  else if (stats.colorTemp > 6500) parts.push('따뜻한 색조');

  if (stats.avgSaturation < 0.15) parts.push('낮은 채도');
  else if (stats.avgSaturation > 0.5) parts.push('높은 채도');

  if (stats.highlightClip > 0.03) parts.push('하이라이트 클리핑');
  if (stats.shadowClip > 0.03) parts.push('섀도 클리핑');

  return parts.join(' · ');
}

function generateRecommendation(stats: ImageStats, scene: SceneType): string {
  const tips: string[] = [];

  // Scene-specific tips first
  switch (scene) {
    case 'portrait':
      tips.push('피부톤을 자연스럽게 보정합니다');
      if (stats.brightnessStdDev > 70) tips.push('콘트라스트를 낮춰 부드러운 인물 느낌을 줍니다');
      break;
    case 'landscape':
      tips.push('풍경의 색감과 디테일을 강화합니다');
      break;
    case 'night':
      tips.push('야경 분위기를 유지하면서 디테일을 살립니다');
      break;
    case 'backlit':
      tips.push('역광으로 어두워진 피사체를 복원합니다');
      break;
    case 'macro':
      tips.push('접사 디테일과 색감을 강조합니다');
      break;
  }

  if (stats.avgBrightness < 100 && scene !== 'night')
    tips.push('노출을 올려 디테일을 살립니다');
  else if (stats.avgBrightness > 170)
    tips.push('노출을 낮춰 디테일을 복원합니다');

  if (stats.highlightClip > 0.02)
    tips.push('하이라이트를 억제하여 날아간 부분을 복원합니다');

  if (stats.shadowClip > 0.02 && scene !== 'night')
    tips.push('섀도를 올려 어두운 부분의 디테일을 살립니다');

  if (stats.avgSaturation < 0.15)
    tips.push('자연채도를 높여 색감을 살립니다');

  if (tips.length === 0)
    tips.push('전체적으로 밸런스를 최적화합니다');

  return tips.join('. ') + '.';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
