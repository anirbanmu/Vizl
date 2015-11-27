'use strict';

function AudioAnalyser(context, source, frequencyFftSize, timeFftSize) {
    let frequencyAnalyser = context.createAnalyser();
    frequencyAnalyser.fftSize = frequencyFftSize;
    frequencyAnalyser.smoothingTimeConstant = 0.89;
    source.connect(frequencyAnalyser);

    let timeAnalyser = context.createAnalyser();
    timeAnalyser.fftSize = timeFftSize;
    timeAnalyser.smoothingTimeConstant = 1;
    source.connect(timeAnalyser);

    let frequencyData = new Float32Array(frequencyAnalyser.frequencyBinCount);
    this.getFrequencyData = function() {
        frequencyAnalyser.getFloatFrequencyData(frequencyData);
        return frequencyData;
    };

    let timeData = new Float32Array(timeAnalyser.fftSize);
    let timeDataWeighted = new Float32Array(timeAnalyser.fftSize);
    this.getTimeData = function(weight) {
        timeAnalyser.getFloatTimeDomainData(timeData);
        for (let i = 0; i < timeData.length; ++i) {
            timeDataWeighted[i] = timeDataWeighted[i] * weight + timeData[i] * (1 - weight);
        }
        return timeDataWeighted;
    };

    this.timeFftSize = timeAnalyser.fftSize;
    this.freqBinCount = frequencyAnalyser.frequencyBinCount;
    this.minDb = frequencyAnalyser.minDecibels;
    this.maxDb = frequencyAnalyser.maxDecibels;
}

function addStreamingItem(url, audioHub) {
    console.log(url);
    const resolveIdentfierURL = 'https://api.soundcloud.com/resolve.json?url=' + url + '&client_id=' + clientId;
    $.getJSON(resolveIdentfierURL, function(resolved) {
        console.log(resolved);
        audioHub.addStreamingItem(resolved);
    });
}

// Gets all URL variables
function getUrlVars() {
    let vars = {};
    let parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
                                                                            vars[key] = value;
                                                                        });
    return vars;
}

$(function () {
    let urlVars = getUrlVars();

    let audioHub = new AudioHub($('#playPauseButton'), $('#nextButton'), $('#previousButton'), $('#progressBar'), $('#trackInfo'), $('#visContainer'));

    let urlInputBar = document.getElementById('urlInputBar');
    $("#streamSubmit").click(function() {
        addStreamingItem(urlInputBar.value, audioHub);
    });

    if (urlVars['trackURL'] !== undefined) {
        urlInputBar.value = urlVars['trackURL'];
        addStreamingItem(urlInputBar.value, audioHub);
    }
});
