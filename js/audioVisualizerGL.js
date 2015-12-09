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

    get width() {
        return this.context.drawingBufferWidth;
    }

    set width(w) {
        super.width = w;
    }

    get height() {
        return this.context.drawingBufferHeight;
    }

    set height(h) {
        super.height = h;
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

        const baseRadius = 0.20;
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

    attribute float polyIndex; // Should be uint's but OpenGL ES doesn't allow integer attributes.
    attribute vec4 posAndAngles;

    uniform vec2 minMaxDb;
    uniform vec2 aspectScale;
    uniform float magnitudes[FREQUENCY_BARS];

    varying float normalizedMagnitude;
    varying vec2 angles;

    float normalizeFreqMagnitude(float db, float minDb, float maxDb) {
        return min(1.0, max(0.0, (db - minDb) / (maxDb - minDb)));
    }

    void main() {
        angles = vec2(posAndAngles.zw);
        normalizedMagnitude = normalizeFreqMagnitude(magnitudes[int(polyIndex)], minMaxDb.x, minMaxDb.y);
        gl_Position = vec4(posAndAngles.x * aspectScale.x, posAndAngles.y * aspectScale.y, 0.0, 1.0);
    }
`;

const freqBarsFragShader = `
    precision highp float;

    uniform vec2 center;
    uniform vec2 barRadii[FREQUENCY_BAR_DIVS];

    varying float normalizedMagnitude;
    varying vec2 angles;

    vec4 getColor(float radius, vec2 bounds) {
        float rangeRelativeRadius = radius - bounds.x;
        float rangeRadius = bounds.y - bounds.x;

        float normalized = rangeRelativeRadius / rangeRadius;
        if (normalized <= 0.5) {
            return mix(vec4(0.0, 0.0, 1.0, 0.02), vec4(0.0, 1.0, 0.0, 0.5), normalized * 2.0);
        }
        return mix(vec4(0.0, 1.0, 0.0, 0.5), vec4(1.0, 0.0, 0.0, 1.0), (normalized - 0.5) * 2.0);
    }

    vec4 adjustAlphaRadialEdge(vec4 color, float radius, vec2 edgeRadii) {
        const float allowedDelta = 0.15;
        float delta = min(radius - edgeRadii.x, edgeRadii.y - radius) / (edgeRadii.y - edgeRadii.x);
        if (delta < allowedDelta) {
            return vec4(color.rgb, color.a * (delta / allowedDelta));
        }
        return color;
    }

    const float inf = 1.0 / 0.0;
    const float pi = 3.141592653589793;

    float arctan(vec2 position) {
        float angleTan = position.y / position.x;

        if (abs(angleTan) == inf) {
            return (position.y < 0.0) ? -0.5 * pi : -1.5 * pi;
        }

        if (abs(angleTan) < 0.000000000001) {
            return (position.x < 0.0) ? -pi : 0.0;
        }

        float angle = atan(angleTan);
        if (angle > 0.0) {
            return (position.x < 0.0) ? angle - pi : angle - 2.0 * pi;
        }
        return (position.x < 0.0) ? angle - pi : angle;
    }

    vec4 adjustAlphaBarEdge(vec4 color, vec2 position, vec2 angleBounds) {
        float angle = arctan(position);

        const float allowedDelta = 0.10;
        float delta = min(abs(angleBounds.x - angle), abs(angleBounds.y - angle)) / abs(angleBounds.y - angleBounds.x);
        if (delta < allowedDelta) {
            return vec4(color.rgb, color.a * (delta / allowedDelta));
        }

        return color;
    }

    void main() {
        vec2 pos = vec2(gl_FragCoord.x - center.x, gl_FragCoord.y - center.y);
        float radius = sqrt(pos.x * pos.x + pos.y * pos.y);

        float exactBarCount = normalizedMagnitude * float(FREQUENCY_BAR_DIVS);
        float lastBarPortion = exactBarCount - floor(exactBarCount);
        int barCount = int(ceil(exactBarCount));

        for (int i = 0; i > -1; i++) {
            if (i >= barCount) {
                break;
            }

            float innerRadius = barRadii[i].x;
            float outerRadius = barRadii[i].y;
            if (i + 1 == barCount) {
                outerRadius = lastBarPortion * (outerRadius - innerRadius) + innerRadius;
            }
            if (radius > innerRadius && radius < outerRadius) {
                vec4 color = getColor(radius, vec2(barRadii[0].x, barRadii[FREQUENCY_BAR_DIVS - 1].y));
                color = adjustAlphaRadialEdge(color, radius, vec2(innerRadius, outerRadius));
                gl_FragColor = adjustAlphaBarEdge(color, pos, angles);
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
        triangles.push(0.0, 0.0, angles[0].angle, angles[1].angle);
        triangles.push(triangleSideLength * angles[0].cos, triangleSideLength * angles[0].sin, angles[0].angle, angles[1].angle);
        triangles.push(triangleSideLength * angles[1].cos, triangleSideLength * angles[1].sin, angles[0].angle, angles[1].angle);
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
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.enable(gl.BLEND);

        const vShader = compileShader(gl, gl.VERTEX_SHADER, aspectCorrectingVertShader.split('FREQUENCY_BARS').join(audioAnalyser.freqBinCount));

        this.freqBarCount = 28;
        const fShader = compileShader(gl, gl.FRAGMENT_SHADER, freqBarsFragShader.split('FREQUENCY_BAR_DIVS').join(this.freqBarCount));

        const program = makeProgram(gl, vShader, fShader);
        this.glLocations = gatherLocations(gl, program);

        updateFloatAttribute(gl, new Float32Array(Array.from(new Array(audioAnalyser.freqBinCount * 3), (x, i) => Math.floor(i / 3))), gl.STATIC_DRAW, this.glLocations['polyIndex']);

        this.freqBinCount = Math.floor(0.74 * audioAnalyser.freqBinCount);
        updateFloatAttribute(gl, new Float32Array(generateRadialTriangles(this.freqBinCount, 0.1)), gl.STATIC_DRAW, this.glLocations['posAndAngles'], 4);

        gl.uniform2fv(this.glLocations['minMaxDb'], [audioAnalyser.minDb, audioAnalyser.maxDb]);
    }

    renderVisual() {
        const gl = this.context;

        const freqData = this.getFrequencyData();
        gl.uniform1fv(this.glLocations['magnitudes[0]'], freqData);

        {
            const scalingDim = this.minDim() / 2;
            const freqIntensityFactor = freqIntensityMultipler(freqData, this.minDb, this.maxDb);
            const lineWidths = [2, pickGapUpperBound(2, this.freqBarCount, scalingDim * 0.20)];

            const minRadiusPortion = 0.15;
            const baseRadius = scalingDim * (minRadiusPortion + freqIntensityFactor * (0.50 - minRadiusPortion));
            const maxRadius = baseRadius + scalingDim * 0.35;
            let bars = generateRadialBars(this.freqBarCount, lineWidths, [baseRadius, maxRadius]);
            gl.uniform2fv(this.glLocations['barRadii[0]'], new Float32Array(bars));
        }

        gl.drawArrays(gl.TRIANGLES, 0, this.freqBinCount * 3);
    }

    resize(w, h) {
        super.resize(w * 4, h * 4);

        const minCanvasDim = this.minDim();
        const center = this.center();
        this.context.uniform2fv(this.glLocations['aspectScale'], [minCanvasDim / this.width, minCanvasDim / this.height]);
        this.context.uniform2fv(this.glLocations['center'], [center.x, center.y]);
    }
}