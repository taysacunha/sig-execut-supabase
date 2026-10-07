import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ShieldAlert, CalendarClock, Search, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VeiculosCalendario } from "@/components/despesas/veiculos/VeiculosCalendario";
import { VeiculosRecorrencias } from "@/components/despesas/veiculos/VeiculosRecorrencias";
import { GerarEncargosDialog } from "@/components/despesas/veiculos/GerarEncargosDialog";
import { VerVeiculoDialog } from "@/components/despesas/veiculos/VerVeiculoDialog";
import { useVeiculos, useDeleteVeiculo, useVeiculosDocumentosAtivos, Veiculo } from "@/hooks/useDespesasVeiculos";
import { VeiculoDialog } from "@/components/despesas/VeiculoDialog";

export default function DespesasVeiculos() {
  const { podeVer, podeEditar, podeExcluir } = useDespesasPermissions();
  const canView = podeVer("veiculos");
  const canEdit = podeEditar("veiculos");
  const canDelete = podeExcluir("veiculos");

  const { data: veiculos = [], isLoading } = useVeiculos();
  const { data: docsPorVeiculo = {} } = useVeiculosDocumentosAtivos();
  const delMut = useDeleteVeiculo();

  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<"ativos" | "vendidos">("ativos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Veiculo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Veiculo | null>(null);
  const [gerar, setGerar] = useState<Veiculo | null>(null);
  const [ver, setVer] = useState<Veiculo | null>(null);

  const qtdAtivos = veiculos.filter((v) => !v.data_venda).length;
  const qtdVendidos = veiculos.length - qtdAtivos;

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return veiculos
      .filter((v) => (situacao === "vendidos" ? !!v.data_venda : !v.data_venda))
      .filter((v) => !q || [v.modelo, v.placa, v.motorista?.nome, v.proprietario?.nome, v.centro_custo?.nome]
        .filter(Boolean).some((t) => String(t).toLowerCase().includes(q)));
  }, [veiculos, busca, situacao]);

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
          <p className="text-muted-foreground">Frota, documentos (IPVA, seguro etc.), vencimentos e baixas.</p>
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
            <CardHeader className="pb-3 flex flex-row flex-wrap items-center gap-3 space-y-0">
              <Tabs value={situacao} onValueChange={(v) => setSituacao(v as any)}>
                <TabsList>
                  <TabsTrigger value="ativos">Ativos ({qtdAtivos})</TabsTrigger>
                  <TabsTrigger value="vendidos">Vendidos ({qtdVendidos})</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar por modelo, placa, motorista…" value={busca} onChange={(e) => setBusca(e.target.value)} />
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
                    {situacao === "vendidos" && <TableHead>Vendido em</TableHead>}
                    <TableHead className="text-right w-44">Ações</TableHead>
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
                          {(docsPorVeiculo[v.id]?.length ?? 0) === 0
                            ? <span className="text-muted-foreground">Nenhum</span>
                            : <Badge variant="secondary">{docsPorVeiculo[v.id].length}</Badge>}
                        </TableCell>
                        {situacao === "vendidos" && (
                          <TableCell>{v.data_venda ? new Date(v.data_venda + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</TableCell>
                        )}
                        <TableCell className="text-right space-x-1">
                          <Button size="icon" variant="ghost" title="Ver dados" onClick={() => setVer(v)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEdit && !v.data_venda && (
                            <Button
                              size="icon" variant="ghost"
                              title={v.centro_custo_id ? "Gerar encargos" : "Defina o centro de custo para gerar encargos"}
                              disabled={!v.centro_custo_id}
                              onClick={() => setGerar(v)}
                            >
                              <CalendarClock className="h-4 w-4" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button size="icon" variant="ghost" title="Editar" onClick={() => { setEditing(v); setDialogOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button size="icon" variant="ghost" title="Desativar" onClick={() => setConfirmDelete(v)}>
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
          <VeiculosCalendario veiculos={veiculos} canEdit={canEdit} canDelete={canDelete} />
        </TabsContent>

        <TabsContent value="recorrencias">
          <VeiculosRecorrencias veiculos={veiculos} canEdit={canEdit} />
        </TabsContent>
      </Tabs>

      <VeiculoDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <VerVeiculoDialog veiculo={ver} onClose={() => setVer(null)} />
      <GerarEncargosDialog
        veiculo={gerar}
        onClose={() => setGerar(null)}
        onCadastrarDocumentos={(v) => { setGerar(null); setEditing(v); setDialogOpen(true); }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar veículo?</AlertDialogTitle>
            <AlertDialogDescription>O veículo <b>{confirmDelete?.modelo}</b> será marcado como inativo.</AlertDialogDescription>
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
    </div>
  );
}
