import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Tag, Wrench, ArrowLeftRight, AlertTriangle, Plus,
  History as HistoryIcon, ShieldAlert, Trash2, Tag as TagIcon, Layers, Package, Info,
  RefreshCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { useUserRole } from "@/hooks/useUserRole";
import { useTableControls } from "@/hooks/useTableControls";
import { TableSearch, TablePagination, SortableHeader } from "@/components/vendas/TableControls";
import {
  usePlacas, useHistoricoPlaca, Placa, PlacaStatus,
  STATUS_LABELS, STATUS_COLORS, TIPO_USO_LABELS, TAMANHO_LABELS, HIST_LABELS,
  MaterialPlaca, resolvePlacaAttributes, formatPlacaTamanho,
} from "@/hooks/useEstoquePlacas";
import { PlacasPDFGenerator } from "@/components/estoque/placas/PlacasPDFGenerator";
import { NovaSaidaDialog } from "@/components/estoque/placas/NovaSaidaDialog";
import { AtribuirCodigoDialog } from "@/components/estoque/placas/AtribuirCodigoDialog";
import { ReaproveitarCodigoDialog } from "@/components/estoque/placas/ReaproveitarCodigoDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fromEstoque = (t: string) => supabase.from(t as any);

interface LocalOpt { id: string; nome: string; }
interface SaldoPlacaRow { id: string; material_id: string; local_armazenamento_id: string; quantidade: number; }

type AbaStatus = "disponivel" | "instalada" | "baixadas";

type ResumoSaldoPlaca = {
  key: string;
  material_id: string;
  material_nome: string;
  local_armazenamento_id: string;
  quantidade: number;
  tipo_uso: "venda" | "aluga";
  tamanho: "1x1" | "2x2" | "outro";
  tamanho_outro: string | null;
};

type PlacaTabelaRow = {
  rowType: "placa" | "saldo";
  id: string;
  codigo: string | null;
  material_id: string;
  material_nome: string;
  tipo_uso: "venda" | "aluga";
  tamanho: "1x1" | "2x2" | "outro";
  tamanho_outro: string | null;
  local_armazenamento_id: string | null;
  local_nome: string;
  status: PlacaStatus | "saldo_agregado";
  imovel_codigo_atual: string | null;
  data_instalacao_atual: string | null;
  quantidade: number;
  placa?: Placa;
};

type SaldoPlacaComMaterial = SaldoPlacaRow & {
  material?: MaterialPlaca | null;
};

