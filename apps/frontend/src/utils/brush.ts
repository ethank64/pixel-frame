const CANVAS_SIZE = 64;
export const PIXEL_SIZE = 8;

export const ERASER_COLOR = { r: 0, g: 0, b: 0 } as const;

export const BRUSH_SIZES = [1, 2, 3, 5, 7] as const;
export type BrushSize = (typeof BRUSH_SIZES)[number];

export type DrawingTool = 'brush' | 'eyedropper' | 'eraser';

export function getBrushPixels(
  centerX: number,
  centerY: number,
  size: number
): { x: number; y: number }[] {
  const radius = size / 2;
  const radiusSq = radius * radius;
  const extent = Math.ceil(radius - 0.5);
  const pixels: { x: number; y: number }[] = [];

  for (let dy = -extent; dy <= extent; dy++) {
    for (let dx = -extent; dx <= extent; dx++) {
      if (dx * dx + dy * dy < radiusSq + 0.25) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x >= 0 && x < CANVAS_SIZE && y >= 0 && y < CANVAS_SIZE) {
          pixels.push({ x, y });
        }
      }
    }
  }

  return pixels;
}
