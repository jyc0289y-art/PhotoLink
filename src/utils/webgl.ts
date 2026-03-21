import vertSrc from '../shaders/passthrough.vert?raw';
import basicFrag from '../shaders/basic.frag?raw';
import hslFrag from '../shaders/hsl.frag?raw';
import splitToneFrag from '../shaders/splitTone.frag?raw';
import clarityBlurHFrag from '../shaders/clarityBlurH.frag?raw';
import clarityBlurVFrag from '../shaders/clarityBlurV.frag?raw';
import clarityApplyFrag from '../shaders/clarityApply.frag?raw';
import grainFrag from '../shaders/grain.frag?raw';
import selectiveColorFrag from '../shaders/selectiveColor.frag?raw';
import { EditParams } from '../types/editor';
import { colorTempToRGB } from './colorTemp';

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

export class WebGLEngine {
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;
  private programs: Record<string, ShaderProgram> = {};
  private quadBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private sourceTexture: WebGLTexture | null = null;
  private fbos: WebGLFramebuffer[] = [];
  private fboTextures: WebGLTexture[] = [];
  private imageWidth = 0;
  private imageHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;

    this.initBuffers();
    this.initPrograms();
  }

  private initBuffers() {
    const gl = this.gl;

    // Full-screen quad
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  }

  private compileShader(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${log}`);
    }
    return shader;
  }

  private createProgram(fragSrc: string, uniformNames: string[]): ShaderProgram {
    const gl = this.gl;
    const vert = this.compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.bindAttribLocation(program, 1, 'aTexCoord');
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
    }

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }

    return { program, uniforms };
  }

  private initPrograms() {
    this.programs.basic = this.createProgram(basicFrag, [
      'uTexture', 'uExposure', 'uContrast', 'uHighlights', 'uShadows',
      'uColorTempRGB', 'uSaturation', 'uVibrance',
    ]);

    this.programs.hsl = this.createProgram(hslFrag, [
      'uTexture',
      'uHSL_Red', 'uHSL_Orange', 'uHSL_Yellow', 'uHSL_Green',
      'uHSL_Aqua', 'uHSL_Blue', 'uHSL_Purple', 'uHSL_Magenta',
    ]);

    this.programs.splitTone = this.createProgram(splitToneFrag, [
      'uTexture', 'uShadowHue', 'uShadowSat', 'uHighlightHue', 'uHighlightSat', 'uBalance',
    ]);

    this.programs.clarityBlurH = this.createProgram(clarityBlurHFrag, [
      'uTexture', 'uResolution', 'uRadius',
    ]);

    this.programs.clarityBlurV = this.createProgram(clarityBlurVFrag, [
      'uTexture', 'uResolution', 'uRadius',
    ]);

    this.programs.clarityApply = this.createProgram(clarityApplyFrag, [
      'uTexture', 'uBlurred', 'uClarity',
    ]);

    this.programs.grain = this.createProgram(grainFrag, [
      'uTexture', 'uGrainAmount', 'uGrainSize', 'uTime',
    ]);

    this.programs.selectiveColor = this.createProgram(selectiveColorFrag, [
      'uTexture', 'uNumRanges', 'uDesaturateStrength',
      ...Array.from({ length: 8 }, (_, i) => `uHueRanges[${i}]`),
    ]);
  }

  private createFBO(): { fbo: WebGLFramebuffer; texture: WebGLTexture } {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.imageWidth, this.imageHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { fbo, texture };
  }

  private drawQuad(prog: ShaderProgram) {
    const gl = this.gl;
    gl.useProgram(prog.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private bindTexture(unit: number, texture: WebGLTexture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }

  loadImage(image: HTMLImageElement | HTMLCanvasElement) {
    const gl = this.gl;

    this.imageWidth = image.width;
    this.imageHeight = image.height;
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    gl.viewport(0, 0, image.width, image.height);

    if (this.sourceTexture) gl.deleteTexture(this.sourceTexture);
    this.sourceTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Pre-create FBOs for this image size
    this.cleanupFBOs();
    for (let i = 0; i < 3; i++) {
      const { fbo, texture } = this.createFBO();
      this.fbos.push(fbo);
      this.fboTextures.push(texture);
    }
  }

  private cleanupFBOs() {
    const gl = this.gl;
    for (const fbo of this.fbos) gl.deleteFramebuffer(fbo);
    for (const tex of this.fboTextures) gl.deleteTexture(tex);
    this.fbos = [];
    this.fboTextures = [];
  }

  render(params: EditParams) {
    if (!this.sourceTexture || this.fbos.length < 3) return;
    const gl = this.gl;

    let currentTexture = this.sourceTexture;
    let fboIndex = 0;

    const renderPass = (prog: ShaderProgram, setUniforms: () => void, toScreen = false) => {
      if (!toScreen) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[fboIndex]);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      gl.viewport(0, 0, this.imageWidth, this.imageHeight);
      gl.useProgram(prog.program);
      this.bindTexture(0, currentTexture);
      gl.uniform1i(prog.uniforms['uTexture'], 0);
      setUniforms();
      this.drawQuad(prog);
      if (!toScreen) {
        currentTexture = this.fboTextures[fboIndex];
        fboIndex = (fboIndex + 1) % 2; // ping-pong between 0 and 1
      }
    };

    // Pass 1: Basic adjustments
    const tempRGB = colorTempToRGB(params.colorTemp);
    const basicProg = this.programs.basic;
    renderPass(basicProg, () => {
      gl.uniform1f(basicProg.uniforms['uExposure'], params.exposure);
      gl.uniform1f(basicProg.uniforms['uContrast'], params.contrast);
      gl.uniform1f(basicProg.uniforms['uHighlights'], params.highlights);
      gl.uniform1f(basicProg.uniforms['uShadows'], params.shadows);
      gl.uniform3f(basicProg.uniforms['uColorTempRGB'], tempRGB[0], tempRGB[1], tempRGB[2]);
      gl.uniform1f(basicProg.uniforms['uSaturation'], params.saturation);
      gl.uniform1f(basicProg.uniforms['uVibrance'], params.vibrance);
    });

    // Pass 2: HSL
    const hasHSL = Object.values(params.hsl).some(ch => ch.hue !== 0 || ch.saturation !== 0 || ch.luminance !== 0);
    if (hasHSL) {
      const hslProg = this.programs.hsl;
      renderPass(hslProg, () => {
        const channels = ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta'] as const;
        const keys = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'] as const;
        for (let i = 0; i < channels.length; i++) {
          const ch = params.hsl[keys[i]];
          gl.uniform3f(hslProg.uniforms[`uHSL_${channels[i]}`], ch.hue, ch.saturation, ch.luminance);
        }
      });
    }

    // Pass 3: Split toning
    const hasSplitTone = params.splitToning.shadowSat > 0 || params.splitToning.highlightSat > 0;
    if (hasSplitTone) {
      const stProg = this.programs.splitTone;
      renderPass(stProg, () => {
        gl.uniform1f(stProg.uniforms['uShadowHue'], params.splitToning.shadowHue);
        gl.uniform1f(stProg.uniforms['uShadowSat'], params.splitToning.shadowSat);
        gl.uniform1f(stProg.uniforms['uHighlightHue'], params.splitToning.highlightHue);
        gl.uniform1f(stProg.uniforms['uHighlightSat'], params.splitToning.highlightSat);
        gl.uniform1f(stProg.uniforms['uBalance'], params.splitToning.balance);
      });
    }

    // Pass 4: Clarity (multi-pass blur + unsharp mask)
    if (params.clarity !== 0) {
      const beforeClarityTexture = currentTexture;
      const radius = Math.abs(params.clarity) * 0.5 + 5;

      // Horizontal blur
      const blurHProg = this.programs.clarityBlurH;
      renderPass(blurHProg, () => {
        gl.uniform2f(blurHProg.uniforms['uResolution'], this.imageWidth, this.imageHeight);
        gl.uniform1f(blurHProg.uniforms['uRadius'], radius);
      });

      // Vertical blur
      const blurVProg = this.programs.clarityBlurV;
      renderPass(blurVProg, () => {
        gl.uniform2f(blurVProg.uniforms['uResolution'], this.imageWidth, this.imageHeight);
        gl.uniform1f(blurVProg.uniforms['uRadius'], radius);
      });

      // Store blurred result in fbo[2]
      const blurredTexture = currentTexture;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[2]);
      gl.viewport(0, 0, this.imageWidth, this.imageHeight);
      // Copy blurred to fbo[2]
      const copyProg = this.programs.basic;
      gl.useProgram(copyProg.program);
      this.bindTexture(0, blurredTexture);
      gl.uniform1i(copyProg.uniforms['uTexture'], 0);
      gl.uniform1f(copyProg.uniforms['uExposure'], 0);
      gl.uniform1f(copyProg.uniforms['uContrast'], 0);
      gl.uniform1f(copyProg.uniforms['uHighlights'], 0);
      gl.uniform1f(copyProg.uniforms['uShadows'], 0);
      gl.uniform3f(copyProg.uniforms['uColorTempRGB'], 1, 1, 1);
      gl.uniform1f(copyProg.uniforms['uSaturation'], 0);
      gl.uniform1f(copyProg.uniforms['uVibrance'], 0);
      this.drawQuad(copyProg);

      // Apply clarity: original + clarity * (original - blurred)
      currentTexture = beforeClarityTexture;
      const clarityProg = this.programs.clarityApply;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[fboIndex]);
      gl.viewport(0, 0, this.imageWidth, this.imageHeight);
      gl.useProgram(clarityProg.program);
      this.bindTexture(0, beforeClarityTexture);
      gl.uniform1i(clarityProg.uniforms['uTexture'], 0);
      this.bindTexture(1, this.fboTextures[2]);
      gl.uniform1i(clarityProg.uniforms['uBlurred'], 1);
      gl.uniform1f(clarityProg.uniforms['uClarity'], params.clarity);
      this.drawQuad(clarityProg);
      currentTexture = this.fboTextures[fboIndex];
      fboIndex = (fboIndex + 1) % 2;
    }

    // Pass 5: Selective color
    if (params.selectiveColor.enabled && params.selectiveColor.preserveHueRanges.length > 0) {
      const scProg = this.programs.selectiveColor;
      renderPass(scProg, () => {
        gl.uniform1i(scProg.uniforms['uNumRanges'], params.selectiveColor.preserveHueRanges.length);
        gl.uniform1f(scProg.uniforms['uDesaturateStrength'], params.selectiveColor.desaturateStrength);
        for (let i = 0; i < 8; i++) {
          const range = params.selectiveColor.preserveHueRanges[i];
          if (range) {
            gl.uniform2f(scProg.uniforms[`uHueRanges[${i}]`], range.center, range.width);
          } else {
            gl.uniform2f(scProg.uniforms[`uHueRanges[${i}]`], 0, 0);
          }
        }
      });
    }

    // Pass 6: Grain
    if (params.grain.amount > 0) {
      const grainProg = this.programs.grain;
      const isLastPass = true;
      renderPass(grainProg, () => {
        gl.uniform1f(grainProg.uniforms['uGrainAmount'], params.grain.amount);
        gl.uniform1f(grainProg.uniforms['uGrainSize'], params.grain.size);
        gl.uniform1f(grainProg.uniforms['uTime'], performance.now() * 0.001);
      }, isLastPass);
      return; // Already rendered to screen
    }

    // Final pass to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.imageWidth, this.imageHeight);
    const finalProg = this.programs.basic;
    gl.useProgram(finalProg.program);
    this.bindTexture(0, currentTexture);
    gl.uniform1i(finalProg.uniforms['uTexture'], 0);
    gl.uniform1f(finalProg.uniforms['uExposure'], 0);
    gl.uniform1f(finalProg.uniforms['uContrast'], 0);
    gl.uniform1f(finalProg.uniforms['uHighlights'], 0);
    gl.uniform1f(finalProg.uniforms['uShadows'], 0);
    gl.uniform3f(finalProg.uniforms['uColorTempRGB'], 1, 1, 1);
    gl.uniform1f(finalProg.uniforms['uSaturation'], 0);
    gl.uniform1f(finalProg.uniforms['uVibrance'], 0);
    this.drawQuad(finalProg);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  destroy() {
    const gl = this.gl;
    this.cleanupFBOs();
    if (this.sourceTexture) gl.deleteTexture(this.sourceTexture);
    this.sourceTexture = null;
    for (const prog of Object.values(this.programs)) {
      gl.deleteProgram(prog.program);
    }
  }
}
