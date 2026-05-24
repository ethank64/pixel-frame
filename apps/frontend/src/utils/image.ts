export const FULL_IMAGE_SIZE = 2 + 64 * 64 * 5;
export const SLIDESHOW_FRAME_SIZE = 2 + 4 + 4 + 64 * 64 * 5;

export type Pixel = { x: number; y: number; r: number; g: number; b: number };

export function fileToImageBinary(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not create canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, 64, 64);
      resolve(imageDataToBinary(ctx.getImageData(0, 0, 64, 64)));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function imageDataToBinary(imageData: ImageData): ArrayBuffer {
  const binaryData = new ArrayBuffer(FULL_IMAGE_SIZE);
  const view = new DataView(binaryData);
  let offset = 2;

  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const index = (y * 64 + x) * 4;
      view.setUint8(offset, x);
      view.setUint8(offset + 1, y);
      view.setUint8(offset + 2, imageData.data[index]);
      view.setUint8(offset + 3, imageData.data[index + 1]);
      view.setUint8(offset + 4, imageData.data[index + 2]);
      offset += 5;
    }
  }

  view.setUint16(0, 64 * 64, true);
  return binaryData;
}

export function binaryToPixels(binaryData: ArrayBuffer): Pixel[] {
  const view = new DataView(binaryData);
  const pixelCount = view.getUint16(0, true);
  const pixels: Pixel[] = [];

  for (let i = 0; i < pixelCount; i++) {
    const offset = 2 + i * 5;
    pixels.push({
      x: view.getUint8(offset),
      y: view.getUint8(offset + 1),
      r: view.getUint8(offset + 2),
      g: view.getUint8(offset + 3),
      b: view.getUint8(offset + 4),
    });
  }

  return pixels;
}

export function parseSlideshowFrame(buffer: ArrayBuffer): {
  transitionMs: number;
  displayMs: number;
  canvas: Pixel[];
} {
  const view = new DataView(buffer);
  const transitionMs = view.getUint32(2, true);
  const displayMs = view.getUint32(6, true);
  const canvas: Pixel[] = [];

  for (let i = 0; i < 64 * 64; i++) {
    const offset = 10 + i * 5;
    canvas.push({
      x: view.getUint8(offset),
      y: view.getUint8(offset + 1),
      r: view.getUint8(offset + 2),
      g: view.getUint8(offset + 3),
      b: view.getUint8(offset + 4),
    });
  }

  return { transitionMs, displayMs, canvas };
}

export function shufflePixelOrder(count: number): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
