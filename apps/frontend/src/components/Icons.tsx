// Stroke icons drawn on a 24x24 grid; they inherit the text color.
import type { ReactNode } from 'react';

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const BrushIcon = () => (
  <Icon>
    <path d="M4 20l4-1 11-11-3-3L5 16z" />
  </Icon>
);

export const EraserIcon = () => (
  <Icon>
    <path d="M8 20h12" />
    <path d="M4 15l9-9 6 6-7 7H8z" />
  </Icon>
);

export const EyedropperIcon = () => (
  <Icon>
    <path d="M14 4l6 6" />
    <path d="M17 7L7 17l-3 1 1-3L15 5" />
  </Icon>
);

export const ImageIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 16l5-5 4 4 3-3 6 6" />
  </Icon>
);

export const CameraIcon = () => (
  <Icon>
    <rect x="3" y="7" width="13" height="10" rx="2" />
    <path d="M16 11l5-3v8l-5-3z" />
  </Icon>
);

export const TrashIcon = () => (
  <Icon>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
  </Icon>
);

export const LinkIcon = () => (
  <Icon size={16}>
    <path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1" />
    <path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" />
  </Icon>
);

export function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 6 6" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="0" y="0" width="2" height="2" fill="#4FE3A1" />
      <rect x="2" y="2" width="2" height="2" fill="#FFC857" />
      <rect x="4" y="4" width="2" height="2" fill="#FF6B8B" />
      <rect x="4" y="0" width="2" height="2" fill="#6CA8FF" />
      <rect x="0" y="4" width="2" height="2" fill="#ECEEF2" />
    </svg>
  );
}
