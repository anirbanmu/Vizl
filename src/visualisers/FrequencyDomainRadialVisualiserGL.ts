import type AudioAnalysisData from "../AudioAnalysisData";
import type AudioAnalysisMetadata from "../AudioAnalysisMetadata";
import type { Vector2d } from "../util";
import { hexToRGB } from "../util";
import BaseAudioVisualiserGL from "./BaseAudioVisualiserGL";

export default class FrequencyDomainRadialVisualiserGL extends BaseAudioVisualiserGL {
  private barDivs = 28;
  private vertCount = 0;

  constructor(canvas: HTMLCanvasElement, analysisMetadata: AudioAnalysisMetadata) {
    super(canvas, { ...analysisMetadata, frequencyBinCount: Math.floor(0.74 * analysisMetadata.frequencyBinCount) });

    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
    this.gl.enable(this.gl.BLEND);

    this.prepShaders();
    this.resize();
  }

  public resize(width: number = 0, height: number = 0): void {
    super.resize(width, height);

    const center = this.center();
    this.gl.uniform2fv(this.uniformLocation('center'), new Float32Array([center.x, center.y]));
    this.gl.uniform2fv(this.uniformLocation('dimensions'), new Float32Array([this.canvas.width, this.canvas.height]));
  }

  public render(analysisData: AudioAnalysisData): void {
    this.gl.uniform4fv(this.uniformLocation('magnitudes[0]'), analysisData.frequencyData);

    {
      const scalingDim = this.minDim() / 2;
      const freqIntensityFactor = freqIntensityMultipler(analysisData.frequencyData, this.minDb(), this.maxDb());
      const lineWidths = { x: 2, y: pickGapUpperBound(2, this.barDivs, scalingDim * 0.20) };

      const minRadiusPortion = 0.15;
      const baseRadius = scalingDim * (minRadiusPortion + freqIntensityFactor * (0.50 - minRadiusPortion));
      const maxRadius = baseRadius + scalingDim * 0.35;
      let bars = generateRadialBars(this.barDivs, lineWidths, { x: baseRadius, y: maxRadius });
      this.gl.uniform2fv(this.uniformLocation('barRadii[0]'), new Float32Array(bars));
    }

    this.gl.drawArrays(this.gl.TRIANGLES, 0, this.vertCount);
  }

  private prepShaders(): void {
    const colors = [
      ...hexToRGB(0x00D1B1), 0.0, 0.0,
      ...hexToRGB(0xABE300), 0.7, 0.2,
      ...hexToRGB(0xFF8400), 1.0, 0.65,
      ...hexToRGB(0xFF2D00), 1.0, 1.0
    ];

    const vShader = this.compileShader(this.gl.VERTEX_SHADER, this.templateShader(aspectCorrectingVertShader, { 'FREQUENCY_BARS': this.frequencyBinCount(), 'FREQUENCY_BAR_DIVS': this.barDivs }));
    const fShader = this.compileShader(this.gl.FRAGMENT_SHADER, this.templateShader(freqBarsFragShader, { 'FREQUENCY_BAR_DIVS': this.barDivs, 'FREQUENCY_BAR_COLORS': colors.length }));

    this.makeAndUseProgram(vShader, fShader);
    {
      let vertProperties = generateVertexAttributes(this.frequencyBinCount(), 0.1, this.barDivs);
      this.updateFloatAttribute(new Float32Array(vertProperties['indices']), this.gl.STATIC_DRAW, 'index', 3);
      this.updateFloatAttribute(new Float32Array(vertProperties['angles']), this.gl.STATIC_DRAW, 'barAngles', 2);
      this.vertCount = vertProperties['vertexCount'];
    }

    this.gl.uniform2fv(this.uniformLocation('minMaxDb'), new Float32Array([this.minDb(), this.maxDb()]));

    for (let i = 0; i < colors.length; i += 5) {
      this.gl.uniform4fv(this.uniformLocation('colors[' + Math.floor(i / 5) + '].color'), new Float32Array(colors.slice(i, i + 4)));
      this.gl.uniform1f(this.uniformLocation('colors[' + Math.floor(i / 5) + '].colorStop'), colors[i + 4]);
    }
  }
}

function normalizeFreqMagnitude(mag: number, min: number, max: number): number {
  return Math.min(1.0, Math.max(0.0, (mag - min) / (max - min)));
}

