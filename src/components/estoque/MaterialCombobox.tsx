import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { normalizeText } from "@/lib/textUtils";

interface MaterialOption {
  id: string;
  nome: string;
}

interface MaterialComboboxProps {
  materiais: MaterialOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

/**
 * Select de material com busca acento-insensível (case + diacríticos).
 * Substitui Selects longos onde o usuário precisava rolar para encontrar itens.
 */
export function MaterialCombobox({
  materiais,
  value,
  onChange,
  placeholder = "Selecione...",
  disabled,
  emptyMessage = "Nenhum material encontrado.",
}: MaterialComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = materiais.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-left">
            {selected ? selected.nome : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const v = normalizeText(itemValue);
            const s = normalizeText(search);
            return v.includes(s) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar material..." />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {materiais.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.nome}
                  onSelect={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === m.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {m.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}