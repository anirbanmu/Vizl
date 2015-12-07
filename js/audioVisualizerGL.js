'use strict';

class CanvasRendererGL extends CanvasRenderer {
    constructor(canvas) {
        super(canvas, false);
        let gl = this.context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        gl.clearColor(0.0, 0.0, 0.0, 0.0); // Transparent
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.glLocations = {}; // Consumer may use this to store their shader program's locations.
    }

    resize(w, h) {
        super.resize(w, h);
        this.context.viewport(0, 0, this.width, this.height);
    }
}

const scalarToCircularVertShader = `
    attribute float vertexId; // Should be uint's but OpenGL ES doesn't allow integer attributes.
    attribute float magnitude;

    uniform float baseRadius;
    uniform float magnitudeScale;
    uniform float angularIncrement;
    uniform vec2 aspectScale;

    void main() {
        float angle = angularIncrement * vertexId;
        float finalRadius = baseRadius + magnitudeScale * magnitude;
        gl_Position = vec4(finalRadius * cos(angle) * aspectScale.x, finalRadius * sin(angle) * aspectScale.y, 0.0, 1.0);
    }
`;

const trivialColorFragmentShader = `
    void main() {
        gl_FragColor = vec4(0.905, 0.298, 0.235, 1.0);
    }
`;

function compileShader(gl, shaderType, shader) {
    let s = gl.createShader(shaderType);
    gl.shaderSource(s, shader);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.log(gl.getShaderInfoLog(s));
    }
    return s;
}

function makeProgram(gl, vShader, fShader) {
    let p = gl.createProgram();
    gl.attachShader(p, vShader);
    gl.attachShader(p, fShader);
    gl.linkProgram(p);
    gl.useProgram(p);
    return p;
}

function updateFloatAttribute(gl, array, drawType, attributeLocation, itemSize) {
    itemSize = itemSize || 1;
    let buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, array, drawType);
    gl.enableVertexAttribArray(attributeLocation);
    gl.vertexAttribPointer(attributeLocation, itemSize, gl.FLOAT, gl.FALSE, 0, 0);
    return buffer;
}

function gatherLocations(gl, program) {
    let locations = {}
    {
        const attributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < attributes; i++) {
            name = gl.getActiveAttrib(program, i).name;
            locations[name] = gl.getAttribLocation(program, name);
        }
    }

    {
        const uniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniforms; i++) {
            name = gl.getActiveUniform(program, i).name;
            locations[name] = gl.getUniformLocation(program, name);
        }
    }
    return locations;
}

class TimeDomainRendererGL extends CanvasRendererGL {
    constructor(audioAnalyser, canvas) {
        super(canvas);
        this.getTimeData = audioAnalyser.getTimeData;

        const gl = this.context;

        const vShader = compileShader(gl, gl.VERTEX_SHADER, scalarToCircularVertShader);
        const fShader = compileShader(gl, gl.FRAGMENT_SHADER, trivialColorFragmentShader);

        const program = makeProgram(gl, vShader, fShader);
        this.glLocations = gatherLocations(gl, program);

        updateFloatAttribute(gl, new Float32Array(Array.from(new Array(audioAnalyser.timeFftSize), (x, i) => i)), gl.STATIC_DRAW, this.glLocations['vertexId']);
    }

    renderVisual() {
        const gl = this.context;

        const timeData = this.getTimeData(0.65);
        updateFloatAttribute(gl, timeData, gl.DYNAMIC_DRAW, this.glLocations['magnitude']);

        const baseRadius = 0.25;
        const magnitudeScale = baseRadius * 0.5;
        const angularIncrement = 2 * Math.PI / timeData.length;

        gl.uniform1f(this.glLocations['baseRadius'], baseRadius);
        gl.uniform1f(this.glLocations['magnitudeScale'], magnitudeScale);
        gl.uniform1f(this.glLocations['angularIncrement'], angularIncrement);

        gl.drawArrays(gl.LINE_STRIP, 0, timeData.length);

        gl.uniform1f(this.glLocations['angularIncrement'], -angularIncrement);
        gl.drawArrays(gl.LINE_STRIP, 0, timeData.length);
    }

    resize(w, h) {
        super.resize(w, h);

        const minCanvasDim = this.minDim();
        this.context.uniform2fv(this.glLocations['aspectScale'], [minCanvasDim / this.width, minCanvasDim / this.height]);
    }
}

const aspectCorrectingVertShader = `
    precision highp float;

    attribute float triangleId; // Should be uint's but OpenGL ES doesn't allow integer attributes.
    attribute vec2 position;

    uniform vec2 minMaxDb;

    uniform vec2 aspectScale;
    uniform float magnitudes[FREQUENCY_MAGNITUDE_SIZE];

    varying float normalizedMagnitude;

    float normalizeFreqMagnitude(float db, float minDb, float maxDb) {
        return min(1.0, max(0.0, (db - minDb) / (maxDb - minDb)));
    }

    void main() {
        normalizedMagnitude = normalizeFreqMagnitude(magnitudes[int(triangleId)], minMaxDb.x, minMaxDb.y);
        gl_Position = vec4(position.x * aspectScale.x, position.y * aspectScale.y, 0.0, 1.0);
    }
`;

