// src/components/ColorPicker.tsx
import { useState } from 'react';
import './ColorPicker.css';

interface ColorPickerProps {
  onColorChange: (color: { r: number; g: number; b: number }) => void;
}

function ColorPicker({ onColorChange }: ColorPickerProps) {
  const [color, setColor] = useState<{ r: number; g: number; b: number }>({ r: 255, g: 0, b: 0 });

  const handleGradientClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    // Simple gradient: x for hue, y for saturation/value
    const hue = Math.floor((x / width) * 360); // 0-360
    const saturation = 100; // Fixed for simplicity
    const value = Math.floor((1 - y / height) * 100); // 0-100

    // Convert HSV to RGB (simplified)
    const c = (value / 100) * (saturation / 100);
    const xVal = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = (value / 100) - c;
    let r, g, b;

    if (hue < 60) { r = c; g = xVal; b = 0; }
    else if (hue < 120) { r = xVal; g = c; b = 0; }
    else if (hue < 180) { r = 0; g = c; b = xVal; }
    else if (hue < 240) { r = 0; g = xVal; b = c; }
    else if (hue < 300) { r = xVal; g = 0; b = c; }
    else { r = c; g = 0; b = xVal; }

    const newColor = {
      r: Math.floor((r + m) * 255),
      g: Math.floor((g + m) * 255),
      b: Math.floor((b + m) * 255),
    };

    setColor(newColor);
    onColorChange(newColor);
  };

  return (
    <div className="color-picker">
      <div
        className="gradient"
        onClick={handleGradientClick}
      />
      <div
        className="preview"
        style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
      />
    </div>
  );
}

export default ColorPicker;