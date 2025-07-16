// src/components/CanvasGrid.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import './CanvasGrid.css';
import { WS_URL } from '../../config';
import Sidebar from '../Sidebar/Sidebar';

type Pixel = { r: number; g: number; b: number };
type PixelUpdate = { x: number; y: number; r: number; g: number; b: number };

interface CanvasGridProps {
  selectedColor: { r: number; g: number; b: number };
}

function CanvasGrid({ selectedColor }: CanvasGridProps) {
  // Get state of messages and send function from the WebSocket
  const { messages, send } = useWebSocket(WS_URL);

  // Initialize canvas state with black pixels
  const [canvasState, setCanvasState] = useState<Pixel[][]>(
    Array(64).fill(null).map(() => Array(64).fill({ r: 0, g: 0, b: 0 }))
  );

  // If you're drawing
  const [isDrawing, setIsDrawing] = useState(false);

  // Line drawing state - use ref for immediate updates
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Pixel queue for batching updates
  const pixelQueue = useRef<PixelUpdate[]>([]);
  const bucketInterval = useRef<NodeJS.Timeout | null>(null);
  const isBucketActive = useRef(false);

  const canvasRef = useRef<Pixel[][]>(
    Array(64).fill(null).map(() => Array(64).fill({ r: 0, g: 0, b: 0 }))
  ); // Ref to hold latest state for batching

  const lastProcessedMessageIndex = useRef<number>(-1);

  // Leaky bucket: drip pixels at fixed intervals
  const startBucket = useCallback(() => {
    if (isBucketActive.current) return;
    
    isBucketActive.current = true;
    bucketInterval.current = setInterval(() => {
      if (pixelQueue.current.length > 0) {
        console.log("leak")
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
    }, 1); // ~60 FPS (16ms intervals)
  }, [send]);

  // Cleanup bucket on unmount
  useEffect(() => {
    return () => {
      if (bucketInterval.current) {
        clearInterval(bucketInterval.current);
      }
    };
  }, []);

  // Global mouse event handlers to ensure drawing stops properly
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDrawing) {
        setIsDrawing(false);
        lastPosRef.current = null;
      }
    };

    const handleGlobalMouseLeave = () => {
      if (isDrawing) {
        setIsDrawing(false);
        lastPosRef.current = null;
      }
    };

    const handleImageUpdate = (event: CustomEvent) => {
      const message = event.detail;
      console.log('Received local image update:', message);
      
      if (message.type === 'image_update') {
        // Reset to black first
        for (let y = 0; y < 64; y++) {
          for (let x = 0; x < 64; x++) {
            canvasRef.current[y][x] = { r: 0, g: 0, b: 0 };
          }
        }
        // Apply all pixels from the image update
        message.canvas?.forEach((pixel: any) => {
          if (pixel.x >= 0 && pixel.x < 64 && pixel.y >= 0 && pixel.y < 64) {
            canvasRef.current[pixel.y][pixel.x] = { r: pixel.r, g: pixel.g, b: pixel.b };
          }
        });
        // Update state to trigger re-render
        setCanvasState([...canvasRef.current.map(row => [...row])]);
      }
    };

    // Add global event listeners
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mouseleave', handleGlobalMouseLeave);
    window.addEventListener('imageUpdate', handleImageUpdate as EventListener);

    // Cleanup
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mouseleave', handleGlobalMouseLeave);
      window.removeEventListener('imageUpdate', handleImageUpdate as EventListener);
    };
  }, [isDrawing]);

  // Update canvas state from WebSocket messages
  useEffect(() => {
    if (!messages.length) return;

    // Process only new messages since last update
    const startIndex = lastProcessedMessageIndex.current + 1;
    const newMessages = messages.slice(startIndex);
    
    for (const message of newMessages) {
      console.log('Processing message:', message.type, 'at index:', messages.indexOf(message), 'total messages:', messages.length);
      // Update the ref directly to avoid batching issues
      if (message.type === 'init') {
        // Reset to black first
        for (let y = 0; y < 64; y++) {
          for (let x = 0; x < 64; x++) {
            canvasRef.current[y][x] = { r: 0, g: 0, b: 0 };
          }
        }
        // Apply non-black pixels
        message.canvas?.forEach((pixel: any) => {
          if (pixel.x >= 0 && pixel.x < 64 && pixel.y >= 0 && pixel.y < 64) {
            canvasRef.current[pixel.y][pixel.x] = { r: pixel.r, g: pixel.g, b: pixel.b };
          }
        });
      } else if (message.type === 'pixel_update' && 
                 typeof message.x === 'number' && 
                 typeof message.y === 'number' && 
                 typeof message.r === 'number' && 
                 typeof message.g === 'number' && 
                 typeof message.b === 'number') {
        canvasRef.current[message.y][message.x] = {
          r: message.r,
          g: message.g,
          b: message.b,
        };
      } else if (message.type === 'image_update') {
        // Reset to black first
        for (let y = 0; y < 64; y++) {
          for (let x = 0; x < 64; x++) {
            canvasRef.current[y][x] = { r: 0, g: 0, b: 0 };
          }
        }
        // Apply all pixels from the image update
        message.canvas?.forEach((pixel: any) => {
          if (pixel.x >= 0 && pixel.x < 64 && pixel.y >= 0 && pixel.y < 64) {
            canvasRef.current[pixel.y][pixel.x] = { r: pixel.r, g: pixel.g, b: pixel.b };
          }
        });
      } else if (message.type === 'reset') {
        for (let y = 0; y < 64; y++) {
          for (let x = 0; x < 64; x++) {
            canvasRef.current[y][x] = { r: 0, g: 0, b: 0 };
          }
        }
      }
    }

    // Update the last processed index
    lastProcessedMessageIndex.current = messages.length - 1;

    // Update state to trigger re-render
    setCanvasState([...canvasRef.current.map(row => [...row])]);
  }, [messages]);

  // Optimistically update a pixel on the canvas
  // Doesn't actually send the pixel to the server, but adds it to the queue
  const updatePixelOptimistically = useCallback((x: number, y: number, r: number, g: number, b: number) => {
    if (x >= 0 && x < 64 && y >= 0 && y < 64) {
      // Update the ref immediately
      canvasRef.current[y][x] = { r, g, b };
      
      // Update state to trigger re-render
      setCanvasState(prev => {
        const newState = prev.map(row => [...row]);
        newState[y][x] = { r, g, b };
        return newState;
      });
      
      // Add to queue for server update
      pixelQueue.current.push({ x, y, r, g, b });
      console.log(`Added pixel to queue: (${x}, ${y}) - queue length: ${pixelQueue.current.length}`);
      
      // Start the bucket if it's not already running
      if (!isBucketActive.current) {
        startBucket();
      }
    }
  }, [startBucket]);

  // Improved Bresenham's line algorithm with safety checks
  const drawLine = useCallback((x0: number, y0: number, x1: number, y1: number) => {
    // Safety check to prevent infinite loops
    if (x0 === x1 && y0 === y1) {
      updatePixelOptimistically(x0, y0, selectedColor.r, selectedColor.g, selectedColor.b);
      return;
    }

    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let currentX = x0;
    let currentY = y0;
    let maxSteps = Math.max(dx, dy) + 1; // Safety limit
    let steps = 0;

    while (steps < maxSteps) {
      if (currentX >= 0 && currentX < 64 && currentY >= 0 && currentY < 64) {
        updatePixelOptimistically(currentX, currentY, selectedColor.r, selectedColor.g, selectedColor.b);
      }
      
      if (currentX === x1 && currentY === y1) break;
      
      let e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        currentX += sx;
      }
      if (e2 < dx) {
        err += dx;
        currentY += sy;
      }
      
      steps++;
    }
  }, [selectedColor, updatePixelOptimistically]);

  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault(); // Prevent text selection
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / (rect.width / 64));
    const y = Math.floor((event.clientY - rect.top) / (rect.height / 64));
    
    if (x >= 0 && x < 64 && y >= 0 && y < 64) {
      setIsDrawing(true);
      lastPosRef.current = { x, y };
      updatePixelOptimistically(x, y, selectedColor.r, selectedColor.g, selectedColor.b);
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDrawing) return;
    
    event.preventDefault(); // Prevent text selection
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / (rect.width / 64));
    const y = Math.floor((event.clientY - rect.top) / (rect.height / 64));
    
    if (!lastPosRef.current || (x === lastPosRef.current.x && y === lastPosRef.current.y)) return;
    if (x < 0 || x >= 64 || y < 0 || y >= 64) return;
    
    drawLine(lastPosRef.current.x, lastPosRef.current.y, x, y);
    lastPosRef.current = { x, y };
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    event.preventDefault();
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const handleMouseLeave = (event: React.MouseEvent) => {
    event.preventDefault();
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  return (
    <div className="canvas-container">
      {/* <Sidebar /> */}

      <div
        className="canvas-grid no-border"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ userSelect: 'none' }} // Prevent text selection
      >
        {canvasState.map((row, y) =>
          row.map((pixel, x) => (
            <div
              key={`${x}-${y}`}
              className="pixel"
              style={{ backgroundColor: `rgb(${pixel.r}, ${pixel.g}, ${pixel.b})` }}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default CanvasGrid;