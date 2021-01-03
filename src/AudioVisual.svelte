<script lang="ts">
  import { onMount } from "svelte";
  import type AudioAnalysisData from "./AudioAnalysisData";
  import type BaseAudioVisualiser from "./visualisers/BaseAudioVisualiser";

  interface VisualiserCreate {
    (canvas: HTMLCanvasElement): BaseAudioVisualiser;
  }

  export let zIndex: number;
  export let opacity: number = 1.0;
  export let filter: string = "";
  export let visualiserLambda: VisualiserCreate;
  export let analysisData: AudioAnalysisData;

  let canvas: HTMLCanvasElement;
  let visualiser: BaseAudioVisualiser;

  onMount(() => {
    visualiser = visualiserLambda(canvas);
  });

  const render = (_: AudioAnalysisData) => {
    if (visualiser) {
      visualiser.render(analysisData);
    }
  };

  $: render(analysisData);
</script>

<canvas
  style="display: block; position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; z-index: {zIndex}; opacity: {opacity}; {filter.length > 0 ? 'filter: ' + filter + ';' : ''}"
  bind:this={canvas} />
