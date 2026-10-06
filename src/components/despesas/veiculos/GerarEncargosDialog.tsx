import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { traduzirErroDespesas } from "@/lib/despesasErros";
import {
  useGerarEncargosVeiculo, usePreviaEncargosVeiculo, Veiculo,
} from "@/hooks/useDespesasVeiculos";

const fmtData = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

interface Props {
  veiculo: Veiculo | null;
  onClose: () => void;
  onCadastrarDocumentos?: (v: Veiculo) => void;
}

/** Gera o próximo ciclo de cada documento, com prévia das datas. Sem campo de ano. */
export function GerarEncargosDialog({ veiculo, onClose, onCadastrarDocumentos }: Props) {
  const { data: previa, isLoading } = usePreviaEncargosVeiculo(veiculo?.id ?? null);
  const gerarMut = useGerarEncargosVeiculo();
  const itens = previa?.itens ?? [];
  const avisos = previa?.avisos ?? [];

  async function gerar() {
    if (!veiculo) return;
    try {
      const r = await gerarMut.mutateAsync({ veiculoId: veiculo.id });
      const ciclos = Array.from(new Set(r.itens.map((i) => i.ciclo))).join(", ");
      toast.success(`${r.criados} parcela(s) gerada(s) (ciclo ${ciclos}).`);
      onClose();
    } catch (e: any) {
      toast.error(traduzirErroDespesas(e));
    }
  }

  return (
    <AlertDialog open={!!veiculo} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Gerar encargos — {veiculo?.modelo}</AlertDialogTitle>
          <AlertDialogDescription>
            As datas vêm de cada documento. Para cada um é gerado o próximo ciclo ainda não lançado,
            com as parcelas mês a mês. Ciclos já gerados nunca são repetidos.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Calculando…</p>
        ) : itens.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            {avisos.length > 0
              ? "Nada a gerar: os próximos vencimentos ficam depois da data de venda do veículo."
              : "Este veículo não possui documentos ativos. Cadastre IPVA, licenciamento, seguro etc. na aba Documentos."}
          </div>
        ) : (
          <div className="rounded-md border p-3 space-y-1 max-h-64 overflow-y-auto text-sm">
            <p className="font-medium">{itens.length} parcela(s) serão criadas:</p>
            {itens.map((i, idx) => (
              <div key={idx} className="flex justify-between gap-2 text-muted-foreground">
                <span className="uppercase">{i.tipo} {i.ciclo} · {i.parcela}/{i.total}</span>
                <span className="text-foreground">{fmtData(i.vencimento)}</span>
              </div>
            ))}
            {avisos.map((a, idx) => (
              <p key={`a${idx}`} className="text-xs text-destructive uppercase">{a.tipo}: {a.motivo}</p>
            ))}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          {itens.length === 0 && avisos.length === 0 && onCadastrarDocumentos ? (
            <AlertDialogAction onClick={(e) => { e.preventDefault(); if (veiculo) onCadastrarDocumentos(veiculo); }}>
              Cadastrar documentos
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              disabled={itens.length === 0 || gerarMut.isPending}
              onClick={(e) => { e.preventDefault(); gerar(); }}
            >
              {gerarMut.isPending ? "Gerando…" : "Gerar"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
