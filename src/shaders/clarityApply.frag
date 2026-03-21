precision highp float;

uniform sampler2D uTexture;
uniform sampler2D uBlurred;
uniform float uClarity;

varying vec2 vUv;

void main() {
  vec3 original = texture2D(uTexture, vUv).rgb;
  vec3 blurred = texture2D(uBlurred, vUv).rgb;
  vec3 detail = original - blurred;
  vec3 result = original + detail * (uClarity / 100.0);
  gl_FragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
