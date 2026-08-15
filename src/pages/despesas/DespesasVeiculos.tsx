import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
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
import { Plus, Pencil, Trash2, ShieldAlert, CalendarClock, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VeiculosCalendario } from "@/components/despesas/veiculos/VeiculosCalendario";
import { VeiculosRecorrencias } from "@/components/despesas/veiculos/VeiculosRecorrencias";
import {
  useVeiculos, useDeleteVeiculo, useGerarEncargosVeiculo, useVeiculosDocumentosAtivos, Veiculo,
} from "@/hooks/useDespesasVeiculos";
import { VeiculoDialog } from "@/components/despesas/VeiculoDialog";
import { useDespesasValues } from "@/contexts/DespesasValuesContext";

export default function DespesasVeiculos() {
  const { podeVer, podeEditar, podeExcluir } = useDespesasPermissions();
  const canView = podeVer("veiculos");
  const canEdit = podeEditar("veiculos");
  const canDelete = podeExcluir("veiculos");

  const { data: veiculos = [], isLoading } = useVeiculos();
  const { data: docsPorVeiculo = {} } = useVeiculosDocumentosAtivos();
  const delMut = useDeleteVeiculo();
  const gerarMut = useGerarEncargosVeiculo();

  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Veiculo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Veiculo | null>(null);
  const [confirmGerar, setConfirmGerar] = useState<Veiculo | null>(null);
  const [ano, setAno] = useState<number>(new Date().getFullYear());

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return veiculos;
    return veiculos.filter((v) =>
      [v.modelo, v.placa, v.motorista?.nome, v.proprietario?.nome, v.centro_custo?.nome]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(q)),
    );
  }, [veiculos, busca]);

  const docsDoGerar = confirmGerar ? (docsPorVeiculo[confirmGerar.id] ?? []) : [];
  const totalEstimado = docsDoGerar.reduce((s, d) => s + Number(d.valor ?? 0), 0);
  const parcelasEstimadas = docsDoGerar.reduce((s, d) => s + Number(d.parcelas ?? 1), 0);
  const { formatValue } = useDespesasValues();
  const fmtMoeda = (v: number) => formatValue(v);

  async function gerar() {
    if (!confirmGerar) return;
    const qtdDocs = docsDoGerar.length;
    try {
      const n = await gerarMut.mutateAsync({ veiculoId: confirmGerar.id, ano });
      if (n > 0) {
        toast.success(`${n} lançamento(s) gerado(s) para ${ano}`);
      } else if (qtdDocs === 0) {
        toast.warning(
          "Este veículo não possui documentos ativos. Cadastre IPVA, seguro etc. na aba Documentos do veículo.",
        );
      } else {
        toast.info(`Nenhum lançamento novo: os encargos de ${ano} já foram gerados.`);
      }
      setConfirmGerar(null);
    } catch (e: any) {
      const msg = /centro de custo/i.test(e?.message ?? "")
        ? "Defina o centro de custo do veículo antes de gerar encargos."
        : (e?.message ?? "Erro");
      toast.error(msg);
    }
  }

  if (!canView) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <CardTitle>Sem acesso</CardTitle>
          <CardDescription>Você não tem permissão para visualizar veículos.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Veículos</h1>
          <p className="text-muted-foreground">
            Frota, motorista, documentos (IPVA, seguro etc) e baixa por venda.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Novo veículo
          </Button>
        )}
      </div>

      <Tabs defaultValue="frota" className="space-y-4">
        <TabsList>
          <TabsTrigger value="frota">Veículos</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="recorrencias">Recorrências</TabsTrigger>
        </TabsList>

        <TabsContent value="frota">
      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por modelo, placa, motorista…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum veículo encontrado.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Centro de custo</TableHead>
                <TableHead>Documentos ativos</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right w-40">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtrados.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.modelo}</TableCell>
                    <TableCell>{v.placa ?? "—"}</TableCell>
                    <TableCell>{v.motorista?.nome ?? "—"}</TableCell>
                    <TableCell>{v.proprietario?.nome ?? "—"}</TableCell>
                    <TableCell>{v.centro_custo?.nome ?? "—"}</TableCell>
                    <TableCell>
                      {(docsPorVeiculo[v.id]?.length ?? 0) === 0 ? (
                        <span className="text-muted-foreground">Nenhum</span>
                      ) : (
                        <Badge variant="secondary">{docsPorVeiculo[v.id].length}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{v.data_venda ? "Vendido" : "Ativo"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {canEdit && !v.data_venda && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title={v.centro_custo_id ? "Gerar encargos" : "Defina o centro de custo para gerar encargos"}
                          disabled={!v.centro_custo_id}
                          onClick={() => { setConfirmGerar(v); setAno(new Date().getFullYear()); }}
                        >
                          <CalendarClock className="h-4 w-4" />
                        </Button>
                      )}
                      {canEdit && (
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(v); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(v)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="calendario">
          <VeiculosCalendario veiculos={veiculos} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="recorrencias">
          <VeiculosRecorrencias veiculos={veiculos} canEdit={canEdit} />
        </TabsContent>
      </Tabs>

      <VeiculoDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar veículo?</AlertDialogTitle>
            <AlertDialogDescription>
              O veículo <b>{confirmDelete?.modelo}</b> será marcado como inativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) delMut.mutate(confirmDelete.id, {
                  onSuccess: () => { toast.success("Veículo desativado"); setConfirmDelete(null); },
                  onError: (err: any) => toast.error(err?.message ?? "Erro"),
                });
              }}
            >Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmGerar} onOpenChange={(o) => !o && setConfirmGerar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar encargos do veículo</AlertDialogTitle>
            <AlertDialogDescription>
              Cria lançamentos parcelados no calendário para <b>{confirmGerar?.modelo}</b>, a partir dos
              documentos ativos cadastrados na aba <b>Documentos</b> do veículo.
            </AlertDialogDescription>
          </AlertDialogHeader>
            <div className="py-2 space-y-2">
              <Label>Ano</Label>
              <Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
            </div>
            {docsDoGerar.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Este veículo não possui documentos ativos — nada seria gerado. Abra o veículo e cadastre
                IPVA, licenciamento, seguro etc. na aba <b>Documentos</b>.
              </div>
            ) : (
              <div className="rounded-md border p-3 space-y-2 max-h-56 overflow-y-auto">
                <p className="text-sm font-medium">
                  {docsDoGerar.length} documento(s) ativo(s) · {parcelasEstimadas} parcela(s) · total estimado{" "}
                  {fmtMoeda(totalEstimado)}
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {docsDoGerar.map((d) => (
                    <li key={d.id}>
                      <span className="uppercase">{d.tipo}</span> — {fmtMoeda(Number(d.valor ?? 0))} em {d.parcelas}x ·
                      1º venc. {new Date(d.vencimento_primeira_parcela + "T00:00:00").toLocaleDateString("pt-BR")}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Lançamentos já existentes para {ano} não são duplicados.
                </p>
              </div>
            )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {docsDoGerar.length === 0 ? (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  const v = confirmGerar;
                  setConfirmGerar(null);
                  setEditing(v);
                  setDialogOpen(true);
                }}
              >
                Cadastrar documentos
              </AlertDialogAction>
            ) : (
              <AlertDialogAction onClick={(e) => { e.preventDefault(); gerar(); }} disabled={gerarMut.isPending}>
                {gerarMut.isPending ? "Gerando…" : "Gerar"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
