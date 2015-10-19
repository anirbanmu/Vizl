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
        for (i = 0; i < timeData.length; ++i) {
            timeDataWeighted[i] = timeDataWeighted[i] * weight + timeData[i] * (1 - weight);
        }
        return timeDataWeighted;
    };
}

function AudioHub(audioPlayer, playControls, progressBar, trackInfo) {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    var gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = 0.5;

    var mediaSource = audioCtx.createMediaElementSource(audioPlayer[0]);
    mediaSource.connect(gainNode);

    var audioAnalyser = new AudioAnalyser(audioCtx, mediaSource, 128, 4096);
    var audioControls = new AudioControls(audioPlayer, playControls, progressBar, trackInfo);

    this.getAudioAnalyser = function() {
        return audioAnalyser;
    };

    this.paused = function() {
        return audioPlayer[0].paused;
    };

    this.streamTrack = function(trackInfo) {
        audioControls.updateTrack(trackInfo.title);

        url = new URL(trackInfo.stream_url + '?client_id=' + clientId);
        audioPlayer[0].setAttribute('src', url);
    };
}

function getCenter(canvas) {
    return new Vector2d(canvas.width / 2, canvas.height / 2);
}

function resizeCanvas(canvases, visContainer) {
    canvases.forEach(function(canvas) {
        canvas.width = visContainer.clientWidth;
        canvas.height = visContainer.clientHeight;
    });
}

function drawTimeDomainVisualizationCore(clockWise, canvas, canvasCtx, timeData) {
    var radius = (canvas.height / 7) - 128.0;

    var centerX = canvas.width / 2;
    var centerY = canvas.height / 2;

    var angularIncrement = (clockWise ? 1 : -1) * 2 * Math.PI / timeData.length;

    canvasCtx.beginPath();
    canvasCtx.moveTo(centerX + radius + timeData[0] * 0.75, centerY);

    for (var i = 1; i < timeData.length; i++) {
        var angle = new Angle(angularIncrement * i);

        canvasCtx.lineTo(centerX + radius * angle.cos + timeData[i] * angle.cos * 0.75, centerY + radius * angle.sin + timeData[i] * angle.sin * 0.75);
    }

    canvasCtx.lineWidth = 1;
    canvasCtx.lineJoin = 'round';
    canvasCtx.strokeStyle = 'rgb(231, 76, 60)';

    canvasCtx.stroke();
}

function drawTimeDomainVisualization(canvas, audioHub) {
    requestAnimationFrame(function() {
        drawTimeDomainVisualization(canvas, audioHub);
    });

    if (audioHub.paused()) {
        return;
    }

    canvas.style.webkitFilter = "blur(1px)";

    var canvasCtx = canvas.getContext("2d");
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    var timeData = audioHub.getAudioAnalyser().getTimeData(0.65);
    drawTimeDomainVisualizationCore(true, canvas, canvasCtx, timeData);
    drawTimeDomainVisualizationCore(false, canvas, canvasCtx, timeData);
}

function lineWidthIncrement(lineWidths, segmentCount) {
    return (lineWidths[1] - lineWidths[0]) / segmentCount;
}

function segmentGapAdditionalLength(lineWidths, segmentCount) {
    return segmentCount * lineWidths[0] + segmentCount * (segmentCount - 1) * lineWidthIncrement(lineWidths, segmentCount) / 2;
}

// radii[0] = minRadius
// radii[1] = maxRadius
// Draw a gradient bar (radially) from angles[0] to angle[1] based on the magnitude
function drawSegmentedBarPath(canvasCtx, center, angles, radii, magnitude, segmentCount, lineWidths) {
    if (magnitude === 0) {
        return;
    }

    // Not including segmented gaps
    var maxLength = radii[1] - radii[0];

    var radialIncrement = 0.05 * maxLength / segmentCount;
    var radialMultiplier = 2 * (maxLength - segmentCount * radialIncrement) / (segmentCount * (segmentCount - 1));

    var lineWidthInc = lineWidthIncrement(lineWidths, segmentCount);

    // Current bar's actual length
    var lastSegmentMagnitude = magnitude * segmentCount - Math.floor(magnitude * segmentCount);
    var barSegmentCount = Math.ceil(magnitude * segmentCount);

    var lastOuterRadius = radii[0];
    for (var i = 0; i < barSegmentCount; ++i) {
        var innerRadius = lastOuterRadius;
        var outerRadius = (i + 1 === barSegmentCount) ? (innerRadius + (radialIncrement + radialMultiplier * i) * lastSegmentMagnitude) : (innerRadius + (radialIncrement + radialMultiplier * i));

        canvasCtx.moveTo(center.x + innerRadius * angles[0].cos, center.y + innerRadius * angles[0].sin);
        canvasCtx.arc(center.x, center.y, innerRadius, angles[0].angle, angles[1].angle, false);
        canvasCtx.arc(center.x, center.y, outerRadius, angles[1].angle, angles[0].angle, true);
        canvasCtx.closePath();

        lastOuterRadius = outerRadius + (lineWidths[0] + lineWidthInc * i);
    }
}

