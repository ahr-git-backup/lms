import Wheel from "@uiw/react-color-wheel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { hsvaToHex, hexToHsva } from "@uiw/color-convert";
import { useState } from "react";

interface ColorWheelPickerProps {
  color: string;
  onChange: (hex: string) => void;
  label?: string;
}

export function ColorWheelPicker({ color, onChange, label }: ColorWheelPickerProps) {
  const [hsva, setHsva] = useState(() => hexToHsva(color));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label || "Pick color"}
          className="h-9 w-9 rounded-full border-2 border-border shadow-sm shrink-0"
          style={{ backgroundColor: color }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 flex flex-col items-center gap-2">
        <Wheel
          color={hsva}
          onChange={(c) => {
            setHsva(c.hsva);
            onChange(hsvaToHex(c.hsva));
          }}
        />
        <span className="text-xs font-mono text-muted-foreground">{color}</span>
      </PopoverContent>
    </Popover>
  );
}
