import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
import { ShieldAlert, Plus, Pencil, Trash2, CalendarClock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useImoveis, useDeleteImovel, useGerarEncargosImovel,
  Imovel, ImovelFiltros,
} from "@/hooks/useDespesasImoveis";
import { useDespesasLookups } from "@/hooks/useDespesasLancamentos";
import { ImovelDialog } from "@/components/despesas/ImovelDialog";

const situacaoLabel: Record<string, string> = {
  alugado: "Alugado", vago: "Desocupado", vendido: "Vendido", proprio_uso: "Uso próprio", em_aquisicao: "Em aquisição",
};

function money(n: number | null | undefined) {
  return `R$ ${Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function DespesasImoveis() {
  const { podeVer, podeEditar, podeExcluir } = useDespesasPermissions();
  const { centros, pessoas } = useDespesasLookups();
  const [filtros, setFiltros] = useState<ImovelFiltros>({});
  const { data: imoveis = [], isLoading } = useImoveis(filtros);
  const delMut = useDeleteImovel();
  const gerarMut = useGerarEncargosImovel();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Imovel | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Imovel | null>(null);
  const [confirmGerar, setConfirmGerar] = useState<Imovel | null>(null);
  const [anoGerar, setAnoGerar] = useState<number>(new Date().getFullYear());

  const kpis = useMemo(() => {
    const total = imoveis.length;
    const alugados = imoveis.filter((i) => i.situacao === "alugado").length;
    const vagos = imoveis.filter((i) => i.situacao === "vago").length;
    const vendidos = imoveis.filter((i) => i.situacao === "vendido").length;
    const receita = imoveis
      .filter((i) => i.situacao === "alugado")
      .reduce((s, i) => s + Number(i.valor_aluguel ?? 0), 0);
    return { total, alugados, vagos, vendidos, receita };
  }, [imoveis]);

  if (!podeVer("imoveis")) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <CardTitle>Sem acesso</CardTitle>
          <CardDescription>Você não tem permissão para visualizar esta aba.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (i: Imovel) => { setEditing(i); setDialogOpen(true); };

  async function gerarEncargos() {
    if (!confirmGerar) return;
    try {
      const n = await gerarMut.mutateAsync({ imovelId: confirmGerar.id, ano: anoGerar });
      toast.success(`${n} lançamento(s) gerado(s) no calendário`);
      setConfirmGerar(null);
    } catch (e: any) { toast.error(e?.message ?? "Erro ao gerar"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Imóveis</h1>
          <p className="text-muted-foreground">Carteira de imóveis, encargos (IPTU/TCR/SPU) e histórico.</p>
        </div>
        {podeEditar("imoveis") && (
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo imóvel</Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {[
          { l: "Total", v: kpis.total },
          { l: "Alugados", v: kpis.alugados },
          { l: "Desocupados", v: kpis.vagos },
          { l: "Vendidos", v: kpis.vendidos },
          { l: "Receita mensal potencial", v: money(kpis.receita), primary: true },
        ].map((k) => (
          <Card key={k.l}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{k.l}</div>
              <div className={"text-2xl font-semibold " + (k.primary ? "text-primary" : "")}>{k.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={filtros.busca ?? ""} onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })} placeholder="Descrição" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Situação</Label>
            <Select value={filtros.situacao ?? "todos"} onValueChange={(v: any) => setFiltros({ ...filtros, situacao: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="alugado">Alugado</SelectItem>
                <SelectItem value="vago">Desocupado</SelectItem>
                <SelectItem value="vendido">Vendido</SelectItem>
                <SelectItem value="proprio_uso">Uso próprio</SelectItem>
                <SelectItem value="em_aquisicao">Em aquisição</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={filtros.tipo ?? "todos"} onValueChange={(v: any) => setFiltros({ ...filtros, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
                <SelectItem value="residencial">Residencial</SelectItem>
                <SelectItem value="terreno">Terreno</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Centro de custo</Label>
            <Select value={filtros.centroCustoId ?? "__none__"} onValueChange={(v) => setFiltros({ ...filtros, centroCustoId: v === "__none__" ? undefined : v })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Todos</SelectItem>
                {(centros.data ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Proprietário</Label>
            <Select value={filtros.proprietarioId ?? "__none__"} onValueChange={(v) => setFiltros({ ...filtros, proprietarioId: v === "__none__" ? undefined : v })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Todos</SelectItem>
                {(pessoas.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imóveis ({imoveis.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : imoveis.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum imóvel encontrado.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead className="text-right">Aluguel</TableHead>
                <TableHead className="text-right w-40">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {imoveis.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.codigo ?? "—"}</TableCell>
                    <TableCell className="font-medium">{i.descricao}</TableCell>
                    <TableCell>{situacaoLabel[i.situacao] ?? i.situacao}</TableCell>
                    <TableCell>{i.centro_custo?.nome ?? "—"}</TableCell>
                    <TableCell>{i.proprietario?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right">{money(i.valor_aluguel)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {podeEditar("imoveis") && (
                        <>
                          <Button size="icon" variant="ghost" title="Gerar encargos do ano" onClick={() => { setConfirmGerar(i); setAnoGerar(new Date().getFullYear()); }}>
                            <CalendarClock className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(i)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {podeExcluir("imoveis") && (
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(i)}>
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

      <ImovelDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar imóvel?</AlertDialogTitle>
            <AlertDialogDescription>
              O imóvel <b>{confirmDelete?.descricao}</b> será marcado como inativo. Encargos e histórico permanecem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) delMut.mutate(confirmDelete.id, {
                  onSuccess: () => { toast.success("Imóvel desativado"); setConfirmDelete(null); },
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
            <AlertDialogTitle>Gerar encargos do ano</AlertDialogTitle>
            <AlertDialogDescription>
              Serão criados lançamentos no calendário para <b>{confirmGerar?.descricao}</b> a partir dos encargos ativos.
              Descrições duplicadas são ignoradas (idempotente).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label>Ano</Label>
            <Input type="number" value={anoGerar} onChange={(e) => setAnoGerar(Number(e.target.value))} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); gerarEncargos(); }}>Gerar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}