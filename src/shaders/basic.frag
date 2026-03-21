precision highp float;

uniform sampler2D uTexture;
uniform float uExposure;
uniform float uContrast;
uniform float uHighlights;
uniform float uShadows;
uniform vec3 uColorTempRGB;
uniform float uSaturation;
uniform float uVibrance;

varying vec2 vUv;

void main() {
  vec4 texColor = texture2D(uTexture, vUv);
  vec3 color = texColor.rgb;

  // 1. Exposure (EV stops)
  color *= pow(2.0, uExposure);

  // 2. Contrast (S-curve around midtones)
  color = (color - 0.5) * (1.0 + uContrast / 100.0) + 0.5;

  // 3. Highlights / Shadows
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float highlightMask = smoothstep(0.5, 1.0, lum);
  float shadowMask = 1.0 - smoothstep(0.0, 0.5, lum);
  color += color * highlightMask * (uHighlights / 200.0);
  color += color * shadowMask * (uShadows / 200.0);

  // 4. Color Temperature
  color *= uColorTempRGB;

  // 5. Saturation
  float gray = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(gray), color, 1.0 + uSaturation / 100.0);

  // 6. Vibrance
  float currentSat = length(color - vec3(gray)) / (gray + 0.001);
  float vibranceWeight = 1.0 - clamp(currentSat, 0.0, 1.0);
  color = mix(vec3(gray), color, 1.0 + uVibrance / 100.0 * vibranceWeight);

  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, texColor.a);
}
