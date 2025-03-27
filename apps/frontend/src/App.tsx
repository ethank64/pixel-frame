// src/App.tsx
import { useRef, useEffect, useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import './App.css';

type Pixel = { r: number; g: number; b: number };

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { messages, send, isConnected } = useWebSocket('ws://44.201.202.86:8000/api/ws/canvas');
  const [canvasState, setCanvasState] = useState<Pixel[][] | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    console.log('Drawing canvas with state');
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const { r, g, b } = canvasState[y][x];
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [canvasState]);

  useEffect(() => {
    if (!messages.length) return;

    const latestMessage = messages[messages.length - 1];
    console.log('Processing message:', latestMessage.type);

    setCanvasState((prevState) => {
      if (latestMessage.type === 'init') {
        const newState = Array(64).fill(null).map(() => Array(64).fill({ r: 0, g: 0, b: 0 }));
        latestMessage.canvas.forEach((pixel) => {
          if (pixel.x >= 0 && pixel.x < 64 && pixel.y >= 0 && pixel.y < 64) {
            newState[pixel.y][pixel.x] = { r: pixel.r, g: pixel.g, b: pixel.b };
          }
        });
        console.log('Initialized canvas state with', latestMessage.canvas.length, 'pixels');
        return newState;
      } else if (latestMessage.type === 'pixel_update' && prevState) {
        const newState = prevState.map(row => [...row]);
        newState[latestMessage.y][latestMessage.x] = {
          r: latestMessage.r,
          g: latestMessage.g,
          b: latestMessage.b,
        };
        console.log(`Updated pixel at (${latestMessage.x}, ${latestMessage.y})`);
        return newState;
      }
      return prevState;
    });
  }, [messages]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isConnected || !canvasState) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = Math.floor((e.clientX - rect.left) * scale);
    const y = Math.floor((e.clientY - rect.top) * scale);

    if (x >= 0 && x < 64 && y >= 0 && y < 64) {
      const update = {
        type: 'pixel_update' as const,
        x,
        y,
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256),
      };
      send(update);
    }
  };

  return (
    <div className="App">
      <h1>Pixel Canvas</h1>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <canvas
        ref={canvasRef}
        width={64}
        height={64}
        onClick={handleCanvasClick}
        className="pixel-canvas"
      />
      <button
        onClick={() =>
          send({
            type: 'pixel_update',
            x: 5,
            y: 5,
            r: 255,
            g: 255,
            b: 255,
          })
        }
        disabled={!isConnected || !canvasState}
      >
        Set White Pixel at (5,5)
      </button>
      <p>Click the canvas to set a random color pixel!</p>
      {!canvasState && isConnected && <p>Loading canvas data...</p>}
    </div>
  );
}

export default App;