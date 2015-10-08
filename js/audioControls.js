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
});