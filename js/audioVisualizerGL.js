'use strict';

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

function updateFloatAttribute(gl, array, drawType, attributeLocation) {
    let buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, array, drawType);
    gl.enableVertexAttribArray(attributeLocation);
    gl.vertexAttribPointer(attributeLocation, 1, gl.FLOAT, gl.FALSE, 0, 0);
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

function initTimeDomainVisualizationGL(canvas, audioAnalyser) {
    const gl = canvas.contextgl;

    const vShader = compileShader(gl, gl.VERTEX_SHADER, scalarToCircularVertShader);
    const fShader = compileShader(gl, gl.FRAGMENT_SHADER, trivialColorFragmentShader);

    const program = makeProgram(gl, vShader, fShader);
    canvas.glLocations = gatherLocations(gl, program);

    updateFloatAttribute(gl, new Float32Array(Array.from(new Array(audioAnalyser.timeFftSize), (x, i) => i)), gl.STATIC_DRAW, canvas.glLocations['vertexId']);
}

function drawTimeDomainVisualizationGL(canvas, audioAnalyser) {
    const gl = canvas.contextgl;

    const timeData = audioAnalyser.getTimeData(0.65);
    updateFloatAttribute(gl, timeData, gl.DYNAMIC_DRAW, canvas.glLocations['magnitude']);

    const minCanvasDim = Math.min(canvas.width, canvas.height);
    gl.uniform2fv(canvas.glLocations['aspectScale'], [minCanvasDim / canvas.width, minCanvasDim / canvas.height]);

    const baseRadius = 0.25;
    const magnitudeScale = baseRadius * 0.5;
    const angularIncrement = 2 * Math.PI / timeData.length;

    gl.uniform1f(canvas.glLocations['baseRadius'], baseRadius);
    gl.uniform1f(canvas.glLocations['magnitudeScale'], magnitudeScale);
    gl.uniform1f(canvas.glLocations['angularIncrement'], angularIncrement);

    gl.drawArrays(gl.LINE_STRIP, 0, timeData.length);

    gl.uniform1f(canvas.glLocations['angularIncrement'], -angularIncrement);
    gl.drawArrays(gl.LINE_STRIP, 0, timeData.length);
}