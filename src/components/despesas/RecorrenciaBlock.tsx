import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RecorrenciaTipo } from "@/hooks/useDespesasRecorrencias";

export interface RecorrenciaFormState {
  ativa: boolean;
  tipo: RecorrenciaTipo;
  data_fim: string | null;
  dia_vencimento: number;
  meses_fixos: number[];
  janela_geracao_meses: number;
}

interface Props {
  value: RecorrenciaFormState;
  onChange: (v: RecorrenciaFormState) => void;
  disabled?: boolean;
}

const MESES = [
  "Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez",
];

export function RecorrenciaBlock({ value, onChange, disabled }: Props) {
  const showMeses = useMemo(
    () => value.tipo === "fixa_meses" || value.tipo === "intercalada",
    [value.tipo]
  );

  function toggleMes(m: number) {
    const has = value.meses_fixos.includes(m);
    onChange({
      ...value,
      meses_fixos: has
        ? value.meses_fixos.filter((x) => x !== m)
        : [...value.meses_fixos, m].sort((a, b) => a - b),
    });
  }

  return (
    <div className="md:col-span-2 rounded-lg border p-4 space-y-4 bg-muted/30">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label className="text-base">Repetir automaticamente</Label>
          <p className="text-xs text-muted-foreground">
            Cria uma série para gerar lançamentos futuros com base neste modelo.
          </p>
        </div>
        <Switch
          checked={value.ativa}
          onCheckedChange={(v) => onChange({ ...value, ativa: v })}
          disabled={disabled}
        />
      </div>

      {value.ativa && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Frequência</Label>
            <Select
              value={value.tipo}
              onValueChange={(v: RecorrenciaTipo) =>
                onChange({ ...value, tipo: v, meses_fixos: [] })
              }
              disabled={disabled}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal (todo mês)</SelectItem>
                <SelectItem value="anual">Anual (mesmo mês)</SelectItem>
                <SelectItem value="fixa_meses">Meses específicos</SelectItem>
                <SelectItem value="intercalada">Intercalada (meses escolhidos)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Dia do vencimento</Label>
            <Input
              type="number" min={1} max={31}
              value={value.dia_vencimento}
              onChange={(e) =>
                onChange({ ...value, dia_vencimento: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })
              }
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label>Encerrar em</Label>
            <Input
              type="date"
              value={value.data_fim ?? ""}
              onChange={(e) => onChange({ ...value, data_fim: e.target.value || null })}
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label>Antecipar (meses)</Label>
            <Input
              type="number" min={1} max={36}
              value={value.janela_geracao_meses}
              onChange={(e) =>
                onChange({ ...value, janela_geracao_meses: Math.max(1, Math.min(36, Number(e.target.value) || 12)) })
              }
              disabled={disabled}
            />
          </div>

          {showMeses && (
            <div className="md:col-span-2 space-y-2">
              <Label>Meses</Label>
              <div className="flex flex-wrap gap-2">
                {MESES.map((label, idx) => {
                  const m = idx + 1;
                  const active = value.meses_fixos.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleMes(m)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}