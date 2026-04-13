import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Colaborador } from "@/pages/ferias/FeriasColaboradores";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  nome_exibicao: z.string().optional(),
  cpf: z.string().optional(),
  data_nascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  data_admissao: z.string().min(1, "Data de admissão é obrigatória"),
  unidade_id: z.string().optional(),
  setor_titular_id: z.string().min(1, "Setor titular é obrigatório"),
  cargo_id: z.string().optional(),
  equipe_id: z.string().optional(),
  status: z.string(),
  familiar_id: z.string().optional(),
  observacoes: z.string().optional(),
  aviso_previo_inicio: z.string().optional(),
  aviso_previo_fim: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ColaboradorDialogProps {
  open: boolean;
  onOpenChange: () => void;
  colaborador?: Colaborador | null;
}

const ColaboradorDialog = ({ open, onOpenChange, colaborador }: ColaboradorDialogProps) => {
  const queryClient = useQueryClient();
  const isEditing = !!colaborador;
  const [selectedSetoresSubstitutos, setSelectedSetoresSubstitutos] = useState<string[]>([]);
  const [familiarOpen, setFamiliarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dados");

  // Fetch setores
  const { data: setores = [] } = useQuery({
    queryKey: ["ferias-setores-active"],
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

  // Fetch unidades
  const { data: unidades = [] } = useQuery({
    queryKey: ["ferias-unidades-active"],
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

  // Fetch cargos
  const { data: cargos = [] } = useQuery({
    queryKey: ["ferias-cargos-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_cargos")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Fetch equipes
  const { data: equipes = [] } = useQuery({
    queryKey: ["ferias-equipes-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_equipes")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Fetch colaboradores for familiar selection (exclude current)
  const { data: colaboradoresForFamiliar = [] } = useQuery({
    queryKey: ["ferias-colaboradores-for-familiar", colaborador?.id],
    queryFn: async () => {
      let query = supabase
        .from("ferias_colaboradores")
        .select("id, nome")
        .eq("status", "ativo")
        .order("nome");
      
      if (colaborador?.id) {
        query = query.neq("id", colaborador.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch setores substitutos when editing
  const { data: setoresSubstitutos = [], isFetched: setoresSubstitutosFetched } = useQuery({
    queryKey: ["ferias-setores-substitutos", colaborador?.id],
    enabled: !!colaborador?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaborador_setores_substitutos")
        .select("setor_id")
        .eq("colaborador_id", colaborador!.id);
      if (error) throw error;
      return data.map(s => s.setor_id).filter((id): id is string => id !== null);
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      nome_exibicao: "",
      cpf: "",
      data_nascimento: "",
      data_admissao: "",
      unidade_id: "",
      setor_titular_id: "",
      cargo_id: "",
      equipe_id: "",
      status: "ativo",
      familiar_id: "",
      observacoes: "",
      aviso_previo_inicio: "",
      aviso_previo_fim: "",
    },
  });

  // Reset form when colaborador changes (NOT dependent on setoresSubstitutos to avoid infinite loop)
  useEffect(() => {
    if (colaborador) {
      form.reset({
        nome: colaborador.nome,
        nome_exibicao: colaborador.nome_exibicao || "",
        cpf: colaborador.cpf || "",
        data_nascimento: colaborador.data_nascimento,
        data_admissao: colaborador.data_admissao,
        unidade_id: colaborador.unidade_id || "",
        setor_titular_id: colaborador.setor_titular_id,
        cargo_id: colaborador.cargo_id || "",
        equipe_id: colaborador.equipe_id || "",
        status: colaborador.status,
        familiar_id: colaborador.familiar_id || "",
        observacoes: colaborador.observacoes || "",
        aviso_previo_inicio: colaborador.aviso_previo_inicio || "",
        aviso_previo_fim: colaborador.aviso_previo_fim || "",
      });
    } else {
      form.reset({
        nome: "",
        nome_exibicao: "",
        cpf: "",
        data_nascimento: "",
        data_admissao: "",
        unidade_id: "",
        setor_titular_id: "",
        cargo_id: "",
        equipe_id: "",
        status: "ativo",
        familiar_id: "",
        observacoes: "",
        aviso_previo_inicio: "",
        aviso_previo_fim: "",
      });
      setSelectedSetoresSubstitutos([]);
    }
  }, [colaborador, form]);

  // Separate effect for loading substitute sectors - using flag to prevent resets
  const [hasLoadedSubstitutos, setHasLoadedSubstitutos] = useState(false);
  
  useEffect(() => {
    if (colaborador && setoresSubstitutosFetched && !hasLoadedSubstitutos) {
      setSelectedSetoresSubstitutos(setoresSubstitutos);
      setHasLoadedSubstitutos(true);
    }
  }, [colaborador, setoresSubstitutosFetched, setoresSubstitutos, hasLoadedSubstitutos]);

  // Reset flag when dialog closes
  useEffect(() => {
    if (!open) setHasLoadedSubstitutos(false);
  }, [open]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        nome: data.nome,
        nome_exibicao: data.nome_exibicao || null,
        cpf: data.cpf || null,
        data_nascimento: data.data_nascimento,
        data_admissao: data.data_admissao,
        unidade_id: data.unidade_id || null,
        setor_titular_id: data.setor_titular_id,
        cargo_id: data.cargo_id || null,
        equipe_id: data.equipe_id || null,
        status: data.status,
        familiar_id: data.familiar_id || null,
        observacoes: data.observacoes || null,
        aviso_previo_inicio: data.aviso_previo_inicio || null,
        aviso_previo_fim: data.aviso_previo_fim || null,
      };

      let colaboradorId: string;

      if (isEditing) {
        const { error } = await supabase
          .from("ferias_colaboradores")
          .update(payload)
          .eq("id", colaborador.id);
        if (error) throw error;
        colaboradorId = colaborador.id;
      } else {
        const { data: inserted, error } = await supabase
          .from("ferias_colaboradores")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        colaboradorId = inserted.id;
      }

      // Sincronização bidirecional de familiares
      const newFamiliarId = data.familiar_id || null;
      const oldFamiliarId = colaborador?.familiar_id || null;

      if (newFamiliarId !== oldFamiliarId) {
        // Remove vínculo do antigo familiar
        if (oldFamiliarId) {
          await supabase
            .from("ferias_colaboradores")
            .update({ familiar_id: null })
            .eq("id", oldFamiliarId);
        }
        
        // Cria vínculo bidirecional com o novo familiar
        if (newFamiliarId) {
          await supabase
            .from("ferias_colaboradores")
            .update({ familiar_id: colaboradorId })
            .eq("id", newFamiliarId);
        }
      }

      // Update setores substitutos
      // First delete existing
      await supabase
        .from("ferias_colaborador_setores_substitutos")
        .delete()
        .eq("colaborador_id", colaboradorId);

      // Then insert new ones
      if (selectedSetoresSubstitutos.length > 0) {
        const substitutosToInsert = selectedSetoresSubstitutos.map(setor_id => ({
          colaborador_id: colaboradorId,
          setor_id,
        }));
        
        const { error: substitutosError } = await supabase
          .from("ferias_colaborador_setores_substitutos")
          .insert(substitutosToInsert);
        if (substitutosError) throw substitutosError;
      }
    },
    onSuccess: () => {
      // Invalidar todas as variações de query keys usadas em diferentes componentes
      queryClient.invalidateQueries({ queryKey: ["ferias-colaboradores"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-colaboradores-for-familiar"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-colaboradores-gerador-todos"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-colaboradores-folgas"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-colaboradores-aniversarios"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-colaboradores-calendario-tab"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-colaboradores-ativos"] });
      queryClient.invalidateQueries({ queryKey: ["colaboradores-aniversariantes-pdf"] });
      queryClient.invalidateQueries({ queryKey: ["colaboradores-aniversariantes-celebre-pdf"] });
      toast.success(isEditing ? "Colaborador atualizado" : "Colaborador criado");
      onOpenChange();
    },
    onError: (error: Error) => {
      toast.error("Erro: " + error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const onInvalid = (errors: Record<string, any>) => {
    // Fields by tab
    const vinculoFields = ["setor_titular_id", "unidade_id", "cargo_id", "equipe_id", "familiar_id"];
    const outrosFields = ["aviso_previo_inicio", "aviso_previo_fim", "observacoes"];
    
    const errorKeys = Object.keys(errors);
    if (errorKeys.some(k => vinculoFields.includes(k))) {
      setActiveTab("vinculo");
      toast.error("Preencha os campos obrigatórios na aba Vínculos");
    } else if (errorKeys.some(k => outrosFields.includes(k))) {
      setActiveTab("outros");
      toast.error("Preencha os campos obrigatórios na aba Outros");
    } else {
      setActiveTab("dados");
      toast.error("Preencha os campos obrigatórios na aba Dados Pessoais");
    }
  };

  const formErrors = form.formState.errors;
  const vinculoHasError = !!(formErrors.setor_titular_id || formErrors.unidade_id || formErrors.cargo_id || formErrors.equipe_id || formErrors.familiar_id);
  const dadosHasError = !!(formErrors.nome || formErrors.data_nascimento || formErrors.data_admissao || formErrors.cpf || formErrors.status || formErrors.nome_exibicao);

  const toggleSetorSubstituto = (setorId: string) => {
    setSelectedSetoresSubstitutos(prev => 
      prev.includes(setorId) 
        ? prev.filter(id => id !== setorId)
        : [...prev, setorId]
    );
  };

  // Get selected familiar name
  const selectedFamiliarName = colaboradoresForFamiliar.find(
    c => c.id === form.watch("familiar_id")
  )?.nome;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Colaborador" : "Novo Colaborador"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="overflow-hidden">
            <ScrollArea className="h-[60vh] pr-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="dados" className="relative">
                    Dados Pessoais
                    {dadosHasError && <span className="ml-1 inline-block w-2 h-2 rounded-full bg-destructive" />}
                  </TabsTrigger>
                  <TabsTrigger value="vinculo" className="relative">
                    Vínculos
                    {vinculoHasError && <span className="ml-1 inline-block w-2 h-2 rounded-full bg-destructive" />}
                  </TabsTrigger>
                  <TabsTrigger value="outros">Outros</TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do colaborador" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nome_exibicao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome para Exibição</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: João Silva, Marquinhos, Zé" {...field} />
                        </FormControl>
                        <FormDescription>
                          Nome curto usado nas tabelas e PDFs. Se não preenchido, usará Primeiro + Último nome.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF</FormLabel>
                          <FormControl>
                            <Input placeholder="000.000.000-00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="data_nascimento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Nascimento *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="data_admissao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Admissão *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ativo">Ativo</SelectItem>
                              <SelectItem value="inativo">Inativo</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="vinculo" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="unidade_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unidade</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {unidades.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="setor_titular_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Setor Titular *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {setores.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <FormLabel>Setores Substitutos</FormLabel>
                    <FormDescription className="text-xs">
                      Selecione os setores onde este colaborador pode atuar como substituto
                    </FormDescription>
                    <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg max-h-40 overflow-y-auto">
                      {setores.map((setor) => (
                        <div key={setor.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`setor-${setor.id}`}
                            checked={selectedSetoresSubstitutos.includes(setor.id)}
                            onCheckedChange={() => toggleSetorSubstituto(setor.id)}
                          />
                          <label
                            htmlFor={`setor-${setor.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {setor.nome}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cargo_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cargo</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {cargos.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="equipe_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipe</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {equipes.map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  {e.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="familiar_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Familiar na Empresa</FormLabel>
                        <FormDescription className="text-xs">
                          Se este colaborador tem familiar na empresa, selecione para priorização de férias
                        </FormDescription>
                        <Popover open={familiarOpen} onOpenChange={setFamiliarOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={familiarOpen}
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {selectedFamiliarName || "Nenhum"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar colaborador..." />
                              <CommandList>
                                <CommandEmpty>Nenhum colaborador encontrado</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="_nenhum_"
                                    onSelect={() => {
                                      field.onChange("");
                                      setFamiliarOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        !field.value ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    Nenhum
                                  </CommandItem>
                                  {colaboradoresForFamiliar.map((c) => (
                                    <CommandItem
                                      key={c.id}
                                      value={c.nome}
                                      onSelect={() => {
                                        field.onChange(c.id);
                                        setFamiliarOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === c.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {c.nome}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="outros" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="aviso_previo_inicio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aviso Prévio - Início</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="aviso_previo_fim"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aviso Prévio - Fim</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Observações adicionais sobre o colaborador"
                            className="resize-none"
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
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

export default ColaboradorDialog;
