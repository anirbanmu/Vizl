'use strict';

function AudioControls(audioPlayer, playControls, progressBar, trackInfo) {
    var track = '';
    this.updateTrack = function(newSrcURL, newTrackTitle) {
        audioPlayer.src = newSrcURL;
        track = newTrackTitle;
    };

    var innerProgressBar = $("<div id='bar' />");
    progressBar.append(innerProgressBar);

    this.playPauseToggle = function() {
        if (audioPlayer.paused) {
            audioPlayer.play();
            return;
        }
        audioPlayer.pause();
    };

    this.onPause = function() {
        playControls[0].className = 'i fontawesome-play';
        trackInfo[0].textContent = 'Paused';
    };

    this.onPlay = function() {
        playControls[0].className = 'i fontawesome-pause';
        trackInfo[0].textContent = track;
    };

    this.onTimeUpdate = function() {
        var progress = 100 * audioPlayer.currentTime / audioPlayer.duration;
        innerProgressBar[0].style.width = progress + '%';
    };

    this.seekTo = function(normalizedPosition) {
        if (audioPlayer.src) {
            var newTime = audioPlayer.duration * normalizedPosition;
            audioPlayer.currentTime = newTime;
        }
    };
}