// src/App.tsx
import { useState } from "react";
import CanvasGrid from "./components/CanvasGrid";
import ColorPicker from "./components/ColorPicker";
import { useWebSocket } from "./hooks/useWebSocket";
import "./App.css";

function App() {
  const { send, isConnected } = useWebSocket(
    "ws://44.201.202.86:8000/api/ws/canvas"
  );
  const [selectedColor, setSelectedColor] = useState<{
    r: number;
    g: number;
    b: number;
  }>({ r: 255, g: 0, b: 0 });

  const handleReset = () => {
    if (!isConnected) return;
    // Send pixel_update for all pixels to black
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        send({
          type: "pixel_update" as const,
          x,
          y,
          r: 0,
          g: 0,
          b: 0,
        });
      }
    }
  };

  return (
    <div className="App">
      <h1>Pixel Canvas</h1>
      <p>Status: {isConnected ? "Connected" : "Disconnected"}</p>
      <div className="canvas-container">
        <CanvasGrid
          send={send}
          isConnected={isConnected}
          selectedColor={selectedColor}
        />
      </div>
      <ColorPicker onColorChange={setSelectedColor} />
      <button onClick={handleReset} disabled={!isConnected}>
        Reset Canvas
      </button>
    </div>
  );
}

export default App;
