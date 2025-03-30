// src/App.tsx
import { useState, useRef } from "react";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Start webcam
  const startWebcam = async () => {
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
  };

  // Stop webcam
  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Capture and process image
  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;

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

    // Convert to array of {x, y, r, g, b} objects
    const pixelData: { x: number; y: number; r: number; g: number; b: number }[] = [];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const index = (y * 64 + x) * 4; // 4 bytes per pixel (RGBA)
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        pixelData.push({ x, y, r, g, b });
      }
    }

    // Send to backend
    try {
      const response = await fetch("http://44.201.202.86:8000/api/update_image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pixels: pixelData }),
      });
      if (response.ok) {
        console.log("Image data sent successfully");
      } else {
        console.error("Failed to send image data:", response.statusText);
      }
    } catch (error) {
      console.error("Error sending image data:", error);
    }
  };

  const handleReset = async () => {
    if (!isConnected) return;

    try {
      const response = await fetch("http://44.201.202.86:8000/api/reset", {
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
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <div className="canvas-container">
        <CanvasGrid
          send={send}
          isConnected={isConnected}
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
          <button onClick={captureImage} disabled={!stream}>
            Capture Image
          </button>
        </div>
      </div>
      <button onClick={handleReset} disabled={!isConnected}>
        Reset Canvas
      </button>
    </div>
  );
}

export default App;