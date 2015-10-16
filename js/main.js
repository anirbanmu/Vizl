function AudioAnalyser(context, source, frequencyFftSize, timeFftSize) {
    var frequencyAnalyser = context.createAnalyser();
    frequencyAnalyser.fftSize = frequencyFftSize;
    frequencyAnalyser.smoothingTimeConstant = 0.89;
    frequencyData = new Uint8Array(frequencyAnalyser.frequencyBinCount);
    source.connect(frequencyAnalyser);

    var timeAnalyser = context.createAnalyser();
    timeAnalyser.fftSize = timeFftSize;
    timeAnalyser.smoothingTimeConstant = 1;
    timeData = new Uint8Array(timeAnalyser.frequencyBinCount);
    source.connect(timeAnalyser);

    this.getFrequencyData = function() {
        frequencyAnalyser.getByteFrequencyData(frequencyData);
        return frequencyData.slice();
    };

    this.getTimeData = function() {
        timeAnalyser.getByteTimeDomainData(timeData);
        return timeData.slice();
    };
}

function AudioHub(audioPlayer) {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    var gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = 0.5;

    var mediaSource = audioCtx.createMediaElementSource(audioPlayer[0]);
    mediaSource.connect(gainNode);

    var audioAnalyser = new AudioAnalyser(audioCtx, mediaSource, 128, 4096);

    this.getAudioAnalyser = function() {
        return audioAnalyser;
    };

    this.paused = function() {
        return audioPlayer[0].paused;
    };

    this.streamTrack = function(url) {
        url = new URL(url + '?client_id=' + clientId);
        audioPlayer[0].setAttribute('src', url);
    };
}

function GradientCalculator(angle, gradientStartColor, gradientEndColor) {
    var angle = new Angle(angle * Math.PI / 180);
    var gradientStartColor = gradientStartColor;
    var gradientEndColor = gradientEndColor;

    var start = new Vector2d(0, 0);
    var end = new Vector2d(0, 0);
    var size = new Vector2d(0, 0);

    this.setGradient = function(center, dimensions) {
        if (dimensions === size) {
            return;
        }

        size = dimensions;

        var gradientLineLength = Math.abs(dimensions.x * angle.sin) + Math.abs(dimensions.y * angle.cos);
        start = new Vector2d(center.x - gradientLineLength * angle.cos / 2, center.y + gradientLineLength * angle.sin / 2);
        end = new Vector2d(center.x + gradientLineLength * angle.cos / 2, center.y - gradientLineLength * angle.sin / 2);
    };

    this.getGradient = function(canvasCtx) {
        var bgGradient = canvasCtx.createLinearGradient(start.x, start.y, end.x, end.y);
        bgGradient.addColorStop(0.0, gradientStartColor);
        bgGradient.addColorStop(1.0, gradientEndColor);
        return bgGradient;
    }
}

function getCenter(canvas) {
    return new Vector2d(canvas.width / 2, canvas.height / 2);
}

function resizeCanvas(canvases, visContainer, gradientCalculator) {
    canvases.forEach(function(canvas) {
        canvas.width = visContainer.clientWidth;
        canvas.height = visContainer.clientHeight;
    });

    gradientCalculator.setGradient(getCenter(canvases[0]), new Vector2d(visContainer.clientWidth, visContainer.clientHeight));
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

    var timeData = audioHub.getAudioAnalyser().getTimeData();
    drawTimeDomainVisualizationCore(true, canvas, canvasCtx, timeData);
    drawTimeDomainVisualizationCore(false, canvas, canvasCtx, timeData);
}

function drawBarsPerspectiveLazy(canvasCtx, center, innerRadius, outerRadius, gradientCalculator) {
    var numBars = 22;
    var radialIncrement = (outerRadius - innerRadius) / numBars;

    var multiplier = 2 / (1 + numBars);

    var maxLineWidth = 8;
    var minLineWidth = 2;

    var lineWidthDecrement = (maxLineWidth - minLineWidth) / numBars;

    canvasCtx.strokeStyle = gradientCalculator.getGradient(canvasCtx);

    var lastRadius = innerRadius;
    for (var i = 0; i < numBars - 1; ++i) {
        var radius = lastRadius + radialIncrement * (multiplier * (i + 1));
        if (radius >= outerRadius) {
            break;
        }

        canvasCtx.lineWidth = maxLineWidth - lineWidthDecrement * (numBars - 1 - i);

        canvasCtx.beginPath();
        canvasCtx.arc(center.x, center.y, radius, 0, 2 * Math.PI, false);
        canvasCtx.stroke();

        lastRadius = radius;
    }
}

function drawPerspective(canvasCtx, center, innerRadius, outerRadius, startingAngle, endingAngle, gradientCalculator) {
    var bgGradient = gradientCalculator.getGradient(canvasCtx);

    canvasCtx.fillStyle = bgGradient;
    canvasCtx.strokeStyle = bgGradient;
    canvasCtx.lineWidth = 5;

    canvasCtx.beginPath();

    canvasCtx.moveTo(center.x + Math.cos(startingAngle) * innerRadius, center.y + Math.sin(startingAngle) * innerRadius);
    canvasCtx.lineTo(center.x + Math.cos(startingAngle) * outerRadius, center.y + Math.sin(startingAngle) * outerRadius);
    canvasCtx.arc(center.x, center.y, outerRadius, startingAngle, (endingAngle - startingAngle) * 0.1 + startingAngle, false);

    canvasCtx.fill();
    canvasCtx.stroke();

    canvasCtx.beginPath();

    canvasCtx.moveTo(center.x + Math.cos(endingAngle) * innerRadius, center.y + Math.sin(endingAngle) * innerRadius);
    canvasCtx.lineTo(center.x + Math.cos(endingAngle) * outerRadius, center.y + Math.sin(endingAngle) * outerRadius);
    canvasCtx.arc(center.x, center.y, outerRadius, endingAngle, endingAngle - (endingAngle - startingAngle) * 0.1, true);

    canvasCtx.fill();
    canvasCtx.stroke();
}

