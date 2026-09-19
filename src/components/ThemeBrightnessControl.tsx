import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";

const BRIGHTNESS_STORAGE_KEY = "app_brightness_level";
const DEFAULT_BRIGHTNESS = 100;

/**
 * Applies a CSS filter: brightness(...) to the whole document so the
 * effect is visible on every page immediately, and persists across
 * reloads via localStorage.
 */
const applyBrightness = (value: number) => {
  document.documentElement.style.filter = value === 100 ? "" : `brightness(${value}%)`;
};

export const ThemeBrightnessControl = () => {
  const { theme, setTheme } = useTheme();
  const [brightness, setBrightness] = useState(DEFAULT_BRIGHTNESS);

  // Load saved brightness on mount and apply it immediately.
  useEffect(() => {
    const stored = localStorage.getItem(BRIGHTNESS_STORAGE_KEY);
    const value = stored ? parseInt(stored, 10) : DEFAULT_BRIGHTNESS;
    setBrightness(value);
    applyBrightness(value);
  }, []);

  const handleBrightnessChange = (values: number[]) => {
    const value = values[0];
    setBrightness(value);
    applyBrightness(value);
    localStorage.setItem(BRIGHTNESS_STORAGE_KEY, String(value));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 h-8 w-8 sm:h-9 sm:w-9"
          aria-label="Theme & brightness settings"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">মোড</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-3.5 w-3.5" /> Light
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5" /> Dark
              </>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">উজ্জ্বলতা</span>
            <span className="text-xs text-muted-foreground">{brightness}%</span>
          </div>
          <Slider
            min={40}
            max={100}
            step={1}
            value={[brightness]}
            onValueChange={handleBrightnessChange}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ThemeBrightnessControl;
