// src/App.tsx
import { useState } from "react";
import CanvasGrid from "./components/CanvasGrid/CanvasGrid";
import ColorPicker from "./components/ColorPicker/ColorPicker";
import { useWebSocket } from "./hooks/useWebSocket";
import { useImageUpload } from "./hooks/useImageUpload";
import { useWebcam } from "./hooks/useWebcam";
import "./App.css";
import { WS_URL, RESET_URL } from "./config";

function App() {
  const { isConnected } = useWebSocket(WS_URL);
  const { fileInputRef, handleImageUpload, triggerFileInput } = useImageUpload();
  const { 
    videoRef, 
    canvasRef, 
    stream,
    startWebcam,
    stopWebcam,
    captureWebcamFrame
  } = useWebcam();
  const [selectedColor, setSelectedColor] = useState<{
    r: number;
    g: number;
    b: number;
  }>({ r: 255, g: 0, b: 0 });

  const handleReset = async () => {
    if (!isConnected) return;

    try {
      const response = await fetch(RESET_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        console.log("Canvas reset successfully");
      } else {
        console.error("Failed to reset canvas:", response.statusText);
      }
    } catch (error) {
      console.error("Error resetting canvas:", error);
    }
  };

  return (
    <div className="App">
      <h1>Pixel Frame</h1>
      <p className={`${isConnected ? 'green-text' : 'red-text'}`}>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <div className="canvas-container">
        <CanvasGrid
          selectedColor={selectedColor}
        />
      </div>
      <ColorPicker onColorChange={setSelectedColor} />
      <div className="webcam-container">
        <video ref={videoRef} style={{ width: '320px', height: '240px' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div>
          <button onClick={startWebcam} disabled={!!stream}>
            Start Webcam
          </button>
          <button onClick={stopWebcam} disabled={!stream}>
            Stop Webcam
          </button>
          <button onClick={captureWebcamFrame} disabled={!stream}>
            Capture Frame
          </button>
        </div>
      </div>
      <div className="upload-container">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
        <button 
          onClick={triggerFileInput}
          disabled={!isConnected}
        >
          Upload Image
        </button>
      </div>
      <button onClick={handleReset} disabled={!isConnected}>
        Reset Canvas
      </button>
    </div>
  );
}

export default App;