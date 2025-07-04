import { useRef, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { WS_URL } from '../config';

export function useImageUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { send } = useWebSocket(WS_URL);
  
  // Pixel queue for batching updates
  const pixelQueue = useRef<{ x: number; y: number; r: number; g: number; b: number }[]>([]);
  const bucketInterval = useRef<NodeJS.Timeout | null>(null);
  const isBucketActive = useRef(false);

  // Leaky bucket: drip pixels at fixed intervals
  const startBucket = useCallback(() => {
    if (isBucketActive.current) return;
    
    isBucketActive.current = true;
    bucketInterval.current = setInterval(() => {
      if (pixelQueue.current.length > 0) {
        // Take one pixel from the queue and send it
        const pixel = pixelQueue.current.shift();
        if (pixel) {
          send({
            type: 'pixel_update' as const,
            x: pixel.x,
            y: pixel.y,
            r: pixel.r,
            g: pixel.g,
            b: pixel.b,
          });
        }
      } else {
        // Stop the bucket when queue is empty
        if (bucketInterval.current) {
          clearInterval(bucketInterval.current);
          bucketInterval.current = null;
        }
        isBucketActive.current = false;
      }
    }, 16); // ~60 FPS (16ms intervals)
  }, [send]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

      // Convert to array of {x, y, r, g, b} objects and add to queue
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const index = (y * 64 + x) * 4; // 4 bytes per pixel (RGBA)
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          pixelQueue.current.push({ x, y, r, g, b });
        }
      }

      console.log(`Added ${pixelQueue.current.length} pixels to queue for upload`);
      
      // Start the bucket if it's not already running
      if (!isBucketActive.current) {
        startBucket();
      }

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