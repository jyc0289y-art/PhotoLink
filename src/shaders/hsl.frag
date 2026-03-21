precision highp float;

uniform sampler2D uTexture;
// 8 channels × 3 values (hue, sat, lum) = 24 uniforms packed as 8 vec3
uniform vec3 uHSL_Red;
uniform vec3 uHSL_Orange;
uniform vec3 uHSL_Yellow;
uniform vec3 uHSL_Green;
uniform vec3 uHSL_Aqua;
uniform vec3 uHSL_Blue;
uniform vec3 uHSL_Purple;
uniform vec3 uHSL_Magenta;

varying vec2 vUv;

vec3 rgb2hsl(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float l = (maxC + minC) / 2.0;
  float d = maxC - minC;
  float s = 0.0;
  float h = 0.0;

  if (d > 0.001) {
    s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    if (maxC == c.r) {
      h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    } else if (maxC == c.g) {
      h = (c.b - c.r) / d + 2.0;
    } else {
      h = (c.r - c.g) / d + 4.0;
    }
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  if (s < 0.001) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(
    hue2rgb(p, q, h + 1.0/3.0),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1.0/3.0)
  );
}

// Channel centers in 0-1 range: Red=0, Orange=30/360, Yellow=60/360, etc.
float channelWeight(float hue, float center, float width) {
  float dist = abs(hue - center);
  if (dist > 0.5) dist = 1.0 - dist;
  return smoothstep(width, 0.0, dist);
}

void main() {
  vec4 texColor = texture2D(uTexture, vUv);
  vec3 hsl = rgb2hsl(texColor.rgb);

  float h = hsl.x; // 0-1
  float hueShift = 0.0;
  float satShift = 0.0;
  float lumShift = 0.0;

  float w = 1.0 / 12.0; // channel width (~30 degrees)

  // Accumulate weighted adjustments from all 8 channels
  float wR = channelWeight(h, 0.0/360.0, w);       // Red = 0°
  float wO = channelWeight(h, 30.0/360.0, w);      // Orange = 30°
  float wY = channelWeight(h, 60.0/360.0, w);      // Yellow = 60°
  float wG = channelWeight(h, 120.0/360.0, w);     // Green = 120°
  float wA = channelWeight(h, 180.0/360.0, w);     // Aqua = 180°
  float wB = channelWeight(h, 240.0/360.0, w);     // Blue = 240°
  float wP = channelWeight(h, 270.0/360.0, w);     // Purple = 270°
  float wM = channelWeight(h, 300.0/360.0, w);     // Magenta = 300°
  // Red also wraps around at 360°
  wR = max(wR, channelWeight(h, 360.0/360.0, w));

  float totalW = wR + wO + wY + wG + wA + wB + wP + wM + 0.001;

  hueShift += wR * uHSL_Red.x + wO * uHSL_Orange.x + wY * uHSL_Yellow.x + wG * uHSL_Green.x;
  hueShift += wA * uHSL_Aqua.x + wB * uHSL_Blue.x + wP * uHSL_Purple.x + wM * uHSL_Magenta.x;
  hueShift /= totalW;

  satShift += wR * uHSL_Red.y + wO * uHSL_Orange.y + wY * uHSL_Yellow.y + wG * uHSL_Green.y;
  satShift += wA * uHSL_Aqua.y + wB * uHSL_Blue.y + wP * uHSL_Purple.y + wM * uHSL_Magenta.y;
  satShift /= totalW;

  lumShift += wR * uHSL_Red.z + wO * uHSL_Orange.z + wY * uHSL_Yellow.z + wG * uHSL_Green.z;
  lumShift += wA * uHSL_Aqua.z + wB * uHSL_Blue.z + wP * uHSL_Purple.z + wM * uHSL_Magenta.z;
  lumShift /= totalW;

  hsl.x += hueShift / 360.0;
  hsl.x = fract(hsl.x);
  hsl.y = clamp(hsl.y * (1.0 + satShift / 100.0), 0.0, 1.0);
  hsl.z = clamp(hsl.z + lumShift / 200.0, 0.0, 1.0);

  vec3 result = hsl2rgb(hsl);
  gl_FragColor = vec4(result, texColor.a);
}
