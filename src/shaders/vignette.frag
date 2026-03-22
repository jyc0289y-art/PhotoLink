precision highp float;

uniform sampler2D uTexture;
uniform float uAmount;      // 0~1 (mapped from 0~100)
uniform float uMidpoint;    // 0~1 (mapped from 0~100)
uniform float uRoundness;   // -1~1 (mapped from -100~100)
uniform float uFeather;     // 0~1 (mapped from 0~100)

varying vec2 vUv;

void main() {
  vec4 texColor = texture2D(uTexture, vUv);
  vec3 color = texColor.rgb;

  // Center-relative coordinates
  vec2 center = vUv - 0.5;

  // Roundness adjusts aspect ratio of the vignette ellipse
  float aspect = 1.0 + uRoundness * 0.5;
  center.x *= mix(1.0, aspect, step(0.0, uRoundness));
  center.y *= mix(aspect, 1.0, step(0.0, uRoundness));

  float dist = length(center) * 2.0; // 0 at center, ~1.414 at corners

  // Vignette falloff
  float start = uMidpoint;
  float end = start + uFeather * (1.0 - start);
  float vignette = 1.0 - smoothstep(start, max(end, start + 0.01), dist);

  // Apply darkening
  float darken = mix(1.0, vignette, uAmount);
  color *= darken;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), texColor.a);
}
