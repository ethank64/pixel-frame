import './ToolButton.css';

interface ToolButtonProps {
  src: string;
  alt?: string;
  title?: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export default function ToolButton({
  src,
  alt = '',
  title,
  isActive = false,
  disabled = false,
  onClick,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      className={`tool-button ${isActive ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={alt}
      aria-pressed={isActive}
    >
      <img className="tool-icon" src={src} alt="" aria-hidden="true" />
    </button>
  );
}