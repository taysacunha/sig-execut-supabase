import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search } from "lucide-react";
import { useVeiculosDocumentosAtivos, Veiculo, VeiculoDocumento } from "@/hooks/useDespesasVeiculos";
import { GerarEncargosDialog } from "./GerarEncargosDialog";
import { normalizeText } from "@/lib/textUtils";

interface Props { veiculos: Veiculo[]; canEdit: boolean; }
interface Linha { veiculo: Veiculo; doc: VeiculoDocumento; }

const fmtData = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

export function VeiculosRecorrencias({ veiculos, canEdit }: Props) {
  const { data: docsPorVeiculo = {} } = useVeiculosDocumentosAtivos();
  const [gerar, setGerar] = useState<Veiculo | null>(null);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [situacao, setSituacao] = useState<"ativos" | "vendidos" | "todos">("ativos");

  const linhas = useMemo<Linha[]>(() => {
    const out: Linha[] = [];
    for (const v of veiculos) for (const doc of docsPorVeiculo[v.id] ?? []) out.push({ veiculo: v, doc });
    return out.sort((a, b) => a.veiculo.modelo.localeCompare(b.veiculo.modelo) || a.doc.tipo.localeCompare(b.doc.tipo));
  }, [veiculos, docsPorVeiculo]);

  const tipos = useMemo(() => Array.from(new Set(linhas.map((l) => l.doc.tipo))).sort(), [linhas]);

  const filtradas = useMemo(() => {
    const q = normalizeText(busca.trim());
    return linhas.filter(({ veiculo, doc }) => {
      if (tipo !== "todos" && doc.tipo !== tipo) return false;
      if (situacao === "ativos" && veiculo.data_venda) return false;
      if (situacao === "vendidos" && !veiculo.data_venda) return false;
      if (q && !normalizeText(`${veiculo.modelo} ${veiculo.placa ?? ""} ${doc.tipo} ${doc.descricao ?? ""}`).includes(q)) return false;
      return true;
    });
  }, [linhas, busca, tipo, situacao]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Encargos recorrentes da frota</CardTitle>
          <CardDescription>
            Documentos que se repetem todo ano. "Gerar" cria o próximo ciclo ainda não lançado, nas datas de cada documento.
          </CardDescription>
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar veículo, placa, encargo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os encargos</SelectItem>
                {tipos.map((t) => <SelectItem key={t} value={t} className="uppercase">{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={situacao} onValueChange={(v) => setSituacao(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativos">Veículos ativos</SelectItem>
                <SelectItem value="vendidos">Veículos vendidos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum encargo encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Encargo</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>1º vencimento</TableHead>
                  {canEdit && <TableHead className="text-right w-36">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map(({ veiculo, doc }) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{veiculo.modelo}{veiculo.placa ? ` (${veiculo.placa})` : ""}</TableCell>
                    <TableCell className="uppercase">{doc.tipo}</TableCell>
                    <TableCell><Badge variant="secondary">Anual</Badge></TableCell>
                    <TableCell>{doc.parcelas}x</TableCell>
                    <TableCell>{fmtData(doc.vencimento_primeira_parcela)}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button
                          size="sm" variant="outline"
                          disabled={!veiculo.centro_custo_id || !!veiculo.data_venda}
                          title={veiculo.centro_custo_id ? "Gerar próximo ciclo" : "Defina o centro de custo do veículo"}
                          onClick={() => setGerar(veiculo)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />Gerar
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
      <GerarEncargosDialog veiculo={gerar} onClose={() => setGerar(null)} />
    </div>
  );
}