function radiusMultiplier(frequencyData) {
    var rMultiplier = 0;
    for (i = 0; i < frequencyData.length / 4; i++) {
        rMultiplier += frequencyData[i];
    }
    return rMultiplier / (frequencyData.length / 4) / 255;
}

function drawCircularVisualization(canvas, audioHub) {
    drawCircularVisual = requestAnimationFrame(function() {
        drawCircularVisualization(canvas, audioHub);
    });

    if (audioHub.paused()) {
        return;
    }

    var canvasCtx = canvas.getContext("2d");

    var frequencyData = audioHub.getAudioAnalyser().getFrequencyData();
    var frequencyBufferLength = frequencyData.length;

    var scalingDim = Math.min(canvas.width / 2, canvas.height / 2);

    var radius = radiusMultiplier(frequencyData) * (scalingDim / 2);
    var angularIncrement = 2 * Math.PI / frequencyBufferLength;

    var center = getCenter(canvas);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineJoin = 'miter';

    // Path for all segmented bars
    canvasCtx.beginPath();

    // Variation range for gaps in segmented bars
    var lineWidths = [2, 8];

    var segmentCount = 26;

    var maxRadius = radius + scalingDim * 6 / 16;

    // Gradient for segmented bars
    var gradient = canvasCtx.createRadialGradient(center.x, center.y, radius, center.x, center.y, segmentGapAdditionalLength(lineWidths, segmentCount) + maxRadius);
    gradient.addColorStop(0.0, 'rgba(0,0,198,0.02)');
    gradient.addColorStop(0.5, 'rgba(0,198,0,0.5)');
    gradient.addColorStop(1.0, 'rgba(198,0,0,1.0)');
    canvasCtx.fillStyle = gradient;

    for (i = 0; i < frequencyBufferLength; i++) {
        var angleOffset = angularIncrement * 0.1;
        var angles = [new Angle(angularIncrement * i + angleOffset), new Angle(angularIncrement * (i + 1) - angleOffset)];

        drawSegmentedBarPath(canvasCtx, center, angles, [radius, maxRadius], frequencyData[i] / 255, segmentCount, lineWidths);
    }

    // Fill for all bars
    canvasCtx.fill();
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

function insertVisualizationCanvases(visContainer, layerCount) {
    var canvases = [];
    for (i = 0; i < layerCount; ++i) {
        var newCanvas = $("<canvas style='z-index: " + i + "; position: absolute; left: 0; top: 0;'></canvas>");
        visContainer.append(newCanvas);
        canvases[i] = newCanvas[0];
    }
    return canvases;
}

$(function () {
    var urlVars = getUrlVars();

    var visContainer = $('#visContainer');
    var canvases = insertVisualizationCanvases(visContainer, 2);

    resizeCanvas(canvases, visContainer[0]);
    $(window).bind('resize', function() {
        resizeCanvas(canvases, visContainer[0]);
    });

    var audioHub = new AudioHub($('#audioPlayer'), $('#playControls'), $('#bar'), $('#trackInfo'));

    drawCircularVisualization(canvases[0], audioHub);
    drawTimeDomainVisualization(canvases[1], audioHub);

    var urlInputBar = document.getElementById('urlInputBar');
    $("#streamSubmit").click(function() {
        streamTrack(urlInputBar.value, audioHub);
    });

    if (urlVars['trackURL'] !== undefined) {
        urlInputBar.value = urlVars['trackURL'];
        streamTrack(urlInputBar.value, audioHub);
    }
});
