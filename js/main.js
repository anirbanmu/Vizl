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

function AudioHub(audioPlayer, playControls, progressBar, trackInfo, visContainer) {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    var gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = 0.5;

    var mediaSource = audioCtx.createMediaElementSource(audioPlayer[0]);
    mediaSource.connect(gainNode);

    var audioAnalyser = new AudioAnalyser(audioCtx, mediaSource, 128, 4096);
    var audioControls = new AudioControls(audioPlayer, playControls, progressBar, trackInfo);
    var audioVisualizer = new AudioVisualizer(audioAnalyser, visContainer);

    this.streamTrack = function(trackInfo) {
        audioControls.updateTrack(trackInfo.title);

        var url = new URL(trackInfo.stream_url + '?client_id=' + clientId);
        audioPlayer[0].setAttribute('src', url);
    };

    playControls.click(function() {
        audioControls.playPauseToggle();
    });

    audioPlayer.bind('play', function() {
        audioControls.onPlay();
        audioVisualizer.startVisualization();
    });

    audioPlayer.bind('pause', function() {
        audioControls.onPause();
        audioVisualizer.pauseVisualization();
    });

    audioPlayer.bind('timeupdate', function() {
        audioControls.onTimeUpdate();
    });

    $(window).bind('resize', function() {
        audioVisualizer.onResize();
    });
}

function streamTrack(url, audioHub) {
    console.log(url);
    var resolveIdentfierURL = 'https://api.soundcloud.com/resolve.json?url=' + url + '&client_id=' + clientId;
    $.getJSON(resolveIdentfierURL, function(resolved) {
        console.log(resolved);
        audioHub.streamTrack(resolved);
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

    var audioHub = new AudioHub($('#audioPlayer'), $('#playControls'), $('#bar'), $('#trackInfo'), $('#visContainer'));

    var urlInputBar = document.getElementById('urlInputBar');
    $("#streamSubmit").click(function() {
        streamTrack(urlInputBar.value, audioHub);
    });

    if (urlVars['trackURL'] !== undefined) {
        urlInputBar.value = urlVars['trackURL'];
        streamTrack(urlInputBar.value, audioHub);
    }
});
