'use strict';

function setFilter(element, filter) {
    element.canvas.style.webkitFilter = element.canvas.style.filter = filter;
}

function drawTimeVisualizationCore(clockWise, canvas, canvasCtx, timeData) {
    let radius = (Math.min(canvas.width, canvas.height) / 7) - 128.0;

    let center = canvas.center();

    let angularIncrement = (clockWise ? 1 : -1) * 2 * Math.PI / timeData.length;

    canvasCtx.beginPath();
    canvasCtx.moveTo(center.x + (radius + timeData[0] * 0.75), center.y);

    for (let i = 1; i < timeData.length; i++) {let angle = new Angle(angularIncrement * i);
        let magnitude = radius + timeData[i] * 0.75;

        canvasCtx.lineTo(center.x + magnitude * angle.cos, center.y + magnitude * angle.sin);
    }

    canvasCtx.stroke();
}

function drawTimeVisualization(canvas, audioAnalyser) {
    let canvasCtx = canvas.context2d;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 1;
    canvasCtx.lineJoin = 'round';
    canvasCtx.strokeStyle = 'rgb(231, 76, 60)';

    let timeData = audioAnalyser.getTimeData(0.65);
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

function freqIntensityMultipler(frequencyData) {
    let rMultiplier = 0;
    for (let i = 0; i < frequencyData.length / 4; i++) {
        rMultiplier += frequencyData[i];
    }
    return rMultiplier / (frequencyData.length / 4) / 255;
}

function drawFrequencyVisualization(canvas, frequencyData, freqIntensityFactor) {
    let canvasCtx = canvas.context2d;
    let scalingDim = Math.min(canvas.width / 2, canvas.height / 2);
    let radius = freqIntensityFactor * (scalingDim / 2);
    let frequencyCutOff = Math.floor(0.74 * frequencyData.length);
    let angularOffsetFactor = 0.15
    let angularIncrement = 2 * Math.PI / frequencyCutOff;
    let center = canvas.center();

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    //canvasCtx.lineJoin = 'miter';

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

        drawSegmentedBarPath(canvasCtx, center, angles, [radius, maxRadius], frequencyData[i] / 255, segmentCount, lineWidths);
    }

    // Fill for all bars
    canvasCtx.fill();
}

function drawTrackImage(canvas, image) {
    let ctx = canvas.context2d;
    let minDim = Math.min(canvas.width, canvas.height);

    ctx.save();

    // Always center square image with half tiles (flipped) to fill the rest.
    if (canvas.width > minDim) {
        let x = canvas.width / 2 - minDim / 2;
        ctx.drawImage(image, x, 0, minDim, minDim);
        ctx.scale(-1,1);
        ctx.drawImage(image, -x, 0, minDim, minDim);
        ctx.drawImage(image, -(x + minDim + minDim), 0, minDim, minDim);
    }
    else {
        let y = canvas.height / 2 - minDim / 2;
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

class CanvasHelper {
    constructor(canvas, gl) {
        this.canvas = canvas;
        this.contextgl = gl ? (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) : null;
        this.context2d = gl ? null : canvas.getContext('2d');
        this.redraw = null;
        this.initWebGL();
    }

    initWebGL() {
        let gl = this.contextgl;
        if (gl) {
            gl.clearColor(0.0, 0.0, 0.0, 0.0); // Transparent
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }
    }

    resized() {
        if (this.contextgl) {
            this.contextgl.viewport(0, 0, this.width, this.height);
        }
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

    center() {
        return new Vector2d(this.canvas.width / 2, this.canvas.height / 2);
    }
}

function insertVisualizationCanvases(visContainer, opacities, filters, contextTypes, layerCount) {
    let canvases = [];
    for (let i = 0; i < layerCount; ++i) {
        let newCanvas = $("<canvas style='z-index: " + i + "; position: absolute; left: 0; top: 0;' />");
        visContainer.append(newCanvas);
        canvases[i] = new CanvasHelper(newCanvas[0], contextTypes[i]);
        canvases[i].canvas.style.opacity = opacities[i];
        setFilter(canvases[i], filters[i]);
    }
    return canvases;
}

function AudioVisualizer(audioAnalyser, visContainer) {
    let canvases;
    {
        let opacities = [0.06, 1.0, 1.0];
        let filters = ['blur(30px)', 'blur(1px)', ''];
        let types = [false, false, false]
        canvases = insertVisualizationCanvases(visContainer, opacities, filters, types, 3);
    }

    let visualizationPaused = true;
    let trackImage = new Image();
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
            canvas.resized();
            if (canvas.redraw) {
                canvas.redraw();
            }
        });
    };

    // No resize event for first sizing
    this.onResize();
}