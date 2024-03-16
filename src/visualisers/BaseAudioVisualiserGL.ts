import type AudioAnalysisMetadata from '../AudioAnalysisMetadata';
import type { Vector2d } from '../util';
import BaseAudioVisualiser from './BaseAudioVisualiser';
import type ShaderAttributeLocations from './ShaderAttributeLocations';
import type ShaderUniformLocations from './ShaderUniformLocations';

class WebGLInitializationException extends Error {
  constructor(error: string) {
    super(error);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, WebGLInitializationException.prototype);
  }
}

export default abstract class BaseAudioVisualiserGL extends BaseAudioVisualiser {
  protected gl: WebGLRenderingContext;
  private attributeLocations: ShaderAttributeLocations = {};
  private uniformLocations: ShaderUniformLocations = {};

  constructor(
    canvas: HTMLCanvasElement,
    analysisMetadata: AudioAnalysisMetadata
  ) {
    super(canvas, analysisMetadata);

    let glContext = this.canvas.getContext('webgl');
    if (glContext === null || glContext === undefined) {
      throw new WebGLInitializationException('no WebGL context');
    }

    this.gl = glContext;
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0); // Transparent
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  protected resizeNeeded(): boolean {
    return (
      this.canvas.clientWidth !== this.gl.drawingBufferWidth ||
      this.canvas.clientWidth !== this.gl.drawingBufferHeight
    );
  }

  protected minDim(): number {
    return Math.min(this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
  }

  protected center(): Vector2d {
    return {
      x: this.gl.drawingBufferWidth / 2,
      y: this.gl.drawingBufferHeight / 2,
    };
  }

  public resize(width: number = 0, height: number = 0): void {
    super.resize(width, height);
    this.gl.viewport(
      0,
      0,
      this.gl.drawingBufferWidth,
      this.gl.drawingBufferHeight
    );
  }

  protected compileShader(shaderType: number, shader: string): WebGLShader {
    const s = this.gl.createShader(shaderType);
    if (s === null || s === undefined) {
      throw new WebGLInitializationException('failed to create WebGL shader');
    }
    this.gl.shaderSource(s, shader);
    this.gl.compileShader(s);
    if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
      console.log(this.gl.getShaderInfoLog(s));
    }
    return s;
  }

  protected makeAndUseProgram(
    vShader: WebGLShader,
    fShader: WebGLShader
  ): WebGLProgram {
    const p = this.gl.createProgram();
    if (p === null || p === undefined) {
      throw new WebGLInitializationException('failed to create WebGL program');
    }
    this.gl.attachShader(p, vShader);
    this.gl.attachShader(p, fShader);
    this.gl.linkProgram(p);
    this.gl.useProgram(p);

    // Store locations
    this.attributeLocations = this.gatherAttributeLocations(p);
    this.uniformLocations = this.gatherUniformLocations(p);

    return p;
  }

  protected updateFloatAttribute(
    array: Float32Array,
    drawType: number,
    attributeName: string,
    itemSize: number = 1
  ): WebGLBuffer {
    const attributeLocation = this.attributeLocation(attributeName);
    const buffer = this.gl.createBuffer();
    if (buffer === null || buffer === undefined) {
      throw new WebGLInitializationException('failed to create WebGL buffer');
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, array, drawType);
    this.gl.enableVertexAttribArray(attributeLocation);
    this.gl.vertexAttribPointer(
      attributeLocation,
      itemSize,
      this.gl.FLOAT,
      false,
      0,
      0
    );
    return buffer;
  }

  protected attributeLocation(attributeName: string): number {
    return this.attributeLocations[attributeName];
  }

  protected uniformLocation(uniformName: string): WebGLUniformLocation {
    return this.uniformLocations[uniformName];
  }

  private gatherAttributeLocations(
    program: WebGLProgram
  ): ShaderAttributeLocations {
    let locations: ShaderAttributeLocations = {};
    {
      const attributes = this.gl.getProgramParameter(
        program,
        this.gl.ACTIVE_ATTRIBUTES
      );
      for (let i = 0; i < attributes; i++) {
        const attr = this.gl.getActiveAttrib(program, i);
        if (attr === null || attr === undefined) {
          throw new WebGLInitializationException(
            'failed to get WebGL attribute'
          );
        }
        const name = attr.name;
        locations[name] = this.gl.getAttribLocation(program, name);
      }
    }

    return locations;
  }

  private gatherUniformLocations(
    program: WebGLProgram
  ): ShaderUniformLocations {
    let locations: ShaderUniformLocations = {};

    {
      const uniforms = this.gl.getProgramParameter(
        program,
        this.gl.ACTIVE_UNIFORMS
      );
      for (let i = 0; i < uniforms; i++) {
        const attr = this.gl.getActiveUniform(program, i);
        if (attr === null || attr === undefined) {
          throw new WebGLInitializationException(
            'failed to get WebGL active uniform'
          );
        }
        const uniformLocation = this.gl.getUniformLocation(program, attr.name);
        if (uniformLocation === null || uniformLocation === undefined) {
          throw new WebGLInitializationException(
            'failed to get WebGL active uniform location'
          );
        }
        locations[attr.name] = uniformLocation;
      }
    }

    return locations;
  }

  public templateShader(
    shader: string,
    values: { [propName: string]: string | number }
  ): string {
    let out = shader;
    for (const prop in values) {
      out = out.split(prop).join(values[prop].toString());
    }
    return out;
  }
}