export default function EstoquePlacas() {
  const queryClient = useQueryClient();
  const { hasAccess, user } = useSystemAccess();
  const { isSuperAdmin, isAdmin } = useUserRole();
  const isAdminOrSuper = isSuperAdmin || isAdmin;

  const [aba, setAba] = useState<AbaStatus>("disponivel");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [tamanhoFiltro, setTamanhoFiltro] = useState<string>("todos");
  const [materialFiltro, setMaterialFiltro] = useState<string>("todos");
  const [localFiltro, setLocalFiltro] = useState<string>("todos");

  const [instalarDialog, setInstalarDialog] = useState(false);
  const [retirarDialog, setRetirarDialog] = useState(false);
  const [perdaRouboDialog, setPerdaRouboDialog] = useState<null | "roubo" | "perda">(null);
  const [historicoDialog, setHistoricoDialog] = useState(false);
  const [excluirDialog, setExcluirDialog] = useState(false);
  const [novaSaidaDialog, setNovaSaidaDialog] = useState(false);
  const [novaSaidaDefaults, setNovaSaidaDefaults] = useState<{ materialId?: string; localId?: string; mode?: "novo" | "existente" }>({});
  const [atribuirCodigoDialog, setAtribuirCodigoDialog] = useState(false);
  const [reaproveitarDialog, setReaproveitarDialog] = useState(false);
  const [selected, setSelected] = useState<Placa | null>(null);

  const { data: placas = [], isLoading } = usePlacas();

  const { data: materiaisPlaca = [] } = useQuery({
    queryKey: ["estoque-materiais-placa"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_materiais")
        .select("id, nome, categoria_id, categoria, unidade_medida, estoque_minimo, is_placa, is_active, tipo_uso, tamanho, tamanho_outro")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      const rows = (data as unknown as MaterialPlaca[]) || [];
      return rows.filter((m) => m.is_placa || m.nome.toLowerCase().startsWith("placa"));
    },
  });

  const { data: locais = [] } = useQuery({
    queryKey: ["estoque-locais-placas"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_locais_armazenamento")
        .select("id, nome").eq("is_active", true).order("nome");
      if (error) throw error;
      return (data as unknown as LocalOpt[]) || [];
    },
  });
  const localNome = (id: string | null) =>
    id ? (locais.find((l) => l.id === id)?.nome || "—") : "—";

  const materialNome = (id: string | null) =>
    id ? (materiaisPlaca.find((m) => m.id === id)?.nome || "—") : "—";

  const { data: saldosPlaca = [], isLoading: isLoadingSaldosPlaca } = useQuery({
    queryKey: ["estoque-saldos-placas"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_saldos")
        .select(`
          id,
          material_id,
          local_armazenamento_id,
          quantidade,
          material:estoque_materiais!inner(
            id,
            nome,
            categoria_id,
            categoria,
            unidade_medida,
            estoque_minimo,
            is_placa,
            is_active,
            tipo_uso,
            tamanho,
            tamanho_outro
          )
        `)
        .gt("quantidade", 0)
        .eq("material.is_active", true);
      if (error) throw error;
      const rows = (data as unknown as SaldoPlacaComMaterial[]) || [];
      return rows.filter((s) => {
        const material = s.material;
        return !!material && (material.is_placa || material.nome.toLowerCase().startsWith("placa"));
      });
    },
  });

  const resumoSaldosPlaca = useMemo<ResumoSaldoPlaca[]>(() => {
    return saldosPlaca.map((s) => {
      const material = s.material || materiaisPlaca.find((m) => m.id === s.material_id);
      const attrs = resolvePlacaAttributes(material);
      return {
        key: s.id,
        material_id: s.material_id,
        material_nome: material?.nome || "—",
        local_armazenamento_id: s.local_armazenamento_id,
        quantidade: s.quantidade,
        ...attrs,
      };
    });
  }, [saldosPlaca, materiaisPlaca]);

  const resumoFiltrado = useMemo(() => {
    return resumoSaldosPlaca.filter((r) => {
      if (tipoFiltro !== "todos" && r.tipo_uso !== tipoFiltro) return false;
      if (tamanhoFiltro !== "todos" && r.tamanho !== tamanhoFiltro) return false;
      if (materialFiltro !== "todos" && r.material_id !== materialFiltro) return false;
      if (localFiltro !== "todos" && r.local_armazenamento_id !== localFiltro) return false;
      return true;
    });
  }, [resumoSaldosPlaca, tipoFiltro, tamanhoFiltro, materialFiltro, localFiltro]);

  // Filtra por aba + filtros adicionais
  const placasFiltradas = useMemo(() => {
    const matchAba = (p: Placa) =>
      aba === "disponivel" ? p.status === "disponivel"
      : aba === "instalada" ? p.status === "instalada"
      : (p.status === "roubada" || p.status === "perdida" || p.status === "baixada");
    return placas.filter((p) => {
      if (!matchAba(p)) return false;
      if (tipoFiltro !== "todos" && p.tipo_uso !== tipoFiltro) return false;
      if (tamanhoFiltro !== "todos" && p.tamanho !== tamanhoFiltro) return false;
      if (materialFiltro !== "todos" && p.material_id !== materialFiltro) return false;
      if (localFiltro !== "todos" && p.local_armazenamento_id !== localFiltro) return false;
      return true;
    });
  }, [placas, aba, tipoFiltro, tamanhoFiltro, materialFiltro, localFiltro]);

  const linhasTabela = useMemo<PlacaTabelaRow[]>(() => {
    const placaRows = placasFiltradas.map((p) => ({
      rowType: "placa" as const,
      id: p.id,
      codigo: p.codigo,
      material_id: p.material_id,
      material_nome: materialNome(p.material_id),
      tipo_uso: p.tipo_uso,
      tamanho: p.tamanho,
      tamanho_outro: p.tamanho_outro,
      local_armazenamento_id: p.local_armazenamento_id,
      local_nome: localNome(p.local_armazenamento_id),
      status: p.status,
      imovel_codigo_atual: p.imovel_codigo_atual,
      data_instalacao_atual: p.data_instalacao_atual,
      quantidade: 1,
      placa: p,
    }));

    if (aba !== "disponivel") return placaRows;

    const fisicasPorMaterialLocal = new Map<string, number>();
    for (const p of placasFiltradas) {
      const key = `${p.material_id}:${p.local_armazenamento_id ?? ""}`;
      fisicasPorMaterialLocal.set(key, (fisicasPorMaterialLocal.get(key) ?? 0) + 1);
    }

    const saldoRows = resumoFiltrado.flatMap((r) => {
      const key = `${r.material_id}:${r.local_armazenamento_id}`;
      const quantidadeSemPlacaFisica = Math.max(r.quantidade - (fisicasPorMaterialLocal.get(key) ?? 0), 0);
      if (quantidadeSemPlacaFisica <= 0) return [];
      return [{
        rowType: "saldo" as const,
        id: `saldo-${r.key}`,
        codigo: null,
        material_id: r.material_id,
        material_nome: r.material_nome,
        tipo_uso: r.tipo_uso,
        tamanho: r.tamanho,
        tamanho_outro: r.tamanho_outro,
        local_armazenamento_id: r.local_armazenamento_id,
        local_nome: localNome(r.local_armazenamento_id),
        status: "saldo_agregado" as const,
        imovel_codigo_atual: null,
        data_instalacao_atual: null,
        quantidade: quantidadeSemPlacaFisica,
      }];
    });

    return [...placaRows, ...saldoRows];
  }, [placasFiltradas, aba, resumoFiltrado, materiaisPlaca, locais]);

  const counts = useMemo(() => ({
    disponivel: Math.max(
      resumoSaldosPlaca.reduce((acc, item) => acc + item.quantidade, 0),
      placas.filter((p) => p.status === "disponivel").length
    ),
    instalada: placas.filter((p) => p.status === "instalada").length,
    baixadas: placas.filter((p) => ["roubada","perdida","baixada"].includes(p.status)).length,
  }), [placas, resumoSaldosPlaca]);

  const {
    searchTerm, setSearchTerm, currentPage, setCurrentPage,
    itemsPerPage, setItemsPerPage, sortField, sortDirection, setSorting,
    paginatedData, filteredData, totalPages,
  } = useTableControls({
    data: linhasTabela,
    searchField: ["codigo", "imovel_codigo_atual", "material_nome", "local_nome"] as any,
    defaultItemsPerPage: 25,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["estoque-placas"] });
    queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });
    queryClient.invalidateQueries({ queryKey: ["estoque-saldos-placas"] });
    queryClient.invalidateQueries({ queryKey: ["estoque-materiais-placa"] });
    queryClient.invalidateQueries({ queryKey: ["estoque-saldos-check"] });
    queryClient.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
  };

  // ─── MUTATIONS ───
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
        observacoes: `Placa ${input.placa.codigo ?? "(sem código)"} instalada no imóvel ${imovel}`,
      } as any);

      if (input.placa.local_armazenamento_id) {
        const { data: saldo } = await fromEstoque("estoque_saldos")
          .select("id, quantidade")
          .eq("material_id", input.placa.material_id)
          .eq("local_armazenamento_id", input.placa.local_armazenamento_id)
          .maybeSingle();
        if (saldo) {
          const novaQuantidade = Math.max(((saldo as any).quantidade || 0) - 1, 0);
          if (novaQuantidade === 0) {
            await fromEstoque("estoque_saldos").delete().eq("id", (saldo as any).id);
          } else {
            await fromEstoque("estoque_saldos").update({ quantidade: novaQuantidade } as any).eq("id", (saldo as any).id);
          }
        }
      }
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
        observacoes: `Placa ${input.placa.codigo ?? "(sem código)"} retirada do imóvel ${input.placa.imovel_codigo_atual || "?"}`,
      } as any);

      if (input.placa.local_armazenamento_id) {
        const { data: saldo } = await fromEstoque("estoque_saldos")
          .select("id, quantidade")
          .eq("material_id", input.placa.material_id)
          .eq("local_armazenamento_id", input.placa.local_armazenamento_id)
          .maybeSingle();
        if (saldo) {
          await fromEstoque("estoque_saldos")
            .update({ quantidade: ((saldo as any).quantidade || 0) + 1 } as any)
            .eq("id", (saldo as any).id);
        } else {
          await fromEstoque("estoque_saldos").insert({
            material_id: input.placa.material_id,
            local_armazenamento_id: input.placa.local_armazenamento_id,
            quantidade: 1,
          } as any);
        }
      }
    },
    onSuccess: () => { invalidate(); toast.success("Placa retirada!"); setRetirarDialog(false); },
    onError: (e: any) => toast.error(e?.message || "Erro ao retirar"),
  });

  const perdaRouboMutation = useMutation({
    mutationFn: async (input: { placa: Placa; tipo: "roubo" | "perda"; data: string; obs: string }) => {
      if (["roubada","perdida","baixada"].includes(input.placa.status)) {
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
        observacoes: `Placa ${input.placa.codigo ?? "(sem código)"} marcada como ${input.tipo}`,
      } as any);

      if (input.placa.status === "disponivel" && input.placa.local_armazenamento_id) {
        const { data: saldo } = await fromEstoque("estoque_saldos")
          .select("id, quantidade")
          .eq("material_id", input.placa.material_id)
          .eq("local_armazenamento_id", input.placa.local_armazenamento_id)
          .maybeSingle();
        if (saldo) {
          const novaQuantidade = Math.max(((saldo as any).quantidade || 0) - 1, 0);
          if (novaQuantidade === 0) {
            await fromEstoque("estoque_saldos").delete().eq("id", (saldo as any).id);
          } else {
            await fromEstoque("estoque_saldos").update({ quantidade: novaQuantidade } as any).eq("id", (saldo as any).id);
          }
        }
      }
    },
    onSuccess: (_, vars) => {
      invalidate();
      toast.success(`Placa marcada como ${vars.tipo}`);
      setPerdaRouboDialog(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao registrar"),
  });

  const excluirMutation = useMutation({
    mutationFn: async (input: { placa: Placa; justificativa: string }) => {
      const { placa, justificativa } = input;
      const just = justificativa.trim();
      if (just.length < 5) throw new Error("Justificativa obrigatória (mín. 5 caracteres)");

      // Se estava disponível em algum local, devolve 1 unidade ao saldo (decrementa)
      if (placa.status === "disponivel" && placa.local_armazenamento_id) {
        const { data: saldo } = await fromEstoque("estoque_saldos")
          .select("id, quantidade")
          .eq("material_id", placa.material_id)
          .eq("local_armazenamento_id", placa.local_armazenamento_id)
          .maybeSingle();
        if (saldo) {
          const novaQuantidade = Math.max(((saldo as any).quantidade || 0) - 1, 0);
          if (novaQuantidade === 0) {
            await fromEstoque("estoque_saldos").delete().eq("id", (saldo as any).id);
          } else {
            await fromEstoque("estoque_saldos")
              .update({ quantidade: novaQuantidade } as any)
              .eq("id", (saldo as any).id);
          }
        }

        await fromEstoque("estoque_movimentacoes").insert({
          material_id: placa.material_id,
          tipo: "saida",
          quantidade: 1,
          local_origem_id: placa.local_armazenamento_id,
          responsavel_user_id: user?.id,
          observacoes: `Exclusão de placa ${placa.codigo ?? "(sem código)"}: ${just}`,
        } as any);
      } else {
        // Apenas registra a movimentação de auditoria (sem alterar saldo)
        await fromEstoque("estoque_movimentacoes").insert({
          material_id: placa.material_id,
          tipo: "saida",
          quantidade: 0,
          local_origem_id: placa.local_armazenamento_id,
          responsavel_user_id: user?.id,
          observacoes: `Exclusão de placa ${placa.codigo ?? "(sem código)"} (status ${placa.status}): ${just}`,
        } as any);
      }

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
          <p className="text-muted-foreground">
            Esta página tem dois blocos: <strong className="text-blue-500">Saldos</strong> (quantidades agregadas por material e local)
            e <strong className="text-emerald-500">Placas</strong> (cada unidade física, com ou sem código).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setNovaSaidaDefaults({}); setNovaSaidaDialog(true); }} title="Escolha o material e local. Para uma placa específica, use o ícone de chave inglesa na lista abaixo.">
            <Plus className="h-4 w-4 mr-2" /> Nova saída para imóvel
          </Button>
          <PlacasPDFGenerator placas={placas} />
        </div>
      </div>

      <NovaSaidaDialog
        open={novaSaidaDialog}
        onOpenChange={setNovaSaidaDialog}
        initialMaterialId={novaSaidaDefaults.materialId}
        initialLocalId={novaSaidaDefaults.localId}
        initialMode={novaSaidaDefaults.mode}
      />

      <Tabs value={aba} onValueChange={(v) => { setAba(v as AbaStatus); setCurrentPage(1); }}>
        <TabsList>
          <TabsTrigger value="disponivel">
            Disponíveis <Badge variant="secondary" className="ml-2">{counts.disponivel}</Badge>
          </TabsTrigger>
          <TabsTrigger value="instalada">
            Instaladas <Badge variant="secondary" className="ml-2">{counts.instalada}</Badge>
          </TabsTrigger>
          <TabsTrigger value="baixadas">
            Baixadas <Badge variant="secondary" className="ml-2">{counts.baixadas}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={aba} className="space-y-4 mt-4">
          {aba === "disponivel" && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="pt-4">
                <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-2">
                    <Layers className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <h2 className="font-semibold text-foreground">Saldos por material e local</h2>
                      <p className="text-xs text-muted-foreground">
                        Quantidades agregadas. Para registrar entradas/baixas de saldo, use a aba Saldos.
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
                    {resumoFiltrado.reduce((acc, item) => acc + item.quantidade, 0)} unidade(s)
                  </Badge>
                </div>
                {resumoFiltrado.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nenhum saldo de placa encontrado para os filtros.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Local</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resumoFiltrado.map((r) => (
                        <TableRow key={r.key}>
                          <TableCell className="font-medium">{r.material_nome}</TableCell>
                          <TableCell>{TIPO_USO_LABELS[r.tipo_uso]}</TableCell>
                          <TableCell>{formatPlacaTamanho(r.tamanho, r.tamanho_outro)}</TableCell>
                          <TableCell>{localNome(r.local_armazenamento_id)}</TableCell>
                          <TableCell className="text-right font-mono">{r.quantidade}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          <Card className={
            aba === "disponivel" ? "border-emerald-500/30 bg-emerald-500/5"
            : aba === "instalada" ? "border-indigo-500/30 bg-indigo-500/5"
            : "border-muted-foreground/20 bg-muted/20"
          }>
            <CardContent className="p-0">
              <div className="p-4 flex items-start justify-between gap-3 flex-wrap border-b">
                <div className="flex items-start gap-2">
                  <Package className={
                    "h-5 w-5 mt-0.5 " + (
                      aba === "disponivel" ? "text-emerald-500"
                      : aba === "instalada" ? "text-indigo-500"
                      : "text-muted-foreground"
                    )
                  } />
                  <div>
                    <h2 className="font-semibold text-foreground">
                      Placas {aba === "disponivel" ? "disponíveis" : aba === "instalada" ? "instaladas" : "baixadas (roubadas/perdidas/baixadas)"}
                    </h2>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Cada linha é uma unidade física. Use o ícone <TagIcon className="h-3 w-3 inline" /> para atribuir código a placas sem identificação.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 border-b">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Buscar</Label>
                  <TableSearch value={searchTerm} onChange={setSearchTerm} placeholder="Código ou imóvel..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Material</Label>
                  <Select value={materialFiltro} onValueChange={setMaterialFiltro}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos materiais</SelectItem>
                      {materiaisPlaca.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tipo de uso</Label>
                  <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos tipos</SelectItem>
                      {Object.entries(TIPO_USO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tamanho</Label>
                  <Select value={tamanhoFiltro} onValueChange={setTamanhoFiltro}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos tamanhos</SelectItem>
                      {Object.entries(TAMANHO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Local</Label>
                  <Select value={localFiltro} onValueChange={setLocalFiltro}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos locais</SelectItem>
                      {locais.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {isLoading || isLoadingSaldosPlaca ? (
                <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : paginatedData.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <Tag className="h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhuma disponibilidade encontrada nesta categoria</p>
                  {aba === "disponivel" && resumoFiltrado.length > 0 && (
                    <p className="mt-2 max-w-xl text-center text-sm">
                      Há saldo agregado para estes filtros, mas ele não corresponde aos filtros ou à busca aplicada nesta lista.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead><SortableHeader label="Código" field="codigo" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} /></TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Imóvel atual</TableHead>
                        <TableHead>Local armazenamento</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((row) => {
                        const p = row.placa;
                        return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.codigo || (
                              <div>
                                <span className="text-muted-foreground italic">sem código</span>
                                {row.rowType === "saldo" && (
                                  <div className="text-xs text-muted-foreground">
                                    {row.quantidade} unidade{row.quantidade !== 1 ? "s" : ""} em saldo
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{row.material_nome}</TableCell>
                          <TableCell>{TIPO_USO_LABELS[row.tipo_uso]}</TableCell>
                          <TableCell>
                            {row.tamanho === "outro" ? `Outro (${row.tamanho_outro || "-"})` : TAMANHO_LABELS[row.tamanho]}
                          </TableCell>
                          <TableCell>
                            {row.rowType === "saldo" ? (
                              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                                Saldo agregado
                              </Badge>
                            ) : p ? (
                              <Badge variant="outline" className={STATUS_COLORS[p.status]}>
                                {STATUS_LABELS[p.status]}
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.imovel_codigo_atual || "—"}
                            {row.data_instalacao_atual && (
                              <div className="text-xs text-muted-foreground">
                                desde {format(new Date(row.data_instalacao_atual), "dd/MM/yyyy", { locale: ptBR })}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{row.local_nome}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 flex-wrap">
                              {row.rowType === "saldo" ? (
                                <Button size="sm" variant="ghost" title="Criar código e instalar em um imóvel"
                                  onClick={() => {
                                    setNovaSaidaDefaults({ materialId: row.material_id, localId: row.local_armazenamento_id || undefined, mode: "novo" });
                                    setNovaSaidaDialog(true);
                                  }}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                              ) : p && !p.codigo && (
                                <>
                                  <Button size="sm" variant="ghost" title="Atribuir código"
                                    onClick={() => { setSelected(p); setAtribuirCodigoDialog(true); }}>
                                    <TagIcon className="h-4 w-4 text-amber-500" />
                                  </Button>
                                  <Button size="sm" variant="ghost" title="Reaproveitar código de placa roubada/perdida"
                                    onClick={() => { setSelected(p); setReaproveitarDialog(true); }}>
                                    <RefreshCcw className="h-4 w-4 text-blue-500" />
                                  </Button>
                                </>
                              )}
                              {p?.status === "disponivel" && (
                                <Button size="sm" variant="ghost" title="Instalar esta placa em um imóvel"
                                  onClick={() => { setSelected(p); setInstalarDialog(true); }}>
                                  <Wrench className="h-4 w-4" />
                                </Button>
                              )}
                              {p?.status === "instalada" && (
                                <Button size="sm" variant="ghost" title="Retirar do imóvel"
                                  onClick={() => { setSelected(p); setRetirarDialog(true); }}>
                                  <ArrowLeftRight className="h-4 w-4" />
                                </Button>
                              )}
                              {p && (p.status === "disponivel" || p.status === "instalada") && (
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
                              {p && (
                                <Button size="sm" variant="ghost" title="Ver histórico"
                                  onClick={() => { setSelected(p); setHistoricoDialog(true); }}>
                                  <HistoryIcon className="h-4 w-4" />
                                </Button>
                              )}
                              {p && isAdminOrSuper && (
                                <Button size="sm" variant="ghost" title="Excluir" className="text-destructive"
                                  onClick={() => { setSelected(p); setExcluirDialog(true); }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                      })}
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
        </TabsContent>
      </Tabs>

      {selected && (
        <InstalarDialog
          open={instalarDialog} onOpenChange={setInstalarDialog} placa={selected}
          onSubmit={(v) => instalarMutation.mutate({ placa: selected, ...v })}
          loading={instalarMutation.isPending}
        />
      )}
      {selected && (
        <RetirarDialog
          open={retirarDialog} onOpenChange={setRetirarDialog} placa={selected}
          onSubmit={(v) => retirarMutation.mutate({ placa: selected, ...v })}
          loading={retirarMutation.isPending}
        />
      )}
      {selected && perdaRouboDialog && (
        <RouboPerdaDialog
          open={!!perdaRouboDialog} tipo={perdaRouboDialog} placa={selected}
          onOpenChange={(o) => !o && setPerdaRouboDialog(null)}
          onSubmit={(v) => perdaRouboMutation.mutate({ placa: selected, tipo: perdaRouboDialog!, ...v })}
          loading={perdaRouboMutation.isPending}
        />
      )}
      {selected && (
        <HistoricoDialog open={historicoDialog} onOpenChange={setHistoricoDialog} placa={selected} />
      )}
      <AtribuirCodigoDialog
        open={atribuirCodigoDialog}
        onOpenChange={setAtribuirCodigoDialog}
        placa={selected}
        materialNome={selected ? materialNome(selected.material_id) : ""}
        localNome={selected ? localNome(selected.local_armazenamento_id) : ""}
      />

      <ExcluirPlacaDialog
        open={excluirDialog}
        onOpenChange={setExcluirDialog}
        placa={selected}
        loading={excluirMutation.isPending}
        onSubmit={(justificativa) => selected && excluirMutation.mutate({ placa: selected, justificativa })}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ──────────────────────────────────────────────────────────────────────────

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
          <DialogTitle>Instalar placa {placa.codigo ?? "(sem código)"}</DialogTitle>
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
          <DialogTitle>Retirar placa {placa.codigo ?? "(sem código)"}</DialogTitle>
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
          <DialogTitle>{titulo} — placa {placa.codigo ?? "(sem código)"}</DialogTitle>
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
          <DialogTitle>Histórico — placa {placa.codigo ?? "(sem código)"}</DialogTitle>
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

function ExcluirPlacaDialog({
  open, onOpenChange, placa, loading, onSubmit,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  placa: Placa | null; loading: boolean;
  onSubmit: (justificativa: string) => void;
}) {
  const [just, setJust] = useState("");
  useEffect(() => { if (open) setJust(""); }, [open]);
  const valid = just.trim().length >= 5;
  const devolveSaldo = !!placa && placa.status === "disponivel" && !!placa.local_armazenamento_id;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir placa?</AlertDialogTitle>
          <AlertDialogDescription>
            Remove a placa <strong>{placa?.codigo ?? "(sem código)"}</strong> e todo o seu histórico. Não pode ser desfeita.
            {devolveSaldo && (
              <span className="block mt-2 text-xs">
                Como a placa está <strong>disponível</strong>, 1 unidade será descontada do saldo do local de origem.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label>Justificativa da exclusão *</Label>
          <Textarea
            value={just}
            onChange={(e) => setJust(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Explique o motivo (mín. 5 caracteres)"
          />
          <p className="text-xs text-muted-foreground">
            A justificativa será registrada nas movimentações para auditoria.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!valid || loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => { e.preventDefault(); if (valid) onSubmit(just); }}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}