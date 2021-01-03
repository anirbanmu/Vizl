import type AudioAnalysisData from '../AudioAnalysisData';
import type AudioAnalysisMetadata from '../AudioAnalysisMetadata';
import type { Vector2d } from '../util';

export default abstract class BaseAudioVisualiser {
  private metadata: AudioAnalysisMetadata;
  protected canvas: HTMLCanvasElement;

  constructor(
    canvasElement: HTMLCanvasElement,
    analysisMetadata: AudioAnalysisMetadata
  ) {
    this.canvas = canvasElement;
    this.metadata = analysisMetadata;
  }

  public resize(width: number = 0, height: number = 0): void {
    width = width === 0 ? this.canvas.clientWidth : width;
    height = height === 0 ? this.canvas.clientHeight : height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  public abstract render(data: AudioAnalysisData): void;

  protected minDim(): number {
    return Math.min(this.canvas.width, this.canvas.height);
  }

  protected center(): Vector2d {
    return { x: this.canvas.width / 2, y: this.canvas.height / 2 };
  }

  protected minDb(): number {
    return this.metadata.minDb;
  }

  protected maxDb(): number {
    return this.metadata.maxDb;
  }

  protected frequencyBinCount(): number {
    return this.metadata.frequencyBinCount;
  }

  protected timeFftSize(): number {
    return this.metadata.timeFftSize;
  }
}
