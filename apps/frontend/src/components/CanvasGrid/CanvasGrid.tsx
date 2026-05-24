// src/components/CanvasGrid.tsx
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useWebSocket, type WebSocketMessage } from '../../hooks/useWebSocket';
import './CanvasGrid.css';
import { WS_URL } from '../../config';
import Sidebar from '../Sidebar/Sidebar';
import { ERASER_COLOR, getBrushPixels, type BrushSize, type DrawingTool } from '../../utils/brush';

type Pixel = { r: number; g: number; b: number };
type PixelUpdate = { x: number; y: number; r: number; g: number; b: number };

interface CanvasGridProps {
  selectedColor: { r: number; g: number; b: number };
  onColorChange: (color: { r: number; g: number; b: number }) => void;
}

const PixelCell = memo(function PixelCell({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}) {
  return (
    <div
      className="pixel"
      style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
    />
  );
});

function createBlackCanvas(): Pixel[][] {
  return Array.from({ length: 64 }, () =>
    Array.from({ length: 64 }, () => ({ r: 0, g: 0, b: 0 }))
  );
}

function encodePixelBatch(pixels: PixelUpdate[]): ArrayBuffer {
  const binaryData = new ArrayBuffer(2 + pixels.length * 5);
  const view = new DataView(binaryData);
  view.setUint16(0, pixels.length, true);

  pixels.forEach((pixel, index) => {
    const offset = 2 + index * 5;
    view.setUint8(offset, pixel.x);
    view.setUint8(offset + 1, pixel.y);
    view.setUint8(offset + 2, pixel.r);
    view.setUint8(offset + 3, pixel.g);
    view.setUint8(offset + 4, pixel.b);
  });

  return binaryData;
}

