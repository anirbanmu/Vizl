'use strict';

function setFilter(element, filter) {
    element.style.webkitFilter = element.style.filter = filter;
}

function getCenter(canvas) {
    return new Vector2d(canvas.width / 2, canvas.height / 2);
}

function drawTimeVisualizationCore(clockWise, canvas, canvasCtx, timeData) {
    var radius = (Math.min(canvas.width, canvas.height) / 7) - 128.0;

    var center = getCenter(canvas);

    var angularIncrement = (clockWise ? 1 : -1) * 2 * Math.PI / timeData.length;

    canvasCtx.beginPath();
    canvasCtx.moveTo(center.x + radius + timeData[0] * 0.75, center.y);

    for (var i = 1; i < timeData.length; i++) {
        var angle = new Angle(angularIncrement * i);

        canvasCtx.lineTo(center.x + radius * angle.cos + timeData[i] * angle.cos * 0.75, center.y + radius * angle.sin + timeData[i] * angle.sin * 0.75);
    }

    canvasCtx.lineWidth = 1;
    canvasCtx.lineJoin = 'round';
    canvasCtx.strokeStyle = 'rgb(231, 76, 60)';

    canvasCtx.stroke();
}

function drawTimeVisualization(canvas, audioAnalyser) {
    setFilter(canvas, 'blur(1px)');

    var canvasCtx = canvas.getContext('2d');
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    var timeData = audioAnalyser.getTimeData(0.65);
    drawTimeVisualizationCore(true, canvas, canvasCtx, timeData);
    drawTimeVisualizationCore(false, canvas, canvasCtx, timeData);
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
    for (var i = 0; i < frequencyData.length / 4; i++) {
        rMultiplier += frequencyData[i];
    }
    return rMultiplier / (frequencyData.length / 4) / 255;
}

function drawFrequencyVisualization(canvas, audioAnalyser) {
    var canvasCtx = canvas.getContext('2d');

    var frequencyData = audioAnalyser.getFrequencyData();
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

    for (var i = 0; i < frequencyBufferLength; i++) {
        var angleOffset = angularIncrement * 0.1;
        var angles = [new Angle(angularIncrement * i + angleOffset), new Angle(angularIncrement * (i + 1) - angleOffset)];

        drawSegmentedBarPath(canvasCtx, center, angles, [radius, maxRadius], frequencyData[i] / 255, segmentCount, lineWidths);
    }

    // Fill for all bars
    canvasCtx.fill();
}

function drawTrackImage(canvas, image) {
    var ctx = canvas.getContext('2d');
    canvas.style.opacity = 0.1;
    setFilter(canvas, 'blur(30px)');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}

function insertVisualizationCanvases(visContainer, layerCount) {
    var canvases = [];
    for (var i = 0; i < layerCount; ++i) {
        var newCanvas = $("<canvas style='z-index: " + i + "; position: absolute; left: 0; top: 0;' />");
        visContainer.append(newCanvas);
        canvases[i] = newCanvas[0];
    }
    return canvases;
}

function AudioVisualizer(audioAnalyser, visContainer) {
    var canvases = insertVisualizationCanvases(visContainer, 3);

    var visualizationPaused = true;
    var trackImage = new Image();
    trackImage.onload = function() {
        drawTrackImage(canvases[0], trackImage);
        canvases[0].redraw = drawTrackImage.bind(null, canvases[0], trackImage);
    };

    this.updateTrackImage = function(trackImgURL) {
        canvases[0].redraw = null;
        trackImage.src = trackImgURL;
    };

    function repeatUntilPaused(func) {
        (function customRepeater() {
            if (!visualizationPaused) {
                requestAnimationFrame(customRepeater);
                func();
            }
        }());
    };

    this.startVisualization = function() {
        visualizationPaused = false;

        repeatUntilPaused(drawTimeVisualization.bind(null, canvases[1], audioAnalyser));
        repeatUntilPaused(drawFrequencyVisualization.bind(null, canvases[2], audioAnalyser));
    };

    this.pauseVisualization = function() {
        visualizationPaused = true;
    };

    this.onResize = function() {
        canvases.forEach(function(canvas) {
            canvas.width = visContainer[0].clientWidth;
            canvas.height = visContainer[0].clientHeight;
            if (canvas.redraw) {
                canvas.redraw();
            }
        });
    };

    // No resize event for first sizing
    this.onResize();
}