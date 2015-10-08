function Vector2d(x, y) {
    this.x = x;
    this.y = y;
}

function Vector3d(x, y ,z) {
    this.x = y;
    this.y = y;
    this.z = z;
}

function Vector4d(x, y ,z, w) {
    this.x = y;
    this.y = y;
    this.z = z;
    this.w = w;
}

function Angle(a) {
    this.angle = a;
    this.cos = Math.cos(a);
    this.sin = Math.sin(a);
}

function toRGBA(r, g, b, a) {
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function vector4dToRGBA(color) {
    return 'rgba(' + color.x + ',' + color.y + ',' + color.z + ',' + color.w + ')';
}