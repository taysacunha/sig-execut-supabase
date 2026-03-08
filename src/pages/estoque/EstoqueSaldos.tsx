import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, AlertTriangle, PackageOpen, ArrowRightLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

export default function EstoqueSaldos() {
  const queryClient = useQueryClient();
  const { canEdit } = useSystemAccess();
  const canEditEstoque = canEdit("estoque");

  const [entradaDialog, setEntradaDialog] = useState(false);
  const [ajusteDialog, setAjusteDialog] = useState(false);
  const [transferenciaDialog, setTransferenciaDialog] = useState(false);

  // Form state
  const [materialId, setMaterialId] = useState("");
  const [localId, setLocalId] = useState("");
  const [localDestinoId, setLocalDestinoId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [observacoes, setObservacoes] = useState("");

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
      
      const { data: unidades } = await supabase
        .from("ferias_unidades")
        .select("id, nome");
      
      return (locaisData as unknown as Local[]).map((l) => ({
        ...l,
        unidade_nome: unidades?.find((u) => u.id === l.unidade_id)?.nome || "—",
      }));
    },
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
        };
      });
    },
    enabled: materiais.length > 0 || locais.length > 0,
  });

  const { user } = useSystemAccess();

  const entradaMutation = useMutation({
    mutationFn: async () => {
      // Upsert saldo
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
      // Register movement
      await fromEstoque("estoque_movimentacoes").insert({
        material_id: materialId,
        tipo: "entrada",
        quantidade,
        local_destino_id: localId,
        responsavel_user_id: user?.id,
        observacoes: observacoes || null,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });
      toast.success("Entrada registrada!");
      resetForms();
    },
    onError: () => toast.error("Erro ao registrar entrada"),
  });

  const ajusteMutation = useMutation({
    mutationFn: async () => {
      const existing = saldos.find((s) => s.material_id === materialId && s.local_armazenamento_id === localId);
      if (existing) {
        const { error } = await fromEstoque("estoque_saldos")
          .update({ quantidade } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await fromEstoque("estoque_saldos")
          .insert({ material_id: materialId, local_armazenamento_id: localId, quantidade } as any);
        if (error) throw error;
      }
      await fromEstoque("estoque_movimentacoes").insert({
        material_id: materialId,
        tipo: "ajuste",
        quantidade,
        local_destino_id: localId,
        responsavel_user_id: user?.id,
        observacoes: observacoes || "Ajuste manual",
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });
      toast.success("Ajuste registrado!");
      resetForms();
    },
    onError: () => toast.error("Erro ao registrar ajuste"),
  });

  const transferenciaMutation = useMutation({
    mutationFn: async () => {
      const origem = saldos.find((s) => s.material_id === materialId && s.local_armazenamento_id === localId);
      if (!origem || origem.quantidade < quantidade) throw new Error("Saldo insuficiente na origem");

      // Decrease origin
      await fromEstoque("estoque_saldos")
        .update({ quantidade: origem.quantidade - quantidade } as any)
        .eq("id", origem.id);

      // Increase destination
      const destino = saldos.find((s) => s.material_id === materialId && s.local_armazenamento_id === localDestinoId);
      if (destino) {
        await fromEstoque("estoque_saldos")
          .update({ quantidade: destino.quantidade + quantidade } as any)
          .eq("id", destino.id);
      } else {
        await fromEstoque("estoque_saldos")
          .insert({ material_id: materialId, local_armazenamento_id: localDestinoId, quantidade } as any);
      }

      // Register movement
      await fromEstoque("estoque_movimentacoes").insert({
        material_id: materialId,
        tipo: "transferencia",
        quantidade,
        local_origem_id: localId,
        local_destino_id: localDestinoId,
        responsavel_user_id: user?.id,
        observacoes: observacoes || null,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });
      toast.success("Transferência realizada!");
      resetForms();
    },
    onError: (err: any) => toast.error(err.message || "Erro na transferência"),
  });

  const resetForms = () => {
    setEntradaDialog(false);
    setAjusteDialog(false);
    setTransferenciaDialog(false);
    setMaterialId("");
    setLocalId("");
    setLocalDestinoId("");
    setQuantidade(1);
    setObservacoes("");
  };

  const {
    searchTerm, setSearchTerm, currentPage, setCurrentPage,
    itemsPerPage, setItemsPerPage, sortField, sortDirection, setSorting,
    paginatedData, filteredData, totalPages,
  } = useTableControls({
    data: saldos,
    searchField: ["material_nome", "local_nome", "unidade_nome"],
    defaultItemsPerPage: 25,
  });

  const lowStockCount = saldos.filter((s) => s.quantidade <= (s.material_estoque_minimo || 0) && s.material_estoque_minimo! > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Saldos de Estoque</h1>
          <p className="text-muted-foreground">Controle de quantidades por local de armazenamento</p>
        </div>
        {canEditEstoque && (
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setEntradaDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Entrada
            </Button>
            <Button variant="outline" onClick={() => setAjusteDialog(true)}>
              Ajuste
            </Button>
            <Button variant="outline" onClick={() => setTransferenciaDialog(true)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" /> Transferência
            </Button>
          </div>
        )}
      </div>

      {/* Alerts */}
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

      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <Input
            placeholder="Buscar por material, local ou unidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <PackageOpen className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum saldo cadastrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const isLow = s.quantidade <= (s.material_estoque_minimo || 0) && (s.material_estoque_minimo || 0) > 0;
                  return (
                    <TableRow key={s.id} className={isLow ? "bg-yellow-500/5" : ""}>
                      <TableCell className="font-medium">{s.material_nome}</TableCell>
                      <TableCell>{s.local_nome}</TableCell>
                      <TableCell>{s.unidade_nome}</TableCell>
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Entrada Dialog */}
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
                <SelectContent>{locais.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome} ({l.unidade_nome})</SelectItem>)}</SelectContent>
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

      {/* Ajuste Dialog */}
      <Dialog open={ajusteDialog} onOpenChange={(o) => !o && resetForms()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuste de Estoque</DialogTitle>
            <DialogDescription>Ajuste manual da quantidade em estoque</DialogDescription>
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
              <Label>Local</Label>
              <Select value={localId} onValueChange={setLocalId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{locais.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome} ({l.unidade_nome})</SelectItem>)}</SelectContent>
              </Select>
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
            <Button onClick={() => ajusteMutation.mutate()} disabled={!materialId || !localId || ajusteMutation.isPending}>
              {ajusteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Ajustar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transferência Dialog */}
      <Dialog open={transferenciaDialog} onOpenChange={(o) => !o && resetForms()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transferência entre Locais</DialogTitle>
            <DialogDescription>Transfira materiais de um local para outro</DialogDescription>
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
              <Label>Local de Origem</Label>
              <Select value={localId} onValueChange={setLocalId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{locais.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome} ({l.unidade_nome})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Local de Destino</Label>
              <Select value={localDestinoId} onValueChange={setLocalDestinoId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {locais.filter((l) => l.id !== localId).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome} ({l.unidade_nome})</SelectItem>
                  ))}
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
            <Button
              onClick={() => transferenciaMutation.mutate()}
              disabled={!materialId || !localId || !localDestinoId || localId === localDestinoId || transferenciaMutation.isPending}
            >
              {transferenciaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
