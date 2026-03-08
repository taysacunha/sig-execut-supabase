import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, AlertTriangle, PackageOpen, ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { useTableControls } from "@/hooks/useTableControls";
import { TableSearch, TablePagination, SortableHeader } from "@/components/vendas/TableControls";

const fromEstoque = (table: string) => supabase.from(table as any);

interface Saldo {
  id: string;
  material_id: string;
  local_armazenamento_id: string;
  quantidade: number;
  material_nome?: string;
  material_unidade?: string;
  material_estoque_minimo?: number;
  local_nome?: string;
  unidade_nome?: string;
  unidade_id?: string;
}

interface Material {
  id: string;
  nome: string;
  unidade_medida: string;
  estoque_minimo: number;
}

interface Local {
  id: string;
  nome: string;
  unidade_id: string;
  unidade_nome?: string;
}

interface Unidade {
  id: string;
  nome: string;
}

// ─── Sub-component: Saldos table for a given unit tab ───
function SaldosTable({
  saldos,
  canEdit,
  onAjustar,
  onTransferir,
  onExcluir,
}: {
  saldos: Saldo[];
  canEdit: boolean;
  onAjustar: (s: Saldo) => void;
  onTransferir: (s: Saldo) => void;
  onExcluir: (s: Saldo) => void;
}) {
  const {
    searchTerm, setSearchTerm, currentPage, setCurrentPage,
    itemsPerPage, setItemsPerPage, sortField, sortDirection, setSorting,
    paginatedData, filteredData, totalPages,
  } = useTableControls({
    data: saldos,
    searchField: ["material_nome", "local_nome"],
    defaultItemsPerPage: 25,
  });

  return (
    <div className="space-y-4">
      <TableSearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por material ou local..." />

      {paginatedData.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <PackageOpen className="h-12 w-12 mb-4 opacity-50" />
          <p>Nenhum saldo encontrado</p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader label="Material" field="material_nome" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Local" field="local_nome" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader label="Quantidade" field="quantidade" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
                </TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((s) => {
                const isLow = s.quantidade <= (s.material_estoque_minimo || 0) && (s.material_estoque_minimo || 0) > 0;
                return (
                  <TableRow key={s.id} className={isLow ? "bg-yellow-500/5" : ""}>
                    <TableCell className="font-medium">{s.material_nome}</TableCell>
                    <TableCell>{s.local_nome}</TableCell>
                    <TableCell className="text-right font-mono">{s.quantidade} {s.material_unidade}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{s.material_estoque_minimo}</TableCell>
                    <TableCell>
                      {isLow ? (
                        <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Baixo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">OK</Badge>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ajustar" onClick={() => onAjustar(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Transferir" onClick={() => onTransferir(s)}>
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir" onClick={() => onExcluir(s)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="px-4 pb-4">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              totalItems={filteredData.length}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main page component ───
export default function EstoqueSaldos() {
  const queryClient = useQueryClient();
  const { canEdit, user } = useSystemAccess();
  const canEditEstoque = canEdit("estoque");

  const [entradaDialog, setEntradaDialog] = useState(false);
  const [ajusteDialog, setAjusteDialog] = useState(false);
  const [transferenciaDialog, setTransferenciaDialog] = useState(false);
  const [excluirDialog, setExcluirDialog] = useState(false);

  // Form state
  const [materialId, setMaterialId] = useState("");
  const [localId, setLocalId] = useState("");
  const [localDestinoId, setLocalDestinoId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [observacoes, setObservacoes] = useState("");

  // Context for row-level actions
  const [selectedSaldo, setSelectedSaldo] = useState<Saldo | null>(null);
  const [justificativa, setJustificativa] = useState("");

  const { data: unidades = [] } = useQuery({
    queryKey: ["estoque-unidades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ferias_unidades").select("id, nome").eq("is_active", true).order("nome");
      if (error) throw error;
      return data as Unidade[];
    },
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ["estoque-materiais-ativos"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_materiais")
        .select("id, nome, unidade_medida, estoque_minimo")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data as unknown as Material[];
    },
  });

  const { data: locais = [] } = useQuery({
    queryKey: ["estoque-locais-ativos"],
    queryFn: async () => {
      const { data: locaisData, error } = await fromEstoque("estoque_locais_armazenamento")
        .select("id, nome, unidade_id")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return (locaisData as unknown as Local[]).map((l) => ({
        ...l,
        unidade_nome: unidades.find((u) => u.id === l.unidade_id)?.nome || "—",
      }));
    },
    enabled: unidades.length > 0,
  });

  const { data: saldos = [], isLoading } = useQuery({
    queryKey: ["estoque-saldos"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_saldos").select("*");
      if (error) throw error;
      return (data as unknown as Saldo[]).map((s) => {
        const mat = materiais.find((m) => m.id === s.material_id);
        const loc = locais.find((l) => l.id === s.local_armazenamento_id);
        return {
          ...s,
          material_nome: mat?.nome || "—",
          material_unidade: mat?.unidade_medida || "",
          material_estoque_minimo: mat?.estoque_minimo || 0,
          local_nome: loc?.nome || "—",
          unidade_nome: loc?.unidade_nome || "—",
          unidade_id: loc?.unidade_id || "",
        };
      });
    },
    enabled: materiais.length > 0 && locais.length > 0,
  });

  // Group saldos by unidade
  const saldosByUnidade = useMemo(() => {
    const map: Record<string, Saldo[]> = {};
    for (const s of saldos) {
      const uid = s.unidade_id || "sem-unidade";
      if (!map[uid]) map[uid] = [];
      map[uid].push(s);
    }
    return map;
  }, [saldos]);

  // Tabs: only show units that have saldos
  const activeUnidades = useMemo(() => {
    return unidades.filter((u) => saldosByUnidade[u.id]?.length > 0);
  }, [unidades, saldosByUnidade]);

  // Locais grouped by unidade for transfer dialog
  const locaisByUnidade = useMemo(() => {
    const map: Record<string, Local[]> = {};
    for (const l of locais) {
      if (!map[l.unidade_id]) map[l.unidade_id] = [];
      map[l.unidade_id].push(l);
    }
    return map;
  }, [locais]);

  const lowStockCount = saldos.filter((s) => s.quantidade <= (s.material_estoque_minimo || 0) && (s.material_estoque_minimo || 0) > 0).length;

  // ─── Row action handlers ───
  const handleAjustar = (s: Saldo) => {
    setSelectedSaldo(s);
    setMaterialId(s.material_id);
    setLocalId(s.local_armazenamento_id);
    setQuantidade(s.quantidade);
    setObservacoes("");
    setAjusteDialog(true);
  };

  const handleTransferir = (s: Saldo) => {
    setSelectedSaldo(s);
    setMaterialId(s.material_id);
    setLocalId(s.local_armazenamento_id);
    setLocalDestinoId("");
    setQuantidade(1);
    setObservacoes("");
    setTransferenciaDialog(true);
  };

  const handleExcluir = (s: Saldo) => {
    setSelectedSaldo(s);
    setJustificativa("");
    setExcluirDialog(true);
  };

  const resetForms = () => {
    setEntradaDialog(false);
    setAjusteDialog(false);
    setTransferenciaDialog(false);
    setExcluirDialog(false);
    setSelectedSaldo(null);
    setMaterialId("");
    setLocalId("");
    setLocalDestinoId("");
    setQuantidade(1);
    setObservacoes("");
    setJustificativa("");
  };

  // ─── Mutations ───
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });

  const entradaMutation = useMutation({
    mutationFn: async () => {
      const existing = saldos.find((s) => s.material_id === materialId && s.local_armazenamento_id === localId);
      if (existing) {
        const { error } = await fromEstoque("estoque_saldos")
          .update({ quantidade: existing.quantidade + quantidade } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await fromEstoque("estoque_saldos")
          .insert({ material_id: materialId, local_armazenamento_id: localId, quantidade } as any);
        if (error) throw error;
      }
      await fromEstoque("estoque_movimentacoes").insert({
        material_id: materialId, tipo: "entrada", quantidade,
        local_destino_id: localId, responsavel_user_id: user?.id,
        observacoes: observacoes || null,
      } as any);
    },
    onSuccess: () => { invalidate(); toast.success("Entrada registrada!"); resetForms(); },
    onError: () => toast.error("Erro ao registrar entrada"),
  });

  const ajusteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSaldo) throw new Error("Saldo não encontrado");
      const { error } = await fromEstoque("estoque_saldos")
        .update({ quantidade } as any)
        .eq("id", selectedSaldo.id);
      if (error) throw error;
      await fromEstoque("estoque_movimentacoes").insert({
        material_id: selectedSaldo.material_id, tipo: "ajuste", quantidade,
        local_destino_id: selectedSaldo.local_armazenamento_id,
        responsavel_user_id: user?.id,
        observacoes: observacoes || "Ajuste manual",
      } as any);
    },
    onSuccess: () => { invalidate(); toast.success("Ajuste registrado!"); resetForms(); },
    onError: () => toast.error("Erro ao registrar ajuste"),
  });

  const transferenciaMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSaldo) throw new Error("Saldo não encontrado");
      if (selectedSaldo.quantidade < quantidade) throw new Error("Saldo insuficiente na origem");

      const newOrigemQtd = selectedSaldo.quantidade - quantidade;
      if (newOrigemQtd === 0) {
        await fromEstoque("estoque_saldos").delete().eq("id", selectedSaldo.id);
      } else {
        await fromEstoque("estoque_saldos").update({ quantidade: newOrigemQtd } as any).eq("id", selectedSaldo.id);
      }

      const destino = saldos.find((s) => s.material_id === selectedSaldo.material_id && s.local_armazenamento_id === localDestinoId);
      if (destino) {
        await fromEstoque("estoque_saldos").update({ quantidade: destino.quantidade + quantidade } as any).eq("id", destino.id);
      } else {
        await fromEstoque("estoque_saldos").insert({ material_id: selectedSaldo.material_id, local_armazenamento_id: localDestinoId, quantidade } as any);
      }

      await fromEstoque("estoque_movimentacoes").insert({
        material_id: selectedSaldo.material_id, tipo: "transferencia", quantidade,
        local_origem_id: selectedSaldo.local_armazenamento_id,
        local_destino_id: localDestinoId,
        responsavel_user_id: user?.id,
        observacoes: observacoes || null,
      } as any);
    },
    onSuccess: () => { invalidate(); toast.success("Transferência realizada!"); resetForms(); },
    onError: (err: any) => toast.error(err.message || "Erro na transferência"),
  });

  const excluirMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSaldo) throw new Error("Saldo não encontrado");
      if (!justificativa.trim()) throw new Error("Justificativa obrigatória");

      // Remove the saldo record
      await fromEstoque("estoque_saldos").delete().eq("id", selectedSaldo.id);

      // Log the removal as a "saida" movement
      await fromEstoque("estoque_movimentacoes").insert({
        material_id: selectedSaldo.material_id, tipo: "saida",
        quantidade: selectedSaldo.quantidade,
        local_origem_id: selectedSaldo.local_armazenamento_id,
        responsavel_user_id: user?.id,
        observacoes: `Exclusão: ${justificativa.trim()}`,
      } as any);
    },
    onSuccess: () => { invalidate(); toast.success("Entrada excluída com sucesso!"); resetForms(); },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir"),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Saldos de Estoque</h1>
          <p className="text-muted-foreground">Controle de quantidades por local de armazenamento</p>
        </div>
        {canEditEstoque && (
          <Button onClick={() => { resetForms(); setEntradaDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Entrada
          </Button>
        )}
      </div>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <span className="text-sm text-yellow-400">
              <strong>{lowStockCount}</strong> {lowStockCount === 1 ? "material abaixo" : "materiais abaixo"} do estoque mínimo
            </span>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : saldos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <PackageOpen className="h-12 w-12 mb-4 opacity-50" />
            <p>Nenhum saldo cadastrado</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="todas" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="todas">Todas ({saldos.length})</TabsTrigger>
            {activeUnidades.map((u) => (
              <TabsTrigger key={u.id} value={u.id}>
                {u.nome} ({saldosByUnidade[u.id]?.length || 0})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="todas">
            <Card>
              <CardContent className="pt-4">
                <SaldosTable
                  saldos={saldos}
                  canEdit={canEditEstoque}
                  onAjustar={handleAjustar}
                  onTransferir={handleTransferir}
                  onExcluir={handleExcluir}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {activeUnidades.map((u) => (
            <TabsContent key={u.id} value={u.id}>
              <Card>
                <CardContent className="pt-4">
                  <SaldosTable
                    saldos={saldosByUnidade[u.id] || []}
                    canEdit={canEditEstoque}
                    onAjustar={handleAjustar}
                    onTransferir={handleTransferir}
                    onExcluir={handleExcluir}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* ─── Entrada Dialog ─── */}
      <Dialog open={entradaDialog} onOpenChange={(o) => !o && resetForms()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Entrada de Material</DialogTitle>
            <DialogDescription>Registre a entrada de materiais no estoque</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Material</Label>
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{materiais.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Local de Armazenamento</Label>
              <Select value={localId} onValueChange={setLocalId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(locaisByUnidade).map(([unidadeId, locs]) => {
                    const unidadeNome = unidades.find((u) => u.id === unidadeId)?.nome || "Sem unidade";
                    return (
                      <div key={unidadeId}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{unidadeNome}</div>
                        {locs.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForms}>Cancelar</Button>
            <Button onClick={() => entradaMutation.mutate()} disabled={!materialId || !localId || entradaMutation.isPending}>
              {entradaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Ajuste Dialog (pre-filled from row) ─── */}
      <Dialog open={ajusteDialog} onOpenChange={(o) => !o && resetForms()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuste de Estoque</DialogTitle>
            <DialogDescription>
              {selectedSaldo ? `${selectedSaldo.material_nome} — ${selectedSaldo.local_nome}` : "Ajuste manual da quantidade"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Quantidade atual</Label>
              <p className="text-sm text-muted-foreground font-mono">{selectedSaldo?.quantidade} {selectedSaldo?.material_unidade}</p>
            </div>
            <div>
              <Label>Nova Quantidade</Label>
              <Input type="number" min={0} value={quantidade} onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Justificativa</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Motivo do ajuste..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForms}>Cancelar</Button>
            <Button onClick={() => ajusteMutation.mutate()} disabled={ajusteMutation.isPending}>
              {ajusteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Ajustar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Transferência Dialog (pre-filled from row) ─── */}
      <Dialog open={transferenciaDialog} onOpenChange={(o) => !o && resetForms()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transferência</DialogTitle>
            <DialogDescription>
              {selectedSaldo ? `${selectedSaldo.material_nome} — de ${selectedSaldo.local_nome} (${selectedSaldo.unidade_nome})` : "Transferir material entre locais"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Saldo disponível</Label>
              <p className="text-sm text-muted-foreground font-mono">{selectedSaldo?.quantidade} {selectedSaldo?.material_unidade}</p>
            </div>
            <div>
              <Label>Local de Destino</Label>
              <Select value={localDestinoId} onValueChange={setLocalDestinoId}>
                <SelectTrigger><SelectValue placeholder="Selecione o destino..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(locaisByUnidade).map(([unidadeId, locs]) => {
                    const unidadeNome = unidades.find((u) => u.id === unidadeId)?.nome || "Sem unidade";
                    const filtered = locs.filter((l) => l.id !== selectedSaldo?.local_armazenamento_id);
                    if (filtered.length === 0) return null;
                    return (
                      <div key={unidadeId}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{unidadeNome}</div>
                        {filtered.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} max={selectedSaldo?.quantidade || 1} value={quantidade} onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForms}>Cancelar</Button>
            <Button
              onClick={() => transferenciaMutation.mutate()}
              disabled={!localDestinoId || transferenciaMutation.isPending}
            >
              {transferenciaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Exclusão AlertDialog com justificativa ─── */}
      <AlertDialog open={excluirDialog} onOpenChange={(o) => !o && resetForms()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir entrada de estoque</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedSaldo?.quantidade} {selectedSaldo?.material_unidade}</strong> de <strong>{selectedSaldo?.material_nome}</strong> no local <strong>{selectedSaldo?.local_nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Justificativa (obrigatória)</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Descreva o motivo da exclusão..."
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetForms}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => excluirMutation.mutate()}
              disabled={!justificativa.trim() || excluirMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluirMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
