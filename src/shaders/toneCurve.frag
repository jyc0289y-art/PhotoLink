precision highp float;

uniform sampler2D uTexture;
uniform sampler2D uCurveLUT;  // 256x1 RGBA texture: R=master, G=red, B=green, A=blue

varying vec2 vUv;

void main() {
  vec4 texColor = texture2D(uTexture, vUv);
  vec3 color = texColor.rgb;

  // Look up each channel through the curve LUT
  float r = texture2D(uCurveLUT, vec2(color.r, 0.5)).g;  // red channel curve
  float g = texture2D(uCurveLUT, vec2(color.g, 0.5)).b;  // green channel curve
  float b = texture2D(uCurveLUT, vec2(color.b, 0.5)).a;  // blue channel curve

  // Apply master curve on top
  r = texture2D(uCurveLUT, vec2(r, 0.5)).r;
  g = texture2D(uCurveLUT, vec2(g, 0.5)).r;
  b = texture2D(uCurveLUT, vec2(b, 0.5)).r;

  gl_FragColor = vec4(r, g, b, texColor.a);
}
