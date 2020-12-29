import type AudioAnalysisMetadata from "../AudioAnalysisMetadata";
import BaseAudioVisualiser from "./BaseAudioVisualiser";
import type ShaderAttributeLocations from "./ShaderAttributeLocations";
import type ShaderUniformLocations from "./ShaderUniformLocations";

export default abstract class BaseAudioVisualiserGL extends BaseAudioVisualiser {
  protected gl: WebGLRenderingContext;
  private attributeLocations: ShaderAttributeLocations = {};
  private uniformLocations: ShaderUniformLocations = {};

  constructor(canvas: HTMLCanvasElement, analysisMetadata: AudioAnalysisMetadata) {
    super(canvas, analysisMetadata);

    this.gl = this.canvas.getContext('webgl');
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0); // Transparent
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  public resize(width: number = 0, height: number = 0): void {
    super.resize(width, height);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  protected compileShader(shaderType: number, shader: string): WebGLShader {
    const s = this.gl.createShader(shaderType);
    this.gl.shaderSource(s, shader);
    this.gl.compileShader(s);
    if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
      console.log(this.gl.getShaderInfoLog(s));
    }
    return s;
  }

  protected makeAndUseProgram(vShader: WebGLShader, fShader: WebGLShader): WebGLProgram {
    const p = this.gl.createProgram();
    this.gl.attachShader(p, vShader);
    this.gl.attachShader(p, fShader);
    this.gl.linkProgram(p);
    this.gl.useProgram(p);

    // Store locations
    this.attributeLocations = this.gatherAttributeLocations(p);
    this.uniformLocations = this.gatherUniformLocations(p);

    return p;
  }

  protected updateFloatAttribute(array: Float32Array, drawType: number, attributeName: string, itemSize: number = 1): WebGLBuffer {
    const attributeLocation = this.attributeLocation(attributeName);
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, array, drawType);
    this.gl.enableVertexAttribArray(attributeLocation);
    this.gl.vertexAttribPointer(attributeLocation, itemSize, this.gl.FLOAT, false, 0, 0);
    return buffer;
  }

  protected attributeLocation(attributeName: string): number {
    return this.attributeLocations[attributeName];
  }

  protected uniformLocation(uniformName: string): WebGLUniformLocation {
    return this.uniformLocations[uniformName];
  }

  private gatherAttributeLocations(program: WebGLProgram): ShaderAttributeLocations {
    let locations = {};

    {
      const attributes = this.gl.getProgramParameter(program, this.gl.ACTIVE_ATTRIBUTES);
      for (let i = 0; i < attributes; i++) {
        const name = this.gl.getActiveAttrib(program, i).name;
        locations[name] = this.gl.getAttribLocation(program, name);
      }
    }

    return locations;
  }

  private gatherUniformLocations(program: WebGLProgram): ShaderUniformLocations {
    let locations = {};

    {
      const uniforms = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < uniforms; i++) {
        const name = this.gl.getActiveUniform(program, i).name;
        locations[name] = this.gl.getUniformLocation(program, name);
      }
    }

    return locations;
  }

  public templateShader(shader: string, values: { [propName: string]: string | number }): string {
    let out = shader;
    for (const prop in values) {
      out = out.split(prop).join(values[prop].toString());
    }
    return out;
  }
}
