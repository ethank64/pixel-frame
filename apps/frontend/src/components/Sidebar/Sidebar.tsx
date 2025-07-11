import ToolButton from "./ToolButton/ToolButton";
import "./Sidebar.css";

export default function Sidebar() {
    return (
        <div className="sidebar-container">
            <ToolButton src="/eyedropper.svg" alt="Eyedropper" />
            <ToolButton src="/paintbrush.svg" alt="Paintbrush" />
            <ToolButton src="/eraser.svg" alt="Eraser" />
        </div>
    )
}