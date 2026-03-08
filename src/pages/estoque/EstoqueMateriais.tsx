import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSystemAccess } from "@/hooks/useSystemAccess";

interface Material {
  id: string;
  nome: string;
  descricao: string | null;
  unidade_medida: string;
  categoria: string | null;
  estoque_minimo: number;
  is_active: boolean;
}

const UNIDADES_MEDIDA = [
  { value: "un", label: "Unidade" },
  { value: "cx", label: "Caixa" },
  { value: "pct", label: "Pacote" },
  { value: "kg", label: "Quilograma" },
  { value: "lt", label: "Litro" },
  { value: "mt", label: "Metro" },
  { value: "rl", label: "Rolo" },
  { value: "fl", label: "Folha" },
  { value: "rs", label: "Resma" },
];

// Helper to bypass Supabase typed client for tables not yet in types.ts
const fromEstoque = (table: string) => supabase.from(table as any);

export default function EstoqueMateriais() {
  const queryClient = useQueryClient();
  const { canEdit } = useSystemAccess();
  const canEditEstoque = canEdit("estoque");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    unidade_medida: "un",
    categoria: "",
    estoque_minimo: 0,
  });

  const { data: materiais = [], isLoading } = useQuery({
    queryKey: ["estoque-materiais"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_materiais")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data || []) as unknown as Material[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      const payload = {
        nome: values.nome,
        descricao: values.descricao || null,
        unidade_medida: values.unidade_medida,
        categoria: values.categoria || null,
        estoque_minimo: values.estoque_minimo,
      };
      if (values.id) {
        const { error } = await fromEstoque("estoque_materiais").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await fromEstoque("estoque_materiais").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais"] });
      toast.success(editingMaterial ? "Material atualizado!" : "Material cadastrado!");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await fromEstoque("estoque_materiais").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais"] });
      toast.success("Status alterado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingMaterial(null);
    setForm({ nome: "", descricao: "", unidade_medida: "un", categoria: "", estoque_minimo: 0 });
  };

  const openEdit = (m: Material) => {
    setEditingMaterial(m);
    setForm({
      nome: m.nome,
      descricao: m.descricao || "",
      unidade_medida: m.unidade_medida,
      categoria: m.categoria || "",
      estoque_minimo: m.estoque_minimo,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    saveMutation.mutate({ ...form, id: editingMaterial?.id });
  };

  const filtered = materiais.filter(
    (m) =>
      m.nome.toLowerCase().includes(search.toLowerCase()) ||
      (m.categoria || "").toLowerCase().includes(search.toLowerCase())
  );

  const unidadeLabel = (val: string) => UNIDADES_MEDIDA.find((u) => u.value === val)?.label || val;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Materiais</h1>
          <p className="text-muted-foreground">Cadastro de materiais do estoque</p>
        </div>
        {canEditEstoque && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Material
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Materiais Cadastrados
            </CardTitle>
            <Input
              placeholder="Buscar por nome ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum material encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-center">Estoque Mín.</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {canEditEstoque && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell>{m.categoria || "—"}</TableCell>
                    <TableCell>{unidadeLabel(m.unidade_medida)}</TableCell>
                    <TableCell className="text-center">{m.estoque_minimo}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={m.is_active ? "default" : "secondary"}>
                        {m.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    {canEditEstoque && (
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleMutation.mutate({ id: m.id, is_active: !m.is_active })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMaterial ? "Editar Material" : "Novo Material"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unidade de Medida</Label>
                <Select value={form.unidade_medida} onValueChange={(v) => setForm({ ...form, unidade_medida: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES_MEDIDA.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estoque Mínimo</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.estoque_minimo}
                  onChange={(e) => setForm({ ...form, estoque_minimo: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ex: Papelaria, Limpeza, Informática..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingMaterial ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
