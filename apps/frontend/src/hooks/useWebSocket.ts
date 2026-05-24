// src/hooks/useWebSocket.tsx
import { useState, useEffect, useRef } from 'react';
import { FULL_IMAGE_SIZE, SLIDESHOW_FRAME_SIZE, parseSlideshowFrame } from '../utils/image';

interface PixelUpdate {
  type: 'pixel_update';
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
}

interface InitMessage {
  type: 'init';
  canvas: { x: number; y: number; r: number; g: number; b: number }[];
}

interface PixelBatchMessage {
  type: 'pixel_batch';
  canvas: { x: number; y: number; r: number; g: number; b: number }[];
}

interface ImageUpdateMessage {
  type: 'image_update';
  canvas: { x: number; y: number; r: number; g: number; b: number }[];
}

interface SlideshowFrameMessage {
  type: 'slideshow_frame';
  transitionMs: number;
  displayMs: number;
  canvas: { x: number; y: number; r: number; g: number; b: number }[];
}

interface ResetMessage {
  type: 'reset';
}

export type WebSocketMessage =
  | PixelUpdate
  | InitMessage
  | PixelBatchMessage
  | ImageUpdateMessage
  | SlideshowFrameMessage
  | ResetMessage;

export interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
}

// Singleton WebSocket manager
class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: WebSocket | null = null;
  private url: string = '';
  private listeners: Set<(message: WebSocketMessage) => void> = new Set();
  private connectionState: boolean = false;
  private connectionStateListeners: Set<(connected: boolean) => void> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private receivedInit = false;

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect || !this.url) {
      return;
    }

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openConnection(this.url);
    }, 2000);
  }

  connect(url: string) {
    this.shouldReconnect = true;
    this.clearReconnectTimer();

    if (
      this.ws &&
      this.url === url &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.url = url;
    this.openConnection(url);
  }

  private openConnection(url: string) {
    this.receivedInit = false;
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.connectionState = true;
      this.notifyConnectionState(true);
    };

    this.ws.onmessage = (event) => {
      let data: WebSocketMessage;

      if (event.data instanceof ArrayBuffer) {
        const buffer = event.data as ArrayBuffer;

        if (buffer.byteLength === 5) {
          data = this.parseBinaryPixelUpdate(buffer);
        } else if (buffer.byteLength === SLIDESHOW_FRAME_SIZE) {
          data = this.parseSlideshowFrame(buffer);
        } else if (buffer.byteLength === FULL_IMAGE_SIZE) {
          data = this.parseBinaryImageUpdate(buffer);
        } else if (!this.receivedInit) {
          this.receivedInit = true;
          data = this.parseBinaryCanvasData(buffer);
        } else {
          data = this.parseBinaryPixelBatch(buffer);
        }
      } else {
        data = JSON.parse(event.data);
      }

      this.listeners.forEach((listener) => listener(data));
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.connectionState = false;
      this.notifyConnectionState(false);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.connectionState = false;
      this.notifyConnectionState(false);
      this.ws = null;
      this.scheduleReconnect();
    };
  }

  private parseBinaryPixels(buffer: ArrayBuffer) {
    const view = new DataView(buffer);
    const pixelCount = view.getUint16(0, true);
    const canvas: { x: number; y: number; r: number; g: number; b: number }[] = [];

    for (let i = 0; i < pixelCount; i++) {
      const offset = 2 + i * 5;
      canvas.push({
        x: view.getUint8(offset),
        y: view.getUint8(offset + 1),
        r: view.getUint8(offset + 2),
        g: view.getUint8(offset + 3),
        b: view.getUint8(offset + 4),
      });
    }

    return canvas;
  }

  private parseBinaryCanvasData(buffer: ArrayBuffer): InitMessage {
    return { type: 'init', canvas: this.parseBinaryPixels(buffer) };
  }

  private parseBinaryPixelBatch(buffer: ArrayBuffer): PixelBatchMessage {
    return { type: 'pixel_batch', canvas: this.parseBinaryPixels(buffer) };
  }

  private parseBinaryPixelUpdate(buffer: ArrayBuffer): PixelUpdate {
    const view = new DataView(buffer);
    return {
      type: 'pixel_update',
      x: view.getUint8(0),
      y: view.getUint8(1),
      r: view.getUint8(2),
      g: view.getUint8(3),
      b: view.getUint8(4),
    };
  }

  private parseBinaryImageUpdate(buffer: ArrayBuffer): ImageUpdateMessage {
    return { type: 'image_update', canvas: this.parseBinaryPixels(buffer) };
  }

  private parseSlideshowFrame(buffer: ArrayBuffer): SlideshowFrameMessage {
    const { transitionMs, displayMs, canvas } = parseSlideshowFrame(buffer);
    return { type: 'slideshow_frame', transitionMs, displayMs, canvas };
  }

  send(data: PixelUpdate) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  sendBinary(data: ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  addMessageListener(listener: (message: WebSocketMessage) => void) {
    this.listeners.add(listener);
  }

  removeMessageListener(listener: (message: WebSocketMessage) => void) {
    this.listeners.delete(listener);
  }

  addConnectionStateListener(listener: (connected: boolean) => void) {
    this.connectionStateListeners.add(listener);
    listener(this.connectionState);
  }

  removeConnectionStateListener(listener: (connected: boolean) => void) {
    this.connectionStateListeners.delete(listener);
  }

  private notifyConnectionState(connected: boolean) {
    this.connectionStateListeners.forEach((listener) => listener(connected));
  }

  isConnected(): boolean {
    return this.connectionState;
  }

  disconnect() {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
    }
  }
}

export function useWebSocket(url: string, options?: UseWebSocketOptions) {
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const onMessageRef = useRef(options?.onMessage);

  useEffect(() => {
    onMessageRef.current = options?.onMessage;
  }, [options?.onMessage]);

  useEffect(() => {
    const manager = WebSocketManager.getInstance();
    const useMessageState = !options?.onMessage;

    manager.connect(url);

    const messageListener = (data: WebSocketMessage) => {
      if (onMessageRef.current) {
        onMessageRef.current(data);
      }
      if (useMessageState) {
        setMessages((prev) => [...prev, data]);
      }
    };
    manager.addMessageListener(messageListener);

    const connectionListener = (connected: boolean) => {
      setIsConnected(connected);
    };
    manager.addConnectionStateListener(connectionListener);

    return () => {
      manager.removeMessageListener(messageListener);
      manager.removeConnectionStateListener(connectionListener);
    };
  }, [url, options?.onMessage]);

  const send = (data: PixelUpdate) => {
    WebSocketManager.getInstance().send(data);
  };

  const sendBinary = (data: ArrayBuffer) => {
    WebSocketManager.getInstance().sendBinary(data);
  };

  return { messages, send, sendBinary, isConnected };
}
