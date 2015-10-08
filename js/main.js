var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

var gainNode = audioCtx.createGain();
gainNode.connect(audioCtx.destination);
gainNode.gain.value = 0.5;

var audioPlayer;
var mediaSource;

var audioAnalyser;

function AudioAnalyser(context, source, frequencyFftSize, timeFftSize) {
    this.frequencyAnalyser = context.createAnalyser();
    this.frequencyAnalyser.fftSize = frequencyFftSize;
    this.frequencyAnalyser.smoothingTimeConstant = 0.89;
    this.frequencyData = new Uint8Array(this.frequencyAnalyser.frequencyBinCount);
    source.connect(this.frequencyAnalyser);

    this.timeAnalyser = context.createAnalyser();
    this.timeAnalyser.fftSize = timeFftSize;
    this.timeAnalyser.smoothingTimeConstant = 1;
    this.timeData = new Uint8Array(this.timeAnalyser.frequencyBinCount);
    source.connect(this.timeAnalyser);

    this.getFrequencyData = function() {
        this.frequencyAnalyser.getByteFrequencyData(this.frequencyData);
        return this.frequencyData.slice();
    };

    this.getTimeData = function() {
        this.timeAnalyser.getByteTimeDomainData(this.timeData);
        return this.timeData.slice();
    };
}

window.onload = function(){
    audioPlayer = document.getElementById('audioPlayer');
    mediaSource = audioCtx.createMediaElementSource(audioPlayer);

    audioAnalyser = new AudioAnalyser(audioCtx, mediaSource, 128, 4096);

    mediaSource.connect(gainNode);
};

var bgGradientStart;
var bgGradientEnd;

function setBackgroundGradient(center, dimensions) {
    var angle = new Angle(45 * Math.PI / 180);
    var gradientLineLength = Math.abs(dimensions.x * angle.sin) + Math.abs(dimensions.y * angle.cos);

    bgGradientStart = new Vector2d(center.x - gradientLineLength * angle.cos / 2, center.y + gradientLineLength * angle.sin / 2);
    bgGradientEnd = new Vector2d(center.x + gradientLineLength * angle.cos / 2, center.y - gradientLineLength * angle.sin / 2);
}

function getCenter(canvas) {
    return new Vector2d(canvas.width / 2, canvas.height / 2);
}

function resizeCanvas() {
    var visContainer = document.getElementById('visContainer');
    
    var canvas = document.getElementById('visLayer0');
    canvas.width  = visContainer.clientWidth;
    canvas.height  = visContainer.clientHeight;

    canvas = document.getElementById('visLayer1');
    canvas.width  = visContainer.clientWidth;
    canvas.height  = visContainer.clientHeight;
    
    setBackgroundGradient(getCenter(canvas), new Vector2d(canvas.width, canvas.height));
}

window.onresize = resizeCanvas;

function setupStream(url) {
    url = new URL(url + '?client_id=' + clientId);
    audioPlayer.setAttribute('src', url);
}

function drawTimeDomainVisualizationCore(clockWise, canvas) {
    var canvasCtx = canvas.getContext("2d");

    var timeData = audioAnalyser.getTimeData();

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
    canvasCtx.strokeStyle = 'rgb(198, 0, 0)';

    canvasCtx.stroke();
}

function drawTimeDomainVisualization() {
    drawTimeDomainVisualization1 = requestAnimationFrame(drawTimeDomainVisualization);
    
    if (audioPlayer.paused) {
        return;
    }

    var canvas = document.getElementById('visLayer1');
    canvas.style.webkitFilter = "blur(1px)";
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    drawTimeDomainVisualizationCore(true, canvas);
    drawTimeDomainVisualizationCore(false, canvas);
}

function drawBars(canvasCtx, center, innerRadius, outerRadius, maxRadius, startingAngle, endingAngle) {
    var numBars = 20;
    var radialIncrement = (maxRadius - innerRadius) / numBars;

    var maxLineWidth = 8;
    var minLineWidth = 2;

    var lineWidthDecrement = (maxLineWidth - minLineWidth) / numBars;

    canvasCtx.strokeStyle = 'rgb(8,8,8)';

    for (var i = 0; i < numBars; ++i) {
        var radius = innerRadius + radialIncrement * i;
        if (radius >= outerRadius) {
            break;
        }

        canvasCtx.lineWidth = maxLineWidth - lineWidthDecrement * (numBars - 1 - i);

        canvasCtx.beginPath();
        canvasCtx.arc(center.x, center.y, radius, startingAngle, endingAngle, false);
        canvasCtx.stroke();
    }
}

function drawBarsPerspective(canvasCtx, center, innerRadius, outerRadius, maxRadius, startingAngle, endingAngle) {
    var numBars = 22;
    var radialIncrement = (maxRadius - innerRadius) / numBars;

    var multiplier = 2 / (1 + numBars);

    var maxLineWidth = 8;
    var minLineWidth = 2;

    var lineWidthDecrement = (maxLineWidth - minLineWidth) / numBars;

    canvasCtx.strokeStyle = 'rgb(8,8,8)';

    var lastRadius = innerRadius;
    for (var i = 0; i < numBars; ++i) {
        var radius = lastRadius + radialIncrement * (multiplier * (i + 1));
        if (radius >= outerRadius) {
            break;
        }

        canvasCtx.lineWidth = maxLineWidth - lineWidthDecrement * (numBars - 1 - i);

        canvasCtx.beginPath();
        canvasCtx.arc(center.x, center.y, radius, startingAngle, endingAngle, false);
        canvasCtx.stroke();

        lastRadius = radius;
    }
}

