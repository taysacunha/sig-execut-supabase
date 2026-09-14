import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  keywords?: string[];
}

interface Props {
  options: ComboboxOption[];
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  showFullText?: boolean;
  wideContent?: boolean;
}

export function ComboboxSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione…",
  emptyText = "Nenhum resultado.",
  searchPlaceholder = "Buscar…",
  allowClear = false,
  disabled = false,
  className,
  showFullText = false,
  wideContent = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            showFullText && "h-auto min-h-10 py-2 text-left",
            className,
          )}
        >
          {selected ? (
            <span className={cn("min-w-0", showFullText ? "whitespace-normal break-words" : "truncate")}>
              {selected.label}
            </span>
          ) : (
            <span className={cn("min-w-0 text-muted-foreground", showFullText ? "whitespace-normal" : "truncate")}>
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0",
          wideContent
            ? "w-[min(32rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]"
            : "w-[--radix-popover-trigger-width]",
        )}
        align="start"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Command
          filter={(val, search) => {
            return val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-64 overflow-y-auto overscroll-contain">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value="__clear__ limpar remover"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <X className="mr-2 h-4 w-4 opacity-70" />
                  <span className="text-muted-foreground">Limpar seleção</span>
                </CommandItem>
              )}
              {options.map((opt) => {
                const searchable = [opt.label, ...(opt.keywords ?? [])].join(" ");
                return (
                  <CommandItem
                    key={opt.value}
                    value={`${searchable} ${opt.value}`}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(showFullText && "items-start py-2")}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        showFullText && "mt-0.5",
                        value === opt.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className={cn("min-w-0", showFullText ? "whitespace-normal break-words" : "truncate")}>
                      {opt.label}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}