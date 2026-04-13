import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Pencil, Trash2, Settings, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Configuracao {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
  updated_at: string | null;
}

// Chaves reservadas (gerenciadas nas outras abas)
const RESERVED_KEYS = [
  "INICIO_SEGUNDA_FEIRA",
  "BLOQUEAR_VESPERA_FERIADO",
  "BLOQUEAR_SABADO",
  "BLOQUEAR_JANEIRO",
  "BLOQUEAR_DEZEMBRO",
  "CONFLITO_POR",
  "DIAS_ALERTA_PERIODO_AQUISITIVO",
  "MAX_COLABORADORES_FERIAS_SETOR",
  "PRIORIZAR_FAMILIARES",
];

export function AvancadoTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Configuracao | null>(null);
  const [configToDelete, setConfigToDelete] = useState<Configuracao | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    chave: "",
    valor: "",
    descricao: "",
  });

  const { data: configuracoes = [], isLoading } = useQuery({
    queryKey: ["ferias-configuracoes-avancado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_configuracoes")
        .select("*")
        .order("chave");

      if (error) throw error;
      // Filter out reserved keys
      return (data as Configuracao[]).filter(c => !RESERVED_KEYS.includes(c.chave));
    },
  });

  const filteredConfigs = configuracoes.filter(
    (c) =>
      normalizeText(c.chave).includes(normalizeText(searchTerm)) ||
      normalizeText(c.valor).includes(normalizeText(searchTerm)) ||
      normalizeText(c.descricao || "").includes(normalizeText(searchTerm))
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate key format
      const keyRegex = /^[A-Z0-9_]+$/;
      if (!keyRegex.test(formData.chave)) {
        throw new Error("A chave deve conter apenas letras maiúsculas, números e underscores");
      }

      if (RESERVED_KEYS.includes(formData.chave)) {
        throw new Error("Esta chave é reservada e não pode ser criada manualmente");
      }

      const payload = {
        chave: formData.chave,
        valor: formData.valor,
        descricao: formData.descricao || null,
        updated_at: new Date().toISOString(),
      };

      if (editingConfig) {
        const { error } = await supabase
          .from("ferias_configuracoes")
          .update({ valor: payload.valor, descricao: payload.descricao, updated_at: payload.updated_at })
          .eq("id", editingConfig.id);
        if (error) throw error;
      } else {
        // Check if key exists
        const { data: existing } = await supabase
          .from("ferias_configuracoes")
          .select("id")
          .eq("chave", formData.chave)
          .single();

        if (existing) {
          throw new Error("Já existe uma configuração com esta chave");
        }

        const { error } = await supabase
          .from("ferias_configuracoes")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias-configuracoes-avancado"] });
      toast.success(editingConfig ? "Configuração atualizada!" : "Configuração criada!");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao salvar configuração");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ferias_configuracoes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias-configuracoes-avancado"] });
      toast.success("Configuração excluída!");
      setDeleteDialogOpen(false);
      setConfigToDelete(null);
    },
    onError: (error) => {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir configuração");
    },
  });

  const handleOpenDialog = (config?: Configuracao) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        chave: config.chave,
        valor: config.valor,
        descricao: config.descricao || "",
      });
    } else {
      setEditingConfig(null);
      setFormData({
        chave: "",
        valor: "",
        descricao: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingConfig(null);
    setFormData({
      chave: "",
      valor: "",
      descricao: "",
    });
  };

  const handleDelete = (config: Configuracao) => {
    setConfigToDelete(config);
    setDeleteDialogOpen(true);
  };

  const handleKeyChange = (value: string) => {
    // Convert to uppercase and replace invalid chars
    const formatted = value.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    setFormData({ ...formData, chave: formatted });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações Avançadas
          </CardTitle>
          <CardDescription>
            Parâmetros técnicos adicionais do sistema. Use com cautela.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar configuração..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Configuração
            </Button>
          </div>

          {filteredConfigs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/50">
              <Settings className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">Nenhuma configuração avançada</h3>
              <p className="text-muted-foreground">
                As configurações principais estão nas outras abas
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chave</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="hidden md:table-cell">Descrição</TableHead>
                    <TableHead className="hidden sm:table-cell">Atualizado</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConfigs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-mono text-sm font-medium">
                        {config.chave}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-sm font-medium text-primary">
                          {config.valor}
                        </span>
                      </TableCell>
                      <TableCell className="hidden max-w-xs truncate md:table-cell">
                        {config.descricao || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {config.updated_at
                          ? format(new Date(config.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(config)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(config)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Editar Configuração" : "Nova Configuração"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Chave *</Label>
              <Input
                value={formData.chave}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="EX: MINHA_CONFIGURACAO"
                disabled={!!editingConfig}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Use apenas letras maiúsculas, números e underscores
              </p>
            </div>

            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                placeholder="Valor da configuração"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descreva o propósito desta configuração"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!formData.chave || !formData.valor || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingConfig ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a configuração <strong>{configToDelete?.chave}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => configToDelete && deleteMutation.mutate(configToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
