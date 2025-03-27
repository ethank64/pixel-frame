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

interface ResetMessage {
  type: 'reset';
}

type WebSocketMessage = PixelUpdate | InitMessage | ResetMessage;

export function useWebSocket(url: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(url);
    setWs(socket);

    socket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      const data: WebSocketMessage = JSON.parse(event.data);
      console.log('WebSocket message received:', data); // Debug log
      setMessages((prev) => [...prev, data]);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    socket.onclose = () => {
      console.log('WebSocket closed');
      setIsConnected(false);
    };

    return () => socket.close();
  }, [url]);

  const send = (data: PixelUpdate) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  return { messages, send, isConnected };
}