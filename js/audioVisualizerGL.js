'use strict';

class CanvasRendererGL extends CanvasRenderer {
    constructor(canvas) {
        super(canvas);
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
        this.context.uniform2fv(this.glLocations['aspectScale'], new Float32Array([minCanvasDim / this.width, minCanvasDim / this.height]));
    }
}

const aspectCorrectingVertShader = `
    precision highp float;

    attribute vec3 index; // Should be uint's but OpenGL ES doesn't allow integer attributes. x: polyIndex, y: barIndex, z:vertexIndex.
    attribute vec2 barAngles; // angles of this bar. (start, end)

    uniform vec2 minMaxDb;
    uniform vec2 dimensions;
    uniform vec2 barRadii[FREQUENCY_BAR_DIVS];
    uniform vec4 magnitudes[FREQUENCY_BARS / 4]; // Flat array packed into vec4's to save uniform space.

    varying float normalizedMagnitude;
    varying vec2 angles;
    varying vec2 radii;
    varying float divIndex;

    float normalizeFreqMagnitude(float db, float minDb, float maxDb) {
        return min(1.0, max(0.0, (db - minDb) / (maxDb - minDb)));
    }

    float getMagnitude(int index) {
        int arrayIndex = index / 4;
        int subIndex = index - arrayIndex * 4;
        vec4 m = magnitudes[arrayIndex];
        if (subIndex == 0) return m.x;
        if (subIndex == 1) return m.y;
        if (subIndex == 2) return m.z;
        return m.w;
    }

    vec4 generateTriangleVertex(int idx, vec2 angleSpan, vec2 radiiSpan, vec2 aspect) {
        vec2 sortedAngles = vec2(max(angleSpan.x, angleSpan.y), min(angleSpan.x, angleSpan.y));
        float angle;
        float radius;

        if (idx == 0) { angle = sortedAngles.x; radius = radiiSpan.x; }
        else if (idx == 1) { angle = sortedAngles.y; radius = radiiSpan.x; }
        else if (idx == 2 || idx == 3) { angle = sortedAngles.y; radius = radiiSpan.y; }
        else if (idx == 4) { angle = sortedAngles.x; radius = radiiSpan.y; }
        else if (idx == 5) { angle = sortedAngles.x; radius = radiiSpan.x; }

        return vec4(cos(angle) * radius * aspect.x, sin(angle) * radius * aspect.y, 0.0, 1.0);
    }

    void main() {
        angles = barAngles;
        normalizedMagnitude = normalizeFreqMagnitude(getMagnitude(int(index.x)), minMaxDb.x, minMaxDb.y);
        radii = barRadii[int(index.y)];
        divIndex = index.y;

        float minDim = min(dimensions.x, dimensions.y);
        gl_Position = generateTriangleVertex(int(index.z), angles, radii / (minDim / 2.0), vec2(minDim / dimensions.x, minDim / dimensions.y));
    }
`;

const freqBarsFragShader = `
    precision highp float;

    uniform vec2 center;
    uniform vec4 colors[FREQUENCY_BAR_COLORS];
    uniform vec2 barRadii[FREQUENCY_BAR_DIVS];

    varying float normalizedMagnitude;
    varying vec2 angles;
    varying vec2 radii;
    varying float divIndex;

    vec4 getColor(float radius, vec2 bounds) {
        float rangeRelativeRadius = radius - bounds.x;
        float rangeRadius = bounds.y - bounds.x;

        float normalized = rangeRelativeRadius / rangeRadius;
        float normalizedDiv = 1.0 / float(FREQUENCY_BAR_COLORS - 1);
        for (int i = 0; i < FREQUENCY_BAR_COLORS; i++) {
            float divStart = float(i) * normalizedDiv;
            if (normalized > divStart && normalized < divStart + normalizedDiv) {
                return mix(colors[i], colors[i + 1], (normalized - divStart) / normalizedDiv);
            }
        }

        // Should be unreachable.
        return vec4(0.0, 0.0, 0.0, 0.0);
    }

    const float inf = 1.0 / 0.0;
    const float pi = 3.141592653589793;

    float arctan(vec2 position) {
        float angleTan = position.y / position.x;

        if (abs(angleTan) == inf) {
            return (position.y < 0.0) ? -0.5 * pi : -1.5 * pi;
        }

        float angle = atan(angleTan);
        if (angle > 0.0) {
            return (position.x < 0.0) ? angle - pi : angle - 2.0 * pi;
        }
        return (position.x < 0.0) ? angle - pi : angle;
    }

    vec4 applyRadialEdgeTransparency(vec4 color, float radius, vec2 edgeRadii) {
        const float allowedDelta = 0.15;
        float delta = min(radius - edgeRadii.x, edgeRadii.y - radius) / (edgeRadii.y - edgeRadii.x);
        if (delta < allowedDelta) {
            return vec4(color.rgb, color.a * (delta / allowedDelta));
        }
        return color;
    }

    vec4 applyBarEdgeTransparency(vec4 color, vec2 position, vec2 angleBounds) {
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
        float rawDivs = normalizedMagnitude * float(FREQUENCY_BAR_DIVS);
        float partialLastDiv = rawDivs - floor(rawDivs);
        int lastDivIndex = int(floor(rawDivs));

        float innerRadius = radii.x;
        float outerRadius = radii.y;
        int thisDivIndex = int(divIndex);
        outerRadius = lastDivIndex == thisDivIndex ? innerRadius + partialLastDiv * (outerRadius - innerRadius) : outerRadius;
        if (thisDivIndex > lastDivIndex || radius < innerRadius || radius > outerRadius) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }

        gl_FragColor = getColor(radius, vec2(barRadii[0].x, barRadii[FREQUENCY_BAR_DIVS - 1].y));
        gl_FragColor = applyRadialEdgeTransparency(gl_FragColor, radius, radii);
        gl_FragColor = applyBarEdgeTransparency(gl_FragColor, pos, angles);
    }
`;

