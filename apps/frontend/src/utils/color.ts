export type RGB = { r: number; g: number; b: number };

export const PALETTE: RGB[] = [
  { r: 0, g: 0, b: 0 },
  { r: 236, g: 238, b: 242 },
  { r: 255, g: 77, b: 77 },
  { r: 255, g: 159, b: 67 },
  { r: 255, g: 200, b: 87 },
  { r: 79, g: 227, b: 161 },
  { r: 46, g: 196, b: 196 },
  { r: 108, g: 168, b: 255 },
  { r: 91, g: 91, b: 214 },
  { r: 166, g: 108, b: 255 },
  { r: 255, g: 107, b: 139 },
  { r: 139, g: 90, b: 60 },
  { r: 58, g: 63, b: 75 },
  { r: 125, g: 132, b: 148 },
  { r: 19, g: 32, b: 74 },
  { r: 74, g: 33, b: 120 },
];

export function toHex({ r, g, b }: RGB): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function fromHex(hex: string): RGB | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function toCss({ r, g, b }: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export function sameColor(a: RGB, b: RGB): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

// hue 0-360, saturation and lightness 0-100
export function hslToRgb(h: number, s: number, l: number): RGB {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  };
}

export function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) };
}
