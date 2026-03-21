precision highp float;

uniform sampler2D uTexture;
uniform int uNumRanges;
uniform vec2 uHueRanges[8]; // center, width pairs
uniform float uDesaturateStrength;

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
    if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

void main() {
  vec4 texColor = texture2D(uTexture, vUv);
  vec3 color = texColor.rgb;
  vec3 hsl = rgb2hsl(color);
  float hue = hsl.x * 360.0;

  float preserve = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uNumRanges) break;
    float center = uHueRanges[i].x;
    float width = uHueRanges[i].y;
    float dist = abs(hue - center);
    if (dist > 180.0) dist = 360.0 - dist;
    float feather = width * 0.3;
    preserve = max(preserve, 1.0 - smoothstep(width * 0.5, width * 0.5 + feather, dist));
  }

  float gray = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float desat = (1.0 - preserve) * (uDesaturateStrength / 100.0);
  color = mix(color, vec3(gray), desat);

  gl_FragColor = vec4(color, texColor.a);
}
