import type AudioAnalysisData from "../AudioAnalysisData";
import type AudioAnalysisMetadata from "../AudioAnalysisMetadata";
import BaseAudioVisualiserGL from "./BaseAudioVisualiserGL";

export default class FrequencyDomainBackgroundVisualiserGL extends BaseAudioVisualiserGL {
  constructor(canvas: HTMLCanvasElement, analysisMetadata: AudioAnalysisMetadata) {
    super(canvas, { ...analysisMetadata, frequencyBinCount: Math.trunc(analysisMetadata.frequencyBinCount * 0.725) });

    this.gl.blendFuncSeparate(
      this.gl.SRC_ALPHA,
      this.gl.ONE_MINUS_SRC_ALPHA,
      this.gl.ONE,
      this.gl.ONE_MINUS_SRC_ALPHA
    );
    this.gl.enable(this.gl.BLEND);

    this.prepShaders();
    this.resize();
  }

  public resize(width: number = 0, height: number = 0): void {
    super.resize(width, height);
    this.gl.uniform2fv(
      this.uniformLocation('dimensions'),
      new Float32Array([this.canvas.width, this.canvas.height])
    );
  }

  public render(analysisData: AudioAnalysisData): void {
    this.gl.uniform4fv(this.uniformLocation('magnitudes[0]'), analysisData.frequencyData);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  private prepShaders(): void {
    const vShader = this.compileShader(
      this.gl.VERTEX_SHADER,
      this.templateShader(quadVertShader, { FREQUENCY_BARS: this.frequencyBinCount() })
    );
    const fShader = this.compileShader(
      this.gl.FRAGMENT_SHADER,
      this.templateShader(freqBackgroundFragShader, { FREQUENCY_BARS: this.frequencyBinCount() })
    );
    this.makeAndUseProgram(vShader, fShader);

    this.updateFloatAttribute(
      new Float32Array([0, 1, 2, 3]),
      this.gl.STATIC_DRAW,
      'index'
    );

    this.gl.uniform2fv(
      this.uniformLocation('minMaxDb'),
      new Float32Array([this.minDb(), this.maxDb()])
    );
  }
}

const quadVertShader = `
    precision highp float;

    attribute float index; // Should be uint's but OpenGL ES doesn't allow integer attributes.

    void main() {
        int vertIndex = int(index);
        if (vertIndex == 0) { gl_Position = vec4(-1.0, 1.0, 0.0, 1.0); return; }
        if (vertIndex == 1) { gl_Position = vec4(1.0, 1.0, 0.0, 1.0); return; }
        if (vertIndex == 2) { gl_Position = vec4(-1.0, -1.0, 0.0, 1.0); return; }
        gl_Position = vec4(1.0, -1.0, 0.0, 1.0);
    }
`;

const freqBackgroundFragShader = `
precision highp float;

uniform vec2 minMaxDb;
uniform vec2 dimensions;
uniform vec4 magnitudes[FREQUENCY_BARS / 4]; // Flat array packed into vec4's to save uniform space.

vec3 getMagnitudes(int index) {
    int arrayIndices[3];
    arrayIndices[0] = (index - 1) < 0 ? -1 : (index - 1) / 4;
    arrayIndices[1] = index / 4;
    arrayIndices[2] = (index + 1) / 4;

    int subIndices[3];
    subIndices[0] = (index - 1) - arrayIndices[0] * 4;
    subIndices[1] = index - arrayIndices[1] * 4;
    subIndices[2] = (index + 1) - arrayIndices[2] * 4;

    vec3 mags = vec3(0.0, 0.0, 0.0);

    for (int i = 0; i < FREQUENCY_BARS / 4; i++) {
        if (i == arrayIndices[0]) {
            if (subIndices[0] == 0) mags.x = magnitudes[i].x;
            if (subIndices[0] == 1) mags.x = magnitudes[i].y;
            if (subIndices[0] == 2) mags.x = magnitudes[i].z;
            if (subIndices[0] == 3) mags.x = magnitudes[i].w;
        }
        if (i == arrayIndices[1]) {
            if (subIndices[1] == 0) mags.y = magnitudes[i].x;
            if (subIndices[1] == 1) mags.y = magnitudes[i].y;
            if (subIndices[1] == 2) mags.y = magnitudes[i].z;
            if (subIndices[1] == 3) mags.y = magnitudes[i].w;
        }
        if (i == arrayIndices[2]) {
            if (subIndices[2] == 0) mags.z = magnitudes[i].x;
            if (subIndices[2] == 1) mags.z = magnitudes[i].y;
            if (subIndices[2] == 2) mags.z = magnitudes[i].z;
            if (subIndices[2] == 3) mags.z = magnitudes[i].w;
        }
    }

    return mags;
}

float getMagnitude(int index) {
    int arrayIndex = index / 4;
    int subIndex = index - arrayIndex * 4;

    for (int i = 0; i < FREQUENCY_BARS / 4; i++) {
        if (i == arrayIndex) {
            if (subIndex == 0) return magnitudes[i].x;
            if (subIndex == 1) return magnitudes[i].y;
            if (subIndex == 2) return magnitudes[i].z;
            return magnitudes[i].w;
        }
    }

    return 0.0;
}

float normalizeFreqMagnitude(float db, float minDb, float maxDb) {
    return min(1.0, max(0.0, (db - minDb) / (maxDb - minDb)));
}

void main() {
    vec2 normalizedCoord = vec2(gl_FragCoord.x / dimensions.x, gl_FragCoord.y / dimensions.y);
    normalizedCoord = vec2(normalizedCoord.y, normalizedCoord.x);
    float freqIndexFloat = normalizedCoord.x * float(FREQUENCY_BARS);
    int freqIndex = int(freqIndexFloat);
    vec3 mags = getMagnitudes(freqIndex);
    float normalizedMagnitude = normalizeFreqMagnitude((mags.x + mags.y + mags.z) / 3.0, minMaxDb.x, minMaxDb.y);

    float columnPosition = freqIndexFloat - float(freqIndex); // 0.0 - 1.0
    float prevContribution = max(0.0, 2.0 * (0.5 - columnPosition) * 0.5);
    float currContribution = (1.0 - 2.0 * abs(0.5 - columnPosition)) * 0.5 + 0.5;
    float nextContribution = max(0.0, 2.0 * (columnPosition - 0.5) * 0.5);

    float yDecay = 2.0 * abs(0.5 - normalizedCoord.y);
    yDecay = mix(0.01, 1.0, yDecay * yDecay * yDecay * yDecay * yDecay);
    float colorFactor = normalizeFreqMagnitude(prevContribution * mags.x + currContribution * mags.y + nextContribution * mags.z, minMaxDb.x, minMaxDb.y);
    gl_FragColor = vec4(colorFactor * colorFactor, 0.75 * colorFactor * colorFactor * colorFactor, 0.5 * colorFactor * colorFactor * colorFactor * colorFactor, yDecay);
}
`;
