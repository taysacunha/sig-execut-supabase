import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Filter, Users, Eye, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ColaboradorDialog from "@/components/ferias/colaboradores/ColaboradorDialog";
import ColaboradorViewDialog from "@/components/ferias/colaboradores/ColaboradorViewDialog";
import ColaboradorFilters from "@/components/ferias/colaboradores/ColaboradorFilters";
import { TableSearch, TablePagination, SortableHeader } from "@/components/vendas/TableControls";
import { useTableControls } from "@/hooks/useTableControls";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface Colaborador {
  id: string;
  nome: string;
  nome_exibicao: string | null;
  cpf: string | null;
  data_nascimento: string;
  data_admissao: string;
  unidade_id: string | null;
  setor_titular_id: string;
  cargo_id: string | null;
  equipe_id: string | null;
  status: string;
  aviso_previo_inicio: string | null;
  aviso_previo_fim: string | null;
  familiar_id: string | null;
  observacoes: string | null;
  ferias_unidades: { nome: string } | null;
  ferias_setores: { nome: string } | null;
  ferias_cargos: { nome: string } | null;
  ferias_equipes: { nome: string } | null;
}

const FeriasColaboradores = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingColaborador, setEditingColaborador] = useState<Colaborador | null>(null);
  const [viewingColaborador, setViewingColaborador] = useState<Colaborador | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [setorFilter, setSetorFilter] = useState<string>("todos");
  const [unidadeFilter, setUnidadeFilter] = useState<string>("todos");
  const queryClient = useQueryClient();

  const { data: colaboradores = [], isLoading } = useQuery({
    queryKey: ["ferias-colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select(`
          *,
          ferias_unidades(nome),
          ferias_setores(nome),
          ferias_cargos(nome),
          ferias_equipes(nome)
        `)
        .order("nome");
      if (error) throw error;
      return data as Colaborador[];
    },
  });

  // Fetch active afastamentos to show badge
  const { data: afastamentosAtivos = [] } = useQuery({
    queryKey: ["ferias-afastamentos-ativos"],
    queryFn: async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("ferias_afastamentos")
        .select("colaborador_id, motivo")
        .lte("data_inicio", todayStr)
        .gte("data_fim", todayStr);
      if (error) return [];
      return data;
    },
  });

  const afastadosSet = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of afastamentosAtivos) {
      map.set(a.colaborador_id, a.motivo);
    }
    return map;
  }, [afastamentosAtivos]);
    queryKey: ["ferias-setores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setores")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["ferias-unidades-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_unidades")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First delete substitute sectors
      await supabase
        .from("ferias_colaborador_setores_substitutos")
        .delete()
        .eq("colaborador_id", id);
      
      const { error } = await supabase
        .from("ferias_colaboradores")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias-colaboradores"] });
      toast.success("Colaborador excluído com sucesso");
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir colaborador: " + error.message);
    },
  });

  // Apply additional filters before passing to useTableControls
  const preFilteredData = useMemo(() => {
    return colaboradores.filter((c) => {
      const matchesStatus = statusFilter === "todos" || c.status === statusFilter;
      const matchesSetor = setorFilter === "todos" || c.setor_titular_id === setorFilter;
      const matchesUnidade = unidadeFilter === "todos" || c.unidade_id === unidadeFilter;
      return matchesStatus && matchesSetor && matchesUnidade;
    });
  }, [colaboradores, statusFilter, setorFilter, unidadeFilter]);

  const {
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    sortField,
    sortDirection,
    setSorting,
    filteredData,
    paginatedData,
    totalPages,
  } = useTableControls({
    data: preFilteredData,
    searchField: ["nome", "cpf"],
    defaultItemsPerPage: 20,
  });

  const handleEdit = (colaborador: Colaborador) => {
    setEditingColaborador(colaborador);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingColaborador(null);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
  };

  const activeFiltersCount = [statusFilter, setorFilter, unidadeFilter].filter(f => f !== "todos").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-muted-foreground">
            Gerencie os colaboradores da organização
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Colaborador
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lista de Colaboradores
              <Badge variant="secondary" className="ml-2">
                {filteredData.length}
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <TableSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por nome ou CPF..."
            />
            <Button
              variant={showFilters ? "secondary" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="shrink-0"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>

          {showFilters && (
            <ColaboradorFilters
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              setorFilter={setorFilter}
              setSetorFilter={setSetorFilter}
              unidadeFilter={unidadeFilter}
              setUnidadeFilter={setUnidadeFilter}
              setores={setores}
              unidades={unidades}
            />
          )}

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader
                      label="Nome"
                      field="nome"
                      currentField={sortField as string | null}
                      direction={sortDirection}
                      onSort={(field) => setSorting(field as keyof Colaborador)}
                    />
                  </TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>
                    <SortableHeader
                      label="Admissão"
                      field="data_admissao"
                      currentField={sortField as string | null}
                      direction={sortDirection}
                      onSort={(field) => setSorting(field as keyof Colaborador)}
                    />
                  </TableHead>
                  <TableHead>Familiar</TableHead>
                  <TableHead>
                    <SortableHeader
                      label="Status"
                      field="status"
                      currentField={sortField as string | null}
                      direction={sortDirection}
                      onSort={(field) => setSorting(field as keyof Colaborador)}
                    />
                  </TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum colaborador encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((colaborador) => (
                    <TableRow key={colaborador.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{colaborador.nome}</p>
                          {afastadosSet.has(colaborador.id) && (
                            <Badge variant="destructive" className="text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Afastado
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{colaborador.ferias_setores?.nome || "-"}</TableCell>
                      <TableCell>{colaborador.ferias_cargos?.nome || "-"}</TableCell>
                      <TableCell>{formatDate(colaborador.data_admissao)}</TableCell>
                      <TableCell>
                        {colaborador.familiar_id ? (
                          <Badge variant="outline" className="text-xs">
                            Sim
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={colaborador.status === "ativo" ? "default" : "secondary"}>
                          {colaborador.status === "ativo" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingColaborador(colaborador)}
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(colaborador)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(colaborador.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            totalItems={filteredData.length}
          />
        </CardContent>
      </Card>

      <ColaboradorViewDialog
        open={!!viewingColaborador}
        onOpenChange={() => setViewingColaborador(null)}
        colaborador={viewingColaborador}
      />

      <ColaboradorDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        colaborador={editingColaborador}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este colaborador? Esta ação não pode ser desfeita.
              Todas as férias e folgas vinculadas também serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FeriasColaboradores;
