import { useRef, useCallback, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { WS_URL, RESET_URL } from '../config';

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const { send } = useWebSocket(WS_URL);
  
  // Pixel queue for batching updates
  const pixelQueue = useRef<{ x: number; y: number; r: number; g: number; b: number }[]>([]);
  const bucketInterval = useRef<NodeJS.Timeout | null>(null);
  const isBucketActive = useRef(false);

  // Reset canvas function
  const resetCanvas = useCallback(async () => {
    try {
      const response = await fetch(RESET_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reset canvas: ${response.statusText}`);
      }
      
      console.log('Canvas reset successfully');
    } catch (error) {
      console.error('Error resetting canvas:', error);
    }
  }, []);

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

  const isBlack = (r: number, g: number, b: number) => {
    return r === 0 && g === 0 && b === 0;
  }

  // Process pixel data and add to queue (same logic as useImageUpload)
  const processPixelData = useCallback((pixels: Uint8ClampedArray) => {
    // Convert to array of {x, y, r, g, b} objects and add to queue
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const index = (y * 64 + x) * 4; // 4 bytes per pixel (RGBA)
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        if (!isBlack(r, g, b)) {
          pixelQueue.current.push({ x, y, r, g, b });
        }
      }
    }

    console.log(`Added ${pixelQueue.current.length} pixels to queue for upload`);
    
    // Start the bucket if it's not already running
    if (!isBucketActive.current) {
      startBucket();
    }
  }, [startBucket]);

  // Start webcam
  const startWebcam = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setStream(mediaStream);
    } catch (error) {
      console.error("Error accessing webcam:", error);
    }
  }, []);

  // Stop webcam
  const stopWebcam = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Capture and process webcam frame using the same logic as image upload
  const captureWebcamFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    // Reset canvas first
    await resetCanvas();

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas to 64x64
    canvas.width = 64;
    canvas.height = 64;

    // Draw the video frame onto the canvas, resizing to 64x64
    ctx.drawImage(video, 0, 0, 64, 64);

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, 64, 64);
    const pixels = imageData.data; // RGBA array

    // Process the pixel data using the same logic as image upload
    processPixelData(pixels);
  }, [resetCanvas, processPixelData]);

  return {
    videoRef,
    canvasRef,
    stream,
    startWebcam,
    stopWebcam,
    captureWebcamFrame,
  };
} 