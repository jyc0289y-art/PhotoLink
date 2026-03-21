precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uRadius;

varying vec2 vUv;

void main() {
  vec2 texelSize = 1.0 / uResolution;
  vec3 result = vec3(0.0);
  float total = 0.0;
  int r = int(uRadius);

  for (int i = -50; i <= 50; i++) {
    if (i > r || i < -r) continue;
    float weight = exp(-float(i * i) / (2.0 * uRadius * uRadius / 4.0));
    vec2 offset = vec2(0.0, float(i) * texelSize.y);
    result += texture2D(uTexture, vUv + offset).rgb * weight;
    total += weight;
  }

  gl_FragColor = vec4(result / total, 1.0);
}
