'use strict';

function setFilter(element, filter) {
    element.canvas.style.webkitFilter = element.canvas.style.filter = filter;
}

function drawTimeVisualizationCore(clockWise, canvas, canvasCtx, timeData) {
    let radius = Math.min(canvas.width, canvas.height) / 7;
    let scalingFactor = radius / 2;

    let center = canvas.center();
    let angularIncrement = (clockWise ? 1 : -1) * 2 * Math.PI / timeData.length;

    canvasCtx.beginPath();
    canvasCtx.moveTo(center.x + (radius + timeData[0] * scalingFactor), center.y);

    for (let i = 1; i < timeData.length; i++) {
        let angle = new Angle(angularIncrement * i);
        let magnitude = radius + timeData[i] * scalingFactor;

        canvasCtx.lineTo(center.x + magnitude * angle.cos, center.y + magnitude * angle.sin);
    }

    canvasCtx.stroke();
}

function drawTimeVisualization(renderer, audioAnalyser) {
    let canvasCtx = renderer.context;
    canvasCtx.clearRect(0, 0, renderer.width, renderer.height);
    canvasCtx.lineWidth = 1;
    canvasCtx.lineJoin = 'round';
    canvasCtx.strokeStyle = 'rgb(231, 76, 60)';

    let timeData = audioAnalyser.getTimeData(0.65);
    drawTimeVisualizationCore(true, renderer, canvasCtx, timeData);
    drawTimeVisualizationCore(false, renderer, canvasCtx, timeData);
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
    let maxLength = radii[1] - radii[0];

    let radialIncrement = 0.05 * maxLength / segmentCount;
    let radialMultiplier = 2 * (maxLength - segmentCount * radialIncrement) / (segmentCount * (segmentCount - 1));

    let lineWidthInc = lineWidthIncrement(lineWidths, segmentCount);

    // Current bar's actual length
    let lastSegmentMagnitude = magnitude * segmentCount - Math.floor(magnitude * segmentCount);
    let barSegmentCount = Math.ceil(magnitude * segmentCount);

    let lastOuterRadius = radii[0];
    let i;
    for (i = 0; i < barSegmentCount - 1; ++i) {
        let innerRadius = lastOuterRadius;
        let outerRadius = innerRadius + (radialIncrement + radialMultiplier * i);

        canvasCtx.moveTo(center.x + innerRadius * angles[0].cos, center.y + innerRadius * angles[0].sin);
        canvasCtx.arc(center.x, center.y, innerRadius, angles[0].angle, angles[1].angle, angles[0].angle > angles[1].angle);
        canvasCtx.arc(center.x, center.y, outerRadius, angles[1].angle, angles[0].angle, angles[0].angle < angles[1].angle);
        canvasCtx.closePath();

        lastOuterRadius = outerRadius + (lineWidths[0] + lineWidthInc * i);
    }

    let outerRadius = (lastOuterRadius + (radialIncrement + radialMultiplier * i) * lastSegmentMagnitude);
    canvasCtx.moveTo(center.x + lastOuterRadius * angles[0].cos, center.y + lastOuterRadius * angles[0].sin);
    canvasCtx.arc(center.x, center.y, lastOuterRadius, angles[0].angle, angles[1].angle, angles[0].angle > angles[1].angle);
    canvasCtx.arc(center.x, center.y, outerRadius, angles[1].angle, angles[0].angle, angles[0].angle < angles[1].angle);
    canvasCtx.closePath();
}

function normalizeFreqMagnitude(mag, min, max) {
    return Math.min(1.0, Math.max(0.0, (mag - min) / (max - min)));
}

function freqIntensityMultipler(frequencyData, min, max) {
    let rMultiplier = 0;
    for (let i = 0; i < frequencyData.length / 4; i++) {
        rMultiplier += frequencyData[i];
    }
    return normalizeFreqMagnitude(rMultiplier / (frequencyData.length / 4), min, max);
}

function drawFrequencyVisualization(renderer, frequencyData, freqIntensityFactor, min, max) {
    let canvasCtx = renderer.context;
    let scalingDim = Math.min(renderer.width / 2, renderer.height / 2);
    let radius = freqIntensityFactor * (scalingDim / 2);
    let frequencyCutOff = Math.floor(0.74 * frequencyData.length);
    let angularOffsetFactor = 0.15
    let angularIncrement = 2 * Math.PI / frequencyCutOff;
    let center = renderer.center();

    canvasCtx.clearRect(0, 0, renderer.width, renderer.height);

    // Path for all segmented bars
    canvasCtx.beginPath();

    // Variation range for gaps in segmented bars
    let lineWidths = [2, 8];
    let segmentCount = 26;
    let maxRadius = radius + scalingDim * 6 / 16;

    // Gradient for segmented bars
    let gradient = canvasCtx.createRadialGradient(center.x, center.y, radius, center.x, center.y, segmentGapAdditionalLength(lineWidths, segmentCount) + maxRadius);
    gradient.addColorStop(0.0, 'rgba(0,0,255,0.02)');
    gradient.addColorStop(0.5, 'rgba(0,255,0,0.5)');
    gradient.addColorStop(1.0, 'rgba(255,0,0,1.0)');
    canvasCtx.fillStyle = gradient;

    let angleOffset = angularIncrement * 0.1;
    for (let i = 0; i < frequencyCutOff; i++) {
        let angles = [new Angle(angularIncrement * i + angleOffset), new Angle(angularIncrement * (i + 1) - angleOffset)];

        drawSegmentedBarPath(canvasCtx, center, angles, [radius, maxRadius], normalizeFreqMagnitude(frequencyData[i], min, max), segmentCount, lineWidths);
    }

    // Fill for all bars
    canvasCtx.fill();
}

