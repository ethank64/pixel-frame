import { useRef, useCallback, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { WS_URL } from '../config';
import { sendImageToFrame } from '../utils/image';

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const { sendBinary } = useWebSocket(WS_URL);

  const startWebcam = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setStream(mediaStream);
    } catch (error) {
      console.error('Error accessing webcam:', error);
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Send the current camera frame to the canvas as one full image update.
  // Mirrored to match the preview, which shows the camera like a mirror.
  const captureWebcamFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    sendImageToFrame(video, video.videoWidth, video.videoHeight, sendBinary, { mirror: true });
  }, [sendBinary]);

  return {
    videoRef,
    stream,
    startWebcam,
    stopWebcam,
    captureWebcamFrame,
  };
}
