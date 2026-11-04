const SIZE = 64;

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
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const side = Math.min(sourceWidth, sourceHeight);
  const sx = (sourceWidth - side) / 2;
  const sy = (sourceHeight - side) / 2;

  if (mirror) {
    ctx.translate(SIZE, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, side, side, 0, 0, SIZE, SIZE);

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