function drawTrackImage(renderer, image) {
    let ctx = renderer.context;
    let minDim = Math.min(renderer.width, renderer.height);

    ctx.save();

    // Always center square image with half tiles (flipped) to fill the rest.
    if (renderer.width > minDim) {
        let x = renderer.width / 2 - minDim / 2;
        ctx.drawImage(image, x, 0, minDim, minDim);
        ctx.scale(-1,1);
        ctx.drawImage(image, -x, 0, minDim, minDim);
        ctx.drawImage(image, -(x + minDim + minDim), 0, minDim, minDim);
    }
    else {
        let y = renderer.height / 2 - minDim / 2;
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

function modifyTrackImage(renderer, freqIntensityFactor) {
    setFilter(renderer, 'hue-rotate(' + scaleInRange(freqIntensityFactor, [0, 360]) + 'deg) blur(30px)');
}

function frequencyBasedVisualizations(renderers, frequencyData, minDb, maxDb) {
    const freqIntensityFactor = freqIntensityMultipler(frequencyData, minDb, maxDb);
    modifyTrackImage(renderers[0], freqIntensityFactor);
    //drawFrequencyVisualization(renderers[1], frequencyData, freqIntensityFactor, minDb, maxDb);
}

class CanvasRenderer {
    constructor(canvas, retrieveContext) {
        this.canvas = canvas;
        this.context = retrieveContext === false ? null : canvas.getContext('2d');
        this.redraw = null;
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
    }

    get width() {
        return this.canvas.width;
    }

    set width(w) {
        this.canvas.width = w;
    }

    get height() {
        return this.canvas.height;
    }

    set height(h) {
        this.canvas.height = h;
    }

    minDim() {
        return Math.min(this.canvas.width, this.canvas.height);
    }

    center() {
        return new Vector2d(this.width / 2, this.height / 2);
    }
}

function createVisualizationRenderers(visContainer, opacities, filters, rendererTypes, layerCount) {
    let renderers = [];
    for (let i = 0; i < layerCount; ++i) {
        let newCanvas = $("<canvas style='z-index: " + i + "; position: absolute; left: 0; top: 0;' />");
        visContainer.append(newCanvas);
        renderers[i] = new rendererTypes[i](newCanvas[0]);
        renderers[i].canvas.style.opacity = opacities[i];
        setFilter(renderers[i], filters[i]);
    }
    return renderers;
}

function AudioVisualizer(audioAnalyser, visContainer) {
    let renderers;
    {
        const opacities = [0.06, 1.0, 1.0];
        const filters = ['blur(30px)', 'blur(1px)', ''];
        const rendererTypes = [CanvasRenderer, TimeDomainRendererGL.bind(null, audioAnalyser), FrequencyDomainRendererGL.bind(null, audioAnalyser)];
        renderers = createVisualizationRenderers(visContainer, opacities, filters, rendererTypes, 3);
    }

    let visualizationPaused = true;
    let trackImage = new Image();
    trackImage.crossOrigin = 'anonymous';
    trackImage.onload = function() {
        drawTrackImage(renderers[0], trackImage);
        renderers[0].redraw = drawTrackImage.bind(null, renderers[0], trackImage);
    };

    this.updateTrackImage = function(trackImgURL) {
        renderers[0].redraw = null;
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

        repeatUntilPaused(function() { renderers[1].renderVisual(); });
        repeatUntilPaused(function() {
            renderers[2].renderVisual();
            frequencyBasedVisualizations([renderers[0], renderers[2]], audioAnalyser.getFrequencyData(), audioAnalyser.minDb, audioAnalyser.maxDb);
        });
    };

    this.pauseVisualization = function() {
        visualizationPaused = true;
    };

    this.onResize = function() {
        renderers.forEach(function(canvas) {
            canvas.resize(visContainer[0].clientWidth, visContainer[0].clientHeight);
            if (canvas.redraw) {
                canvas.redraw();
            }
        });
    };

    // No resize event for first sizing
    this.onResize();
}