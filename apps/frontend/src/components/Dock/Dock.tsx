import { useEffect, useRef, useState, type ReactNode } from 'react';
import ColorPanel from '../ColorPanel/ColorPanel';
import { BrushIcon, CameraIcon, EraserIcon, EyedropperIcon, ImageIcon, TrashIcon } from '../Icons';
import { BRUSH_SIZES, type BrushSize, type DrawingTool } from '../../utils/brush';
import { toCss, toHex, type RGB } from '../../utils/color';
import { LIVE_FPS_OPTIONS, type useWebcam } from '../../hooks/useWebcam';
import './Dock.css';

type Panel = 'color' | 'size' | 'webcam' | 'clear';

type WebcamControls = ReturnType<typeof useWebcam>;

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
  const { stream, stopWebcam, live } = webcam;

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

  // Turn the camera off when its panel closes, unless you're streaming
  useEffect(() => {
    if (openPanel !== 'webcam' && stream && !live.you) {
      stopWebcam();
    }
  }, [openPanel, stream, stopWebcam, live.you]);

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

          {openPanel === 'webcam' && <WebcamPanel webcam={webcam} isConnected={isConnected} />}

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
          aria-label={live.you ? 'Webcam, you are live' : 'Webcam'}
          title="Webcam"
          aria-expanded={openPanel === 'webcam'}
          onClick={() => togglePanel('webcam')}
        >
          <CameraIcon />
          {live.you && <span className="live-badge" aria-hidden="true" />}
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

function WebcamPanel({ webcam, isConnected }: { webcam: WebcamControls; isConnected: boolean }) {
  const { stream, live, fps } = webcam;
  const secondsLeft = useSecondsLeft(live.active ? live.endsAt : 0);
  const someoneElseLive = live.active && !live.you;

  return (
    <div className="webcam-panel">
      <div className="webcam-previews">
        <video ref={webcam.attachPreview} className="webcam-video" muted playsInline />
        {live.you && (
          <canvas
            ref={webcam.previewCanvasRef}
            className="live-preview"
            width={64}
            height={64}
            role="img"
            aria-label="What the frame is showing"
          />
        )}
      </div>

      {live.you ? (
        <>
          <p className="live-status">
            <span className="live-dot" aria-hidden="true" />
            You're live on the frame · {formatTime(secondsLeft)} left
          </p>
          <div className="panel-actions">
            <button type="button" className="danger-button" onClick={webcam.stopLive}>
              Stop streaming
            </button>
          </div>
        </>
      ) : !stream ? (
        <>
          <p className="panel-note">Turn on your camera to snap a picture or stream live to the frame.</p>
          <div className="panel-actions">
            <button type="button" className="primary-button" onClick={webcam.startWebcam}>
              Turn on camera
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="fps-picker" role="group" aria-label="Frames per second">
            {LIVE_FPS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={option === fps ? 'active' : ''}
                aria-pressed={option === fps}
                onClick={() => webcam.setFps(option)}
              >
                {option} fps
              </button>
            ))}
          </div>
          {someoneElseLive ? (
            <p className="panel-note">Someone else is streaming to the frame. It's free in {formatTime(secondsLeft)}.</p>
          ) : (
            <p className="panel-note">Streams last up to 3 minutes. Drawing keeps working and shows up on the frame when you stop.</p>
          )}
          <div className="panel-actions">
            <button type="button" className="secondary-button" onClick={webcam.stopWebcam}>
              Turn off
            </button>
            <button type="button" className="secondary-button" onClick={webcam.captureWebcamFrame} disabled={!isConnected}>
              Snap
            </button>
            <button type="button" className="live-button" onClick={webcam.goLive} disabled={!isConnected || someoneElseLive}>
              <span className="live-dot" aria-hidden="true" />
              Go live
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Counts down to a Date.now() timestamp, once a second
function useSecondsLeft(endsAt: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return Math.max(0, Math.round((endsAt - now) / 1000));
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