const freqBarsFragShader = `
    precision highp float;

    uniform vec2 center;
    uniform vec2 barRadii[FREQUENCY_BAR_COUNT];

    varying float normalizedMagnitude;

    void main() {
        float x = gl_FragCoord.x - center.x;
        float y = gl_FragCoord.y - center.y;

        float currentRadiusSquared = x * x + y * y;

        float exactBarCount = normalizedMagnitude * float(FREQUENCY_BAR_COUNT);
        float lastBarPortion = exactBarCount - floor(exactBarCount);
        int barCount = int(ceil(exactBarCount));

        for (int i = 0; i > -1; i++) {
            if (i >= barCount) {
                return;
            }

            float innerRadiusSquared = barRadii[i].x * barRadii[i].x;
            float outerRadiusSquared = barRadii[i].y * barRadii[i].y;
            if (i + 1 == barCount) {
                float outerRadius = lastBarPortion * (barRadii[i].y - barRadii[i].x) + barRadii[i].x;
                outerRadiusSquared = outerRadius * outerRadius;
            }
            if (currentRadiusSquared > innerRadiusSquared && currentRadiusSquared < outerRadiusSquared) {
                gl_FragColor = vec4(0.905, 0.298, 0.235, 1.0);
                return;
            }
        }

        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
`;

function generateRadialTriangles(divisions, gapPercent) {
    const angularIncrement = -2 * Math.PI / divisions;
    const angleOffset = angularIncrement * gapPercent;
    const triangleSideLength = 1 / Math.cos(angularIncrement - 2 * angleOffset);

    let triangles = [];
    for (let i = 0; i < divisions; i++) {
        const angles = [new Angle(angularIncrement * i + angleOffset), new Angle(angularIncrement * (i + 1) - angleOffset)];
        triangles.push(0.0, 0.0);
        triangles.push(triangleSideLength * angles[0].cos, triangleSideLength * angles[0].sin);
        triangles.push(triangleSideLength * angles[1].cos, triangleSideLength * angles[1].sin);
    }

    return triangles;
}

function generateRadialBars(barCount, gapWidthRange, radii) {
    // Not including segmented gaps
    const maxLength = radii[1] - radii[0];

    const radialIncrement = 0.05 * maxLength / barCount;
    const radialMultiplier = 2 * (maxLength - barCount * radialIncrement) / (barCount * (barCount - 1));

    const lineWidthInc = lineWidthIncrement(gapWidthRange, barCount);

    let lastOuterRadius = radii[0];
    let bars = []
    for (let i = 0; i < barCount; ++i) {
        const innerRadius = lastOuterRadius;
        const outerRadius = innerRadius + (radialIncrement + radialMultiplier * i);
        Array.prototype.push.apply(bars, [innerRadius, outerRadius]);
        lastOuterRadius = outerRadius + (gapWidthRange[0] + lineWidthInc * i);
    }
    return bars;
}

function pickGapUpperBound(gapRangeStart, segmentCount, length) {
    return gapRangeStart + 2 * (length - segmentCount * gapRangeStart) / (segmentCount - 1);
}

class FrequencyDomainRendererGL extends CanvasRendererGL {
    constructor(audioAnalyser, canvas) {
        super(canvas);
        this.getFrequencyData = audioAnalyser.getFrequencyData;
        this.minDb = audioAnalyser.minDb;
        this.maxDb = audioAnalyser.maxDb;

        const gl = this.context;

        const vShader = compileShader(gl, gl.VERTEX_SHADER, aspectCorrectingVertShader.split('FREQUENCY_MAGNITUDE_SIZE').join(audioAnalyser.freqBinCount));

        this.freqBarCount = 28;
        const fShader = compileShader(gl, gl.FRAGMENT_SHADER, freqBarsFragShader.split('FREQUENCY_BAR_COUNT').join(this.freqBarCount));

        const program = makeProgram(gl, vShader, fShader);
        this.glLocations = gatherLocations(gl, program);

        updateFloatAttribute(gl, new Float32Array(Array.from(new Array(audioAnalyser.freqBinCount * 3), (x, i) => Math.floor(i / 3))), gl.STATIC_DRAW, this.glLocations['triangleId']);

        this.freqBinCount = Math.floor(0.74 * audioAnalyser.freqBinCount);
        updateFloatAttribute(gl, new Float32Array(generateRadialTriangles(this.freqBinCount, 0.1)), gl.STATIC_DRAW, this.glLocations['position'], 2);

        this.context.uniform2fv(this.glLocations['minMaxDb'], [audioAnalyser.minDb, audioAnalyser.maxDb]);
    }

    renderVisual() {
        const gl = this.context;

        const freqData = this.getFrequencyData();
        gl.uniform1fv(this.glLocations['magnitudes[0]'], freqData);

        {
            const scalingDim = this.minDim() / 2;
            const freqIntensityFactor = freqIntensityMultipler(freqData, this.minDb, this.maxDb);
            const lineWidths = [2, pickGapUpperBound(2, this.freqBarCount, scalingDim * 0.20)];
            const baseRadius = freqIntensityFactor * scalingDim * 0.45;
            const maxRadius = baseRadius + scalingDim * 0.35;
            let bars = generateRadialBars(this.freqBarCount, lineWidths, [baseRadius, maxRadius]);
            gl.uniform2fv(this.glLocations['barRadii[0]'], new Float32Array(bars));
        }

        gl.drawArrays(gl.TRIANGLES, 0, this.freqBinCount * 3);
    }

    resize(w, h) {
        super.resize(w, h);

        const minCanvasDim = Math.min(this.width, this.height);
        this.context.uniform2fv(this.glLocations['aspectScale'], [minCanvasDim / this.width, minCanvasDim / this.height]);
        this.context.uniform2fv(this.glLocations['center'], [this.width / 2, this.height / 2]);
    }
}