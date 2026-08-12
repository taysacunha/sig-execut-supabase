import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  LancamentoInput, STATUS_NAO_PROPAGAVEL, useParcelasFuturasSerie,
  usePropagarAlteracoes,
} from "@/hooks/useDespesasLancamentos";

export interface DiffItem {
  campo: keyof LancamentoInput;
  label: string;
  de: string;
  para: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  serieId: string | null;
  dataVencimento: string | null;
  diff: DiffItem[];
  patch: Partial<LancamentoInput>;
  onAtualizarSerie?: (patch: Partial<LancamentoInput>) => Promise<void>;
  onDone: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  pago: "Pago",
  pago_parcial: "Pago parcial",
  cancelado: "Cancelado",
  quitado: "Quitado",
  gimob: "GIMOB",
  a_vencer: "A vencer",
  vencido: "Vencido",
};

function fmtData(d: string) {
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}

function fmtValor(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PropagarRecorrenciaDialog({
  open, onOpenChange, serieId, dataVencimento, diff, patch, onAtualizarSerie, onDone,
}: Props) {
  const parcelas = useParcelasFuturasSerie(serieId, dataVencimento, open);
  const propagar = usePropagarAlteracoes();
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [atualizarSerie, setAtualizarSerie] = useState(true);

  const elegiveis = useMemo(
    () => (parcelas.data ?? []).filter((p) => !STATUS_NAO_PROPAGAVEL.includes(p.status)),
    [parcelas.data],
  );

  useEffect(() => {
    if (!open) return;
    const init: Record<string, boolean> = {};
    elegiveis.forEach((p) => { init[p.id] = true; });
    setSelecionados(init);
  }, [open, elegiveis]);

  const totalSelecionado = Object.values(selecionados).filter(Boolean).length;
  const todosMarcados = elegiveis.length > 0 && totalSelecionado === elegiveis.length;

  function marcarTodos(v: boolean) {
    const next: Record<string, boolean> = {};
    elegiveis.forEach((p) => { next[p.id] = v; });
    setSelecionados(next);
  }

  async function aplicar() {
    try {
      const ids = Object.entries(selecionados).filter(([, v]) => v).map(([k]) => k);
      const n = await propagar.mutateAsync({ ids, patch });
      if (atualizarSerie && onAtualizarSerie) await onAtualizarSerie(patch);
      toast.success(
        n === 0
          ? "Nenhuma parcela futura atualizada"
          : `${n} parcela(s) futura(s) atualizada(s)`,
      );
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao aplicar alterações nas parcelas futuras");
    }
  }

  function somenteEste() {
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aplicar às próximas parcelas?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-sm font-medium">O que mudou</p>
            {diff.map((d) => (
              <p key={String(d.campo)} className="text-xs text-muted-foreground">
                <span className="text-foreground">{d.label}:</span> {d.de} → {d.para}
              </p>
            ))}
          </div>

          {parcelas.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando parcelas futuras…</p>
          ) : (parcelas.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Não há parcelas futuras desta recorrência.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  Encontramos {elegiveis.length} parcela(s) futura(s) desta recorrência.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => marcarTodos(!todosMarcados)}
                  disabled={!elegiveis.length}
                >
                  {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
                </Button>
              </div>

              <div className="max-h-[45vh] overflow-y-auto rounded-md border divide-y">
                {(parcelas.data ?? []).map((p) => {
                  const bloqueada = STATUS_NAO_PROPAGAVEL.includes(p.status);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 p-2 text-sm ${
                        bloqueada ? "opacity-60" : "cursor-pointer hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={!!selecionados[p.id]}
                        disabled={bloqueada}
                        onCheckedChange={(v) =>
                          setSelecionados((s) => ({ ...s, [p.id]: !!v }))
                        }
                      />
                      <span className="w-24 shrink-0">{fmtData(p.data_vencimento)}</span>
                      <span className="flex-1 truncate">{p.descricao}</span>
                      <span className="w-28 text-right shrink-0">{fmtValor(p.valor_total)}</span>
                      {bloqueada && (
                        <Badge variant="secondary" className="shrink-0">
                          {STATUS_LABEL[p.status] ?? p.status}
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>

              {onAtualizarSerie && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={atualizarSerie}
                    onCheckedChange={(v) => setAtualizarSerie(!!v)}
                  />
                  Atualizar também o modelo da série (próximas ocorrências geradas)
                </label>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={somenteEste}>Aplicar somente neste</Button>
          <Button
            onClick={aplicar}
            disabled={propagar.isPending || (!totalSelecionado && !atualizarSerie)}
          >
            {propagar.isPending
              ? "Aplicando…"
              : `Aplicar nos selecionados (${totalSelecionado})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}