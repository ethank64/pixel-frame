import { useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { WS_URL } from '../config';

export function useImageUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendBinary } = useWebSocket(WS_URL);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // No need to reset canvas first - we'll send the full image data anyway

    // Create a canvas to process the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas to 64x64
    canvas.width = 64;
    canvas.height = 64;

    // Create an image element to load the file
    const img = new Image();
    img.onload = async () => {
      // Draw the image onto the canvas, resizing to 64x64
      ctx.drawImage(img, 0, 0, 64, 64);

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, 64, 64);
      const pixels = imageData.data; // RGBA array

      // Create binary data for all pixels (including black ones for full image update)
      const binaryData = new ArrayBuffer(2 + 64 * 64 * 5); // 2 bytes for count + 64*64 pixels * 5 bytes each
      const view = new DataView(binaryData);
      
      let pixelCount = 0;
      let offset = 2; // Start after the 2-byte count
      
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const index = (y * 64 + x) * 4; // 4 bytes per pixel (RGBA)
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          
          // Write pixel data: x, y, r, g, b (5 bytes)
          view.setUint8(offset, x);
          view.setUint8(offset + 1, y);
          view.setUint8(offset + 2, r);
          view.setUint8(offset + 3, g);
          view.setUint8(offset + 4, b);
          
          offset += 5;
          pixelCount++;
        }
      }
      
      // Set the pixel count in the first 2 bytes
      view.setUint16(0, pixelCount, true); // Little-endian
      
      console.log(`Sending binary image data with ${pixelCount} pixels, size: ${binaryData.byteLength} bytes`);
      
      // Send the binary data
      sendBinary(binaryData);
      
      // Also update the local canvas immediately for the sender
      // This ensures the sender sees their image right away
      const canvasPixels = [];
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const index = (y * 64 + x) * 4; // 4 bytes per pixel (RGBA)
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          canvasPixels.push({ x, y, r, g, b });
        }
      }
      
      // Trigger a local image update by dispatching a custom event
      const imageUpdateEvent = new CustomEvent('imageUpdate', {
        detail: { type: 'image_update', canvas: canvasPixels }
      });
      window.dispatchEvent(imageUpdateEvent);

      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    // Load the image from the file
    img.src = URL.createObjectURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return {
    fileInputRef,
    handleImageUpload,
    triggerFileInput,
  };
} 