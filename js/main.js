'use strict';

function AudioAnalyser(context, source, frequencyFftSize, timeFftSize) {
    var frequencyAnalyser = context.createAnalyser();
    frequencyAnalyser.fftSize = frequencyFftSize;
    frequencyAnalyser.smoothingTimeConstant = 0.89;
    source.connect(frequencyAnalyser);

    var timeAnalyser = context.createAnalyser();
    timeAnalyser.fftSize = timeFftSize;
    timeAnalyser.smoothingTimeConstant = 1;
    source.connect(timeAnalyser);

    var frequencyData = new Uint8Array(frequencyAnalyser.frequencyBinCount);
    this.getFrequencyData = function() {
        frequencyAnalyser.getByteFrequencyData(frequencyData);
        return frequencyData;
    };

    var timeData = new Uint8Array(timeAnalyser.frequencyBinCount);
    var timeDataWeighted = new Uint8Array(timeAnalyser.frequencyBinCount);
    this.getTimeData = function(weight) {
        timeAnalyser.getByteTimeDomainData(timeData);
        for (var i = 0; i < timeData.length; ++i) {
            timeDataWeighted[i] = timeDataWeighted[i] * weight + timeData[i] * (1 - weight);
        }
        return timeDataWeighted;
    };
}

function AudioHub(playControls, progressBar, trackInfoDisplay, visContainer) {
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
    var audioPlayer = new AudioPlayer(audioElement, playControls, progressBar, trackInfoDisplay);
    var audioVisualizer = new AudioVisualizer(audioAnalyser, visContainer);

    function play(track) {
        audioPlayer.playTrack(track, clientId);
        audioVisualizer.updateTrackImage(track.artwork_url);
    };

    this.addStreamingItem = function(itemInfo) {
        // Autoplay next track if playlist has no more to play && audio is paused && there is no track in progress.
        if (playlist.addItem(itemInfo) && audioElement.paused && !audioPlayer.trackInProgress()) {
            play(playlist.next());
        }
    };

    playControls.click(function() {
        audioPlayer.playPauseToggle();
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
        var next = playlist.next();
        if (next) {
            play(next);
        }
    });

    progressBar.click(function(e) {
        var position = Math.max(0, Math.min((e.pageX - progressBar.offset().left) / progressBar.width(), 1));
        audioPlayer.seekTo(position);
    });

    $(window).bind('resize', function() {
        audioVisualizer.onResize();
    });
}

function addStreamingItem(url, audioHub) {
    console.log(url);
    var resolveIdentfierURL = 'https://api.soundcloud.com/resolve.json?url=' + url + '&client_id=' + clientId;
    $.getJSON(resolveIdentfierURL, function(resolved) {
        console.log(resolved);
        audioHub.addStreamingItem(resolved);
    });
}

// Gets all URL variables
function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
                                                                            vars[key] = value;
                                                                        });
    return vars;
}

$(function () {
    var urlVars = getUrlVars();

    var audioHub = new AudioHub($('#playControls'), $('#progressBar'), $('#trackInfo'), $('#visContainer'));

    var urlInputBar = document.getElementById('urlInputBar');
    $("#streamSubmit").click(function() {
        addStreamingItem(urlInputBar.value, audioHub);
    });

    if (urlVars['trackURL'] !== undefined) {
        urlInputBar.value = urlVars['trackURL'];
        addStreamingItem(urlInputBar.value, audioHub);
    }
});