function addBarGradientColorStops(gradient, magnitude) {
    gradient.addColorStop(0.0, 'rgba(0,0,' + 198 + ',0.02)');

    var maxMidAlpha = 0.5;

    if (magnitude <= 0.5) {
        var endGreen = Math.floor(198 * (1 - Math.abs(magnitude - 0.5) / 0.5));
        var endBlue = Math.floor(198 * Math.abs(magnitude - 0.5) / 0.5);
        var endAlpha = maxMidAlpha * (0.5 - Math.abs(magnitude - 0.5)) / 0.5;
        gradient.addColorStop(1.0, 'rgba(0,' + endGreen + ',' + endBlue + ',' + endAlpha + ')');
    }
    else {
        gradient.addColorStop(0.5 / magnitude, 'rgba(0,198,0,' + maxMidAlpha + ')');
        var endGreen = Math.floor(198 * Math.abs(magnitude - 1.0));
        var endRed = Math.floor(198 * (1 - Math.abs(magnitude - 1.0)));
        var endAlpha = (1 - Math.abs(magnitude - 1.0));
        gradient.addColorStop(1.0, 'rgba(' + endRed + ',' + endGreen + ',0,' + endAlpha + ')');
    }
}

// Draw a gradient bar (radially) from angles[0] to angle[1] & radii[0] to radii[1]
function drawBar(canvasCtx, gradientCalculator, center, angles, radii, magnitude) {
    canvasCtx.beginPath();

    canvasCtx.arc(center.x, center.y, radii[0], angles[0].angle, angles[1].angle, false);
    canvasCtx.lineTo(center.x + angles[1].cos * radii[1], center.y + angles[1].sin * radii[1]);
    canvasCtx.arc(center.x, center.y, radii[1], angles[1].angle, angles[0].angle, true);
    canvasCtx.lineTo(center.x + angles[0].cos * radii[0], center.y + angles[0].sin * radii[0]);

    var midAngle = new Angle((angles[0].angle + angles[1].angle) / 2);

    var gradient = canvasCtx.createLinearGradient(center.x + midAngle.cos * radii[0], center.y + midAngle.sin * radii[0], center.x + midAngle.cos * radii[1], center.y + midAngle.sin * radii[1]);
    addBarGradientColorStops(gradient, magnitude);
    canvasCtx.fillStyle = gradient;
    canvasCtx.fill();

    drawPerspective(canvasCtx, center, radii[0], radii[1], angles[0].angle, angles[1].angle, gradientCalculator);
}

function radiusMultiplier(frequencyData) {
    var rMultiplier = 0;
    for (i = 0; i < frequencyData.length / 4; i++) {
        rMultiplier += frequencyData[i];
    }
    return rMultiplier / (frequencyData.length / 4) / 255;
}

function drawCircularVisualization(canvas, audioHub, gradientCalculator) {
    drawCircularVisual = requestAnimationFrame(function() {
        drawCircularVisualization(canvas, audioHub, gradientCalculator);
    });

    if (audioHub.paused()) {
        return;
    }

    var canvasCtx = canvas.getContext("2d");

    var frequencyData = audioHub.getAudioAnalyser().getFrequencyData();
    var frequencyBufferLength = frequencyData.length;

    var radius = radiusMultiplier(frequencyData) * (canvas.height / 4);
    var angularIncrement = 2 * Math.PI / frequencyBufferLength;

    var center = getCenter(canvas);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineJoin = 'miter';

    var maxRadius = radius + canvas.height * 0.75 / 2;

    for (i = 0; i < frequencyBufferLength; i++) {
        var angleOffset = angularIncrement * 0.05;
        var angles = [new Angle(angularIncrement * i + angleOffset), new Angle(angularIncrement * (i + 1) - angleOffset)];

        var magnitude = frequencyData[i] / 255;

        // From inner radius to outer radius
        var radii = [radius, radius + (magnitude * (canvas.height * 0.6 / 2))];

        drawBar(canvasCtx, gradientCalculator, center, angles, radii, magnitude);
    }

    drawBarsPerspectiveLazy(canvasCtx, center, radius, maxRadius, gradientCalculator);
}

function streamTrack(url, audioHub) {
    console.log(url);
    var resolveIdentfierURL = 'https://api.soundcloud.com/resolve.json?url=' + url + '&client_id=' + clientId;
    $.getJSON(resolveIdentfierURL, function(resolved) {
        console.log(resolved);
        audioHub.streamTrack(resolved.stream_url);
    });
}

// Get linear gradient properties from given style
function getBackgroundGradient(style) {
    var re = /linear-gradient\(\s*(\d+)deg\s*,\s*(rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\))\s*,\s*(rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\))\s*\)/;
    return re.exec(style);
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

    var backgroundStyle = window.getComputedStyle(document.body, null).getPropertyValue('background');
    var matched = getBackgroundGradient(backgroundStyle);

    var gradientCalculator = new GradientCalculator(matched[1], matched[2], matched[3]);

    var visContainer = $('#visContainer');
    var canvases = insertVisualizationCanvases(visContainer, 2);

    resizeCanvas(canvases, visContainer[0], gradientCalculator);
    $(window).bind('resize', function() {
        resizeCanvas(canvases, visContainer[0], gradientCalculator);
    });

    var audioHub = new AudioHub($('#audioPlayer'));

    drawCircularVisualization(canvases[0], audioHub, gradientCalculator);
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
