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
    precision highp float;

    uniform vec4 color;

    void main() {
        gl_FragColor = color;
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

        gl.uniform4fv(this.glLocations['color'], new Float32Array([0.905, 0.298, 0.235, 0.5]));
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
    uniform vec2 barRadii[FREQUENCY_BAR_DIVS];

    struct Color {
        vec4 color;
        float colorStop;
    };

    uniform Color colors[FREQUENCY_BAR_COLORS];

    varying float normalizedMagnitude;
    varying vec2 angles;
    varying vec2 radii;
    varying float divIndex;

    vec4 getColor(float radius, vec2 bounds) {
        float rangeRelativeRadius = radius - bounds.x;
        float rangeRadius = bounds.y - bounds.x;

        float normalized = rangeRelativeRadius / rangeRadius;
        Color lastColor = Color(vec4(0.0, 0.0, 0.0, 0.0), 0.0); // Takes care of first color stop not being at 0.0
        for (int i = 0; i < FREQUENCY_BAR_COLORS; i++) {
            Color currentColor = colors[i];
            if (normalized > lastColor.colorStop && normalized < currentColor.colorStop) {
                return mix(lastColor.color, currentColor.color, (normalized - lastColor.colorStop) / (currentColor.colorStop - lastColor.colorStop));
            }

            lastColor = currentColor;
        }

        // Color stops did not cover upto 1.0.
        return mix(lastColor.color, vec4(0.0, 0.0, 0.0, 0.0), (normalized - lastColor.colorStop) / (1.0 - lastColor.colorStop));
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

function hexToRGB(h) {
    const mask = 0xFF;
    return [(h >> 16) & mask, (h >> 8) & mask, h & mask].map((x) => x / 255);
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

        const colors = [...hexToRGB(0x00D1B1), 0.0, 0.0,
                        ...hexToRGB(0xABE300), 0.7, 0.2,
                        ...hexToRGB(0xFF8400), 1.0, 0.65,
                        ...hexToRGB(0xFF2D00), 1.0, 1.0];

        this.barDivs = 28;
        const vShader = compileShader(gl, gl.VERTEX_SHADER, replaceAll(aspectCorrectingVertShader, {'FREQUENCY_BARS': audioAnalyser.freqBinCount, 'FREQUENCY_BAR_DIVS': this.barDivs}));
        const fShader = compileShader(gl, gl.FRAGMENT_SHADER, replaceAll(freqBarsFragShader, {'FREQUENCY_BAR_DIVS': this.barDivs, 'FREQUENCY_BAR_COLORS': colors.length}));

        const program = makeProgram(gl, vShader, fShader);
        this.glLocations = gatherLocations(gl, program);

        {
            this.freqBinCount = Math.floor(0.74 * audioAnalyser.freqBinCount);
            let vertProperties = generateVertexAttributes(this.freqBinCount, 0.1, this.barDivs);
            updateFloatAttribute(gl, new Float32Array(vertProperties[0]), gl.STATIC_DRAW, this.glLocations['index'], 3);
            updateFloatAttribute(gl, new Float32Array(vertProperties[1]), gl.STATIC_DRAW, this.glLocations['barAngles'], 2);
            this.vertCount = vertProperties[2];
        }

        gl.uniform2fv(this.glLocations['minMaxDb'], new Float32Array([audioAnalyser.minDb, audioAnalyser.maxDb]));

        for (let i = 0; i < colors.length; i += 5) {
            gl.uniform4fv(this.glLocations['colors[' + Math.floor(i / 5) + '].color'], new Float32Array(colors.slice(i, i + 4)));
            gl.uniform1f(this.glLocations['colors[' + Math.floor(i / 5) + '].colorStop'], colors[i + 4]);
        }
    }

    renderVisual() {
        const gl = this.context;

        const freqData = this.getFrequencyData();
        gl.uniform4fv(this.glLocations['magnitudes[0]'], freqData);

        {
            const scalingDim = this.minDim() / 2;
            const freqIntensityFactor = freqIntensityMultipler(freqData, this.minDb, this.maxDb);
            const lineWidths = [2, pickGapUpperBound(2, this.barDivs, scalingDim * 0.20)];

            const minRadiusPortion = 0.15;
            const baseRadius = scalingDim * (minRadiusPortion + freqIntensityFactor * (0.50 - minRadiusPortion));
            const maxRadius = baseRadius + scalingDim * 0.35;
            let bars = generateRadialBars(this.barDivs, lineWidths, [baseRadius, maxRadius]);
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

const quadVertShader = `
    precision highp float;

    attribute float index; // Should be uint's but OpenGL ES doesn't allow integer attributes.

    void main() {
        int vertIndex = int(index);
        if (vertIndex == 0) { gl_Position = vec4(-1.0, 1.0, 0.0, 1.0); return; }
        if (vertIndex == 1) { gl_Position = vec4(1.0, 1.0, 0.0, 1.0); return; }
        if (vertIndex == 2) { gl_Position = vec4(-1.0, -1.0, 0.0, 1.0); return; }
        gl_Position = vec4(1.0, -1.0, 0.0, 1.0);
    }
`;

const freqBackgroundFragShader = `
    precision highp float;

    uniform vec2 minMaxDb;
    uniform vec2 dimensions;
    uniform vec4 magnitudes[FREQUENCY_BARS / 4]; // Flat array packed into vec4's to save uniform space.

    vec3 getMagnitudes(int index) {
        int arrayIndices[3];
        arrayIndices[0] = (index - 1) < 0 ? -1 : (index - 1) / 4;
        arrayIndices[1] = index / 4;
        arrayIndices[2] = (index + 1) / 4;

        int subIndices[3];
        subIndices[0] = (index - 1) - arrayIndices[0] * 4;
        subIndices[1] = index - arrayIndices[1] * 4;
        subIndices[2] = (index + 1) - arrayIndices[2] * 4;

        vec3 mags = vec3(0.0, 0.0, 0.0);

        for (int i = 0; i < FREQUENCY_BARS / 4; i++) {
            if (i == arrayIndices[0]) {
                if (subIndices[0] == 0) mags.x = magnitudes[i].x;
                if (subIndices[0] == 1) mags.x = magnitudes[i].y;
                if (subIndices[0] == 2) mags.x = magnitudes[i].z;
                if (subIndices[0] == 3) mags.x = magnitudes[i].w;
            }
            if (i == arrayIndices[1]) {
                if (subIndices[1] == 0) mags.y = magnitudes[i].x;
                if (subIndices[1] == 1) mags.y = magnitudes[i].y;
                if (subIndices[1] == 2) mags.y = magnitudes[i].z;
                if (subIndices[1] == 3) mags.y = magnitudes[i].w;
            }
            if (i == arrayIndices[2]) {
                if (subIndices[2] == 0) mags.z = magnitudes[i].x;
                if (subIndices[2] == 1) mags.z = magnitudes[i].y;
                if (subIndices[2] == 2) mags.z = magnitudes[i].z;
                if (subIndices[2] == 3) mags.z = magnitudes[i].w;
            }
        }

        return mags;
    }

    float getMagnitude(int index) {
        int arrayIndex = index / 4;
        int subIndex = index - arrayIndex * 4;

        for (int i = 0; i < FREQUENCY_BARS / 4; i++) {
            if (i == arrayIndex) {
                if (subIndex == 0) return magnitudes[i].x;
                if (subIndex == 1) return magnitudes[i].y;
                if (subIndex == 2) return magnitudes[i].z;
                return magnitudes[i].w;
            }
        }

        return 0.0;
    }

    float normalizeFreqMagnitude(float db, float minDb, float maxDb) {
        return min(1.0, max(0.0, (db - minDb) / (maxDb - minDb)));
    }

    void main() {
        vec2 normalizedCoord = vec2(gl_FragCoord.x / dimensions.x, gl_FragCoord.y / dimensions.y);
        normalizedCoord = vec2(normalizedCoord.y, normalizedCoord.x);
        float freqIndexFloat = normalizedCoord.x * float(FREQUENCY_BARS);
        int freqIndex = int(freqIndexFloat);
        vec3 mags = getMagnitudes(freqIndex);
        float normalizedMagnitude = normalizeFreqMagnitude((mags.x + mags.y + mags.z) / 3.0, minMaxDb.x, minMaxDb.y);

        float columnPosition = freqIndexFloat - float(freqIndex); // 0.0 - 1.0
        float prevContribution = max(0.0, 2.0 * (0.5 - columnPosition) * 0.5);
        float currContribution = (1.0 - 2.0 * abs(0.5 - columnPosition)) * 0.5 + 0.5;
        float nextContribution = max(0.0, 2.0 * (columnPosition - 0.5) * 0.5);

        float yDecay = 2.0 * abs(0.5 - normalizedCoord.y);
        yDecay = yDecay * yDecay;
        float colorFactor = normalizeFreqMagnitude(prevContribution * mags.x + currContribution * mags.y + nextContribution * mags.z, minMaxDb.x, minMaxDb.y);
        gl_FragColor = vec4(colorFactor * colorFactor, 0.75 * colorFactor * colorFactor * colorFactor, 0.5 * colorFactor * colorFactor * colorFactor * colorFactor, yDecay * yDecay * yDecay * yDecay);
    }
`;

class FrequencyBackgroundRendererGL extends CanvasRendererGL {
    constructor(audioAnalyser, canvas) {
        super(canvas);
        this.getFrequencyData = audioAnalyser.getFrequencyData;
        this.minDb = audioAnalyser.minDb;
        this.maxDb = audioAnalyser.maxDb;

        const gl = this.context;
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.enable(gl.BLEND);

        console.log(audioAnalyser.freqBinCount);

        this.freqBinCount = Math.trunc(audioAnalyser.freqBinCount * 0.725);

        const vShader = compileShader(gl, gl.VERTEX_SHADER, replaceAll(quadVertShader, {'FREQUENCY_BARS': this.freqBinCount}));
        const fShader = compileShader(gl, gl.FRAGMENT_SHADER, replaceAll(freqBackgroundFragShader, {'FREQUENCY_BARS': this.freqBinCount}));

        const program = makeProgram(gl, vShader, fShader);
        this.glLocations = gatherLocations(gl, program);

        {
            updateFloatAttribute(gl, new Float32Array([0, 1, 2, 3]), gl.STATIC_DRAW, this.glLocations['index']);
            this.vertCount = 4;
        }

        gl.uniform2fv(this.glLocations['minMaxDb'], new Float32Array([audioAnalyser.minDb, audioAnalyser.maxDb]));
    }

    renderVisual() {
        const gl = this.context;

        const freqData = this.getFrequencyData();
        gl.uniform4fv(this.glLocations['magnitudes[0]'], freqData);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.vertCount);
    }

    resize(w, h) {
        super.resize(w * 4, h * 4);

        const center = this.center();
        //this.context.uniform2fv(this.glLocations['center'], new Float32Array([center.x, center.y]));
        this.context.uniform2fv(this.glLocations['dimensions'], new Float32Array([this.width, this.height]));
    }
}