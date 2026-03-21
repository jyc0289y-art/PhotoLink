import exifr from 'exifr';

export interface PhotoMetadata {
  // Camera
  make?: string;
  model?: string;
  lens?: string;
  // Exposure
  focalLength?: number;
  focalLength35mm?: number;
  aperture?: number;
  iso?: number;
  exposureTime?: number;
  exposureCompensation?: number;
  // Scene
  flash?: boolean;
  whiteBalance?: string;
  meteringMode?: string;
  exposureProgram?: string;
  // GPS
  latitude?: number;
  longitude?: number;
  // Date
  dateTime?: Date;
  // Image
  width?: number;
  height?: number;
  orientation?: number;
}

export async function readExif(file: File): Promise<PhotoMetadata> {
  try {
    const data = await exifr.parse(file, true);

    if (!data) return {};

    return {
      make: data.Make,
      model: data.Model,
      lens: data.LensModel || data.LensMake,
      focalLength: data.FocalLength,
      focalLength35mm: data.FocalLengthIn35mmFormat,
      aperture: data.FNumber || data.ApertureValue,
      iso: data.ISO,
      exposureTime: data.ExposureTime,
      exposureCompensation: data.ExposureCompensation,
      flash: data.Flash ? !!(data.Flash & 1) : undefined,
      whiteBalance: data.WhiteBalance === 0 ? 'Auto' : data.WhiteBalance === 1 ? 'Manual' : undefined,
      meteringMode: formatMeteringMode(data.MeteringMode),
      exposureProgram: formatExposureProgram(data.ExposureProgram),
      latitude: data.latitude,
      longitude: data.longitude,
      dateTime: data.DateTimeOriginal || data.CreateDate,
      width: data.ImageWidth || data.ExifImageWidth,
      height: data.ImageHeight || data.ExifImageHeight,
      orientation: data.Orientation,
    };
  } catch {
    return {};
  }
}

function formatMeteringMode(mode?: number): string | undefined {
  if (mode === undefined) return undefined;
  const modes: Record<number, string> = {
    0: 'Unknown', 1: 'Average', 2: 'Center-weighted', 3: 'Spot',
    4: 'Multi-spot', 5: 'Multi-segment', 6: 'Partial',
  };
  return modes[mode];
}

function formatExposureProgram(prog?: number): string | undefined {
  if (prog === undefined) return undefined;
  const programs: Record<number, string> = {
    0: 'Unknown', 1: 'Manual', 2: 'Auto', 3: 'Aperture Priority',
    4: 'Shutter Priority', 5: 'Creative', 6: 'Action', 7: 'Portrait', 8: 'Landscape',
  };
  return programs[prog];
}

export function formatExposureTime(time?: number): string {
  if (!time) return '';
  if (time >= 1) return `${time}s`;
  return `1/${Math.round(1 / time)}s`;
}

export function formatMetadataSummary(meta: PhotoMetadata): string {
  const parts: string[] = [];
  if (meta.model) parts.push(meta.model);
  if (meta.lens) parts.push(meta.lens);
  if (meta.focalLength) parts.push(`${meta.focalLength}mm`);
  if (meta.aperture) parts.push(`f/${meta.aperture}`);
  if (meta.exposureTime) parts.push(formatExposureTime(meta.exposureTime));
  if (meta.iso) parts.push(`ISO ${meta.iso}`);
  return parts.join(' · ');
}

// Generate shooting context analysis for AI
export function generateShootingContext(meta: PhotoMetadata): string {
  const lines: string[] = [];

  // Camera & lens info
  if (meta.make || meta.model) {
    lines.push(`카메라: ${[meta.make, meta.model].filter(Boolean).join(' ')}`);
  }
  if (meta.lens) lines.push(`렌즈: ${meta.lens}`);

  // Focal length analysis
  if (meta.focalLength) {
    const fl = meta.focalLength35mm || meta.focalLength;
    if (fl <= 24) lines.push(`화각: 광각(${fl}mm) — 풍경/건축/스트릿 가능성`);
    else if (fl <= 50) lines.push(`화각: 표준(${fl}mm) — 스냅/일상/스트릿 가능성`);
    else if (fl <= 100) lines.push(`화각: 중망원(${fl}mm) — 인물/디테일 가능성`);
    else lines.push(`화각: 망원(${fl}mm) — 압축효과/원거리 피사체 가능성`);
  }

  // Aperture analysis
  if (meta.aperture) {
    if (meta.aperture <= 2.8) lines.push(`조리개: f/${meta.aperture} (개방) — 보케/피사체 분리 의도`);
    else if (meta.aperture <= 5.6) lines.push(`조리개: f/${meta.aperture} — 적절한 심도`);
    else lines.push(`조리개: f/${meta.aperture} (조임) — 전체 선명도/풍경 의도`);
  }

  // Exposure analysis
  if (meta.exposureTime) {
    const t = meta.exposureTime;
    if (t >= 1) lines.push(`셔터속도: ${t}s (장노출) — 빛궤적/수면/구름 흐림 가능성`);
    else if (t >= 1/30) lines.push(`셔터속도: 1/${Math.round(1/t)}s — 저속 의도적 블러 가능성`);
    else lines.push(`셔터속도: 1/${Math.round(1/t)}s — 순간 포착`);
  }

  if (meta.iso) {
    if (meta.iso >= 3200) lines.push(`ISO ${meta.iso} — 저조도/야간 촬영`);
    else if (meta.iso >= 800) lines.push(`ISO ${meta.iso} — 실내/저녁 가능성`);
    else lines.push(`ISO ${meta.iso} — 충분한 광량`);
  }

  if (meta.flash) lines.push('플래시 사용');
  if (meta.exposureCompensation && meta.exposureCompensation !== 0) {
    lines.push(`노출 보정: ${meta.exposureCompensation > 0 ? '+' : ''}${meta.exposureCompensation} EV`);
  }
  if (meta.exposureProgram) lines.push(`촬영 모드: ${meta.exposureProgram}`);
  if (meta.dateTime) {
    const h = meta.dateTime.getHours();
    let timeOfDay = '';
    if (h >= 5 && h < 7) timeOfDay = '새벽/일출';
    else if (h >= 7 && h < 10) timeOfDay = '아침';
    else if (h >= 10 && h < 15) timeOfDay = '한낮';
    else if (h >= 15 && h < 18) timeOfDay = '오후/골든아워';
    else if (h >= 18 && h < 20) timeOfDay = '석양/블루아워';
    else timeOfDay = '야간';
    lines.push(`촬영 시간: ${meta.dateTime.toLocaleString('ko-KR')} (${timeOfDay})`);
  }

  return lines.join('\n');
}
