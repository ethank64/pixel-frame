import { useRef, useCallback, useEffect, useState } from 'react';
import { useWebSocket, type WebSocketMessage } from './useWebSocket';
import { WS_URL } from '../config';
import { createFrameCanvas, encodeLiveFrame, sendImageToFrame } from '../utils/image';

export const LIVE_FPS_OPTIONS = [5, 10, 15] as const;
export type LiveFps = (typeof LIVE_FPS_OPTIONS)[number];

export interface LiveState {
  // Someone (maybe you) is streaming to the frame
  active: boolean;
  // You hold the live turn
  you: boolean;
}

// Skip a frame rather than queue it when this much is still waiting to go out
const MAX_BUFFERED_BYTES = 32 * 1024;

export function useWebcam() {
  // Frames are captured from this off-screen video, so streaming keeps going when the panel closes
  const captureVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [live, setLive] = useState<LiveState>({ active: false, you: false });
  const [fps, setFps] = useState<LiveFps>(10);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'live_status') {
      setLive({ active: message.active, you: message.you });
    }
  }, []);

  const { sendBinary, sendJson, bufferedAmount } = useWebSocket(WS_URL, {
    onMessage: handleMessage,
  });

  const startWebcam = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = mediaStream;
      await video.play();
      captureVideoRef.current = video;
      setStream(mediaStream);
    } catch (error) {
      console.error('Error accessing webcam:', error);
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (live.you) {
      sendJson({ type: 'live_stop' });
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    captureVideoRef.current = null;
  }, [live.you, sendJson, stream]);

  // Ref callback for an on-screen <video> that shows the camera
  const attachPreview = useCallback(
    (video: HTMLVideoElement | null) => {
      if (video && stream && video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
    },
    [stream]
  );

  // Send the current camera frame to the canvas as one full image update.
  // Mirrored to match the preview, which shows the camera like a mirror.
  const captureWebcamFrame = useCallback(() => {
    const video = captureVideoRef.current;
    if (!video || !video.videoWidth) return;
    sendImageToFrame(video, video.videoWidth, video.videoHeight, sendBinary, { mirror: true });
  }, [sendBinary]);

  const goLive = useCallback(() => sendJson({ type: 'live_start' }), [sendJson]);
  const stopLive = useCallback(() => sendJson({ type: 'live_stop' }), [sendJson]);

  // While you hold the live turn, send camera frames to the frame
  useEffect(() => {
    if (!live.you || !stream) return;

    const ctx = createFrameCanvas();
    if (!ctx) return;

    const interval = setInterval(() => {
      const video = captureVideoRef.current;
      if (!video || !video.videoWidth) return;
      if (bufferedAmount() > MAX_BUFFERED_BYTES) return;

      sendBinary(encodeLiveFrame(ctx, video, video.videoWidth, video.videoHeight, { mirror: true }));

      // Show what the frame is getting, if the preview is on screen
      const preview = previewCanvasRef.current?.getContext('2d');
      if (preview) {
        preview.imageSmoothingEnabled = false;
        preview.drawImage(ctx.canvas, 0, 0);
      }
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [live.you, stream, fps, sendBinary, bufferedAmount]);

  return {
    stream,
    startWebcam,
    stopWebcam,
    attachPreview,
    previewCanvasRef,
    captureWebcamFrame,
    live,
    goLive,
    stopLive,
    fps,
    setFps,
  };
}
