import { useEffect, useState } from "react";
import { normalizeText } from "@/lib/textUtils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import { toast } from "sonner";
import { Crown, Users, X } from "lucide-react";

const schema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface SetorDialogProps {
  open: boolean;
  onOpenChange: () => void;
  setor?: {
    id: string;
    nome: string;
    is_active: boolean;
  } | null;
}

const SetorDialog = ({ open, onOpenChange, setor }: SetorDialogProps) => {
  const queryClient = useQueryClient();
  const isEditing = !!setor;
  const [selectedChefes, setSelectedChefes] = useState<string[]>([]);

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["ferias-colaboradores-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, ferias_cargos(nome), ferias_unidades(nome)")
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: chefesAtuais = [] } = useQuery({
    queryKey: ["ferias-setor-chefes", setor?.id],
    queryFn: async () => {
      if (!setor?.id) return [];
      const { data, error } = await supabase
        .from("ferias_setor_chefes")
        .select("colaborador_id")
        .eq("setor_id", setor.id);
      if (error) throw error;
      return data.map((c) => c.colaborador_id).filter(Boolean) as string[];
    },
    enabled: !!setor?.id,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (setor) {
        form.reset({
          nome: setor.nome,
          is_active: setor.is_active ?? true,
        });
      } else {
        form.reset({
          nome: "",
          is_active: true,
        });
        setSelectedChefes([]);
      }
    }
  }, [open, setor, form]);

  // Sincronizar chefes quando os dados da query mudam (usando length para estabilidade)
  useEffect(() => {
    if (chefesAtuais.length > 0 && open) {
      // Só atualiza se os arrays forem diferentes
      const sorted1 = [...chefesAtuais].sort();
      const sorted2 = [...selectedChefes].sort();
      const isDifferent = sorted1.length !== sorted2.length || 
        sorted1.some((id, idx) => id !== sorted2[idx]);
      
      if (isDifferent) {
        setSelectedChefes(chefesAtuais);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chefesAtuais.length, open]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        nome: data.nome,
        is_active: data.is_active,
      };

      let setorId = setor?.id;

      if (isEditing) {
        const { error } = await supabase
          .from("ferias_setores")
          .update(payload)
          .eq("id", setor.id);
        if (error) throw error;
      } else {
        const { data: newSetor, error } = await supabase
          .from("ferias_setores")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setorId = newSetor.id;
      }

      // Atualizar chefes
      if (setorId) {
        // Remove chefes antigos
        await supabase
          .from("ferias_setor_chefes")
          .delete()
          .eq("setor_id", setorId);

        // Adiciona novos chefes
        if (selectedChefes.length > 0) {
          const chefesInsert = selectedChefes.map((colaborador_id) => ({
            setor_id: setorId,
            colaborador_id,
          }));
          const { error: chefesError } = await supabase
            .from("ferias_setor_chefes")
            .insert(chefesInsert);
          if (chefesError) throw chefesError;
        }
      }
    },
    onSuccess: () => {
      // Invalidar todas as variações de query keys usadas
      queryClient.invalidateQueries({ queryKey: ["ferias-setores"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-setor-chefes"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-setor-chefes-all"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-setor-chefes-table"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-setor-chefes-pdf"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-setor-chefes-gerador"] });
      toast.success(isEditing ? "Setor atualizado" : "Setor criado");
      onOpenChange();
    },
    onError: (error: Error) => {
      toast.error("Erro: " + error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const [searchChefe, setSearchChefe] = useState("");
  
  const filteredColaboradores = colaboradores.filter(c =>
    normalizeText(c.nome).includes(normalizeText(searchChefe))
  );

  const toggleChefe = (colaboradorId: string) => {
    setSelectedChefes((prev) =>
      prev.includes(colaboradorId)
        ? prev.filter((id) => id !== colaboradorId)
        : [...prev, colaboradorId]
    );
  };

  const removeChefe = (colaboradorId: string) => {
    setSelectedChefes((prev) => prev.filter((id) => id !== colaboradorId));
  };

  const getColaboradorNome = (id: string) => {
    const colab = colaboradores.find((c) => c.id === id);
    return colab?.nome || "Colaborador não encontrado";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Setor" : "Novo Setor"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do setor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Ativo</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Seção de Chefes de Setor */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-warning" />
                <FormLabel className="text-base font-semibold">Chefes do Setor</FormLabel>
              </div>
              <FormDescription>
                Selecione os colaboradores que serão chefes deste setor
              </FormDescription>

              {/* Chefes selecionados */}
              {selectedChefes.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg">
                  {selectedChefes.map((chefeId) => (
                    <Badge
                      key={chefeId}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      <Crown className="h-3 w-3 text-warning" />
                      {getColaboradorNome(chefeId)}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 hover:bg-destructive/20"
                        onClick={() => removeChefe(chefeId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Campo de busca */}
              <Input
                placeholder="Buscar colaborador por nome..."
                value={searchChefe}
                onChange={(e) => setSearchChefe(e.target.value)}
                className="mb-2"
              />

              {/* Lista de colaboradores para seleção */}
              <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                <div className="p-2 space-y-1">
                  {filteredColaboradores.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum colaborador ativo encontrado
                    </p>
                  ) : (
                    filteredColaboradores.map((colab) => (
                      <div
                        key={colab.id}
                        className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleChefe(colab.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedChefes.includes(colab.id)}
                          onChange={() => toggleChefe(colab.id)}
                          className="h-4 w-4 rounded border-input"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{colab.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {colab.ferias_cargos?.nome || "Sem cargo"} 
                            {colab.ferias_unidades?.nome && ` • ${colab.ferias_unidades.nome}`}
                          </p>
                        </div>
                        {selectedChefes.includes(colab.id) && (
                          <Crown className="h-4 w-4 text-warning flex-shrink-0" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onOpenChange}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default SetorDialog;
