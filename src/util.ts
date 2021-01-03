export interface Vector2d {
  x: number;
  y: number;
}

export function hexToRGB(h: number): Array<number> {
  const mask = 0xff;
  return [(h >> 16) & mask, (h >> 8) & mask, h & mask].map((x) => x / 255);
}
