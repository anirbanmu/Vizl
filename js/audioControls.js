var playControls = document.getElementById("playControls");

function playPause(){
    if (audioPlayer.paused) {
        console.log('play');
        audioPlayer.play();
        playControls.className = 'i fontawesome-pause';
    }
    else {
        console.log('pause');
        audioPlayer.pause();
        playControls.className = 'i fontawesome-play';
    }
}

playControls.onclick = playPause;