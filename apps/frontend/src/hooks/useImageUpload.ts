import { useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { WS_URL } from '../config';
import { fileToImageBinary, binaryToPixels } from '../utils/image';

export function useImageUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendBinary } = useWebSocket(WS_URL);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const binaryData = await fileToImageBinary(file);
      console.log(
        `Sending binary image data, size: ${binaryData.byteLength} bytes`
      );
      sendBinary(binaryData);

      const imageUpdateEvent = new CustomEvent('imageUpdate', {
        detail: { type: 'image_update', canvas: binaryToPixels(binaryData) },
      });
      window.dispatchEvent(imageUpdateEvent);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    }
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
