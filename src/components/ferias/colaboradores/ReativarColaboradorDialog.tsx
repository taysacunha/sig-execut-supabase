import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useReativarColaborador } from "@/hooks/ferias/useColaboradorVinculos";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  colaborador: {
    id: string;
    nome: string;
    motivo_inativacao?: string | null;
    data_demissao?: string | null;
  } | null;
}

export default function ReativarColaboradorDialog({ open, onOpenChange, colaborador }: Props) {
  const [novaAdmissao, setNovaAdmissao] = useState("");
  const [observacao, setObservacao] = useState("");
  const reativar = useReativarColaborador();

  const eraDesligamento =
    colaborador?.motivo_inativacao === "desligamento" || !!colaborador?.data_demissao;

  useEffect(() => {
    if (!open) return;
    setNovaAdmissao("");
    setObservacao("");
  }, [open, colaborador]);

  if (!colaborador) return null;

  const dataInvalida =
    eraDesligamento &&
    !!novaAdmissao &&
    !!colaborador.data_demissao &&
    novaAdmissao <= colaborador.data_demissao;

  const podeSalvar = !eraDesligamento || (!!novaAdmissao && !dataInvalida);

  async function salvar() {
    try {
      await reativar.mutateAsync({
        colaboradorId: colaborador!.id,
        colaboradorNome: colaborador!.nome,
        eraDesligamento,
        novaDataAdmissao: eraDesligamento ? novaAdmissao : null,
        observacao: observacao || null,
      });
      toast.success(eraDesligamento ? "Colaborador recontratado" : "Colaborador reativado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao reativar colaborador");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reativar {colaborador.nome}</DialogTitle>
          <DialogDescription>
            {eraDesligamento
              ? "Este colaborador foi desligado. Informe a nova data de admissão para abrir um novo vínculo (recontratação)."
              : "A inativação foi temporária. O vínculo e a data de admissão originais serão mantidos."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {eraDesligamento && (
            <div className="space-y-2">
              <Label>Nova data de admissão *</Label>
              <Input
                type="date"
                value={novaAdmissao}
                onChange={(e) => setNovaAdmissao(e.target.value)}
              />
              {colaborador.data_demissao && (
                <p className="text-xs text-muted-foreground">
                  Demissão anterior em {colaborador.data_demissao}.
                </p>
              )}
              {dataInvalida && (
                <p className="text-xs text-destructive">
                  A nova admissão deve ser posterior à demissão anterior.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                O período aquisitivo passa a contar a partir desta data; o vínculo anterior
                permanece no histórico.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!podeSalvar || reativar.isPending}>
            {reativar.isPending ? "Salvando…" : "Confirmar reativação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
