precision highp float;

uniform sampler2D uTexture;
uniform float uShadowHue;
uniform float uShadowSat;
uniform float uHighlightHue;
uniform float uHighlightSat;
uniform float uBalance;

varying vec2 vUv;

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  if (s < 0.001) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  float hk = h;
  float tr = hk + 1.0/3.0;
  float tg = hk;
  float tb = hk - 1.0/3.0;
  if (tr > 1.0) tr -= 1.0;
  if (tb < 0.0) tb += 1.0;

  float r = tr < 1.0/6.0 ? p + (q-p)*6.0*tr :
            tr < 0.5 ? q :
            tr < 2.0/3.0 ? p + (q-p)*(2.0/3.0-tr)*6.0 : p;
  float g = tg < 1.0/6.0 ? p + (q-p)*6.0*tg :
            tg < 0.5 ? q :
            tg < 2.0/3.0 ? p + (q-p)*(2.0/3.0-tg)*6.0 : p;
  float b = tb < 1.0/6.0 ? p + (q-p)*6.0*tb :
            tb < 0.5 ? q :
            tb < 2.0/3.0 ? p + (q-p)*(2.0/3.0-tb)*6.0 : p;
  return vec3(r, g, b);
}

void main() {
  vec4 texColor = texture2D(uTexture, vUv);
  vec3 color = texColor.rgb;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));

  float balanceNorm = uBalance / 100.0;
  float shadowThreshold = 0.5 + balanceNorm * 0.3;
  float highlightThreshold = 0.5 + balanceNorm * 0.3;

  float shadowWeight = (1.0 - smoothstep(0.0, shadowThreshold, lum)) * (uShadowSat / 100.0);
  float highlightWeight = smoothstep(highlightThreshold, 1.0, lum) * (uHighlightSat / 100.0);

  if (shadowWeight > 0.001) {
    vec3 shadowTint = hsl2rgb(vec3(uShadowHue / 360.0, 1.0, lum));
    color = mix(color, shadowTint, shadowWeight * 0.5);
  }
  if (highlightWeight > 0.001) {
    vec3 highlightTint = hsl2rgb(vec3(uHighlightHue / 360.0, 1.0, lum));
    color = mix(color, highlightTint, highlightWeight * 0.5);
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), texColor.a);
}
