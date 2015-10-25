'use strict';

function AudioHub(playPause, nextButton, prevButton, progressBar, trackInfoDisplay, visContainer) {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    var audioElement = new Audio();
    audioElement.crossOrigin = 'anonymous';
    audioElement.autoplay = true;

    var gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = 0.5;

    var mediaSource = audioCtx.createMediaElementSource(audioElement);
    mediaSource.connect(gainNode);

    var audioAnalyser = new AudioAnalyser(audioCtx, mediaSource, 128, 4096);
    var playlist = new Playlist();
    var audioPlayer = new AudioPlayer(audioElement, playPause[0], progressBar, trackInfoDisplay[0]);
    var audioVisualizer = new AudioVisualizer(audioAnalyser, visContainer);

    function play(track) {
        if (track) {
            audioVisualizer.pauseVisualization();
            audioPlayer.playTrack(track, clientId);
            audioVisualizer.updateTrackImage(track.artwork_url);
        }
    };

    this.addStreamingItem = function(itemInfo) {
        // Autoplay next track if playlist has no more to play && audio is paused && there is no track in progress.
        if (playlist.addItem(itemInfo) && audioElement.paused && !audioPlayer.trackInProgress()) {
            play(playlist.next());
        }
    };

    playPause.click(function() {
        audioPlayer.playPauseToggle();
    });

    nextButton.click(function() {
        play(playlist.next());
    });

    prevButton.click(function() {
        play(playlist.prev());
    });

    audioElement.addEventListener('play', function() {
        audioPlayer.onPlay();
        audioVisualizer.startVisualization();
    });

    audioElement.addEventListener('pause', function() {
        audioPlayer.onPause();
        audioVisualizer.pauseVisualization();
    });

    audioElement.addEventListener('timeupdate', function() {
        audioPlayer.onTimeUpdate();
    });

    audioElement.addEventListener('ended', function() {
        audioPlayer.onEnd();
        play(playlist.next());
    });

    progressBar.click(function(e) {
        var position = Math.max(0, Math.min((e.pageX - progressBar.offset().left) / progressBar.width(), 1));
        audioPlayer.seekTo(position);
    });

    $(window).bind('resize', function() {
        audioVisualizer.onResize();
    });
}