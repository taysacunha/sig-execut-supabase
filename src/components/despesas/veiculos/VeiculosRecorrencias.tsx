import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw } from "lucide-react";
import {
  useVeiculosDocumentosAtivos, useGerarEncargosVeiculo, Veiculo, VeiculoDocumento,
} from "@/hooks/useDespesasVeiculos";
import { useDespesasValues } from "@/contexts/DespesasValuesContext";

interface Props {
  veiculos: Veiculo[];
  canEdit: boolean;
}

interface Linha {
  veiculo: Veiculo;
  doc: VeiculoDocumento;
}

const fmtData = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

export function VeiculosRecorrencias({ veiculos, canEdit }: Props) {
  const { data: docsPorVeiculo = {} } = useVeiculosDocumentosAtivos();
  const gerarMut = useGerarEncargosVeiculo();
  const { formatValue } = useDespesasValues();

  const [confirmGerar, setConfirmGerar] = useState<Linha | null>(null);
  const [ano, setAno] = useState(new Date().getFullYear());

  const linhas = useMemo<Linha[]>(() => {
    const out: Linha[] = [];
    for (const v of veiculos) {
      for (const doc of docsPorVeiculo[v.id] ?? []) out.push({ veiculo: v, doc });
    }
    return out.sort(
      (a, b) =>
        a.veiculo.modelo.localeCompare(b.veiculo.modelo) || a.doc.tipo.localeCompare(b.doc.tipo),
    );
  }, [veiculos, docsPorVeiculo]);

  function gerar() {
    if (!confirmGerar) return;
    gerarMut.mutate(
      { veiculoId: confirmGerar.veiculo.id, ano },
      {
        onSuccess: (n) => {
          if (n > 0) toast.success(`${n} lançamento(s) gerado(s) para ${ano}`);
          else toast.info(`Nenhum lançamento novo: os encargos de ${ano} já foram gerados.`);
          setConfirmGerar(null);
        },
        onError: (e: any) => toast.error(traduzirErroDespesas(e)),

      },
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Encargos recorrentes da frota</CardTitle>
          <CardDescription>
            Documentos ativos que se repetem todo ano (IPVA, licenciamento, seguro etc.). Gere as
            parcelas do ano desejado para que apareçam no calendário.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linhas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum encargo recorrente cadastrado. Abra um veículo e cadastre os documentos.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Encargo</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>1º vencimento</TableHead>
                  {canEdit && <TableHead className="text-right w-40">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map(({ veiculo, doc }) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      {veiculo.modelo}{veiculo.placa ? ` (${veiculo.placa})` : ""}
                    </TableCell>
                    <TableCell className="uppercase">{doc.tipo}</TableCell>
                    <TableCell><Badge variant="secondary">Anual</Badge></TableCell>
                    <TableCell className="text-right">{formatValue(Number(doc.valor ?? 0))}</TableCell>
                    <TableCell>{doc.parcelas}x</TableCell>
                    <TableCell>{fmtData(doc.vencimento_primeira_parcela)}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!veiculo.centro_custo_id}
                          title={
                            veiculo.centro_custo_id
                              ? "Gerar parcelas do ano"
                              : "Defina o centro de custo do veículo"
                          }
                          onClick={() => {
                            setConfirmGerar({ veiculo, doc });
                            setAno(new Date().getFullYear());
                          }}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />Gerar ano
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmGerar} onOpenChange={(o) => !o && setConfirmGerar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar encargos do ano</AlertDialogTitle>
            <AlertDialogDescription>
              Serão criadas as parcelas de todos os documentos ativos de{" "}
              <b>{confirmGerar?.veiculo.modelo}</b>. Lançamentos já existentes não são duplicados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Ano</Label>
            <Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={gerarMut.isPending}
              onClick={(e) => { e.preventDefault(); gerar(); }}
            >
              {gerarMut.isPending ? "Gerando…" : "Gerar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
