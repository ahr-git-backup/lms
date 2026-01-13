import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type Option = {
  label: string;
  value: string;
};

interface CreatableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  onCreate?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CreatableSelect({
  options,
  value,
  onChange,
  onCreate,
  placeholder = "Select item...",
  className,
}: CreatableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between px-3 py-2 h-auto min-h-10", className)}
        >
          {value
            ? options.find((option) => option.value === value)?.label || value
            : <span className="text-muted-foreground font-normal">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder={placeholder}
            onValueChange={(val) => setInputValue(val)}
          />
          <CommandList>
              <CommandEmpty className="py-2 px-2">
                {onCreate && inputValue.trim().length > 0 ? (
                    <div
                        className="flex items-center gap-2 p-2 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onClick={() => {
                            onCreate(inputValue.trim());
                            onChange(inputValue.trim());
                            setInputValue("");
                            setOpen(false);
                        }}
                    >
                        <Plus className="h-4 w-4" />
                        Create "{inputValue}"
                    </div>
                ) : (
                   <span className="text-muted-foreground text-sm block py-4 text-center">No item found.</span>
                )}
              </CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={(currentValue) => {
                      // If the onSelect value matches an existing option value, select it.
                      // Note: cmdk lowercases values. We should match robustly.
                      // But here we rely on option.value passed to key/value.
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
