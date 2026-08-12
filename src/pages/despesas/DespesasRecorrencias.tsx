import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2, Play, Power, Trash2, ListChecks, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Recorrencia, useDeleteRecorrencia, useGerarOcorrencias, useRecorrencias,
  useSaveRecorrencia,
} from "@/hooks/useDespesasRecorrencias";
import { useDespesasValues } from "@/contexts/DespesasValuesContext";
import { useTableControls } from "@/hooks/useTableControls";
import { SortableHeader, TablePagination, TableSearch } from "@/components/vendas/TableControls";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const TIPO_LABEL: Record<string, string> = {
  mensal: "Mensal",
  anual: "Anual",
  fixa_meses: "Meses fixos",
  intercalada: "Intercalada",
};

type RecorrenciaRow = Recorrencia & {
  empresa_nome: string;
  centro_nome: string;
  frequencia_label: string;
  status_label: string;
  valor_num: number;
};

const ALL = "__all__";

export default function DespesasRecorrencias() {
  const { data = [], isLoading } = useRecorrencias();
  const { showValues, formatValue } = useDespesasValues();
  const saveMut = useSaveRecorrencia();
  const gerarMut = useGerarOcorrencias();
  const delMut = useDeleteRecorrencia();
  const [toDelete, setToDelete] = useState<Recorrencia | null>(null);
  const [toRenew, setToRenew] = useState<Recorrencia | null>(null);
  const [renewDate, setRenewDate] = useState<string>("");
  const [renewOpen, setRenewOpen] = useState<boolean>(false);
  const [renewSemFim, setRenewSemFim] = useState<boolean>(false);
  const [fTipo, setFTipo] = useState<string>(ALL);
  const [fCentro, setFCentro] = useState<string>(ALL);
  const [fEmpresa, setFEmpresa] = useState<string>(ALL);
  const [fStatus, setFStatus] = useState<string>(ALL);
  const [fDe, setFDe] = useState<string>("");
  const [fAte, setFAte] = useState<string>("");

  const rows: RecorrenciaRow[] = useMemo(
    () =>
      data.map((r) => ({
        ...r,
        empresa_nome: r.pessoa?.nome ?? "—",
        centro_nome: r.centro_custo?.nome ?? "—",
        frequencia_label: TIPO_LABEL[r.tipo] ?? r.tipo,
        status_label: r.ativo ? "Ativa" : "Pausada",
        valor_num: r.valor_total ?? 0,
      })),
    [data]
  );

  const centros = useMemo(
    () => Array.from(new Set(rows.map((r) => r.centro_nome))).filter((n) => n !== "—").sort(),
    [rows]
  );
  const empresas = useMemo(
    () => Array.from(new Set(rows.map((r) => r.empresa_nome))).filter((n) => n !== "—").sort(),
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fTipo !== ALL && r.tipo !== fTipo) return false;
        if (fCentro !== ALL && r.centro_nome !== fCentro) return false;
        if (fEmpresa !== ALL && r.empresa_nome !== fEmpresa) return false;
        if (fStatus !== ALL && String(r.ativo) !== fStatus) return false;
        if (fDe && r.data_inicio < fDe) return false;
        if (fAte && r.data_inicio > fAte) return false;
        return true;
      }),
    [rows, fTipo, fCentro, fEmpresa, fStatus, fDe, fAte]
  );

  const hasFilters =
    fTipo !== ALL || fCentro !== ALL || fEmpresa !== ALL || fStatus !== ALL || !!fDe || !!fAte;

  const {
    searchTerm, setSearchTerm, currentPage, setCurrentPage, itemsPerPage,
    setItemsPerPage, sortField, sortDirection, setSorting, filteredData, paginatedData, totalPages,
  } = useTableControls<RecorrenciaRow>({
    data: filtered,
    searchField: ["descricao", "empresa_nome", "centro_nome", "frequencia_label", "status_label"],
    defaultItemsPerPage: 25,
  });

  function limparFiltros() {
    setFTipo(ALL);
    setFCentro(ALL);
    setFEmpresa(ALL);
    setFStatus(ALL);
    setFDe("");
    setFAte("");
    setSearchTerm("");
    setCurrentPage(1);
  }

  function abrirRenovar(r: Recorrencia) {
    setToRenew(r);
    const base = r.data_fim ? new Date(r.data_fim + "T00:00:00") : new Date();
    const novo = new Date(base);
    novo.setMonth(novo.getMonth() + 12);
    setRenewDate(novo.toISOString().slice(0, 10));
    setRenewSemFim(false);
  }

  async function confirmRenovar() {
    if (!toRenew) return;
    try {
      const novaDataFim = renewSemFim ? null : renewDate || null;
      await saveMut.mutateAsync({
        id: toRenew.id,
        input: {
          ativo: true,
          tipo: toRenew.tipo,
          data_inicio: toRenew.data_inicio,
          data_fim: novaDataFim,
          dia_vencimento: toRenew.dia_vencimento,
          meses_fixos: toRenew.meses_fixos,
          janela_geracao_meses: toRenew.janela_geracao_meses,
          lanc_tipo: toRenew.lanc_tipo,
          descricao: toRenew.descricao,
          valor_total: toRenew.valor_total,
          centro_custo_id: toRenew.centro_custo_id,
          categoria_id: toRenew.categoria_id,
          plano_conta_id: toRenew.plano_conta_id,
          subcategoria_id: toRenew.subcategoria_id,
          conta_bancaria_id: toRenew.conta_bancaria_id,
          pessoa_id: toRenew.pessoa_id,
          imovel_id: toRenew.imovel_id,
          referencia_tipo: toRenew.referencia_tipo,
          referencia_numero: toRenew.referencia_numero,
          referencia_numero_pasta: toRenew.referencia_numero_pasta,
          referencia_numero_venda: toRenew.referencia_numero_venda,
          observacao: toRenew.observacao,
        },
      });
      const n = await gerarMut.mutateAsync({
        id: toRenew.id,
        ate: novaDataFim ?? undefined,
      });
      toast.success(`Série renovada — ${n} nova(s) ocorrência(s) geradas`);
      setToRenew(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao renovar série");
    }
  }

  async function toggleAtivo(r: Recorrencia) {
    try {
      await saveMut.mutateAsync({
        id: r.id,
        input: {
          ativo: !r.ativo,
          tipo: r.tipo,
          data_inicio: r.data_inicio,
          data_fim: r.data_fim,
          dia_vencimento: r.dia_vencimento,
          meses_fixos: r.meses_fixos,
          janela_geracao_meses: r.janela_geracao_meses,
          lanc_tipo: r.lanc_tipo,
          descricao: r.descricao,
          valor_total: r.valor_total,
          centro_custo_id: r.centro_custo_id,
          categoria_id: r.categoria_id,
          plano_conta_id: r.plano_conta_id,
          subcategoria_id: r.subcategoria_id,
          conta_bancaria_id: r.conta_bancaria_id,
          pessoa_id: r.pessoa_id,
          imovel_id: r.imovel_id,
          referencia_tipo: r.referencia_tipo,
          referencia_numero: r.referencia_numero,
          referencia_numero_pasta: r.referencia_numero_pasta,
          referencia_numero_venda: r.referencia_numero_venda,
          observacao: r.observacao,
        },
      });
      toast.success(r.ativo ? "Série pausada" : "Série ativada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao alterar status");
    }
  }

  async function gerar(r: Recorrencia) {
    try {
      const n = await gerarMut.mutateAsync({ id: r.id });
      toast.success(`${n} ocorrência(s) geradas`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar ocorrências");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await delMut.mutateAsync(toDelete.id);
      toast.success("Série removida");
      setToDelete(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Recorrências</h1>
          <p className="text-sm text-muted-foreground">
            Séries que geram lançamentos automaticamente. Crie novas séries pelo diálogo
            de <strong>Novo Lançamento</strong> ativando “Repetir automaticamente”.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Séries cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : data.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma série cadastrada.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <TableSearch
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Buscar por descrição, empresa, centro…"
                />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Frequência</Label>
                  <Select value={fTipo} onValueChange={(v) => { setFTipo(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todas</SelectItem>
                      {Object.entries(TIPO_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Centro de custo</Label>
                  <Select value={fCentro} onValueChange={(v) => { setFCentro(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todos</SelectItem>
                      {centros.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Empresa</Label>
                  <Select value={fEmpresa} onValueChange={(v) => { setFEmpresa(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todas</SelectItem>
                      {empresas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={fStatus} onValueChange={(v) => { setFStatus(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todos</SelectItem>
                      <SelectItem value="true">Ativa</SelectItem>
                      <SelectItem value="false">Pausada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Início de</Label>
                  <Input type="date" className="w-[150px]" value={fDe}
                    onChange={(e) => { setFDe(e.target.value); setCurrentPage(1); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Início até</Label>
                  <Input type="date" className="w-[150px]" value={fAte}
                    onChange={(e) => { setFAte(e.target.value); setCurrentPage(1); }} />
                </div>
                {(hasFilters || searchTerm) && (
                  <Button variant="ghost" size="sm" onClick={limparFiltros}>Limpar filtros</Button>
                )}
              </div>

              {filteredData.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  Nenhuma série encontrada com os filtros aplicados.
                </div>
              ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><SortableHeader label="Descrição" field="descricao" currentField={sortField as string} direction={sortDirection} onSort={(f) => setSorting(f as keyof RecorrenciaRow)} /></TableHead>
                    <TableHead><SortableHeader label="Frequência" field="frequencia_label" currentField={sortField as string} direction={sortDirection} onSort={(f) => setSorting(f as keyof RecorrenciaRow)} /></TableHead>
                    <TableHead><SortableHeader label="Valor" field="valor_num" currentField={sortField as string} direction={sortDirection} onSort={(f) => setSorting(f as keyof RecorrenciaRow)} /></TableHead>
                    <TableHead><SortableHeader label="Centro" field="centro_nome" currentField={sortField as string} direction={sortDirection} onSort={(f) => setSorting(f as keyof RecorrenciaRow)} /></TableHead>
                    <TableHead><SortableHeader label="Empresa" field="empresa_nome" currentField={sortField as string} direction={sortDirection} onSort={(f) => setSorting(f as keyof RecorrenciaRow)} /></TableHead>
                    <TableHead><SortableHeader label="Início" field="data_inicio" currentField={sortField as string} direction={sortDirection} onSort={(f) => setSorting(f as keyof RecorrenciaRow)} /></TableHead>
                    <TableHead><SortableHeader label="Última geração até" field="ultima_geracao_ate" currentField={sortField as string} direction={sortDirection} onSort={(f) => setSorting(f as keyof RecorrenciaRow)} /></TableHead>
                    <TableHead><SortableHeader label="Status" field="status_label" currentField={sortField as string} direction={sortDirection} onSort={(f) => setSorting(f as keyof RecorrenciaRow)} /></TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.descricao}</TableCell>
                      <TableCell>{TIPO_LABEL[r.tipo] ?? r.tipo}</TableCell>
                      <TableCell>
                        {r.valor_total == null
                          ? "—"
                          : showValues
                          ? formatValue(r.valor_total)
                          : "R$ ******"}
                      </TableCell>
                      <TableCell>{r.centro_custo?.nome ?? "—"}</TableCell>
                      <TableCell>{r.empresa_nome}</TableCell>
                      <TableCell>
                        {format(new Date(r.data_inicio + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {r.ultima_geracao_ate
                          ? format(new Date(r.ultima_geracao_ate + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.ativo ? "default" : "secondary"}>
                          {r.ativo ? "Ativa" : "Pausada"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/despesas/calendario?serie=${r.id}`}>
                            <ListChecks className="h-3 w-3 mr-1" /> Ver ocorrências
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => gerar(r)} disabled={gerarMut.isPending}>
                          <Play className="h-3 w-3 mr-1" /> Gerar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirRenovar(r)}
                          disabled={saveMut.isPending || gerarMut.isPending}
                          title="Renovar / prorrogar encerramento"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" /> Renovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleAtivo(r)} disabled={saveMut.isPending}>
                          <Power className="h-3 w-3 mr-1" /> {r.ativo ? "Pausar" : "Ativar"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setToDelete(r)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              )}

              {filteredData.length > 0 && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                  totalItems={filteredData.length}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!toRenew} onOpenChange={(o) => !o && setToRenew(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renovar recorrência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Prorrogue o encerramento desta série. As novas ocorrências serão geradas
              automaticamente até a nova data.
            </p>
            <div className="space-y-2">
              <Label>Nova data de encerramento</Label>
              <Input
                type="date"
                value={renewDate}
                onChange={(e) => setRenewDate(e.target.value)}
                disabled={renewSemFim}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={renewSemFim}
                onCheckedChange={(v) => setRenewSemFim(!!v)}
              />
              Sem data de encerramento (série contínua)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToRenew(null)}>Cancelar</Button>
            <Button
              onClick={confirmRenovar}
              disabled={saveMut.isPending || gerarMut.isPending || (!renewSemFim && !renewDate)}
            >
              Renovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover série de recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              Os lançamentos já gerados serão mantidos (sem vínculo com a série). Novos
              lançamentos não serão gerados. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}