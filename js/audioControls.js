function playPauseToggle(audioPlayer){
    if (audioPlayer.paused) {
        audioPlayer.play();
        return;
    }
    audioPlayer.pause();
}

function played(playControls, trackInfo, track) {
    playControls.className = 'i fontawesome-pause';
    trackInfo.textContent = track;
}

function paused(playControls, trackInfo) {
    playControls.className = 'i fontawesome-play';
    trackInfo.textContent = 'Paused';
}

function updateProgress(audioPlayer, bar) {
    var progress = 100 * audioPlayer.currentTime / audioPlayer.duration;
    bar.style.width = progress + '%';
}

function AudioControls(audioPlayer, playControls, progressBar, trackInfo) {
    playControls.click(function() {
        playPauseToggle(audioPlayer[0]);
    });

    var track = '';
    audioPlayer.bind('play', function() {
        played(playControls[0], trackInfo[0], track);
    });

    audioPlayer.bind('pause', function() {
        paused(playControls[0], trackInfo[0]);
    });

    audioPlayer.bind('timeupdate', function() {
        updateProgress(audioPlayer[0], progressBar[0]);
    });

    this.updateTrack = function(newTrack) {
        track = newTrack;
    };
}