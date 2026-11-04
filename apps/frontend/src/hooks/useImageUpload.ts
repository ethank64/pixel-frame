import { useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { WS_URL } from '../config';
import { sendImageToFrame } from '../utils/image';

export function useImageUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendBinary } = useWebSocket(WS_URL);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      sendImageToFrame(img, img.naturalWidth, img.naturalHeight, sendBinary);
      URL.revokeObjectURL(url);

      // Clear the file input so the same file can be picked again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    img.src = url;
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
