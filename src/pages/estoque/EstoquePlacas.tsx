import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Loader2, Tag, Wrench, ArrowLeftRight, AlertTriangle,
  History as HistoryIcon, Trash2, ShieldAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { useUserRole } from "@/hooks/useUserRole";
import { useTableControls } from "@/hooks/useTableControls";
import { TableSearch, TablePagination, SortableHeader } from "@/components/vendas/TableControls";
import {
  usePlacas, useHistoricoPlaca, Placa, PlacaStatus, TipoUso, Tamanho,
  STATUS_LABELS, STATUS_COLORS, TIPO_USO_LABELS, TAMANHO_LABELS, HIST_LABELS,
} from "@/hooks/useEstoquePlacas";
import { PlacasPDFGenerator } from "@/components/estoque/placas/PlacasPDFGenerator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fromEstoque = (t: string) => supabase.from(t as any);

interface MaterialOpt { id: string; nome: string; }
interface LocalOpt { id: string; nome: string; unidade_id: string; }

export default function EstoquePlacas() {
  const queryClient = useQueryClient();
  const { hasAccess, user } = useSystemAccess();
  const { isSuperAdmin, isAdmin } = useUserRole();
  const isAdminOrSuper = isSuperAdmin || isAdmin;

  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [tamanhoFiltro, setTamanhoFiltro] = useState<string>("todos");

  const [novaPlacaDialog, setNovaPlacaDialog] = useState(false);
  const [novaPlacaSubstitui, setNovaPlacaSubstitui] = useState<Placa | null>(null);
  const [instalarDialog, setInstalarDialog] = useState(false);
  const [retirarDialog, setRetirarDialog] = useState(false);
  const [perdaRouboDialog, setPerdaRouboDialog] = useState<null | "roubo" | "perda">(null);
  const [historicoDialog, setHistoricoDialog] = useState(false);
  const [excluirDialog, setExcluirDialog] = useState(false);
  const [selected, setSelected] = useState<Placa | null>(null);

  const { data: placas = [], isLoading } = usePlacas();

  // Material "Placa" — usa o primeiro material cujo nome contém "placa"
  const { data: materiais = [] } = useQuery({
    queryKey: ["estoque-materiais-placa"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_materiais")
        .select("id, nome").eq("is_active", true).order("nome");
      if (error) throw error;
      return (data as unknown as MaterialOpt[]) || [];
    },
  });
  const materialPlaca = useMemo(
    () => materiais.find((m) => m.nome.toLowerCase().includes("placa")) || materiais[0] || null,
    [materiais]
  );

  const { data: locais = [] } = useQuery({
    queryKey: ["estoque-locais-placas"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_locais_armazenamento")
        .select("id, nome, unidade_id").eq("is_active", true).order("nome");
      if (error) throw error;
      return (data as unknown as LocalOpt[]) || [];
    },
  });
  const localNome = (id: string | null) =>
    id ? (locais.find((l) => l.id === id)?.nome || "—") : "—";

  // Filtro
  const placasFiltradas = useMemo(() => {
    return placas.filter((p) => {
      if (statusFiltro !== "todos" && p.status !== statusFiltro) return false;
      if (tipoFiltro !== "todos" && p.tipo_uso !== tipoFiltro) return false;
      if (tamanhoFiltro !== "todos" && p.tamanho !== tamanhoFiltro) return false;
      return true;
    });
  }, [placas, statusFiltro, tipoFiltro, tamanhoFiltro]);

  const {
    searchTerm, setSearchTerm, currentPage, setCurrentPage,
    itemsPerPage, setItemsPerPage, sortField, sortDirection, setSorting,
    paginatedData, filteredData, totalPages,
  } = useTableControls({
    data: placasFiltradas,
    searchField: ["codigo", "imovel_codigo_atual"] as any,
    defaultItemsPerPage: 25,
  });

  // Códigos disponíveis para reuso (perdidos/roubados sem versão ativa)
  const codigosReuso = useMemo(() => {
    const ativos = new Set(
      placas.filter((p) => p.status === "disponivel" || p.status === "instalada")
        .map((p) => p.codigo)
    );
    const terminais = placas.filter(
      (p) => (p.status === "roubada" || p.status === "perdida") && !ativos.has(p.codigo)
    );
    // mantém versão mais recente
    const map = new Map<string, Placa>();
    for (const p of terminais) {
      const cur = map.get(p.codigo);
      if (!cur || p.versao > cur.versao) map.set(p.codigo, p);
    }
    return Array.from(map.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [placas]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["estoque-placas"] });
    queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });
    queryClient.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
  };

  // ─── MUTATIONS ───
  const novaPlacaMutation = useMutation({
    mutationFn: async (input: {
      codigo: string; tipo_uso: TipoUso; tamanho: Tamanho; tamanho_outro: string;
      local_armazenamento_id: string; observacoes: string; substitui_placa_id: string | null;
    }) => {
      if (!materialPlaca) throw new Error("Material 'Placa' não encontrado em /estoque/materiais");
      const codigo = input.codigo.trim();
      if (!codigo) throw new Error("Código obrigatório");
      if (codigo.length > 30) throw new Error("Código muito longo (máx 30)");
      if (!input.local_armazenamento_id) throw new Error("Local de armazenamento obrigatório");

      // calcula versão
      const mesmoCodigo = placas.filter((p) => p.codigo === codigo);
      const ativaExiste = mesmoCodigo.some((p) => p.status === "disponivel" || p.status === "instalada");
      if (ativaExiste) throw new Error("Já existe uma placa ativa com este código");
      const versao = mesmoCodigo.length === 0 ? 1 : Math.max(...mesmoCodigo.map((p) => p.versao)) + 1;
      const tipo = versao === 1 ? "criacao" : "reposicao";

      const { data: nova, error } = await fromEstoque("estoque_placas").insert({
        codigo, versao,
        material_id: materialPlaca.id,
        tipo_uso: input.tipo_uso,
        tamanho: input.tamanho,
        tamanho_outro: input.tamanho === "outro" ? (input.tamanho_outro || null) : null,
        local_armazenamento_id: input.local_armazenamento_id,
        status: "disponivel",
        observacoes: input.observacoes || null,
        substitui_placa_id: input.substitui_placa_id,
        created_by: user?.id,
      } as any).select().single();
      if (error) throw error;

      await fromEstoque("estoque_placas_historico").insert({
        placa_id: (nova as any).id,
        tipo,
        data_evento: new Date().toISOString().slice(0, 10),
        observacoes: input.observacoes || null,
        user_id: user?.id,
      } as any);

      await fromEstoque("estoque_movimentacoes").insert({
        material_id: materialPlaca.id, tipo: "entrada", quantidade: 1,
        local_destino_id: input.local_armazenamento_id,
        responsavel_user_id: user?.id,
        observacoes: `Nova placa ${codigo} (v${versao})${tipo === "reposicao" ? " - reposição" : ""}`,
      } as any);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Placa registrada!");
      setNovaPlacaDialog(false);
      setNovaPlacaSubstitui(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao registrar placa"),
  });

  const instalarMutation = useMutation({
    mutationFn: async (input: { placa: Placa; imovel: string; data: string; obs: string }) => {
      const imovel = input.imovel.trim();
      if (!imovel) throw new Error("Código do imóvel obrigatório");
      if (imovel.length > 30) throw new Error("Código do imóvel muito longo (máx 30)");
      if (input.placa.status !== "disponivel") throw new Error("Placa não está disponível");

      const { error } = await fromEstoque("estoque_placas").update({
        status: "instalada",
        imovel_codigo_atual: imovel,
        data_instalacao_atual: input.data,
      } as any).eq("id", input.placa.id);
      if (error) throw error;

      await fromEstoque("estoque_placas_historico").insert({
        placa_id: input.placa.id,
        tipo: "instalacao",
        imovel_codigo: imovel,
        data_evento: input.data,
        observacoes: input.obs || null,
        user_id: user?.id,
      } as any);

      await fromEstoque("estoque_movimentacoes").insert({
        material_id: input.placa.material_id, tipo: "saida", quantidade: 1,
        local_origem_id: input.placa.local_armazenamento_id,
        responsavel_user_id: user?.id,
        observacoes: `Placa ${input.placa.codigo} instalada no imóvel ${imovel}`,
      } as any);
    },
    onSuccess: () => { invalidate(); toast.success("Placa instalada!"); setInstalarDialog(false); },
    onError: (e: any) => toast.error(e?.message || "Erro ao instalar"),
  });

  const retirarMutation = useMutation({
    mutationFn: async (input: { placa: Placa; data: string; obs: string }) => {
      if (input.placa.status !== "instalada") throw new Error("Placa não está instalada");

      const { error } = await fromEstoque("estoque_placas").update({
        status: "disponivel",
        imovel_codigo_atual: null,
        data_instalacao_atual: null,
      } as any).eq("id", input.placa.id);
      if (error) throw error;

      // Atualiza a última instalação preenchendo data_retorno
      const { data: ultima } = await fromEstoque("estoque_placas_historico")
        .select("id").eq("placa_id", input.placa.id).eq("tipo", "instalacao")
        .is("data_retorno", null).order("data_evento", { ascending: false }).limit(1).maybeSingle();
      if (ultima) {
        await fromEstoque("estoque_placas_historico")
          .update({ data_retorno: input.data } as any).eq("id", (ultima as any).id);
      }

      await fromEstoque("estoque_placas_historico").insert({
        placa_id: input.placa.id,
        tipo: "retirada",
        imovel_codigo: input.placa.imovel_codigo_atual,
        data_evento: input.data,
        observacoes: input.obs || null,
        user_id: user?.id,
      } as any);

      await fromEstoque("estoque_movimentacoes").insert({
        material_id: input.placa.material_id, tipo: "entrada", quantidade: 1,
        local_destino_id: input.placa.local_armazenamento_id,
        responsavel_user_id: user?.id,
        observacoes: `Placa ${input.placa.codigo} retirada do imóvel ${input.placa.imovel_codigo_atual || "?"}`,
      } as any);
    },
    onSuccess: () => { invalidate(); toast.success("Placa retirada!"); setRetirarDialog(false); },
    onError: (e: any) => toast.error(e?.message || "Erro ao retirar"),
  });

  const perdaRouboMutation = useMutation({
    mutationFn: async (input: { placa: Placa; tipo: "roubo" | "perda"; data: string; obs: string }) => {
      if (input.placa.status === "roubada" || input.placa.status === "perdida" || input.placa.status === "baixada") {
        throw new Error("Placa já está em estado terminal");
      }
      const novoStatus: PlacaStatus = input.tipo === "roubo" ? "roubada" : "perdida";
      const { error } = await fromEstoque("estoque_placas").update({
        status: novoStatus,
      } as any).eq("id", input.placa.id);
      if (error) throw error;

      await fromEstoque("estoque_placas_historico").insert({
        placa_id: input.placa.id,
        tipo: input.tipo,
        imovel_codigo: input.placa.imovel_codigo_atual,
        data_evento: input.data,
        observacoes: input.obs || null,
        user_id: user?.id,
      } as any);

      await fromEstoque("estoque_movimentacoes").insert({
        material_id: input.placa.material_id, tipo: "saida", quantidade: 1,
        local_origem_id: input.placa.local_armazenamento_id,
        responsavel_user_id: user?.id,
        observacoes: `Placa ${input.placa.codigo} marcada como ${input.tipo}`,
      } as any);
    },
    onSuccess: (_, vars) => {
      invalidate();
      toast.success(`Placa marcada como ${vars.tipo}`);
      setPerdaRouboDialog(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao registrar"),
  });

  const excluirMutation = useMutation({
    mutationFn: async (placa: Placa) => {
      const { error } = await fromEstoque("estoque_placas").delete().eq("id", placa.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Placa excluída"); setExcluirDialog(false); },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir"),
  });

  if (!hasAccess("estoque")) {
    return <div className="p-8 text-muted-foreground">Sem permissão para acessar este módulo.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Tag className="h-6 w-6" /> Placas
          </h1>
          <p className="text-muted-foreground">Controle de entrada, instalação, roubo/perda e histórico das placas.</p>
        </div>
        <div className="flex gap-2">
          <PlacasPDFGenerator placas={placas} />
          {isAdminOrSuper && (
            <Button onClick={() => { setNovaPlacaSubstitui(null); setNovaPlacaDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Nova placa
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <TableSearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por código ou imóvel..." />
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos tipos</SelectItem>
              {Object.entries(TIPO_USO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tamanhoFiltro} onValueChange={setTamanhoFiltro}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos tamanhos</SelectItem>
              {Object.entries(TAMANHO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : paginatedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Tag className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma placa encontrada</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><SortableHeader label="Código" field="codigo" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} /></TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Imóvel atual</TableHead>
                    <TableHead>Local armazenamento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.codigo}</TableCell>
                      <TableCell><Badge variant="outline">v{p.versao}</Badge></TableCell>
                      <TableCell>{TIPO_USO_LABELS[p.tipo_uso]}</TableCell>
                      <TableCell>
                        {p.tamanho === "outro" ? `Outro (${p.tamanho_outro || "-"})` : TAMANHO_LABELS[p.tamanho]}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[p.status]}>
                          {STATUS_LABELS[p.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.imovel_codigo_atual || "—"}
                        {p.data_instalacao_atual && (
                          <div className="text-xs text-muted-foreground">
                            desde {format(new Date(p.data_instalacao_atual), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{localNome(p.local_armazenamento_id)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {p.status === "disponivel" && (
                            <Button size="sm" variant="ghost" title="Instalar em imóvel"
                              onClick={() => { setSelected(p); setInstalarDialog(true); }}>
                              <Wrench className="h-4 w-4" />
                            </Button>
                          )}
                          {p.status === "instalada" && (
                            <Button size="sm" variant="ghost" title="Retirar do imóvel"
                              onClick={() => { setSelected(p); setRetirarDialog(true); }}>
                              <ArrowLeftRight className="h-4 w-4" />
                            </Button>
                          )}
                          {(p.status === "disponivel" || p.status === "instalada") && (
                            <>
                              <Button size="sm" variant="ghost" title="Registrar roubo"
                                onClick={() => { setSelected(p); setPerdaRouboDialog("roubo"); }}>
                                <ShieldAlert className="h-4 w-4 text-red-500" />
                              </Button>
                              <Button size="sm" variant="ghost" title="Registrar perda"
                                onClick={() => { setSelected(p); setPerdaRouboDialog("perda"); }}>
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                              </Button>
                            </>
                          )}
                          {(p.status === "roubada" || p.status === "perdida") && isAdminOrSuper && (
                            <Button size="sm" variant="ghost" title="Comprar nova placa com este código (reposição)"
                              onClick={() => { setNovaPlacaSubstitui(p); setNovaPlacaDialog(true); }}>
                              <Plus className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" title="Ver histórico"
                            onClick={() => { setSelected(p); setHistoricoDialog(true); }}>
                            <HistoryIcon className="h-4 w-4" />
                          </Button>
                          {isAdminOrSuper && (
                            <Button size="sm" variant="ghost" title="Excluir" className="text-destructive"
                              onClick={() => { setSelected(p); setExcluirDialog(true); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-4">
                <TablePagination
                  currentPage={currentPage} totalPages={totalPages}
                  itemsPerPage={itemsPerPage} onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage} totalItems={filteredData.length}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ──────── NOVA PLACA ──────── */}
      <NovaPlacaDialog
        open={novaPlacaDialog}
        onOpenChange={(o) => { setNovaPlacaDialog(o); if (!o) setNovaPlacaSubstitui(null); }}
        materialPlaca={materialPlaca}
        locais={locais}
        codigosReuso={codigosReuso}
        substituiPlaca={novaPlacaSubstitui}
        onSubmit={(v) => novaPlacaMutation.mutate(v)}
        loading={novaPlacaMutation.isPending}
      />

      {/* ──────── INSTALAR ──────── */}
      {selected && (
        <InstalarDialog
          open={instalarDialog} onOpenChange={setInstalarDialog} placa={selected}
          onSubmit={(v) => instalarMutation.mutate({ placa: selected, ...v })}
          loading={instalarMutation.isPending}
        />
      )}

      {/* ──────── RETIRAR ──────── */}
      {selected && (
        <RetirarDialog
          open={retirarDialog} onOpenChange={setRetirarDialog} placa={selected}
          onSubmit={(v) => retirarMutation.mutate({ placa: selected, ...v })}
          loading={retirarMutation.isPending}
        />
      )}

      {/* ──────── ROUBO/PERDA ──────── */}
      {selected && perdaRouboDialog && (
        <RouboPerdaDialog
          open={!!perdaRouboDialog} tipo={perdaRouboDialog} placa={selected}
          onOpenChange={(o) => !o && setPerdaRouboDialog(null)}
          onSubmit={(v) => perdaRouboMutation.mutate({ placa: selected, tipo: perdaRouboDialog!, ...v })}
          loading={perdaRouboMutation.isPending}
        />
      )}

      {/* ──────── HISTÓRICO ──────── */}
      {selected && (
        <HistoricoDialog open={historicoDialog} onOpenChange={setHistoricoDialog} placa={selected} />
      )}

      {/* ──────── EXCLUIR ──────── */}
      <AlertDialog open={excluirDialog} onOpenChange={setExcluirDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir placa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a placa <strong>{selected?.codigo}</strong> (v{selected?.versao}) e todo o seu histórico.
              Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selected && excluirMutation.mutate(selected)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES (dialogs inline)
// ──────────────────────────────────────────────────────────────────────────

function NovaPlacaDialog({
  open, onOpenChange, materialPlaca, locais, codigosReuso, substituiPlaca, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  materialPlaca: MaterialOpt | null;
  locais: LocalOpt[];
  codigosReuso: Placa[];
  substituiPlaca: Placa | null;
  onSubmit: (v: {
    codigo: string; tipo_uso: TipoUso; tamanho: Tamanho; tamanho_outro: string;
    local_armazenamento_id: string; observacoes: string; substitui_placa_id: string | null;
  }) => void;
  loading: boolean;
}) {
  const [codigo, setCodigo] = useState("");
  const [tipoUso, setTipoUso] = useState<TipoUso>("venda");
  const [tamanho, setTamanho] = useState<Tamanho>("1x1");
  const [tamanhoOutro, setTamanhoOutro] = useState("");
  const [localId, setLocalId] = useState("");
  const [obs, setObs] = useState("");
  const [reusoSelecionado, setReusoSelecionado] = useState<string>("");

  // Pré-preenche se for reposição
  useEffect(() => {
    if (open && substituiPlaca) {
      setCodigo(substituiPlaca.codigo);
      setTipoUso(substituiPlaca.tipo_uso);
      setTamanho(substituiPlaca.tamanho);
      setTamanhoOutro(substituiPlaca.tamanho_outro || "");
      setLocalId(substituiPlaca.local_armazenamento_id || "");
      setObs("");
      setReusoSelecionado(substituiPlaca.id);
    } else if (open) {
      setCodigo(""); setTipoUso("venda"); setTamanho("1x1"); setTamanhoOutro("");
      setLocalId(""); setObs(""); setReusoSelecionado("");
    }
  }, [open, substituiPlaca]);

  const placaAlvoReuso = codigosReuso.find((p) => p.id === reusoSelecionado);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{substituiPlaca ? "Reposição de placa" : "Nova placa"}</DialogTitle>
          <DialogDescription>
            {materialPlaca
              ? `Material vinculado: ${materialPlaca.nome}`
              : "Cadastre primeiro um material chamado 'Placa' em /estoque/materiais."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {!substituiPlaca && codigosReuso.length > 0 && (
            <div className="space-y-2 p-3 rounded-md bg-muted/30 border">
              <Label className="text-xs">Reaproveitar código de placa anterior (opcional)</Label>
              <Select
                value={reusoSelecionado}
                onValueChange={(v) => {
                  setReusoSelecionado(v);
                  const alvo = codigosReuso.find((p) => p.id === v);
                  if (alvo) {
                    setCodigo(alvo.codigo);
                    setTipoUso(alvo.tipo_uso);
                    setTamanho(alvo.tamanho);
                    setTamanhoOutro(alvo.tamanho_outro || "");
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um código disponível" /></SelectTrigger>
                <SelectContent>
                  {codigosReuso.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo} (v{p.versao}) — {STATUS_LABELS[p.status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {placaAlvoReuso && (
                <p className="text-xs text-muted-foreground">
                  Será criada uma nova versão (v{placaAlvoReuso.versao + 1}) substituindo a placa anterior.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Código da placa *</Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={30} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de uso *</Label>
              <Select value={tipoUso} onValueChange={(v) => setTipoUso(v as TipoUso)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_USO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tamanho *</Label>
              <Select value={tamanho} onValueChange={(v) => setTamanho(v as Tamanho)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TAMANHO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tamanho === "outro" && (
            <div className="space-y-2">
              <Label>Especifique o tamanho</Label>
              <Input value={tamanhoOutro} onChange={(e) => setTamanhoOutro(e.target.value)} maxLength={30} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Local de armazenamento *</Label>
            <Select value={localId} onValueChange={setLocalId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {locais.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={loading || !materialPlaca || !codigo.trim() || !localId}
            onClick={() => onSubmit({
              codigo, tipo_uso: tipoUso, tamanho, tamanho_outro: tamanhoOutro,
              local_armazenamento_id: localId, observacoes: obs,
              substitui_placa_id: substituiPlaca?.id || placaAlvoReuso?.id || null,
            })}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InstalarDialog({
  open, onOpenChange, placa, onSubmit, loading,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; placa: Placa;
  onSubmit: (v: { imovel: string; data: string; obs: string }) => void; loading: boolean;
}) {
  const [imovel, setImovel] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  useEffect(() => { if (open) { setImovel(""); setData(new Date().toISOString().slice(0, 10)); setObs(""); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Instalar placa {placa.codigo}</DialogTitle>
          <DialogDescription>Informe o código do imóvel onde a placa será fixada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label>Código do imóvel *</Label>
            <Input value={imovel} onChange={(e) => setImovel(e.target.value)} maxLength={30} />
          </div>
          <div className="space-y-2">
            <Label>Data da instalação *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={loading || !imovel.trim()} onClick={() => onSubmit({ imovel, data, obs })}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RetirarDialog({
  open, onOpenChange, placa, onSubmit, loading,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; placa: Placa;
  onSubmit: (v: { data: string; obs: string }) => void; loading: boolean;
}) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  useEffect(() => { if (open) { setData(new Date().toISOString().slice(0, 10)); setObs(""); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retirar placa {placa.codigo}</DialogTitle>
          <DialogDescription>
            Imóvel atual: <strong>{placa.imovel_codigo_atual || "—"}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label>Data do retorno ao estoque *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={loading} onClick={() => onSubmit({ data, obs })}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RouboPerdaDialog({
  open, onOpenChange, tipo, placa, onSubmit, loading,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  tipo: "roubo" | "perda"; placa: Placa;
  onSubmit: (v: { data: string; obs: string }) => void; loading: boolean;
}) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  useEffect(() => { if (open) { setData(new Date().toISOString().slice(0, 10)); setObs(""); } }, [open]);
  const titulo = tipo === "roubo" ? "Registrar roubo" : "Registrar perda";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo} — placa {placa.codigo}</DialogTitle>
          <DialogDescription>
            A placa sairá do saldo de disponíveis. Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label>Data do ocorrido *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={3}
              placeholder={tipo === "roubo" ? "BO, local, descrição..." : "Onde foi perdida, contexto..."} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={loading}
            className={tipo === "roubo" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}
            onClick={() => onSubmit({ data, obs })}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoricoDialog({
  open, onOpenChange, placa,
}: { open: boolean; onOpenChange: (o: boolean) => void; placa: Placa }) {
  const { data: historico = [], isLoading } = useHistoricoPlaca(open ? placa.id : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico — placa {placa.codigo} (v{placa.versao})</DialogTitle>
          <DialogDescription>
            {TIPO_USO_LABELS[placa.tipo_uso]} · {placa.tamanho === "outro" ? placa.tamanho_outro : TAMANHO_LABELS[placa.tamanho]}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : historico.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">Sem eventos registrados.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Retorno</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{format(new Date(h.data_evento), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell><Badge variant="outline">{HIST_LABELS[h.tipo]}</Badge></TableCell>
                    <TableCell>{h.imovel_codigo || "—"}</TableCell>
                    <TableCell>{h.data_retorno ? format(new Date(h.data_retorno), "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px]">{h.observacoes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