function freqIntensityMultipler(frequencyData: Float32Array, min: number, max: number): number {
  let rMultiplier = 0;
  for (let i = 0; i < frequencyData.length / 4; i++) {
    rMultiplier += frequencyData[i];
  }
  return normalizeFreqMagnitude(rMultiplier / (frequencyData.length / 4), min, max);
}

function lineWidthIncrement(lineWidths: Vector2d, segmentCount: number): number {
  return (lineWidths.y - lineWidths.x) / segmentCount;
}

function generateRadialBars(barCount: number, gapWidthRange: Vector2d, radii: Vector2d): Array<number> {
  // Not including segmented gaps
  const maxLength = radii.y - radii.x;

  const radialIncrement = 0.05 * maxLength / barCount;
  const radialMultiplier = 2 * (maxLength - barCount * radialIncrement) / (barCount * (barCount - 1));

  const lineWidthInc = lineWidthIncrement(gapWidthRange, barCount);

  let lastOuterRadius = radii.x;
  let bars = []
  for (let i = 0; i < barCount; ++i) {
    const innerRadius = lastOuterRadius;
    const outerRadius = innerRadius + (radialIncrement + radialMultiplier * i);
    bars.push(innerRadius, outerRadius);
    lastOuterRadius = outerRadius + (gapWidthRange.x + lineWidthInc * i);
  }
  return bars;
}

function pickGapUpperBound(gapRangeStart: number, segmentCount: number, length: number): number {
  return gapRangeStart + 2 * (length - segmentCount * gapRangeStart) / (segmentCount - 1);
}

function generateVertexAttributes(divisions: number, gapPercent: number, barCount: number): { indices: Array<number>, angles: Array<number>, vertexCount: number } {
  const angularIncrement = -2 * Math.PI / divisions;
  const angleOffset = angularIncrement * gapPercent;

  let indices = [], angles = [];
  for (let i = 0; i < divisions; i++) {
    for (let j = 0; j < barCount; j++) {
      for (let k = 0; k < 6; k++) {
        indices.push(i, j, k);
        angles.push(angularIncrement * i + angleOffset, angularIncrement * (i + 1) - angleOffset);
      }
    }
  }

  return { indices, angles, vertexCount: angles.length / 2 };
}

const aspectCorrectingVertShader = `
    precision highp float;

    attribute vec3 index; // Should be uint's but OpenGL ES doesn't allow integer attributes. x: polyIndex, y: barIndex, z:vertexIndex.
    attribute vec2 barAngles; // angles of this bar. (start, end)

    uniform vec2 minMaxDb;
    uniform vec2 dimensions;
    uniform vec2 barRadii[FREQUENCY_BAR_DIVS];
    uniform vec4 magnitudes[FREQUENCY_BARS / 4]; // Flat array packed into vec4's to save uniform space.

    varying float normalizedMagnitude;
    varying vec2 angles;
    varying vec2 radii;
    varying float divIndex;

    float normalizeFreqMagnitude(float db, float minDb, float maxDb) {
        return min(1.0, max(0.0, (db - minDb) / (maxDb - minDb)));
    }

    float getMagnitude(int index) {
        int arrayIndex = index / 4;
        int subIndex = index - arrayIndex * 4;
        vec4 m = magnitudes[arrayIndex];
        if (subIndex == 0) return m.x;
        if (subIndex == 1) return m.y;
        if (subIndex == 2) return m.z;
        return m.w;
    }

    vec4 generateTriangleVertex(int idx, vec2 angleSpan, vec2 radiiSpan, vec2 aspect) {
        vec2 sortedAngles = vec2(max(angleSpan.x, angleSpan.y), min(angleSpan.x, angleSpan.y));
        float angle;
        float radius;

        if (idx == 0) { angle = sortedAngles.x; radius = radiiSpan.x; }
        else if (idx == 1) { angle = sortedAngles.y; radius = radiiSpan.x; }
        else if (idx == 2 || idx == 3) { angle = sortedAngles.y; radius = radiiSpan.y; }
        else if (idx == 4) { angle = sortedAngles.x; radius = radiiSpan.y; }
        else if (idx == 5) { angle = sortedAngles.x; radius = radiiSpan.x; }

        return vec4(cos(angle) * radius * aspect.x, sin(angle) * radius * aspect.y, 0.0, 1.0);
    }

    void main() {
        angles = barAngles;
        normalizedMagnitude = normalizeFreqMagnitude(getMagnitude(int(index.x)), minMaxDb.x, minMaxDb.y);
        radii = barRadii[int(index.y)];
        divIndex = index.y;

        float minDim = min(dimensions.x, dimensions.y);
        gl_Position = generateTriangleVertex(int(index.z), angles, radii / (minDim / 2.0), vec2(minDim / dimensions.x, minDim / dimensions.y));
    }
`;

