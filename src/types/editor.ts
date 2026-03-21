export interface HSLChannelAdjustment {
  hue: number;
  saturation: number;
  luminance: number;
}

export type HSLChannel = 'red' | 'orange' | 'yellow' | 'green' | 'aqua' | 'blue' | 'purple' | 'magenta';

export interface HSLAdjustments {
  red: HSLChannelAdjustment;
  orange: HSLChannelAdjustment;
  yellow: HSLChannelAdjustment;
  green: HSLChannelAdjustment;
  aqua: HSLChannelAdjustment;
  blue: HSLChannelAdjustment;
  purple: HSLChannelAdjustment;
  magenta: HSLChannelAdjustment;
}

export interface SplitToning {
  shadowHue: number;
  shadowSat: number;
  highlightHue: number;
  highlightSat: number;
  balance: number;
}

export interface Grain {
  amount: number;
  size: number;
}

export interface SelectiveColor {
  enabled: boolean;
  preserveHueRanges: Array<{ center: number; width: number }>;
  desaturateStrength: number;
}

export interface CropState {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: 'free' | '1:1' | '4:3' | '16:9' | '3:2' | '9:16';
}

export interface ExportSettings {
  format: 'jpeg' | 'png';
  quality: number;
  maxLongEdge: number | null;
}

export interface EditParams {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  colorTemp: number;
  saturation: number;
  vibrance: number;
  hsl: HSLAdjustments;
  splitToning: SplitToning;
  clarity: number;
  grain: Grain;
  selectiveColor: SelectiveColor;
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
}

export const DEFAULT_HSL_CHANNEL: HSLChannelAdjustment = { hue: 0, saturation: 0, luminance: 0 };

export const DEFAULT_PARAMS: EditParams = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  colorTemp: 5800,
  saturation: 0,
  vibrance: 0,
  hsl: {
    red: { ...DEFAULT_HSL_CHANNEL },
    orange: { ...DEFAULT_HSL_CHANNEL },
    yellow: { ...DEFAULT_HSL_CHANNEL },
    green: { ...DEFAULT_HSL_CHANNEL },
    aqua: { ...DEFAULT_HSL_CHANNEL },
    blue: { ...DEFAULT_HSL_CHANNEL },
    purple: { ...DEFAULT_HSL_CHANNEL },
    magenta: { ...DEFAULT_HSL_CHANNEL },
  },
  splitToning: { shadowHue: 0, shadowSat: 0, highlightHue: 0, highlightSat: 0, balance: 0 },
  clarity: 0,
  grain: { amount: 0, size: 50 },
  selectiveColor: { enabled: false, preserveHueRanges: [], desaturateStrength: 0 },
  rotation: 0,
  flipH: false,
  flipV: false,
};

export interface Preset {
  id: string;
  name: string;
  description: string;
  params: Partial<EditParams>;
  isBuiltIn?: boolean;
}

export type ToolMode = 'adjust' | 'crop' | 'resize' | 'preset';