function drawBarsPerspectiveLazy(canvasCtx, center, innerRadius, outerRadius) {
    var numBars = 22;
    var radialIncrement = (outerRadius - innerRadius) / numBars;

    var multiplier = 2 / (1 + numBars);

    var maxLineWidth = 8;
    var minLineWidth = 2;

    var lineWidthDecrement = (maxLineWidth - minLineWidth) / numBars;

    var bgGradient = canvasCtx.createLinearGradient(bgGradientStart.x, bgGradientStart.y, bgGradientEnd.x, bgGradientEnd.y);
    bgGradient.addColorStop(0.0, '#ff8080');
    bgGradient.addColorStop(1.0, '#80dbff');
    canvasCtx.strokeStyle = bgGradient;

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

function drawPerspective(canvasCtx, center, innerRadius, outerRadius, startingAngle, endingAngle) {

    var bgGradient = canvasCtx.createLinearGradient(bgGradientStart.x, bgGradientStart.y, bgGradientEnd.x, bgGradientEnd.y);
    bgGradient.addColorStop(0.0, '#ff8080');
    bgGradient.addColorStop(1.0, '#80dbff');

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

function toRGBA(r, g, b, a) {
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function drawBarGradient(gradient, magnitude) {
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

function drawCircularVisualization() {
    drawCircularVisual = requestAnimationFrame(drawCircularVisualization);
    
    if (audioPlayer.paused) {
        return;
    }

    var canvas = document.getElementById('visLayer0');
    //canvas.style.webkitFilter = "blur(1px)";
    var canvasCtx = canvas.getContext("2d");


    var frequencyData = audioAnalyser.getFrequencyData();
    var frequencyBufferLength = frequencyData.length;

    var radiusMultiplier = 0;
    for (i = 0; i < frequencyBufferLength / 4; i++) {
        radiusMultiplier += frequencyData[i];
    }
    radiusMultiplier = radiusMultiplier / (frequencyBufferLength / 4) / 255;

    var radius = radiusMultiplier * (canvas.height / 4);
    var angularIncrement = 2 * Math.PI / frequencyBufferLength;

    var center = getCenter(canvas);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineJoin = 'miter';

    var maxRadius = radius + canvas.height * 0.75 / 2;

    for (i = 0; i < frequencyBufferLength; i++) {
        barHeight = frequencyData[i];

        canvasCtx.lineWidth = 1.5;
        //canvasCtx.strokeStyle = 'rgb(50,50,50)';
        canvasCtx.strokeStyle = 'rgb(8,8,8)';
        canvasCtx.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';

        var angleOffset = angularIncrement * 0.05;

        var startingAngle = new Angle(angularIncrement * i + angleOffset);
        var endingAngle = new Angle(angularIncrement * (i + 1) - angleOffset);

        var magnitude = barHeight / 255;

        var outerRadius = radius + (magnitude * (canvas.height * 0.6 / 2));

        canvasCtx.beginPath();

        canvasCtx.arc(center.x, center.y, radius, startingAngle.angle, endingAngle.angle, false);
        canvasCtx.lineTo(center.x + endingAngle.cos * outerRadius, center.y + endingAngle.sin * outerRadius);
        canvasCtx.arc(center.x, center.y, outerRadius, endingAngle.angle, startingAngle.angle, true);
        canvasCtx.lineTo(center.x + startingAngle.cos * radius, center.y + startingAngle.sin * radius);

        var midAngle = angularIncrement * (i + 0.5);
        var cosMidAngle = Math.cos(midAngle);
        var sinMidAngle = Math.sin(midAngle);

        var gradient = canvasCtx.createLinearGradient(center.x + cosMidAngle * radius, center.y + sinMidAngle * radius, center.x + cosMidAngle * outerRadius, center.y + sinMidAngle * outerRadius);
        drawBarGradient(gradient, barHeight / 255);
        canvasCtx.fillStyle = gradient;
        canvasCtx.fill();

        drawPerspective(canvasCtx, center, radius, outerRadius, startingAngle.angle, endingAngle.angle);
    }

    drawBarsPerspectiveLazy(canvasCtx, center, radius, maxRadius);
}

function streamTrack() {
    resizeCanvas();
    console.log(document.getElementById('urlInputBar').value);
    var resolveIdentfierURL = 'https://api.soundcloud.com/resolve.json?url=' + document.getElementById('urlInputBar').value + '&client_id=' + clientId;
    $.getJSON(resolveIdentfierURL, function(resolved) {
        console.log(resolved);
        setupStream(resolved.stream_url);
        playPause();
        drawCircularVisualization();
        drawTimeDomainVisualization();
    });
}

$(function () {
    $("#streamSubmit").click(function() {
        streamTrack();
    });
});
