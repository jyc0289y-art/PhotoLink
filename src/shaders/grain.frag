precision highp float;

uniform sampler2D uTexture;
uniform float uGrainAmount;
uniform float uGrainSize;
uniform float uTime;

varying vec2 vUv;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 texColor = texture2D(uTexture, vUv);
  vec3 color = texColor.rgb;

  float scale = max(1.0, 101.0 - uGrainSize);
  vec2 grainUv = vUv * scale + vec2(uTime);
  float noise = rand(grainUv) - 0.5;
  noise *= uGrainAmount / 100.0;

  color += noise;
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), texColor.a);
}
