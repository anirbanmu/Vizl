<script lang="ts">
	import Fa from "svelte-fa";
	import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus";
	import { faPlay } from "@fortawesome/free-solid-svg-icons/faPlay";
	import { faPause } from "@fortawesome/free-solid-svg-icons/faPause";

	import { clientId } from "./config";
	import type Track from "./Track";
	import AudioVisual from "./AudioVisual.svelte";
	import Footer from "./Footer.svelte";

	import AudioAnalyser from "./AudioAnalyser";
	import type AudioAnalysisData from "./AudioAnalysisData";
	import FrequencyDomainBackgroundVisualiserGL from "./visualisers/FrequencyDomainBackgroundVisualiserGL";
	import FrequencyDomainRadialVisualiserGL from "./visualisers/FrequencyDomainRadialVisualiserGL";
	import TimeDomainRadialVisualiserGL from "./visualisers/TimeDomainRadialVisualizerGL";

	const audioElement = new Audio();
	audioElement.crossOrigin = "anonymous";
	audioElement.autoplay = true;

	//
	// Audio controls
	//
	let audioState = {
		paused: true,
		hasSrc: false,
	};
	const updateAudioState = () => {
		audioState = {
			hasSrc: (audioElement.src || "").length > 0,
			paused: audioElement.paused,
		};
	};
	audioElement.addEventListener("pause", () => updateAudioState());
	audioElement.addEventListener("play", () => updateAudioState());
	audioElement.addEventListener("ended", () => updateAudioState());
	const playPause = (play: boolean) => {
		if (play) {
			audioElement.play();
		} else {
			audioElement.pause();
		}
	};

	//
	// Audio progress/seek bar
	//
	const seekMax = 1000;
	let seekPosition: number = 0;
	let seekbar: HTMLInputElement;
	audioElement.addEventListener("timeupdate", () => {
		seekPosition = (seekMax * audioElement.currentTime) / audioElement.duration;
	});
	const seekClick = (e: MouseEvent) => {
		const position = Math.max(0, Math.min(e.offsetX / seekbar.clientWidth, 1));
		audioElement.currentTime = audioElement.duration * position;
	};

	//
	// New track input & resolution
	//
	const soundcloudApiBaseUrl = "https://api.soundcloud.com";

	let trackUrlInput: string;
	let trackUrlInputElement: HTMLInputElement;

	let trackUrlExists = false;
	$: trackUrlExists = (trackUrlInput || "").length > 0;

	let track: Track = null;

	let loading = false;
	function onClick(): void {
		loading = true;
		const resolveIdentifierURL = new URL(
			`${soundcloudApiBaseUrl}/resolve.json`
		);
		resolveIdentifierURL.searchParams.append("url", trackUrlInput);
		resolveIdentifierURL.searchParams.append("client_id", clientId);
		fetch(resolveIdentifierURL.href)
			.then((resp) => {
				if (!resp.ok) {
					throw resp.statusText;
				}
				return resp.json();
			})
			.then((json) => {
				return {
					streamUrl: json.stream_url,
					title: json.title,
					artwork: json.artwork_url,
				};
			})
			.then((t: Track) => {
				track = t;

				audioCtx.resume();

				const url = new URL(t.streamUrl);
				url.searchParams.append("client_id", clientId);
				audioElement.src = url.href;
				trackUrlInputElement.placeholder = "Now playing: " + track.title;
				trackUrlInput = "";
				updateAudioState();
				loading = false;
			})
			.catch((e) => {
				trackUrlInput = "Sorry! That didn't work!";
				setTimeout(() => {
					trackUrlInput = "";
					if (track) {
						trackUrlInputElement.placeholder = "Now playing: " + track.title;
					}
					loading = false;
				}, 2000);
				console.log(e);
			});
	}

	//
	// Audio analysis
	//
	const audioCtx = new AudioContext();
	const gainNode = audioCtx.createGain();
	gainNode.connect(audioCtx.destination);
	gainNode.gain.value = 0.5;

	const mediaSource = audioCtx.createMediaElementSource(audioElement);
	mediaSource.connect(gainNode);

	const analyser = new AudioAnalyser(audioCtx, mediaSource, 256, 4096);
	const analysisMetadata = analyser.metadata();

	let analysisData: AudioAnalysisData;

	const analysisRefresher = () => {
		analysisData = {
			frequencyData: analyser.getFrequencyData(),
			timeData: analyser.getTimeData(),
		};

		requestAnimationFrame(analysisRefresher);
	};

	analysisRefresher();
