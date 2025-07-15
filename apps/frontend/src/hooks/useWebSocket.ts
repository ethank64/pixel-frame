// src/hooks/useWebSocket.tsx
import { useState, useEffect } from 'react';

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

interface ImageUpdateMessage {
  type: 'image_update';
  canvas: { x: number; y: number; r: number; g: number; b: number }[];
}

interface ResetMessage {
  type: 'reset';
}

type WebSocketMessage = PixelUpdate | InitMessage | ImageUpdateMessage | ResetMessage;

// Singleton WebSocket manager
class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: WebSocket | null = null;
  private url: string = '';
  private listeners: Set<(message: WebSocketMessage) => void> = new Set();
  private connectionState: boolean = false;
  private connectionStateListeners: Set<(connected: boolean) => void> = new Set();

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  connect(url: string) {
    if (this.ws && this.url === url) {
      return; // Already connected to this URL
    }

    if (this.ws) {
      this.ws.close();
    }

    this.url = url;
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
          // Single pixel update: 5 bytes for x, y, r, g, b
          data = this.parseBinaryPixelUpdate(buffer);
        } else if (buffer.byteLength === 2 + 64 * 64 * 5) {
          // Full image update: count + all 64x64 pixels
          data = this.parseBinaryImageUpdate(buffer);
        } else {
          // Initial canvas state: count + non-black pixel data
          data = this.parseBinaryCanvasData(buffer);
        }
      } else {
        // Handle JSON data for other messages
        data = JSON.parse(event.data);
      }
      
      console.log("message", data);
      this.listeners.forEach(listener => listener(data));
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
    };
  }

  private parseBinaryCanvasData(buffer: ArrayBuffer): InitMessage {
    const view = new DataView(buffer);
    const pixelCount = view.getUint16(0, true); // Little-endian 2-byte count
    
    const canvas: { x: number; y: number; r: number; g: number; b: number }[] = [];
    
    // Each pixel is 5 bytes: x, y, r, g, b
    for (let i = 0; i < pixelCount; i++) {
      const offset = 2 + (i * 5); // Start after the 2-byte count
      const x = view.getUint8(offset);
      const y = view.getUint8(offset + 1);
      const r = view.getUint8(offset + 2);
      const g = view.getUint8(offset + 3);
      const b = view.getUint8(offset + 4);
      
      canvas.push({ x, y, r, g, b });
    }
    
    return { type: 'init', canvas };
  }

  private parseBinaryPixelUpdate(buffer: ArrayBuffer): PixelUpdate {
    const view = new DataView(buffer);
    const x = view.getUint8(0);
    const y = view.getUint8(1);
    const r = view.getUint8(2);
    const g = view.getUint8(3);
    const b = view.getUint8(4);
    
    return { type: 'pixel_update', x, y, r, g, b };
  }

  private parseBinaryImageUpdate(buffer: ArrayBuffer): ImageUpdateMessage {
    const view = new DataView(buffer);
    const pixelCount = view.getUint16(0, true); // Little-endian 2-byte count
    
    const canvas: { x: number; y: number; r: number; g: number; b: number }[] = [];
    
    // Each pixel is 5 bytes: x, y, r, g, b
    for (let i = 0; i < pixelCount; i++) {
      const offset = 2 + (i * 5); // Start after the 2-byte count
      const x = view.getUint8(offset);
      const y = view.getUint8(offset + 1);
      const r = view.getUint8(offset + 2);
      const g = view.getUint8(offset + 3);
      const b = view.getUint8(offset + 4);
      
      canvas.push({ x, y, r, g, b });
    }
    
    return { type: 'image_update', canvas };
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
    // Immediately notify with current state
    listener(this.connectionState);
  }

  removeConnectionStateListener(listener: (connected: boolean) => void) {
    this.connectionStateListeners.delete(listener);
  }

  private notifyConnectionState(connected: boolean) {
    this.connectionStateListeners.forEach(listener => listener(connected));
  }

  isConnected(): boolean {
    return this.connectionState;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

export function useWebSocket(url: string) {
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Whenever the URL changes, we need to reconnect to the new WebSocket
  useEffect(() => {
    const manager = WebSocketManager.getInstance();
    
    // Connect to the WebSocket
    manager.connect(url);

    // Set up message listener
    const messageListener = (data: WebSocketMessage) => {
      setMessages((prev) => [...prev, data]);
    };
    manager.addMessageListener(messageListener);

    // Set up connection state listener
    const connectionListener = (connected: boolean) => {
      setIsConnected(connected);
    };
    manager.addConnectionStateListener(connectionListener);

    // Cleanup
    return () => {
      manager.removeMessageListener(messageListener);
      manager.removeConnectionStateListener(connectionListener);
    };
  }, [url]);

  const send = (data: PixelUpdate) => {
    const manager = WebSocketManager.getInstance();
    manager.send(data);
  };

  const sendBinary = (data: ArrayBuffer) => {
    const manager = WebSocketManager.getInstance();
    manager.sendBinary(data);
  };

  return { messages, send, sendBinary, isConnected };
}