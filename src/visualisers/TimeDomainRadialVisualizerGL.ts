import type AudioAnalysisData from '../AudioAnalysisData';
import type AudioAnalysisMetadata from '../AudioAnalysisMetadata';
import BaseAudioVisualiserGL from './BaseAudioVisualiserGL';

export default class TimeDomainRadialVisualiserGL extends BaseAudioVisualiserGL {
  constructor(
    canvas: HTMLCanvasElement,
    analysisMetadata: AudioAnalysisMetadata
  ) {
    super(canvas, analysisMetadata);
    this.prepShaders();
    this.resize();
  }

  public resize(width: number = 0, height: number = 0): void {
    super.resize(width, height);

    const minCanvasDim = this.minDim();
    this.gl.uniform2fv(
      this.uniformLocation('aspectScale'),
      new Float32Array([
        minCanvasDim / this.gl.drawingBufferWidth,
        minCanvasDim / this.gl.drawingBufferHeight,
      ])
    );
  }

  public render(analysisData: AudioAnalysisData): void {
    if (this.resizeNeeded()) {
      this.resize();
    }

    this.updateFloatAttribute(
      analysisData.timeData,
      this.gl.DYNAMIC_DRAW,
      'magnitude'
    );

    const baseRadius = 0.2;
    const magnitudeScale = baseRadius * 0.5;
    const angularIncrement = (2 * Math.PI) / analysisData.timeData.length;

    this.gl.uniform1f(this.uniformLocation('baseRadius'), baseRadius);
    this.gl.uniform1f(this.uniformLocation('magnitudeScale'), magnitudeScale);
    this.gl.uniform1f(
      this.uniformLocation('angularIncrement'),
      angularIncrement
    );

    this.gl.drawArrays(this.gl.LINE_STRIP, 0, analysisData.timeData.length);

    this.gl.uniform1f(
      this.uniformLocation('angularIncrement'),
      -angularIncrement
    );
    this.gl.drawArrays(this.gl.LINE_STRIP, 0, analysisData.timeData.length);
  }

  private prepShaders(): void {
    const vShader = this.compileShader(
      this.gl.VERTEX_SHADER,
      scalarToCircularVertShader
    );
    const fShader = this.compileShader(
      this.gl.FRAGMENT_SHADER,
      trivialColorFragmentShader
    );
    this.makeAndUseProgram(vShader, fShader);

    this.updateFloatAttribute(
      new Float32Array(Array.from(new Array(this.timeFftSize()), (x, i) => i)),
      this.gl.STATIC_DRAW,
      'vertexId'
    );
    this.gl.uniform4fv(
      this.uniformLocation('color'),
      new Float32Array([0.905, 0.298, 0.235, 0.5])
    );
  }
}

const scalarToCircularVertShader = `
    attribute float vertexId; // Should be uint's but OpenGL ES doesn't allow integer attributes.
    attribute float magnitude;

    uniform float baseRadius;
    uniform float magnitudeScale;
    uniform float angularIncrement;
    uniform vec2 aspectScale;

    void main() {
        float angle = angularIncrement * vertexId;
        float finalRadius = baseRadius + magnitudeScale * magnitude;
        gl_Position = vec4(finalRadius * cos(angle) * aspectScale.x, finalRadius * sin(angle) * aspectScale.y, 0.0, 1.0);
    }
`;

const trivialColorFragmentShader = `
    precision highp float;

    uniform vec4 color;

    void main() {
        gl_FragColor = color;
    }
`;
