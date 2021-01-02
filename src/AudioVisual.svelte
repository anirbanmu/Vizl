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
  let windowInnerWidth = window.innerWidth;
  let windowInnerHeight = window.innerHeight;
  let visualiser: BaseAudioVisualiser;

  onMount(() => {
    visualiser = visualiserLambda(canvas);
  });

  const render = (_: AudioAnalysisData) => {
    if (visualiser) {
      visualiser.render(analysisData);
    }
  };

  const resize = (_w: number, _h: number) => {
    if (visualiser) {
      visualiser.resize();
    }
  };

  $: render(analysisData);
  $: resize(windowInnerWidth, windowInnerHeight);
</script>

<svelte:window
  bind:innerWidth={windowInnerWidth}
  bind:innerHeight={windowInnerHeight} />
<canvas
  style="display: block; position: absolute; left: 0; top: 0; z-index: {zIndex}; opacity: {opacity}; {filter.length > 0 ? 'filter: ' + filter + ';' : ''}"
  bind:this={canvas} />
