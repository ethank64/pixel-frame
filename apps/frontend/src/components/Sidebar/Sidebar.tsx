import ToolButton from './ToolButton/ToolButton';
import BrushSizePicker from './BrushSizePicker/BrushSizePicker';
import { type BrushSize, type DrawingTool } from '../../utils/brush';
import './Sidebar.css';

interface SidebarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  brushSize: BrushSize;
  onBrushSizeChange: (size: BrushSize) => void;
}

export default function Sidebar({
  activeTool,
  onToolChange,
  brushSize,
  onBrushSizeChange,
}: SidebarProps) {
  return (
    <aside className="sidebar-container">
      <div className="sidebar-tools">
        <ToolButton
          src="/paintbrush.svg"
          alt="Brush"
          title="Brush"
          isActive={activeTool === 'brush'}
          onClick={() => onToolChange('brush')}
        />
        <ToolButton
          src="/eyedropper.svg"
          alt="Eyedropper"
          title="Eyedropper"
          isActive={activeTool === 'eyedropper'}
          onClick={() => onToolChange('eyedropper')}
        />
        <ToolButton
          src="/eraser.svg"
          alt="Eraser"
          title="Eraser"
          isActive={activeTool === 'eraser'}
          onClick={() => onToolChange('eraser')}
        />
      </div>

      {(activeTool === 'brush' || activeTool === 'eraser') && (
        <BrushSizePicker size={brushSize} onChange={onBrushSizeChange} />
      )}
    </aside>
  );
}
