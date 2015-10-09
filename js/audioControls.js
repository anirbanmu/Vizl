function playPauseToggle(audioPlayer){
    if (audioPlayer.paused) {
        audioPlayer.play();
        return;
    }
    audioPlayer.pause();
}

function played(playControls) {
    playControls.className = 'i fontawesome-pause';
}

function paused(playControls) {
    playControls.className = 'i fontawesome-play';
}

function updateProgress(audioPlayer, bar) {
    var progress = 100 * audioPlayer.currentTime / audioPlayer.duration;
    bar.style.width = progress + '%';
}

$(function () {
    var playControls = $('#playControls');
    var audioPlayer = $('#audioPlayer');

    playControls.click(function() {
        playPauseToggle(audioPlayer[0]);
    });

    audioPlayer.bind('play', function() {
        played(playControls[0]);
    });

    audioPlayer.bind('pause', function() {
        paused(playControls[0]);
    });

    var progressBar = document.getElementById('bar');
    audioPlayer.bind('timeupdate', function() {
        updateProgress(audioPlayer[0], progressBar);
    });
});