import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin, Loader2, ChevronRight, ChevronDown, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Local {
  id: string;
  unidade_id: string;
  nome: string;
  tipo: string;
  parent_id: string | null;
  is_active: boolean;
}

interface Unidade {
  id: string;
  nome: string;
}

const TIPOS = [
  { value: "deposito", label: "Depósito" },
  { value: "armario", label: "Armário" },
  { value: "prateleira", label: "Prateleira" },
];

const fromEstoque = (table: string) => supabase.from(table as any);

type LocalWithChildren = Local & { children: LocalWithChildren[] };

function buildTree(locais: Local[], parentId: string | null = null): LocalWithChildren[] {
  return locais
    .filter((l) => l.parent_id === parentId)
    .map((l) => ({ ...l, children: buildTree(locais, l.id) }));
}

function LocalNode({
  local,
  level,
  canEdit,
  onEdit,
  onToggle,
}: {
  local: LocalWithChildren;
  level: number;
  canEdit: boolean;
  onEdit: (l: Local) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = local.children.length > 0;
  const tipoLabel = TIPOS.find((t) => t.value === local.tipo)?.label || local.tipo;

  return (
    <div style={{ marginLeft: level * 20 }}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group">
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          ) : (
            <div className="w-6" />
          )}
          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className={`font-medium ${!local.is_active ? "text-muted-foreground line-through" : ""}`}>
            {local.nome}
          </span>
          <Badge variant="outline" className="text-xs">{tipoLabel}</Badge>
          {!local.is_active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
          {canEdit && (
            <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(local)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onToggle(local.id, !local.is_active)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        {hasChildren && (
          <CollapsibleContent>
            {local.children.map((child) => (
              <LocalNode key={child.id} local={child} level={level + 1} canEdit={canEdit} onEdit={onEdit} onToggle={onToggle} />
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

export default function EstoqueLocais() {
  const queryClient = useQueryClient();
  const { canEdit } = useSystemAccess();
  const canEditEstoque = canEdit("estoque");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Local | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "deposito", unidade_id: "", parent_id: "" });

  const { data: unidades = [] } = useQuery({
    queryKey: ["ferias-unidades-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ferias_unidades").select("id, nome").eq("is_active", true).order("nome");
      if (error) throw error;
      return data as Unidade[];
    },
  });

  const { data: locais = [], isLoading } = useQuery({
    queryKey: ["estoque-locais"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_locais_armazenamento").select("*").order("nome");
      if (error) throw error;
      return (data || []) as Local[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      const payload = {
        nome: values.nome,
        tipo: values.tipo,
        unidade_id: values.unidade_id,
        parent_id: values.parent_id || null,
      };
      if (values.id) {
        const { error } = await fromEstoque("estoque_locais_armazenamento").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await fromEstoque("estoque_locais_armazenamento").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-locais"] });
      toast.success(editing ? "Local atualizado!" : "Local cadastrado!");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await fromEstoque("estoque_locais_armazenamento").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-locais"] });
      toast.success("Status alterado!");
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm({ nome: "", tipo: "deposito", unidade_id: "", parent_id: "" });
  };

  const openEdit = (l: Local) => {
    setEditing(l);
    setForm({ nome: l.nome, tipo: l.tipo, unidade_id: l.unidade_id, parent_id: l.parent_id || "" });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (!form.unidade_id) return toast.error("Selecione uma unidade");
    saveMutation.mutate({ ...form, id: editing?.id });
  };

  const possibleParents = locais.filter(
    (l) => l.unidade_id === form.unidade_id && l.id !== editing?.id && l.is_active
  );

  const locaisByUnidade = unidades.map((u) => ({
    unidade: u,
    tree: buildTree(locais.filter((l) => l.unidade_id === u.id)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locais de Armazenamento</h1>
          <p className="text-muted-foreground">Depósitos, armários e prateleiras por unidade</p>
        </div>
        {canEditEstoque && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Local
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : locaisByUnidade.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma unidade cadastrada. Cadastre unidades no módulo de Férias.
          </CardContent>
        </Card>
      ) : (
        locaisByUnidade.map(({ unidade, tree }) => (
          <Card key={unidade.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> {unidade.nome}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tree.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum local cadastrado nesta unidade</p>
              ) : (
                tree.map((local) => (
                  <LocalNode
                    key={local.id}
                    local={local}
                    level={0}
                    canEdit={canEditEstoque}
                    onEdit={openEdit}
                    onToggle={(id, active) => toggleMutation.mutate({ id, is_active: active })}
                  />
                ))
              )}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Local" : "Novo Local de Armazenamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Unidade *</Label>
              <Select value={form.unidade_id} onValueChange={(v) => setForm({ ...form, unidade_id: v, parent_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Depósito 1, Armário A..." />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Local Pai (opcional)</Label>
              <Select value={form.parent_id} onValueChange={(v) => setForm({ ...form, parent_id: v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum (raiz)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum (raiz)</SelectItem>
                  {possibleParents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} ({TIPOS.find((t) => t.value === p.tipo)?.label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
