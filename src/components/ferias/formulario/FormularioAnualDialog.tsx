import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Calendar, Star, Ban, Check, ChevronsUpDown, Users } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const MONTHS = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const normalizeValue = (val: string | undefined | null): string | null =>
  !val || val === "_none_" || val === "" ? null : val;

const formSchema = z.object({
  colaborador_id: z.string().min(1, "Selecione um colaborador"),
  periodo1_mes: z.string().optional(),
  periodo2_mes: z.string().optional(),
  periodo3_mes: z.string().optional(),
  periodo_preferencia: z.string().optional(),
  data_inicio_preferencia: z.string().optional(),
  vender_dias: z.boolean().default(false),
  dias_vender: z.number().min(0).max(10).optional(),
  observacao: z.string().max(500).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface FormularioAnual {
  id: string;
  colaborador_id: string;
  ano_referencia: number;
  periodo1_mes: number | null;
  periodo1_quinzena: string | null;
  periodo2_mes: number | null;
  periodo2_quinzena: string | null;
  periodo3_mes: number | null;
  periodo3_quinzena: string | null;
  periodo_preferencia: number | null;
  vender_dias: boolean | null;
  dias_vender: number | null;
  observacao?: string | null;
  status: string | null;
}

interface FormularioAnualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formulario: FormularioAnual | null;
  anoReferencia: number;
  onSuccess: () => void;
}

export function FormularioAnualDialog({
  open, onOpenChange, formulario, anoReferencia, onSuccess,
}: FormularioAnualDialogProps) {
  const isEditing = !!formulario;
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      colaborador_id: "",
      periodo1_mes: "",
      periodo2_mes: "",
      periodo3_mes: "",
      periodo_preferencia: "",
      data_inicio_preferencia: "",
      vender_dias: false,
      dias_vender: 0,
      observacao: "",
    },
  });

  const venderDias = form.watch("vender_dias");
  const periodo1_mes = form.watch("periodo1_mes");
  const periodo2_mes = form.watch("periodo2_mes");
  const periodo3_mes = form.watch("periodo3_mes");
  const periodoPreferencia = form.watch("periodo_preferencia");

  // Get the preferred month number
  const preferredMonth = useMemo(() => {
    if (!periodoPreferencia) return null;
    const mesField = `periodo${periodoPreferencia}_mes` as "periodo1_mes" | "periodo2_mes" | "periodo3_mes";
    const mesVal = form.watch(mesField);
    return mesVal && mesVal !== "_none_" ? parseInt(mesVal) : null;
  }, [periodoPreferencia, periodo1_mes, periodo2_mes, periodo3_mes]);

  // Fetch colaboradores ativos
  const { data: colaboradores = [] } = useQuery({
    queryKey: ["ferias-colaboradores-formulario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, data_admissao, familiar_id, setor_titular:ferias_setores!setor_titular_id(nome)")
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: colaboradoresComFormulario = [] } = useQuery({
    queryKey: ["ferias-colaboradores-com-formulario", anoReferencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_formulario_anual")
        .select("colaborador_id")
        .eq("ano_referencia", anoReferencia);
      if (error) throw error;
      return (data || []).map(f => f.colaborador_id).filter(Boolean) as string[];
    },
    enabled: open,
  });

  // Fetch collaborators that already have vacations in the selected year
  const { data: colaboradoresComFerias = [] } = useQuery({
    queryKey: ["ferias-colaboradores-com-ferias-formulario", anoReferencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_ferias")
        .select("colaborador_id")
        .gte("quinzena1_inicio", `${anoReferencia}-01-01`)
        .lte("quinzena1_inicio", `${anoReferencia}-12-31`)
        .in("status", ["aprovada", "em_gozo_q1", "q1_concluida", "em_gozo_q2", "pendente", "em_gozo"]);
      if (error) throw error;
      return (data || []).map(f => f.colaborador_id).filter(Boolean) as string[];
    },
    enabled: open,
  });

  const colaboradoresDisponiveis = colaboradores.filter(c => {
    if (isEditing && formulario?.colaborador_id === c.id) return true;
    return !colaboradoresComFormulario.includes(c.id) && !colaboradoresComFerias.includes(c.id);
  });

  const selectedColaboradorId = form.watch("colaborador_id");
  const selectedColaborador = colaboradores.find((c) => c.id === selectedColaboradorId);
  const familiarId = selectedColaborador?.familiar_id;
  const familiarNome = familiarId ? colaboradores.find(c => c.id === familiarId)?.nome : null;

  const { data: feriasFamiliar } = useQuery({
    queryKey: ["ferias-familiar-formulario", familiarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_ferias")
        .select("quinzena1_inicio, quinzena1_fim, quinzena2_inicio, quinzena2_fim, gozo_diferente, gozo_quinzena1_inicio, gozo_quinzena1_fim, gozo_quinzena2_inicio, gozo_quinzena2_fim, status")
        .eq("colaborador_id", familiarId!)
        .in("status", ["aprovada", "em_gozo_q1", "q1_concluida", "em_gozo_q2", "pendente", "em_gozo"]);
      if (error) throw error;
      return data;
    },
    enabled: !!familiarId,
  });

  const availableMonths = useMemo(() => {
    const blockedMonths = new Set([1, 12]);
    return MONTHS.map((m) => ({
      ...m,
      disabled: blockedMonths.has(parseInt(m.value)),
    }));
  }, []);

  const filledPeriods = useMemo(() => {
    const periods: string[] = [];
    if (normalizeValue(periodo1_mes)) periods.push("1");
    if (normalizeValue(periodo2_mes)) periods.push("2");
    if (normalizeValue(periodo3_mes)) periods.push("3");
    return periods;
  }, [periodo1_mes, periodo2_mes, periodo3_mes]);

  useEffect(() => {
    if (open) {
      if (formulario) {
        form.reset({
          colaborador_id: formulario.colaborador_id,
          periodo1_mes: formulario.periodo1_mes?.toString() || "",
          periodo2_mes: formulario.periodo2_mes?.toString() || "",
          periodo3_mes: formulario.periodo3_mes?.toString() || "",
          periodo_preferencia: formulario.periodo_preferencia?.toString() || "",
          data_inicio_preferencia: (formulario as any).data_inicio_preferencia || "",
          vender_dias: formulario.vender_dias || false,
          dias_vender: formulario.dias_vender || 0,
          observacao: (formulario as any).observacao || "",
        });
      } else {
        form.reset({
          colaborador_id: "",
          periodo1_mes: "",
          periodo2_mes: "",
          periodo3_mes: "",
          periodo_preferencia: "",
          data_inicio_preferencia: "",
          vender_dias: false,
          dias_vender: 0,
          observacao: "",
        });
      }
    }
  }, [open, formulario, form]);

  // Clear data_inicio_preferencia when preferred month changes
  useEffect(() => {
    const currentDate = form.getValues("data_inicio_preferencia");
    if (currentDate && preferredMonth) {
      try {
        const d = parseISO(currentDate);
        if (d.getMonth() + 1 !== preferredMonth) {
          form.setValue("data_inicio_preferencia", "");
        }
      } catch {
        form.setValue("data_inicio_preferencia", "");
      }
    }
  }, [preferredMonth]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const p1_mes = normalizeValue(data.periodo1_mes);
      const p2_mes = normalizeValue(data.periodo2_mes);
      const p3_mes = normalizeValue(data.periodo3_mes);
      const preferencia = normalizeValue(data.periodo_preferencia);

      const payload: any = {
        colaborador_id: data.colaborador_id,
        ano_referencia: anoReferencia,
        periodo1_mes: p1_mes ? parseInt(p1_mes) : null,
        periodo1_quinzena: null,
        periodo2_mes: p2_mes ? parseInt(p2_mes) : null,
        periodo2_quinzena: null,
        periodo3_mes: p3_mes ? parseInt(p3_mes) : null,
        periodo3_quinzena: null,
        periodo_preferencia: preferencia ? parseInt(preferencia) : null,
        vender_dias: data.vender_dias,
        dias_vender: data.vender_dias ? data.dias_vender : 0,
        observacao: data.observacao || null,
        data_inicio_preferencia: data.data_inicio_preferencia || null,
        status: "pendente",
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        const { error } = await supabase.from("ferias_formulario_anual").update(payload).eq("id", formulario.id);
        if (error) throw error;
      } else {
        const { data: existing } = await supabase
          .from("ferias_formulario_anual")
          .select("id")
          .eq("colaborador_id", data.colaborador_id)
          .eq("ano_referencia", anoReferencia)
          .single();
        if (existing) throw new Error("Já existe um formulário para este colaborador neste ano.");
        const { error } = await supabase.from("ferias_formulario_anual").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Formulário atualizado!" : "Formulário criado com sucesso!");
      onSuccess();
    },
    onError: (error: Error) => toast.error(error.message || "Erro ao salvar formulário"),
  });

  const onSubmit = (data: FormData) => {
    const p1 = normalizeValue(data.periodo1_mes);
    const p2 = normalizeValue(data.periodo2_mes);
    const p3 = normalizeValue(data.periodo3_mes);

    if (!p1 && !p2 && !p3) {
      toast.error("Informe pelo menos um mês de preferência");
      return;
    }

    // Validate data_inicio_preferencia is within preferred month
    if (data.data_inicio_preferencia && preferredMonth) {
      try {
        const d = parseISO(data.data_inicio_preferencia);
        if (d.getMonth() + 1 !== preferredMonth) {
          toast.error("A data de início deve estar dentro do mês de preferência");
          return;
        }
      } catch {
        toast.error("Data de início inválida");
        return;
      }
    }

    saveMutation.mutate(data);
  };

  const renderMonthSelect = (fieldName: string, field: any) => (
    <Select onValueChange={field.onChange} value={field.value}>
      <FormControl>
        <SelectTrigger>
          <SelectValue placeholder="Selecione o mês" />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        <SelectItem value="_none_">— Não informar —</SelectItem>
        {availableMonths.map((m) => (
          <SelectItem key={m.value} value={m.value} disabled={m.disabled} className={m.disabled ? "text-muted-foreground" : ""}>
            {m.label}{m.disabled && " (bloqueado)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const formatDateBR = (dateStr: string) => {
    try { return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR }); } catch { return dateStr; }
  };

  // Compute min/max dates for the preferred month date picker
  const preferredMonthDateLimits = useMemo(() => {
    if (!preferredMonth) return null;
    const year = anoReferencia;
    const daysInMonth = getDaysInMonth(new Date(year, preferredMonth - 1));
    return {
      min: `${year}-${String(preferredMonth).padStart(2, "0")}-01`,
      max: `${year}-${String(preferredMonth).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`,
    };
  }, [preferredMonth, anoReferencia]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Formulário" : "Novo Formulário"} - {anoReferencia}
          </DialogTitle>
          <DialogDescription>
            Registre as preferências de férias do colaborador para o ano de {anoReferencia}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Combobox Colaborador */}
            <FormField
              control={form.control}
              name="colaborador_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Colaborador *</FormLabel>
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={comboboxOpen}
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                          disabled={isEditing}
                        >
                          {field.value
                            ? (() => {
                                const c = colaboradores.find(c => c.id === field.value);
                                return c ? `${c.nome}${(c as any).setor_titular?.nome ? ` (${(c as any).setor_titular.nome})` : ""}` : "Selecione...";
                              })()
                            : "Buscar colaborador..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nome..." />
                        <CommandList>
                          <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                          {colaboradoresDisponiveis.map((c) => (
                            <CommandItem key={c.id} value={c.nome} onSelect={() => { field.onChange(c.id); setComboboxOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", field.value === c.id ? "opacity-100" : "opacity-0")} />
                              {c.nome} {(c as any).setor_titular?.nome ? `(${(c as any).setor_titular.nome})` : ""}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Family member vacation info */}
            {familiarId && feriasFamiliar && feriasFamiliar.length > 0 && (
              <Alert className="border-blue-500/30 bg-blue-500/5">
                <Users className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-600">Familiar vinculado: {familiarNome || "—"}</AlertTitle>
                <AlertDescription className="text-sm">
                  <p className="font-medium mt-1">Férias cadastradas:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {feriasFamiliar.map((ff, i) => {
                      const q1i = ff.gozo_diferente && ff.gozo_quinzena1_inicio ? ff.gozo_quinzena1_inicio : ff.quinzena1_inicio;
                      const q1f = ff.gozo_diferente && ff.gozo_quinzena1_fim ? ff.gozo_quinzena1_fim : ff.quinzena1_fim;
                      const q2i = ff.gozo_diferente && ff.gozo_quinzena2_inicio ? ff.gozo_quinzena2_inicio : ff.quinzena2_inicio;
                      const q2f = ff.gozo_diferente && ff.gozo_quinzena2_fim ? ff.gozo_quinzena2_fim : ff.quinzena2_fim;
                      return (
                        <li key={i}>1º Período: {formatDateBR(q1i)} a {formatDateBR(q1f)} | 2º Período: {formatDateBR(q2i)} a {formatDateBR(q2f)}</li>
                      );
                    })}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {familiarId && (!feriasFamiliar || feriasFamiliar.length === 0) && (
              <Alert className="border-muted">
                <Users className="h-4 w-4" />
                <AlertTitle>Familiar vinculado: {familiarNome || "—"}</AlertTitle>
                <AlertDescription className="text-sm text-muted-foreground">Nenhuma férias cadastrada para o familiar ainda.</AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* Info about blocked months */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <Ban className="h-4 w-4" />
              <span>Janeiro e Dezembro estão bloqueados para férias conforme política da empresa.</span>
            </div>

            {/* Meses de preferência */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">
                Meses de Preferência (informe até 3 opções)
              </h4>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">1ª</span>
                    <span className="text-sm font-medium">Primeira opção</span>
                  </div>
                  <FormField control={form.control} name="periodo1_mes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mês</FormLabel>
                      {renderMonthSelect("periodo1_mes", field)}
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-secondary text-secondary-foreground text-xs font-bold px-2 py-1 rounded">2ª</span>
                    <span className="text-sm font-medium">Segunda opção</span>
                  </div>
                  <FormField control={form.control} name="periodo2_mes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mês</FormLabel>
                      {renderMonthSelect("periodo2_mes", field)}
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-muted text-muted-foreground text-xs font-bold px-2 py-1 rounded">3ª</span>
                    <span className="text-sm font-medium">Terceira opção</span>
                  </div>
                  <FormField control={form.control} name="periodo3_mes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mês</FormLabel>
                      {renderMonthSelect("periodo3_mes", field)}
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </div>

            {/* Período preferido */}
            {filledPeriods.length >= 1 && (
              <Card className="border-2 border-primary/50 bg-primary/5">
                <CardContent className="pt-4">
                  <FormField
                    control={form.control}
                    name="periodo_preferencia"
                    render={({ field }) => (
                      <FormItem className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-primary fill-primary" />
                          <FormLabel className="text-base font-semibold m-0">Qual é o mês de PREFERÊNCIA?</FormLabel>
                        </div>
                        <FormDescription>Escolha qual dos meses acima você prefere tirar férias.</FormDescription>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2">
                            {filledPeriods.map((p) => {
                              const mes = form.watch(`periodo${p}_mes` as any);
                              const monthLabel = MONTHS.find((m) => m.value === mes)?.label || "";
                              return (
                                <div key={p} className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                                  <RadioGroupItem value={p} id={`pref-${p}`} />
                                  <Label htmlFor={`pref-${p}`} className="flex-1 cursor-pointer">
                                    <span className="font-medium">{p}ª opção</span>
                                    <span className="text-muted-foreground ml-2">— {monthLabel}</span>
                                  </Label>
                                </div>
                              );
                            })}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* Data de início desejada */}
            {preferredMonth && (
              <FormField
                control={form.control}
                name="data_inicio_preferencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de início desejada (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        min={preferredMonthDateLimits?.min}
                        max={preferredMonthDateLimits?.max}
                      />
                    </FormControl>
                    <FormDescription>
                      Se o colaborador deseja iniciar as férias em uma data específica de {MONTHS.find(m => m.value === String(preferredMonth))?.label}, informe aqui.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            {/* Observação */}
            <FormField
              control={form.control}
              name="observacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observação</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Especifique datas ou períodos específicos, ou qualquer informação relevante..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Campo livre para especificar preferências adicionais (opcional)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Venda de dias */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="vender_dias"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Vender dias (Abono Pecuniário)</FormLabel>
                      <FormDescription>Deseja converter parte das férias em dinheiro?</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {venderDias && (
                <FormField control={form.control} name="dias_vender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade de dias a vender (máx. 10)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={10} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                    </FormControl>
                    <FormDescription>Você pode vender até 1/3 das férias (10 dias de 30)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
