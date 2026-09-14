import Wheel from "@uiw/react-color-wheel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { hsvaToHex, hexToHsva, hsvaToHexa, hexToRgba, rgbaToHsva } from "@uiw/color-convert";
import { useState } from "react";

interface ColorWheelPickerProps {
  color: string;
  onChange: (hex: string) => void;
  label?: string;
}

/** Quick-pick swatches shown above the wheel — common colors that are
    otherwise fiddly to land on exactly by dragging the wheel. */
const PRESET_COLORS = [
  "#000000", // black
  "#ffffff", // white
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#1e293b", // slate (default box bg)
  "#38bdf8", // sky (default neon border)
];

/** Parses either a 6-digit hex or an 8-digit hex-with-alpha string into an
    hsva object so both plain colors and previously-saved semi-transparent
    colors load correctly into the wheel + opacity slider. */
const toHsva = (color: string) => {
  if (!color) return hexToHsva("#000000");
  const clean = color.trim();
  if (/^#?[0-9a-fA-F]{8}$/.test(clean)) {
    return rgbaToHsva(hexToRgba(clean.startsWith("#") ? clean : `#${clean}`));
  }
  try {
    return hexToHsva(clean);
  } catch {
    return hexToHsva("#000000");
  }
};

export function ColorWheelPicker({ color, onChange, label }: ColorWheelPickerProps) {
  const [hsva, setHsva] = useState(() => toHsva(color));

  const applyHsva = (next: typeof hsva) => {
    setHsva(next);
    // Emit 8-digit hex (with alpha) when opacity < 100%, otherwise plain 6-digit hex
    onChange(next.a < 1 ? hsvaToHexa(next) : hsvaToHex(next));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label || "Pick color"}
          className="h-9 w-9 rounded-full border-2 border-border shadow-sm shrink-0"
          style={{
            backgroundColor: color,
            backgroundImage:
              "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
          }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 flex flex-col items-center gap-3">
        {/* Preset swatches */}
        <div className="grid grid-cols-6 gap-1.5">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyHsva({ ...hexToHsva(preset), a: hsva.a })}
              className="h-6 w-6 rounded-full border-2 border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: preset }}
              aria-label={preset}
            />
          ))}
        </div>

        <Wheel color={hsva} onChange={(c) => applyHsva({ ...c.hsva, a: hsva.a })} />

        {/* Opacity slider */}
        <div className="w-full flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground shrink-0">Opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(hsva.a * 100)}
            onChange={(e) => applyHsva({ ...hsva, a: Number(e.target.value) / 100 })}
            className="flex-1 h-2"
          />
          <span className="text-[10px] w-9 text-right text-muted-foreground">{Math.round(hsva.a * 100)}%</span>
        </div>

        <span className="text-xs font-mono text-muted-foreground">{color}</span>
      </PopoverContent>
    </Popover>
  );
}
