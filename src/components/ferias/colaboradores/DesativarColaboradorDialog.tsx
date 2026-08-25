import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";
import {
  TIPOS_DESLIGAMENTO,
  useDesativarColaborador,
  useImpactosDesligamento,
} from "@/hooks/ferias/useColaboradorVinculos";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  colaborador: {
    id: string;
    nome: string;
    data_admissao: string;
    aviso_previo_fim?: string | null;
  } | null;
}

export default function DesativarColaboradorDialog({ open, onOpenChange, colaborador }: Props) {
  const [tipo, setTipo] = useState<"desligamento" | "temporario">("desligamento");
  const [dataDemissao, setDataDemissao] = useState("");
  const [tipoDesligamento, setTipoDesligamento] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [cancelarFerias, setCancelarFerias] = useState(false);

  const desativar = useDesativarColaborador();
  const { data: impactos } = useImpactosDesligamento(
    open && tipo === "desligamento" ? colaborador?.id : null,
    dataDemissao || undefined,
  );

  useEffect(() => {
    if (!open) return;
    setTipo("desligamento");
    setDataDemissao(colaborador?.aviso_previo_fim || "");
    setTipoDesligamento("");
    setMotivo("");
    setObservacao("");
    setCancelarFerias(false);
  }, [open, colaborador]);

  if (!colaborador) return null;

  const dataInvalida =
    tipo === "desligamento" &&
    !!dataDemissao &&
    dataDemissao < colaborador.data_admissao;

  const podeSalvar =
    tipo === "temporario" ||
    (!!dataDemissao && !!tipoDesligamento && !dataInvalida);

  const temImpactos =
    !!impactos &&
    (impactos.feriasFuturas > 0 || impactos.folgasFuturas > 0 || impactos.creditosPendentes > 0);

  async function salvar() {
    try {
      await desativar.mutateAsync({
        colaboradorId: colaborador!.id,
        colaboradorNome: colaborador!.nome,
        tipo,
        dataDemissao: tipo === "desligamento" ? dataDemissao : null,
        tipoDesligamento: tipo === "desligamento" ? tipoDesligamento : null,
        motivo: motivo || null,
        observacao: observacao || null,
        cancelarFeriasFuturas: tipo === "desligamento" && cancelarFerias,
      });
      toast.success(
        tipo === "desligamento" ? "Colaborador desligado" : "Colaborador inativado temporariamente",
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao desativar colaborador");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Desativar {colaborador.nome}</DialogTitle>
          <DialogDescription>
            Informe o motivo da desativação. Desligamentos encerram o vínculo atual e ficam
            registrados no histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Motivo da desativação *</Label>
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as any)} className="gap-2">
              <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer">
                <RadioGroupItem value="desligamento" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Desligamento</p>
                  <p className="text-xs text-muted-foreground">
                    O colaborador saiu da empresa. Encerra o vínculo com data de demissão.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer">
                <RadioGroupItem value="temporario" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Inativação temporária</p>
                  <p className="text-xs text-muted-foreground">
                    Suspensão, licença longa ou outra pausa. O vínculo continua aberto.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {tipo === "desligamento" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de demissão *</Label>
                  <Input
                    type="date"
                    value={dataDemissao}
                    onChange={(e) => setDataDemissao(e.target.value)}
                  />
                  {colaborador.aviso_previo_fim && (
                    <p className="text-xs text-muted-foreground">
                      Sugestão pelo fim do aviso prévio.
                    </p>
                  )}
                  {dataInvalida && (
                    <p className="text-xs text-destructive">
                      Não pode ser anterior à admissão ({colaborador.data_admissao}).
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select value={tipoDesligamento} onValueChange={setTipoDesligamento}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_DESLIGAMENTO.map((t) => (
                        <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {temImpactos && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Pendências deste colaborador
                  </p>
                  <ul className="text-xs list-disc pl-5 space-y-1">
                    {impactos!.feriasFuturas > 0 && (
                      <li>{impactos!.feriasFuturas} férias agendadas após a demissão</li>
                    )}
                    {impactos!.folgasFuturas > 0 && (
                      <li>{impactos!.folgasFuturas} folgas agendadas após a demissão</li>
                    )}
                    {impactos!.creditosPendentes > 0 && (
                      <li>{impactos!.creditosPendentes} créditos de folga não utilizados</li>
                    )}
                  </ul>
                  {(impactos!.feriasFuturas > 0 || impactos!.folgasFuturas > 0) && (
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={cancelarFerias}
                        onCheckedChange={(c) => setCancelarFerias(!!c)}
                      />
                      Cancelar férias e folgas posteriores à demissão
                    </label>
                  )}
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label>Motivo / detalhe</Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={200}
              placeholder={tipo === "temporario" ? "Ex.: licença sem vencimento" : "Opcional"}
            />
          </div>

          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={salvar}
            disabled={!podeSalvar || desativar.isPending}
          >
            {desativar.isPending ? "Salvando…" : "Confirmar desativação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
