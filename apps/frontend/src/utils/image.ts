const SIZE = 64;

// Live frame format: "LV" + 64x64 RGB565 pixels, little-endian, row by row (see backend canvas/live.py)
const LIVE_FRAME_SIZE = 2 + SIZE * SIZE * 2;

/** Draw the source center-cropped to a square and scaled down to 64x64, optionally mirrored. */
function drawSquare(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  mirror: boolean
) {
  const side = Math.min(sourceWidth, sourceHeight);
  const sx = (sourceWidth - side) / 2;
  const sy = (sourceHeight - side) / 2;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (mirror) {
    ctx.translate(SIZE, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, side, side, 0, 0, SIZE, SIZE);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function createFrameCanvas(): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  return canvas.getContext('2d', { willReadFrequently: true });
}

/**
 * Scale an image or video frame down to 64x64 and send it to everyone as a full image update.
 * The source is center-cropped to a square so it isn't stretched.
 */
export function sendImageToFrame(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  sendBinary: (data: ArrayBuffer) => void,
  { mirror = false }: { mirror?: boolean } = {}
) {
  const ctx = createFrameCanvas();
  if (!ctx) return;

  drawSquare(ctx, source, sourceWidth, sourceHeight, mirror);
  const pixels = ctx.getImageData(0, 0, SIZE, SIZE).data; // RGBA

  // Format: [count][x][y][r][g][b] for every pixel, including black ones
  const binaryData = new ArrayBuffer(2 + SIZE * SIZE * 5);
  const view = new DataView(binaryData);
  view.setUint16(0, SIZE * SIZE, true);

  const canvasPixels: { x: number; y: number; r: number; g: number; b: number }[] = [];
  let offset = 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const index = (y * SIZE + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      view.setUint8(offset, x);
      view.setUint8(offset + 1, y);
      view.setUint8(offset + 2, r);
      view.setUint8(offset + 3, g);
      view.setUint8(offset + 4, b);
      offset += 5;
      canvasPixels.push({ x, y, r, g, b });
    }
  }

  sendBinary(binaryData);

  // The server doesn't echo image updates to the sender, so update our own canvas directly
  window.dispatchEvent(
    new CustomEvent('imageUpdate', { detail: { type: 'image_update', canvas: canvasPixels } })
  );
}

/**
 * Turn the current video frame into a live frame for the physical frame.
 * Draws into ctx (a 64x64 canvas), which callers can also show as a preview.
 */
export function encodeLiveFrame(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  { mirror = false }: { mirror?: boolean } = {}
): ArrayBuffer {
  drawSquare(ctx, source, sourceWidth, sourceHeight, mirror);
  const pixels = ctx.getImageData(0, 0, SIZE, SIZE).data;

  const frame = new ArrayBuffer(LIVE_FRAME_SIZE);
  const view = new DataView(frame);
  view.setUint8(0, 'L'.charCodeAt(0));
  view.setUint8(1, 'V'.charCodeAt(0));

  for (let i = 0; i < SIZE * SIZE; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    view.setUint16(2 + i * 2, ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3), true);
  }

  return frame;
}