function CanvasGrid({ selectedColor, onColorChange }: CanvasGridProps) {
  const canvasRef = useRef<Pixel[][]>(createBlackCanvas());
  const pixelQueue = useRef<PixelUpdate[]>([]);
  const bucketInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isBucketActive = useRef(false);
  const renderFrameRef = useRef<number | null>(null);

  const [canvasState, setCanvasState] = useState<Pixel[][]>(() =>
    createBlackCanvas()
  );
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawingTool>('brush');
  const [brushSize, setBrushSize] = useState<BrushSize>(1);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(
    null
  );
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const scheduleRender = useCallback(() => {
    if (renderFrameRef.current !== null) return;

    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null;
      setCanvasState(canvasRef.current.map((row) => [...row]));
    });
  }, []);

  const applyPixels = useCallback(
    (pixels: { x: number; y: number; r: number; g: number; b: number }[]) => {
      for (const pixel of pixels) {
        if (
          pixel.x >= 0 &&
          pixel.x < 64 &&
          pixel.y >= 0 &&
          pixel.y < 64
        ) {
          canvasRef.current[pixel.y][pixel.x] = {
            r: pixel.r,
            g: pixel.g,
            b: pixel.b,
          };
        }
      }
    },
    []
  );

  const resetCanvas = useCallback(() => {
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        canvasRef.current[y][x] = { r: 0, g: 0, b: 0 };
      }
    }
  }, []);

  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      if (message.type === 'init') {
        resetCanvas();
        applyPixels(message.canvas ?? []);
        scheduleRender();
      } else if (message.type === 'pixel_update') {
        applyPixels([message]);
        scheduleRender();
      } else if (message.type === 'pixel_batch') {
        applyPixels(message.canvas ?? []);
        scheduleRender();
      } else if (message.type === 'image_update') {
        resetCanvas();
        applyPixels(message.canvas ?? []);
        scheduleRender();
      } else if (message.type === 'reset') {
        resetCanvas();
        scheduleRender();
      }
    },
    [applyPixels, resetCanvas, scheduleRender]
  );

  const { sendBinary } = useWebSocket(WS_URL, {
    onMessage: handleWebSocketMessage,
  });

  const flushPixelQueue = useCallback(() => {
    if (pixelQueue.current.length === 0) {
      if (bucketInterval.current) {
        clearInterval(bucketInterval.current);
        bucketInterval.current = null;
      }
      isBucketActive.current = false;
      return;
    }

    const drained = pixelQueue.current.splice(0);
    sendBinary(encodePixelBatch(drained));
  }, [sendBinary]);

  const startBucket = useCallback(() => {
    if (isBucketActive.current) return;

    isBucketActive.current = true;
    bucketInterval.current = setInterval(flushPixelQueue, 16);
  }, [flushPixelQueue]);

  useEffect(() => {
    return () => {
      if (bucketInterval.current) {
        clearInterval(bucketInterval.current);
      }
      if (renderFrameRef.current !== null) {
        cancelAnimationFrame(renderFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDrawing) {
        setIsDrawing(false);
        lastPosRef.current = null;
      }
    };

    const handleGlobalMouseLeave = () => {
      if (isDrawing) {
        setIsDrawing(false);
        lastPosRef.current = null;
      }
    };

    const handleImageUpdate = (event: CustomEvent) => {
      const message = event.detail;

      if (message.type === 'image_update') {
        resetCanvas();
        applyPixels(message.canvas ?? []);
        scheduleRender();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mouseleave', handleGlobalMouseLeave);
    window.addEventListener('imageUpdate', handleImageUpdate as EventListener);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mouseleave', handleGlobalMouseLeave);
      window.removeEventListener(
        'imageUpdate',
        handleImageUpdate as EventListener
      );
    };
  }, [applyPixels, isDrawing, resetCanvas, scheduleRender]);

  const updatePixelOptimistically = useCallback(
    (x: number, y: number, r: number, g: number, b: number) => {
      if (x < 0 || x >= 64 || y < 0 || y >= 64) return;

      const current = canvasRef.current[y][x];
      if (current.r === r && current.g === g && current.b === b) return;

      canvasRef.current[y][x] = { r, g, b };

      setCanvasState((prev) => {
        const newState = prev.map((row) => [...row]);
        newState[y][x] = { r, g, b };
        return newState;
      });

      pixelQueue.current.push({ x, y, r, g, b });

      if (!isBucketActive.current) {
        startBucket();
      }
    },
    [startBucket]
  );

  const stampBrush = useCallback(
    (centerX: number, centerY: number, r: number, g: number, b: number) => {
      for (const { x, y } of getBrushPixels(centerX, centerY, brushSize)) {
        updatePixelOptimistically(x, y, r, g, b);
      }
    },
    [brushSize, updatePixelOptimistically]
  );

  const getCoords = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / (rect.width / 64));
    const y = Math.floor((event.clientY - rect.top) / (rect.height / 64));
    return { x, y };
  };

  const isInBounds = (x: number, y: number) =>
    x >= 0 && x < 64 && y >= 0 && y < 64;

  const drawLine = useCallback(
    (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      strokeColor: Pixel
    ) => {
      const { r, g, b } = strokeColor;

      if (x0 === x1 && y0 === y1) {
        stampBrush(x0, y0, r, g, b);
        return;
      }

      let dx = Math.abs(x1 - x0);
      let dy = Math.abs(y1 - y0);
      let sx = x0 < x1 ? 1 : -1;
      let sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;

      let currentX = x0;
      let currentY = y0;
      const maxSteps = Math.max(dx, dy) + 1;
      let steps = 0;

      while (steps < maxSteps) {
        if (isInBounds(currentX, currentY)) {
          stampBrush(currentX, currentY, r, g, b);
        }

        if (currentX === x1 && currentY === y1) break;

        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          currentX += sx;
        }
        if (e2 < dx) {
          err += dx;
          currentY += sy;
        }

        steps++;
      }
    },
    [stampBrush]
  );

  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    const { x, y } = getCoords(event);
    if (!isInBounds(x, y)) return;

    if (activeTool === 'eyedropper') {
      const sampled = canvasRef.current[y][x];
      onColorChange({ ...sampled });
      setActiveTool('brush');
      return;
    }

    if (activeTool !== 'brush' && activeTool !== 'eraser') return;

    const strokeColor = activeTool === 'eraser' ? ERASER_COLOR : selectedColor;
    setIsDrawing(true);
    lastPosRef.current = { x, y };
    stampBrush(x, y, strokeColor.r, strokeColor.g, strokeColor.b);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    const { x, y } = getCoords(event);
    setHoverCell(isInBounds(x, y) ? { x, y } : null);

    if (!isDrawing || activeTool === 'eyedropper') return;

    event.preventDefault();

    if (
      !lastPosRef.current ||
      (x === lastPosRef.current.x && y === lastPosRef.current.y)
    ) {
      return;
    }
    if (!isInBounds(x, y)) return;

    const strokeColor = activeTool === 'eraser' ? ERASER_COLOR : selectedColor;
    drawLine(lastPosRef.current.x, lastPosRef.current.y, x, y, strokeColor);
    lastPosRef.current = { x, y };
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    event.preventDefault();
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const handleMouseLeave = (event: React.MouseEvent) => {
    event.preventDefault();
    setHoverCell(null);
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const showBrushPreview =
    (activeTool === 'brush' || activeTool === 'eraser') &&
    hoverCell !== null &&
    isInBounds(hoverCell.x, hoverCell.y);

  const previewPixels = showBrushPreview
    ? getBrushPixels(hoverCell.x, hoverCell.y, brushSize)
    : [];

  const previewColor =
    activeTool === 'eraser' ? ERASER_COLOR : selectedColor;

  return (
    <div className="canvas-container">
      <div className="canvas-editor">
        <Sidebar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
        />

        <div className="canvas-grid-wrapper">
        <div
          className={`canvas-grid no-border tool-${activeTool}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ userSelect: 'none' }}
        >
          {canvasState.map((row, y) =>
            row.map((pixel, x) => (
              <PixelCell
                key={`${x}-${y}`}
                r={pixel.r}
                g={pixel.g}
                b={pixel.b}
              />
            ))
          )}
        </div>

        {showBrushPreview && (
          <div className="brush-preview-overlay" aria-hidden="true">
            {previewPixels.map(({ x, y }) => (
              <div
                key={`preview-${x}-${y}`}
                className="brush-preview-pixel"
                style={{
                  gridColumn: x + 1,
                  gridRow: y + 1,
                  backgroundColor: `rgba(${previewColor.r}, ${previewColor.g}, ${previewColor.b}, 0.4)`,
                  borderColor: `rgb(${previewColor.r}, ${previewColor.g}, ${previewColor.b})`,
                }}
              />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default CanvasGrid;
