import { useRef } from 'react';
import { UPDATE_IMAGE_URL } from '../config';

export function useImageUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const response = await fetch(UPDATE_IMAGE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pixels: pixelData }),
        });
        if (response.ok) {
          console.log("Image uploaded successfully");
        } else {
          console.error("Failed to upload image:", response.statusText);
        }
      } catch (error) {
        console.error("Error uploading image:", error);
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