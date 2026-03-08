import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, History, ArrowDownUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const fromEstoque = (table: string) => supabase.from(table as any);

interface Movimentacao {
  id: string;
  material_id: string;
  tipo: string;
  quantidade: number;
  local_origem_id: string | null;
  local_destino_id: string | null;
  solicitacao_id: string | null;
  responsavel_user_id: string | null;
  recebido_por_user_id: string | null;
  recebido_em: string | null;
  observacoes: string | null;
  created_at: string;
}

const TIPO_LABELS: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  transferencia: "Transferência",
  ajuste: "Ajuste",
};

const TIPO_COLORS: Record<string, string> = {
  entrada: "bg-green-500/20 text-green-400 border-green-500/30",
  saida: "bg-red-500/20 text-red-400 border-red-500/30",
  transferencia: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ajuste: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export default function EstoqueMovimentacoes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");

  const { data: materiais = [] } = useQuery({
    queryKey: ["estoque-materiais-all"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_materiais").select("id, nome");
      if (error) throw error;
      return data as unknown as { id: string; nome: string }[];
    },
  });

  const { data: locais = [] } = useQuery({
    queryKey: ["estoque-locais-all"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_locais_armazenamento").select("id, nome, unidade_id");
      if (error) throw error;
      return data as unknown as { id: string; nome: string; unidade_id: string }[];
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["ferias-unidades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ferias_unidades").select("id, nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ["estoque-movimentacoes"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_movimentacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as Movimentacao[];
    },
  });

  const getMaterialNome = (id: string) => materiais.find((m) => m.id === id)?.nome || "—";
  const getLocalNome = (id: string | null) => {
    if (!id) return "—";
    const local = locais.find((l) => l.id === id);
    if (!local) return "—";
    const unidade = unidades.find((u) => u.id === local.unidade_id);
    return `${local.nome} (${unidade?.nome || ""})`;
  };

  const filtered = movimentacoes.filter((m) => {
    if (filterTipo !== "all" && m.tipo !== filterTipo) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matNome = getMaterialNome(m.material_id).toLowerCase();
      const obs = (m.observacoes || "").toLowerCase();
      if (!matNome.includes(term) && !obs.includes(term)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Movimentações</h1>
        <p className="text-muted-foreground">Histórico completo de movimentações do estoque</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Buscar por material ou observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sm:max-w-xs"
            />
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="sm:max-w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(TIPO_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
              <ArrowDownUp className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma movimentação encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((mov) => (
                  <TableRow key={mov.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(mov.created_at).toLocaleDateString("pt-BR")}{" "}
                      <span className="text-muted-foreground text-xs">
                        {new Date(mov.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TIPO_COLORS[mov.tipo] || ""}>
                        {TIPO_LABELS[mov.tipo] || mov.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{getMaterialNome(mov.material_id)}</TableCell>
                    <TableCell className="text-right font-mono">{mov.quantidade}</TableCell>
                    <TableCell className="text-sm">{getLocalNome(mov.local_origem_id)}</TableCell>
                    <TableCell className="text-sm">{getLocalNome(mov.local_destino_id)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{mov.observacoes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
