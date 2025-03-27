// src/hooks/useWebSocket.ts
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

type WebSocketMessage = PixelUpdate | InitMessage;

export function useWebSocket(url: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]); // Store all messages
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
      console.log('Received message:', data.type, data.type === 'init' ? `${data.canvas.length} pixels` : '');
      setMessages((prev) => [...prev, data]); // Append new message
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    socket.onclose = () => {
      console.log('WebSocket closed');
      setIsConnected(false);
    };

    // Cleanup only when component unmounts, not on every render
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
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