function generateVertexAttributes(divisions, gapPercent, barCount) {
    const angularIncrement = -2 * Math.PI / divisions;
    const angleOffset = angularIncrement * gapPercent;
    const triangleSideLength = 1 / Math.cos(angularIncrement - 2 * angleOffset);

    let indices = [], angles = [];
    for (let i = 0; i < divisions; i++) {
        for (let j = 0; j < barCount; j++) {
            for (let k = 0; k < 6; k++) {
                indices.push(i, j, k);
                angles.push(angularIncrement * i + angleOffset, angularIncrement * (i + 1) - angleOffset);
            }
        }
    }

    return [indices, angles, angles.length / 2];
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
        bars.push(innerRadius, outerRadius);
        lastOuterRadius = outerRadius + (gapWidthRange[0] + lineWidthInc * i);
    }
    return bars;
}

function pickGapUpperBound(gapRangeStart, segmentCount, length) {
    return gapRangeStart + 2 * (length - segmentCount * gapRangeStart) / (segmentCount - 1);
}

function replaceAll(str, replacements) {
    let replaced = str;
    for (let key in replacements) {
        replaced = replaced.split(key).join(replacements[key]);
    }
    return replaced;
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

        this.freqBarCount = 28;
        const vShader = compileShader(gl, gl.VERTEX_SHADER, replaceAll(aspectCorrectingVertShader, {'FREQUENCY_BARS': audioAnalyser.freqBinCount, 'FREQUENCY_BAR_DIVS': this.freqBarCount}));
        const fShader = compileShader(gl, gl.FRAGMENT_SHADER, replaceAll(freqBarsFragShader, {'FREQUENCY_BAR_DIVS': this.freqBarCount, 'FREQUENCY_BAR_COLORS': 3}));

        const program = makeProgram(gl, vShader, fShader);
        this.glLocations = gatherLocations(gl, program);

        {
            this.freqBinCount = Math.floor(0.74 * audioAnalyser.freqBinCount);
            let vertProperties = generateVertexAttributes(this.freqBinCount, 0.1, this.freqBarCount);
            updateFloatAttribute(gl, new Float32Array(vertProperties[0]), gl.STATIC_DRAW, this.glLocations['index'], 3);
            updateFloatAttribute(gl, new Float32Array(vertProperties[1]), gl.STATIC_DRAW, this.glLocations['barAngles'], 2);
            this.vertCount = vertProperties[2];
        }

        gl.uniform2fv(this.glLocations['minMaxDb'], new Float32Array([audioAnalyser.minDb, audioAnalyser.maxDb]));

        {
            const colors = new Float32Array([0.0, 0.0, 1.0, 0.02,
                                             0.0, 1.0, 0.0, 0.5,
                                             1.0, 0.0, 0.0, 1.0]);
            gl.uniform4fv(this.glLocations['colors[0]'], colors);
        }
    }

    renderVisual() {
        const gl = this.context;

        const freqData = this.getFrequencyData();
        gl.uniform4fv(this.glLocations['magnitudes[0]'], freqData);

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

        gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
    }

    resize(w, h) {
        super.resize(w * 4, h * 4);

        const center = this.center();
        this.context.uniform2fv(this.glLocations['center'], new Float32Array([center.x, center.y]));
        this.context.uniform2fv(this.glLocations['dimensions'], new Float32Array([this.width, this.height]));
    }
}