const freqBarsFragShader = `
    precision highp float;

    uniform vec2 center;
    uniform vec2 barRadii[FREQUENCY_BAR_DIVS];

    struct Color {
        vec4 color;
        float colorStop;
    };

    uniform Color colors[FREQUENCY_BAR_COLORS];

    varying float normalizedMagnitude;
    varying vec2 angles;
    varying vec2 radii;
    varying float divIndex;

    vec4 getColor(float radius, vec2 bounds) {
        float rangeRelativeRadius = radius - bounds.x;
        float rangeRadius = bounds.y - bounds.x;

        float normalized = rangeRelativeRadius / rangeRadius;
        Color lastColor = Color(vec4(0.0, 0.0, 0.0, 0.0), 0.0); // Takes care of first color stop not being at 0.0
        for (int i = 0; i < FREQUENCY_BAR_COLORS; i++) {
            Color currentColor = colors[i];
            if (normalized > lastColor.colorStop && normalized < currentColor.colorStop) {
                return mix(lastColor.color, currentColor.color, (normalized - lastColor.colorStop) / (currentColor.colorStop - lastColor.colorStop));
            }

            lastColor = currentColor;
        }

        // Color stops did not cover upto 1.0.
        return mix(lastColor.color, vec4(0.0, 0.0, 0.0, 0.0), (normalized - lastColor.colorStop) / (1.0 - lastColor.colorStop));
    }

    const float inf = 1.0 / 0.0;
    const float pi = 3.141592653589793;

    float arctan(vec2 position) {
        float angleTan = position.y / position.x;

        if (abs(angleTan) == inf) {
            return (position.y < 0.0) ? -0.5 * pi : -1.5 * pi;
        }

        float angle = atan(angleTan);
        if (angle > 0.0) {
            return (position.x < 0.0) ? angle - pi : angle - 2.0 * pi;
        }
        return (position.x < 0.0) ? angle - pi : angle;
    }

    vec4 applyRadialEdgeTransparency(vec4 color, float radius, vec2 edgeRadii) {
        const float allowedDelta = 0.15;
        float delta = min(radius - edgeRadii.x, edgeRadii.y - radius) / (edgeRadii.y - edgeRadii.x);
        if (delta < allowedDelta) {
            return vec4(color.rgb, color.a * (delta / allowedDelta));
        }
        return color;
    }

    vec4 applyBarEdgeTransparency(vec4 color, vec2 position, vec2 angleBounds) {
        float angle = arctan(position);

        const float allowedDelta = 0.10;
        float delta = min(abs(angleBounds.x - angle), abs(angleBounds.y - angle)) / abs(angleBounds.y - angleBounds.x);
        if (delta < allowedDelta) {
            return vec4(color.rgb, color.a * (delta / allowedDelta));
        }
        return color;
    }

    void main() {
        vec2 pos = vec2(gl_FragCoord.x - center.x, gl_FragCoord.y - center.y);
        float radius = sqrt(pos.x * pos.x + pos.y * pos.y);
        float rawDivs = normalizedMagnitude * float(FREQUENCY_BAR_DIVS);
        float partialLastDiv = rawDivs - floor(rawDivs);
        int lastDivIndex = int(floor(rawDivs));

        float innerRadius = radii.x;
        float outerRadius = radii.y;
        int thisDivIndex = int(divIndex);
        outerRadius = lastDivIndex == thisDivIndex ? innerRadius + partialLastDiv * (outerRadius - innerRadius) : outerRadius;
        if (thisDivIndex > lastDivIndex || radius < innerRadius || radius > outerRadius) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }

        gl_FragColor = getColor(radius, vec2(barRadii[0].x, barRadii[FREQUENCY_BAR_DIVS - 1].y));
        gl_FragColor = applyRadialEdgeTransparency(gl_FragColor, radius, vec2(innerRadius, outerRadius));
        gl_FragColor = applyBarEdgeTransparency(gl_FragColor, pos, angles);
    }
`;
