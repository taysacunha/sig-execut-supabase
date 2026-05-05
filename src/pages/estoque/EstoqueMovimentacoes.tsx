import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowDownUp, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTableControls } from "@/hooks/useTableControls";
import { TableSearch, TablePagination, SortableHeader } from "@/components/vendas/TableControls";
import { exportToExcel } from "@/lib/exportUtils";

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

  const { data: profiles = [] } = useQuery({
    queryKey: ["user-profiles-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_profiles").select("user_id, name");
      if (error) throw error;
      return data as { user_id: string; name: string }[];
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
  const getUserName = (id: string | null) => {
    if (!id) return "—";
    return profiles.find((p) => p.user_id === id)?.name || "—";
  };

  // Enrich data for table controls
  const enriched = movimentacoes
    .filter((m) => filterTipo === "all" || m.tipo === filterTipo)
    .map((m) => ({
      ...m,
      material_nome: getMaterialNome(m.material_id),
      tipo_label: TIPO_LABELS[m.tipo] || m.tipo,
      responsavel_nome: getUserName(m.responsavel_user_id),
      recebedor_nome: getUserName(m.recebido_por_user_id),
    }));

  const {
    searchTerm, setSearchTerm, currentPage, setCurrentPage,
    itemsPerPage, setItemsPerPage, sortField, sortDirection, setSorting,
    paginatedData, filteredData, totalPages,
  } = useTableControls({
    data: enriched,
    searchField: ["material_nome", "observacoes"],
    defaultItemsPerPage: 25,
  });

  const handleExport = () => {
    const rows = filteredData.map((m) => ({
      Data: new Date(m.created_at).toLocaleString("pt-BR"),
      Tipo: m.tipo_label,
      Material: m.material_nome,
      Quantidade: m.quantidade,
      Origem: getLocalNome(m.local_origem_id),
      Destino: getLocalNome(m.local_destino_id),
      Responsável: m.responsavel_nome,
      Recebedor: m.recebedor_nome,
      "Recebido em": m.recebido_em ? new Date(m.recebido_em).toLocaleString("pt-BR") : "—",
      Observações: m.observacoes || "",
    }));
    if (rows.length === 0) return;
    exportToExcel(rows, `movimentacoes_estoque_${new Date().toISOString().slice(0, 10)}`, "Movimentações");
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Movimentações</h1>
            <p className="text-muted-foreground">Histórico completo de movimentações do estoque</p>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={filteredData.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <TableSearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por material ou observação..." />
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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <ArrowDownUp className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma movimentação encontrada</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortableHeader label="Data" field="created_at" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
                    </TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>
                      <SortableHeader label="Material" field="material_nome" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader label="Qtd" field="quantidade" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
                    </TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Recebedor</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((mov) => (
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
                      <TableCell className="font-medium">{mov.material_nome}</TableCell>
                      <TableCell className="text-right font-mono">{mov.quantidade}</TableCell>
                      <TableCell className="text-sm">{getLocalNome(mov.local_origem_id)}</TableCell>
                      <TableCell className="text-sm">{getLocalNome(mov.local_destino_id)}</TableCell>
                      <TableCell className="text-sm">{mov.responsavel_nome}</TableCell>
                      <TableCell className="text-sm">
                        {mov.recebedor_nome}
                        {mov.recebido_em && (
                          <div className="text-xs text-muted-foreground">
                            {new Date(mov.recebido_em).toLocaleDateString("pt-BR")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{mov.observacoes || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
