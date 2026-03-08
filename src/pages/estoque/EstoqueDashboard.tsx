import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, MapPin, AlertTriangle, ClipboardList, ArrowDownUp, TrendingDown, Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function EstoqueDashboard() {
  const navigate = useNavigate();

  const { data: materiais = [], isLoading: loadingMat } = useQuery({
    queryKey: ["estoque-materiais-count"],
    queryFn: async () => {
      const { data } = await supabase.from("estoque_materiais").select("id, nome, is_active");
      return data || [];
    },
  });

  const { data: locais = [], isLoading: loadingLoc } = useQuery({
    queryKey: ["estoque-locais-count"],
    queryFn: async () => {
      const { data } = await supabase.from("estoque_locais_armazenamento").select("id, is_active");
      return data || [];
    },
  });

  const { data: solicitacoes = [], isLoading: loadingSol } = useQuery({
    queryKey: ["estoque-solicitacoes-dash"],
    queryFn: async () => {
      const { data } = await supabase
        .from("estoque_solicitacoes")
        .select("id, status, created_at, solicitante_nome")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: saldos = [], isLoading: loadingSaldo } = useQuery({
    queryKey: ["estoque-saldos-dash"],
    queryFn: async () => {
      const { data } = await supabase
        .from("estoque_saldos")
        .select("quantidade, material_id, estoque_materiais(nome, estoque_minimo)");
      return data || [];
    },
  });

  const { data: movRecentes = [], isLoading: loadingMov } = useQuery({
    queryKey: ["estoque-mov-recentes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("estoque_movimentacoes")
        .select("id, tipo, quantidade, created_at, estoque_materiais(nome)")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const totalMateriaisAtivos = materiais.filter((m) => m.is_active !== false).length;
  const totalLocaisAtivos = locais.filter((l) => l.is_active !== false).length;
  const solPendentes = solicitacoes.filter((s) => s.status === "pendente").length;
  const solAprovadas = solicitacoes.filter((s) => s.status === "aprovada").length;

  const itensAbaixoMinimo = saldos.filter((s: any) => {
    const min = s.estoque_materiais?.estoque_minimo;
    return min != null && s.quantidade < min;
  });

  const isLoading = loadingMat || loadingLoc || loadingSol || loadingSaldo || loadingMov;

  const tipoLabel: Record<string, string> = {
    entrada: "Entrada",
    saida: "Saída",
    transferencia: "Transferência",
    ajuste: "Ajuste",
  };

  const tipoBadge: Record<string, string> = {
    entrada: "bg-green-600/15 text-green-700 border-green-200",
    saida: "bg-red-600/15 text-red-700 border-red-200",
    transferencia: "bg-blue-600/15 text-blue-700 border-blue-200",
    ajuste: "bg-amber-600/15 text-amber-700 border-amber-200",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Estoques</h1>
        <p className="text-muted-foreground">Visão geral do módulo de estoques</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/estoque/materiais")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Materiais Ativos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{totalMateriaisAtivos}</div>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/estoque/locais")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locais de Armazenamento</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{totalLocaisAtivos}</div>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/estoque/solicitacoes")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solicitações Pendentes</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{solPendentes}</span>
                {solAprovadas > 0 && (
                  <span className="text-sm text-muted-foreground">+ {solAprovadas} aprovadas</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover:shadow-md transition-shadow ${itensAbaixoMinimo.length > 0 ? "border-destructive/50" : ""}`}
          onClick={() => navigate("/estoque/saldos")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${itensAbaixoMinimo.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${itensAbaixoMinimo.length > 0 ? "text-destructive" : ""}`}>
                  {itensAbaixoMinimo.length}
                </span>
                <span className="text-sm text-muted-foreground">itens abaixo do mínimo</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Alertas de estoque baixo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-destructive" />
              Alertas de Estoque Baixo
            </CardTitle>
            <CardDescription>Materiais com saldo abaixo do mínimo configurado</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : itensAbaixoMinimo.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum material com estoque abaixo do mínimo 🎉
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {itensAbaixoMinimo.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <div>
                      <p className="text-sm font-medium">{item.estoque_materiais?.nome || "Material"}</p>
                      <p className="text-xs text-muted-foreground">
                        Mínimo: {item.estoque_materiais?.estoque_minimo}
                      </p>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      Saldo: {item.quantidade}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Movimentações recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
              Movimentações Recentes
            </CardTitle>
            <CardDescription>Últimas 5 movimentações registradas</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : movRecentes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma movimentação registrada ainda
              </p>
            ) : (
              <div className="space-y-2">
                {movRecentes.map((mov: any) => (
                  <div key={mov.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{mov.estoque_materiais?.nome || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {mov.created_at ? format(new Date(mov.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{mov.quantidade}</span>
                      <Badge variant="outline" className={tipoBadge[mov.tipo] || ""}>
                        {tipoLabel[mov.tipo] || mov.tipo}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
