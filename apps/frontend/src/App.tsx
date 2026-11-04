// src/App.tsx
import { useCallback, useState } from "react";
import CanvasGrid from "./components/CanvasGrid/CanvasGrid";
import Dock from "./components/Dock/Dock";
import { LogoMark } from "./components/Icons";
import { useWebSocket } from "./hooks/useWebSocket";
import { useImageUpload } from "./hooks/useImageUpload";
import { useWebcam } from "./hooks/useWebcam";
import { type BrushSize, type DrawingTool } from "./utils/brush";
import { sameColor, type RGB } from "./utils/color";
import "./App.css";
import { WS_URL, RESET_URL } from "./config";

const MAX_RECENT_COLORS = 6;

function App() {
  const { isConnected } = useWebSocket(WS_URL);
  const { fileInputRef, handleImageUpload, triggerFileInput } = useImageUpload();
  const webcam = useWebcam();
  const [selectedColor, setSelectedColor] = useState<RGB>({ r: 255, g: 200, b: 87 });
  const [recentColors, setRecentColors] = useState<RGB[]>([]);
  const [activeTool, setActiveTool] = useState<DrawingTool>("brush");
  const [brushSize, setBrushSize] = useState<BrushSize>(1);

  // Remember colors that were actually drawn with, newest first
  const rememberColor = useCallback((color: RGB) => {
    setRecentColors((prev) =>
      [color, ...prev.filter((c) => !sameColor(c, color))].slice(0, MAX_RECENT_COLORS)
    );
  }, []);

  const handleColorChange = (color: RGB) => {
    setSelectedColor(color);
    if (activeTool === "eraser") setActiveTool("brush");
  };

  const handleReset = async () => {
    try {
      const response = await fetch(RESET_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        console.error("Failed to reset canvas:", response.statusText);
      }
    } catch (error) {
      console.error("Error resetting canvas:", error);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <LogoMark />
          <h1>Pixel Frame</h1>
        </div>
        <span className={`status ${isConnected ? "online" : "offline"}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {isConnected ? "Live" : "Reconnecting…"}
        </span>
      </header>

      <main className="stage">
        <div className="frame">
          <div className="frame-mat">
            <CanvasGrid
              selectedColor={selectedColor}
              onColorChange={handleColorChange}
              activeTool={activeTool}
              onToolChange={setActiveTool}
              brushSize={brushSize}
              onStroke={rememberColor}
            />
          </div>
        </div>

        <Dock
          activeTool={activeTool}
          onToolChange={setActiveTool}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          color={selectedColor}
          recentColors={recentColors}
          onColorChange={handleColorChange}
          isConnected={isConnected}
          onUploadClick={triggerFileInput}
          onClear={handleReset}
          webcam={webcam}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          hidden
        />
      </main>
    </div>
  );
}

export default App;
