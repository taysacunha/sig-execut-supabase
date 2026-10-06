import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useVeiculoDocumentos, Veiculo } from "@/hooks/useDespesasVeiculos";
import { useLancamentos } from "@/hooks/useDespesasLancamentos";

const fmt = (d?: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

/** Ficha somente leitura do veículo, documentos e próximos vencimentos. */
export function VerVeiculoDialog({ veiculo, onClose }: { veiculo: Veiculo | null; onClose: () => void }) {
  const { data: docs = [] } = useVeiculoDocumentos(veiculo?.id ?? null);
  const { data: lancs = [] } = useLancamentos({
    veiculoId: veiculo?.id ?? "00000000-0000-0000-0000-000000000000",
    somenteVeiculos: true,
  });
  const proximos = lancs.filter((l) => l.status === "a_vencer" || l.status === "vencido").slice(0, 12);

  const campo = (l: string, v?: string | null) => (
    <div><div className="text-xs text-muted-foreground">{l}</div><div className="font-medium">{v || "—"}</div></div>
  );

  return (
    <Dialog open={!!veiculo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{veiculo?.modelo}{veiculo?.placa ? ` (${veiculo.placa})` : ""}</DialogTitle></DialogHeader>
        {veiculo && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              {campo("Motorista", veiculo.motorista?.nome)}
              {campo("Proprietário", veiculo.proprietario?.nome)}
              {campo("Centro de custo", veiculo.centro_custo?.nome)}
              {campo("Aquisição", fmt(veiculo.data_aquisicao))}
              {campo("Venda", fmt(veiculo.data_venda))}
              {campo("Nota fiscal", veiculo.nota_fiscal)}
            </div>
            {veiculo.observacao && <p className="text-sm text-muted-foreground">{veiculo.observacao}</p>}

            <div>
              <h4 className="font-semibold mb-2">Documentos</h4>
              {docs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum documento cadastrado.</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Tipo</TableHead><TableHead>Descrição</TableHead>
                    <TableHead>Parcelas</TableHead><TableHead>1º vencimento</TableHead><TableHead>Situação</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {docs.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="uppercase">{d.tipo}</TableCell>
                        <TableCell>{d.descricao || "—"}</TableCell>
                        <TableCell>{d.parcelas}x</TableCell>
                        <TableCell>{fmt(d.vencimento_primeira_parcela)}</TableCell>
                        <TableCell><Badge variant={d.ativo ? "default" : "outline"}>{d.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div>
              <h4 className="font-semibold mb-2">Próximos vencimentos lançados</h4>
              {proximos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum encargo em aberto.</p> : (
                <ul className="text-sm space-y-1">
                  {proximos.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span>{l.descricao}</span><span className="font-medium">{fmt(l.data_vencimento)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
