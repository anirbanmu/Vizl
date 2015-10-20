'use strict';

function AudioControls(audioPlayer, playControls, progressBar, trackInfo) {
    var track = '';
    this.updateTrack = function(newTrack) {
        track = newTrack;
    };

    this.playPauseToggle = function() {
        if (audioPlayer[0].paused) {
            audioPlayer[0].play();
            return;
        }
        audioPlayer[0].pause();
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
        var progress = 100 * audioPlayer[0].currentTime / audioPlayer[0].duration;
        progressBar[0].style.width = progress + '%';
    };
}