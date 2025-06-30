// src/components/CanvasGrid.tsx
import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import './CanvasGrid.css';
import { WS_URL } from '../config';

type Pixel = { r: number; g: number; b: number };

interface CanvasGridProps {
  send: (data: any) => void;
  isConnected: boolean;
  selectedColor: { r: number; g: number; b: number };
}

function CanvasGrid({ send, selectedColor }: CanvasGridProps) {
  const { messages } = useWebSocket(WS_URL);
  const [canvasState, setCanvasState] = useState<Pixel[][]>(
    Array(64).fill(null).map(() => Array(64).fill({ r: 0, g: 0, b: 0 }))
  );
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<Pixel[][]>(
    Array(64).fill(null).map(() => Array(64).fill({ r: 0, g: 0, b: 0 }))
  ); // Ref to hold latest state

  // Update canvas state from WebSocket messages
  useEffect(() => {
    if (!messages.length) return;

    const latestMessage = messages[messages.length - 1];
    console.log('Received message:', latestMessage);

    // Update the ref directly to avoid batching issues
    if (latestMessage.type === 'init') {
      // Reset to black first
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          canvasRef.current[y][x] = { r: 0, g: 0, b: 0 };
        }
      }
      // Apply non-black pixels
      latestMessage.canvas.forEach((pixel: any) => {
        if (pixel.x >= 0 && pixel.x < 64 && pixel.y >= 0 && pixel.y < 64) {
          canvasRef.current[pixel.y][pixel.x] = { r: pixel.r, g: pixel.g, b: pixel.b };
        }
      });
      console.log('Processed init message with', latestMessage.canvas.length, 'pixels');
    } else if (latestMessage.type === 'pixel_update') {
      canvasRef.current[latestMessage.y][latestMessage.x] = {
        r: latestMessage.r,
        g: latestMessage.g,
        b: latestMessage.b,
      };
      console.log(`Processed pixel_update: x=${latestMessage.x}, y=${latestMessage.y}, r=${latestMessage.r}, g=${latestMessage.g}, b=${latestMessage.b}`);
    } else if (latestMessage.type === 'reset') {
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          canvasRef.current[y][x] = { r: 0, g: 0, b: 0 };
        }
      }
      console.log('Processed reset message');
    }

    // Update state to trigger re-render
    setCanvasState([...canvasRef.current.map(row => [...row])]);
  }, [messages]);

  // Bresenham's line algorithm to draw continuous lines
  const drawLine = (x0: number, y0: number, x1: number, y1: number) => {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      if (x0 >= 0 && x0 < 64 && y0 >= 0 && y0 < 64) {
        send({
          type: 'pixel_update' as const,
          x: x0,
          y: y0,
          r: selectedColor.r,
          g: selectedColor.g,
          b: selectedColor.b,
        });
      }
      if (x0 === x1 && y0 === y1) break;
      let e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  };

  const handleMouseDown = (x: number, y: number) => {
    setIsDrawing(true);
    setLastPos({ x, y });
    drawLine(x, y, x, y); // Single pixel on click
  };

  const handleMouseMove = (x: number, y: number) => {
    if (!isDrawing || !lastPos) return;
    drawLine(lastPos.x, lastPos.y, x, y);
    setLastPos({ x, y });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setLastPos(null);
  };

  return (
    <div
      className="canvas-grid"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {canvasState.map((row, y) =>
        row.map((pixel, x) => (
          <div
            key={`${x}-${y}`}
            className="pixel"
            style={{ backgroundColor: `rgb(${pixel.r}, ${pixel.g}, ${pixel.b})` }}
            onMouseDown={() => handleMouseDown(x, y)}
            onMouseMove={() => handleMouseMove(x, y)}
          />
        ))
      )}
    </div>
  );
}

export default CanvasGrid;