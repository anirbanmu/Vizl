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

    var frequencyByteData = new Uint8Array(frequencyAnalyser.frequencyBinCount);
    this.getFrequencyData = function() {
        frequencyAnalyser.getByteFrequencyData(frequencyByteData);
        return frequencyByteData;
    };

    let frequencyFloatData = new Float32Array(frequencyAnalyser.frequencyBinCount);
    this.getFloatFrequencyData = function() {
        frequencyAnalyser.getFloatFrequencyData(frequencyFloatData);
        return frequencyFloatData;
    };

    var timeData = new Float32Array(timeAnalyser.fftSize);
    var timeDataWeighted = new Float32Array(timeAnalyser.fftSize);
    this.getTimeData = function(weight) {
        timeAnalyser.getFloatTimeDomainData(timeData);
        for (var i = 0; i < timeData.length; ++i) {
            timeDataWeighted[i] = timeDataWeighted[i] * weight + timeData[i] * (1 - weight);
        }
        return timeDataWeighted;
    };

    this.timeFftSize = function() { return timeAnalyser.fftSize; };
    this.freqBinCount = function() { return frequencyAnalyser.frequencyBinCount; };
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

    var audioHub = new AudioHub($('#playPauseButton'), $('#nextButton'), $('#previousButton'), $('#progressBar'), $('#trackInfo'), $('#visContainer'));

    var urlInputBar = document.getElementById('urlInputBar');
    $("#streamSubmit").click(function() {
        addStreamingItem(urlInputBar.value, audioHub);
    });

    if (urlVars['trackURL'] !== undefined) {
        urlInputBar.value = urlVars['trackURL'];
        addStreamingItem(urlInputBar.value, audioHub);
    }
});