</script>

<style>
	main {
		padding: 0em;
		margin: 0 auto;
		display: flex;
		min-height: 100vh;
		flex-direction: column;
	}

	main-wrap {
		padding: 1em;
		flex-grow: 1;
	}

	topbar {
		position: relative;
		width: 90%;
		margin: 0em auto 0 auto;
		font-size: 1.24em;
		padding: 0.8em;
		display: flex;
		align-items: center;
		z-index: 99;
	}

	.logo {
		max-width: 3em;
		width: 3em;
	}

	control-container {
		align-items: center;
		position: relative;
		width: 90%;
		margin: 0em auto 0 auto;
		display: flex;
		z-index: 99;
	}

	.control-child {
		margin-top: 0;
		margin-bottom: 0;
	}

	.control-child + .control-child {
		margin-left: 10px;
	}

	.track-input {
		flex-grow: 30;
	}

	.control-button {
		flex-grow: 1;
	}

	.seek-bar {
		margin-left: auto;
		margin-bottom: 0;
		border: 1px solid;
		border-radius: 2px;
		border-color: #e74c3c;
	}

	.seek-bar:disabled {
		opacity: 0;
	}

	input[type="range"] {
		-webkit-appearance: none;
		border-radius: 2px;
		box-shadow: none;
		background-color: transparent;
		height: 1px;
		vertical-align: middle;
		width: 20%;
	}
	input[type="range"]::-moz-range-track {
		-moz-appearance: none;
		border-radius: 2px;
		box-shadow: none;
		background-color: transparent;
		height: 1px;
		width: 20%;
	}
	input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none !important;
		border-radius: 0px;
		background-color: #e74c3c;
		box-shadow: none;
		border: 0px solid #999;
		height: 20px;
		width: 5px;
	}
	input[type="range"]::-moz-range-thumb {
		-moz-appearance: none;
		border-radius: 0px;
		background-color: #e74c3c;
		box-shadow: none;
		border: 0px solid #999;
		height: 20px;
		width: 5px;
	}
</style>

<main>
	<main-wrap>
		<topbar>
			<img src="logo.png" alt="Vizl" class="logo" />
			<input
				class="seek-bar control-child"
				type="range"
				bind:value={seekPosition}
				bind:this={seekbar}
				on:click={seekClick}
				min="0"
				max={seekMax}
				disabled={loading || !audioState.hasSrc}
				step="any" />
		</topbar>

		<control-container>
			<input
				class="track-input control-child"
				bind:this={trackUrlInputElement}
				bind:value={trackUrlInput}
				disabled={loading}
				placeholder="Paste a SoundCloud track link here" />
			<button
				class="control-button control-child"
				on:click={(_) => onClick()}
				disabled={!trackUrlExists || loading}>
				<Fa icon={faPlus} />
			</button>
			<button
				class="control-button control-child"
				on:click={(_) => playPause(audioState.paused)}
				disabled={loading || !audioState.hasSrc}>
				<Fa icon={audioState.paused ? faPlay : faPause} />
			</button>
		</control-container>
	</main-wrap>

	<Footer />

	<AudioVisual
		zIndex={1}
		opacity={0.5}
		{analysisData}
		visualiserLambda={(c) => new FrequencyDomainBackgroundVisualiserGL(c, analysisMetadata)} />
	<AudioVisual
		zIndex={2}
		{analysisData}
		visualiserLambda={(c) => new TimeDomainRadialVisualiserGL(c, analysisMetadata)} />
	<AudioVisual
		zIndex={3}
		{analysisData}
		visualiserLambda={(c) => new FrequencyDomainRadialVisualiserGL(c, analysisMetadata)} />
</main>
