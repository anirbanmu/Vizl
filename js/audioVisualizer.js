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
    canvasCtx.moveTo(center.x + (radius + timeData[0] * 0.75), center.y);

    for (var i = 1; i < timeData.length; i++) {
        var angle = new Angle(angularIncrement * i);
        var magnitude = radius + timeData[i] * 0.75;

        canvasCtx.lineTo(center.x + magnitude * angle.cos, center.y + magnitude * angle.sin);
    }

    canvasCtx.stroke();
}

function drawTimeVisualization(canvas, audioAnalyser) {
    var canvasCtx = canvas.getContext('2d');
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 1;
    canvasCtx.lineJoin = 'round';
    canvasCtx.strokeStyle = 'rgb(231, 76, 60)';

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
    var i;
    for (i = 0; i < barSegmentCount - 1; ++i) {
        var innerRadius = lastOuterRadius;
        var outerRadius = innerRadius + (radialIncrement + radialMultiplier * i);

        canvasCtx.moveTo(center.x + innerRadius * angles[0].cos, center.y + innerRadius * angles[0].sin);
        canvasCtx.arc(center.x, center.y, innerRadius, angles[0].angle, angles[1].angle, angles[0].angle > angles[1].angle);
        canvasCtx.arc(center.x, center.y, outerRadius, angles[1].angle, angles[0].angle, angles[0].angle < angles[1].angle);
        canvasCtx.closePath();

        lastOuterRadius = outerRadius + (lineWidths[0] + lineWidthInc * i);
    }

    var outerRadius = (lastOuterRadius + (radialIncrement + radialMultiplier * i) * lastSegmentMagnitude);
    canvasCtx.moveTo(center.x + lastOuterRadius * angles[0].cos, center.y + lastOuterRadius * angles[0].sin);
    canvasCtx.arc(center.x, center.y, lastOuterRadius, angles[0].angle, angles[1].angle, angles[0].angle > angles[1].angle);
    canvasCtx.arc(center.x, center.y, outerRadius, angles[1].angle, angles[0].angle, angles[0].angle < angles[1].angle);
    canvasCtx.closePath();
}

function freqIntensityMultipler(frequencyData) {
    var rMultiplier = 0;
    for (var i = 0; i < frequencyData.length / 4; i++) {
        rMultiplier += frequencyData[i];
    }
    return rMultiplier / (frequencyData.length / 4) / 255;
}

function drawFrequencyVisualization(canvas, frequencyData, freqIntensityFactor) {
    var canvasCtx = canvas.getContext('2d');
    var scalingDim = Math.min(canvas.width / 2, canvas.height / 2);
    var radius = freqIntensityFactor * (scalingDim / 2);
    var frequencyCutOff = Math.floor(0.74 * frequencyData.length);
    var angularOffsetFactor = 0.15
    var angularIncrement = 2 * Math.PI / frequencyCutOff;
    var center = getCenter(canvas);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    //canvasCtx.lineJoin = 'miter';

    // Path for all segmented bars
    canvasCtx.beginPath();

    // Variation range for gaps in segmented bars
    var lineWidths = [2, 8];
    var segmentCount = 26;
    var maxRadius = radius + scalingDim * 6 / 16;

    // Gradient for segmented bars
    var gradient = canvasCtx.createRadialGradient(center.x, center.y, radius, center.x, center.y, segmentGapAdditionalLength(lineWidths, segmentCount) + maxRadius);
    gradient.addColorStop(0.0, 'rgba(0,0,255,0.02)');
    gradient.addColorStop(0.5, 'rgba(0,255,0,0.5)');
    gradient.addColorStop(1.0, 'rgba(255,0,0,1.0)');
    canvasCtx.fillStyle = gradient;

    var angleOffset = angularIncrement * 0.1;
    for (var i = 0; i < frequencyCutOff; i++) {
        var angles = [new Angle(angularIncrement * i + angleOffset), new Angle(angularIncrement * (i + 1) - angleOffset)];

        drawSegmentedBarPath(canvasCtx, center, angles, [radius, maxRadius], frequencyData[i] / 255, segmentCount, lineWidths);
    }

    // Fill for all bars
    canvasCtx.fill();
}

function drawTrackImage(canvas, image) {
    var ctx = canvas.getContext('2d');
    var minDim = Math.min(canvas.width, canvas.height);

    ctx.save();

    // Always center square image with half tiles (flipped) to fill the rest.
    if (canvas.width > minDim) {
        var x = canvas.width / 2 - minDim / 2;
        ctx.drawImage(image, x, 0, minDim, minDim);
        ctx.scale(-1,1);
        ctx.drawImage(image, -x, 0, minDim, minDim);
        ctx.drawImage(image, -(x + minDim + minDim), 0, minDim, minDim);
    }
    else {
        var y = canvas.height / 2 - minDim / 2;
        ctx.drawImage(image, 0, y, minDim, minDim);
        ctx.scale(1,-1);
        ctx.drawImage(image, 0, -y, minDim, minDim);
        ctx.drawImage(image, 0, -(y + minDim + minDim), minDim, minDim);
    }

    ctx.restore();
}

function scaleInRange(scale, range) {
    return (range[1] - range[0]) * scale + range[0];
}

function modifyTrackImage(canvas, frequencyData, freqIntensityFactor) {
    setFilter(canvas, 'hue-rotate(' + scaleInRange(freqIntensityFactor, [0, 360]) + 'deg) blur(30px)');
}

function frequencyBasedVisualizations(canvases, frequencyData, freqIntensityFactor) {
    modifyTrackImage(canvases[0], frequencyData, freqIntensityFactor);
    drawFrequencyVisualization(canvases[1], frequencyData, freqIntensityFactor);
}

function insertVisualizationCanvases(visContainer, opacities, filters, layerCount) {
    var canvases = [];
    for (var i = 0; i < layerCount; ++i) {
        var newCanvas = $("<canvas style='z-index: " + i + "; position: absolute; left: 0; top: 0;' />");
        visContainer.append(newCanvas);
        canvases[i] = newCanvas[0];
        canvases[i].style.opacity = opacities[i];
        setFilter(canvases[i], filters[i]);
    }
    return canvases;
}

function AudioVisualizer(audioAnalyser, visContainer) {
    var canvases;
    {
        var opacities = [0.06, 1.0, 1.0];
        var filters = ['blur(30px)', 'blur(1px)', ''];
        canvases = insertVisualizationCanvases(visContainer, opacities, filters, 3);
    }

    var visualizationPaused = true;
    var trackImage = new Image();
    trackImage.crossOrigin = 'anonymous';
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
        repeatUntilPaused(function() {
            frequencyBasedVisualizations([canvases[0], canvases[2]], audioAnalyser.getFrequencyData(), freqIntensityMultipler(audioAnalyser.getFrequencyData()));
        });
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