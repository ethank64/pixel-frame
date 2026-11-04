import { useEffect, useState } from 'react';
import { PALETTE, fromHex, hslToRgb, rgbToHsl, sameColor, toCss, toHex, type RGB } from '../../utils/color';
import './ColorPanel.css';

interface ColorPanelProps {
  color: RGB;
  recentColors: RGB[];
  onColorChange: (color: RGB) => void;
}

export default function ColorPanel({ color, recentColors, onColorChange }: ColorPanelProps) {
  const [hsl, setHsl] = useState(() => rgbToHsl(color));
  const [hexDraft, setHexDraft] = useState(toHex(color));

  // Keep the sliders and hex field in step when the color changes elsewhere (swatch, eyedropper)
  useEffect(() => {
    setHexDraft(toHex(color));
    setHsl((prev) => (sameColor(hslToRgb(prev.h, prev.s, prev.l), color) ? prev : rgbToHsl(color)));
  }, [color]);

  const updateHsl = (next: { h: number; s: number; l: number }) => {
    setHsl(next);
    onColorChange(hslToRgb(next.h, next.s, next.l));
  };

  const commitHex = () => {
    const parsed = fromHex(hexDraft);
    if (parsed) {
      onColorChange(parsed);
    } else {
      setHexDraft(toHex(color));
    }
  };

  const hueTrackColor = toCss(hslToRgb(hsl.h, 100, 50));

  return (
    <div className="color-panel">
      <div className="color-panel-swatches" role="group" aria-label="Palette">
        {PALETTE.map((swatch) => (
          <button
            key={toHex(swatch)}
            type="button"
            className={`swatch ${sameColor(swatch, color) ? 'selected' : ''}`}
            style={{ backgroundColor: toCss(swatch) }}
            aria-label={toHex(swatch)}
            aria-pressed={sameColor(swatch, color)}
            onClick={() => onColorChange(swatch)}
          />
        ))}
      </div>

      <label className="color-slider">
        <span>Hue</span>
        <input
          type="range"
          className="hue-range"
          min={0}
          max={360}
          value={hsl.h}
          onChange={(e) => updateHsl({ h: Number(e.target.value), s: Math.max(hsl.s, 40), l: hsl.l })}
        />
      </label>

      <label className="color-slider">
        <span>Light</span>
        <input
          type="range"
          className="light-range"
          min={0}
          max={100}
          value={hsl.l}
          style={{ ['--hue-color' as string]: hueTrackColor }}
          onChange={(e) => updateHsl({ ...hsl, l: Number(e.target.value) })}
        />
      </label>

      <div className="color-panel-footer">
        <span className="current-swatch" style={{ backgroundColor: toCss(color) }} />
        <label className="hex-field">
          <span>Hex</span>
          <input
            value={hexDraft}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitHex();
            }}
          />
        </label>
      </div>

      {recentColors.length > 0 && (
        <div className="recent-colors" role="group" aria-label="Recent colors">
          <span>Recent</span>
          {recentColors.map((recent) => (
            <button
              key={toHex(recent)}
              type="button"
              className="swatch small"
              style={{ backgroundColor: toCss(recent) }}
              aria-label={`Recent color ${toHex(recent)}`}
              onClick={() => onColorChange(recent)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
