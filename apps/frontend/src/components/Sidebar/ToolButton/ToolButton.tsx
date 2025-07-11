import './ToolButton.css';

interface ToolButtonProps {
    src: string;
    alt?: string;
}

export default function ToolButton({ src, alt = ""}: ToolButtonProps) {
    return (
        <div className="tool-container">
            <button className="tool-button">
                <img className="tool-icon" src={src} alt={alt} />
            </button>
        </div>
    )
}