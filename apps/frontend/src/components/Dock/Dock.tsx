import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import ColorPanel from '../ColorPanel/ColorPanel';
import { BrushIcon, CameraIcon, EraserIcon, EyedropperIcon, ImageIcon, TrashIcon } from '../Icons';
import { BRUSH_SIZES, type BrushSize, type DrawingTool } from '../../utils/brush';
import { toCss, toHex, type RGB } from '../../utils/color';
import './Dock.css';

type Panel = 'color' | 'size' | 'webcam' | 'clear';

interface WebcamControls {
  videoRef: RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  startWebcam: () => void;
  stopWebcam: () => void;
  captureWebcamFrame: () => void;
}

interface DockProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  brushSize: BrushSize;
  onBrushSizeChange: (size: BrushSize) => void;
  color: RGB;
  recentColors: RGB[];
  onColorChange: (color: RGB) => void;
  isConnected: boolean;
  onUploadClick: () => void;
  onClear: () => void;
  webcam: WebcamControls;
}

const TOOLS: { id: DrawingTool; label: string; icon: ReactNode }[] = [
  { id: 'brush', label: 'Brush', icon: <BrushIcon /> },
  { id: 'eraser', label: 'Eraser', icon: <EraserIcon /> },
  { id: 'eyedropper', label: 'Eyedropper', icon: <EyedropperIcon /> },
];

export default function Dock({
  activeTool,
  onToolChange,
  brushSize,
  onBrushSizeChange,
  color,
  recentColors,
  onColorChange,
  isConnected,
  onUploadClick,
  onClear,
  webcam,
}: DockProps) {
  const [openPanel, setOpenPanel] = useState<Panel | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const { stream, stopWebcam } = webcam;

  const togglePanel = (panel: Panel) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  // Close the open panel on a click outside the dock or on Escape
  useEffect(() => {
    if (!openPanel) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (dockRef.current && !dockRef.current.contains(event.target as Node)) {
        setOpenPanel(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPanel(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPanel]);

  // Turn the camera off when its panel closes
  useEffect(() => {
    if (openPanel !== 'webcam' && stream) {
      stopWebcam();
    }
  }, [openPanel, stream, stopWebcam]);

  return (
    <div className="dock-anchor" ref={dockRef}>
      {openPanel && (
        <div className="dock-panel" role="dialog" aria-label={panelLabel(openPanel)}>
          {openPanel === 'color' && (
            <ColorPanel color={color} recentColors={recentColors} onColorChange={onColorChange} />
          )}

          {openPanel === 'size' && (
            <div className="size-panel" role="group" aria-label="Brush size">
              {BRUSH_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`size-option ${size === brushSize ? 'active' : ''}`}
                  aria-pressed={size === brushSize}
                  onClick={() => {
                    onBrushSizeChange(size);
                    setOpenPanel(null);
                  }}
                >
                  <span className="size-dot" style={{ width: 3 + size * 3, height: 3 + size * 3 }} />
                  {size} px
                </button>
              ))}
            </div>
          )}

          {openPanel === 'webcam' && (
            <div className="webcam-panel">
              <video ref={webcam.videoRef} className="webcam-video" muted playsInline />
              {!webcam.stream && <p className="panel-note">Turn on your camera, then snap a picture to put it on the frame.</p>}
              <div className="panel-actions">
                {webcam.stream ? (
                  <>
                    <button type="button" className="secondary-button" onClick={webcam.stopWebcam}>
                      Turn off
                    </button>
                    <button type="button" className="primary-button" onClick={webcam.captureWebcamFrame} disabled={!isConnected}>
                      Snap to frame
                    </button>
                  </>
                ) : (
                  <button type="button" className="primary-button" onClick={webcam.startWebcam}>
                    Turn on camera
                  </button>
                )}
              </div>
            </div>
          )}

          {openPanel === 'clear' && (
            <div className="clear-panel">
              <strong>Clear the canvas for everyone?</strong>
              <p className="panel-note">This wipes the frame too. It can't be undone.</p>
              <div className="panel-actions">
                <button type="button" className="secondary-button" onClick={() => setOpenPanel(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger-button"
                  disabled={!isConnected}
                  onClick={() => {
                    onClear();
                    setOpenPanel(null);
                  }}
                >
                  Clear canvas
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="dock" role="toolbar" aria-label="Drawing tools">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`dock-button ${activeTool === tool.id ? 'active' : ''}`}
            aria-label={tool.label}
            title={tool.label}
            aria-pressed={activeTool === tool.id}
            onClick={() => onToolChange(tool.id)}
          >
            {tool.icon}
          </button>
        ))}

        <span className="dock-divider" aria-hidden="true" />

        <button
          type="button"
          className={`dock-color ${openPanel === 'color' ? 'open' : ''}`}
          style={{ backgroundColor: toCss(color) }}
          aria-label={`Color, currently ${toHex(color)}`}
          title="Color"
          aria-expanded={openPanel === 'color'}
          onClick={() => togglePanel('color')}
        />
        <button
          type="button"
          className={`dock-button dock-size ${openPanel === 'size' ? 'open' : ''}`}
          aria-label={`Brush size, currently ${brushSize} pixels`}
          title="Brush size"
          aria-expanded={openPanel === 'size'}
          onClick={() => togglePanel('size')}
        >
          {brushSize} px
        </button>

        <span className="dock-divider" aria-hidden="true" />

        <button
          type="button"
          className="dock-button"
          aria-label="Upload an image"
          title="Upload an image"
          disabled={!isConnected}
          onClick={onUploadClick}
        >
          <ImageIcon />
        </button>
        <button
          type="button"
          className={`dock-button ${openPanel === 'webcam' ? 'open' : ''}`}
          aria-label="Webcam"
          title="Webcam"
          aria-expanded={openPanel === 'webcam'}
          onClick={() => togglePanel('webcam')}
        >
          <CameraIcon />
        </button>
        <button
          type="button"
          className={`dock-button dock-danger ${openPanel === 'clear' ? 'open' : ''}`}
          aria-label="Clear canvas"
          title="Clear canvas"
          aria-expanded={openPanel === 'clear'}
          onClick={() => togglePanel('clear')}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function panelLabel(panel: Panel): string {
  switch (panel) {
    case 'color':
      return 'Color';
    case 'size':
      return 'Brush size';
    case 'webcam':
      return 'Webcam';
    case 'clear':
      return 'Clear canvas';
  }
}
