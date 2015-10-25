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
