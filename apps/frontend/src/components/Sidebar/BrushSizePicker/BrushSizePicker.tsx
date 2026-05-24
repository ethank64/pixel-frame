import { BRUSH_SIZES, type BrushSize } from '../../../utils/brush';
import './BrushSizePicker.css';

interface BrushSizePickerProps {
  size: BrushSize;
  onChange: (size: BrushSize) => void;
}

export default function BrushSizePicker({ size, onChange }: BrushSizePickerProps) {
  return (
    <div className="brush-size-picker">
      <span className="brush-size-label">Size</span>
      {BRUSH_SIZES.map((brushSize) => (
        <button
          key={brushSize}
          type="button"
          className={`brush-size-option ${size === brushSize ? 'active' : ''}`}
          onClick={() => onChange(brushSize)}
          title={`Brush size ${brushSize}`}
          aria-label={`Brush size ${brushSize}`}
          aria-pressed={size === brushSize}
        >
          <span
            className="brush-size-preview"
            style={{ width: `${4 + brushSize * 2}px`, height: `${4 + brushSize * 2}px` }}
          />
        </button>
      ))}
    </div>
  );
}
