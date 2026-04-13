import { useState } from "react";
import { normalizeText } from "@/lib/textUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Crown, Users, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import SetorDialog from "./SetorDialog";
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

interface Setor {
  id: string;
  nome: string;
  is_active: boolean;
}

interface SetorChefe {
  setor_id: string;
  colaborador_id: string;
  ferias_colaboradores: { nome: string } | null;
}

type SortField = "nome" | "chefes" | "colaboradores" | "is_active";
type SortDirection = "asc" | "desc";

const SetoresTab = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSetor, setEditingSetor] = useState<Setor | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("nome");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const queryClient = useQueryClient();

  const { data: setores = [], isLoading } = useQuery({
    queryKey: ["ferias-setores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setores")
        .select("id, nome, is_active")
        .order("nome");
      if (error) throw error;
      return data as Setor[];
    },
  });

  // Buscar todos os chefes de todos os setores
  const { data: todosChefes = [] } = useQuery({
    queryKey: ["ferias-setor-chefes-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setor_chefes")
        .select("setor_id, colaborador_id, ferias_colaboradores(nome)");
      if (error) throw error;
      return data as SetorChefe[];
    },
  });

  // Buscar contagem de colaboradores por setor
  const { data: colaboradoresCount = [] } = useQuery({
    queryKey: ["ferias-colaboradores-por-setor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("setor_titular_id")
        .eq("status", "ativo");
      if (error) throw error;
      
      // Contar colaboradores por setor
      const counts: Record<string, number> = {};
      data.forEach((colab) => {
        if (colab.setor_titular_id) {
          counts[colab.setor_titular_id] = (counts[colab.setor_titular_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Primeiro remove os chefes
      await supabase.from("ferias_setor_chefes").delete().eq("setor_id", id);
      // Depois remove o setor
      const { error } = await supabase.from("ferias_setores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias-setores"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-equipes"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-setor-chefes-all"] });
      toast.success("Setor excluído com sucesso");
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir setor: " + error.message);
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const filteredSetores = setores.filter((s) =>
    normalizeText(s.nome).includes(normalizeText(search))
  );

  const sortedSetores = [...filteredSetores].sort((a, b) => {
    let aValue: string | number | boolean;
    let bValue: string | number | boolean;

    switch (sortField) {
      case "nome":
        aValue = a.nome.toLowerCase();
        bValue = b.nome.toLowerCase();
        break;
      case "chefes":
        aValue = getChefesDoSetor(a.id).length;
        bValue = getChefesDoSetor(b.id).length;
        break;
      case "colaboradores":
        aValue = getColaboradoresCount(a.id);
        bValue = getColaboradoresCount(b.id);
        break;
      case "is_active":
        aValue = a.is_active ? 1 : 0;
        bValue = b.is_active ? 1 : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleEdit = (setor: Setor) => {
    setEditingSetor(setor);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSetor(null);
  };

  const getChefesDoSetor = (setorId: string) => {
    return todosChefes.filter((c) => c.setor_id === setorId);
  };

  const getColaboradoresCount = (setorId: string) => {
    return colaboradoresCount[setorId] || 0;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Setores</CardTitle>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Setor
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar setor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("nome")} className="h-auto p-0 font-medium hover:bg-transparent">
                    Nome {getSortIcon("nome")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("chefes")} className="h-auto p-0 font-medium hover:bg-transparent">
                    Chefes {getSortIcon("chefes")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("colaboradores")} className="h-auto p-0 font-medium hover:bg-transparent">
                    Colaboradores {getSortIcon("colaboradores")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("is_active")} className="h-auto p-0 font-medium hover:bg-transparent">
                    Status {getSortIcon("is_active")}
                  </Button>
                </TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : sortedSetores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum setor encontrado
                  </TableCell>
                </TableRow>
              ) : (
                sortedSetores.map((setor) => {
                  const chefes = getChefesDoSetor(setor.id);
                  const colabCount = getColaboradoresCount(setor.id);
                  
                  return (
                    <TableRow key={setor.id}>
                      <TableCell className="font-medium">{setor.nome}</TableCell>
                      <TableCell>
                        {chefes.length === 0 ? (
                          <span className="text-muted-foreground text-sm">Nenhum chefe</span>
                        ) : (
                          (() => {
                            const chefesNames = chefes
                              .map((chefe) => chefe.ferias_colaboradores?.nome || "Nome não disponível")
                              .join(" • ");

                            return (
                              <div className="flex items-center gap-1" title={chefesNames}>
                                <Crown className="h-4 w-4 text-warning" />
                                <span className="text-sm">{chefes.length}</span>
                              </div>
                            );
                          })()
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{colabCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={setor.is_active ? "default" : "secondary"}>
                          {setor.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(setor)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(setor.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <SetorDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        setor={editingSetor}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este setor? Esta ação não pode ser desfeita.
              Todas as equipes vinculadas e chefes também serão removidos.
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
    </Card>
  );
};

export default SetoresTab;
