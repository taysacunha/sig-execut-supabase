import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TrendingUp, TrendingDown, Minus, Star, Calendar, FileText, Handshake, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const scoreField = z.coerce.number().min(0).max(10).optional().nullable();

const evaluationSchema = z.object({
  broker_id: z.string().min(1),
  is_launch: z.boolean(),
  c2s_perfil_cliente: scoreField,
  c2s_atualiza_atividades: scoreField,
  c2s_atende_rapido: scoreField,
  c2s_cliente_remanejado: scoreField,
  c2s_bolsao: scoreField,
  c2s_agendamento_chaves: scoreField,
  c2s_agendamento_sem_chaves: scoreField,
  c2s_cliente_potencial: scoreField,
  c2s_justifica_arquivamento: scoreField,
  c2s_insere_etiquetas: scoreField,
  c2s_etiqueta_construtora: scoreField,
  c2s_feedback_visita: scoreField,
  c2s_cadastra_proposta: scoreField,
  c2s_negocio_fechado: scoreField,
  obs_feedbacks: z.string().optional(),
  acoes_melhorias_c2s: z.string().optional(),
  metas_acoes_futuras: z.string().optional(),
});

export type EvaluationFormData = z.infer<typeof evaluationSchema>;

const c2sCriteria = [
  { name: "c2s_perfil_cliente", label: "Perfil do Cliente?" },
  { name: "c2s_atualiza_atividades", label: "Atualiza atividades?" },
  { name: "c2s_atende_rapido", label: "Atende rápido?" },
  { name: "c2s_cliente_remanejado", label: "Cliente remanejado para muito tempo?" },
  { name: "c2s_bolsao", label: "Não deixa atendimentos para Bolsão?" },
  { name: "c2s_agendamento_chaves", label: "Registra agendamento com chaves?" },
  { name: "c2s_agendamento_sem_chaves", label: "Registra agendamento de visitas sem chaves?" },
  { name: "c2s_cliente_potencial", label: "Insere cliente em potencial (favoritos)?" },
  { name: "c2s_justifica_arquivamento", label: "Justifica o motivo do arquivamento?" },
  { name: "c2s_insere_etiquetas", label: "Insere etiquetas?" },
  { name: "c2s_etiqueta_construtora", label: "Insere etiqueta reunião construtora?" },
  { name: "c2s_feedback_visita", label: "Insere feedback da visita?" },
  { name: "c2s_cadastra_proposta", label: "Cadastra proposta?" },
  { name: "c2s_negocio_fechado", label: "Insere negócio fechado na conclusão?" },
];

interface EvaluationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  broker: {
    id: string;
    name: string;
    is_launch?: boolean;
  };
  yearMonth: string;
  existingEvaluation?: any;
  onSubmit: (data: EvaluationFormData, isEdit: boolean) => void;
  isSubmitting?: boolean;
}

function getPreviousMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

function getMonthName(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function EvaluationDialog({
  open,
  onOpenChange,
  broker,
  yearMonth,
  existingEvaluation,
  onSubmit,
  isSubmitting = false,
}: EvaluationDialogProps) {
  const isEdit = !!existingEvaluation;
  const previousMonth = getPreviousMonth(yearMonth);

  const form = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: {
      broker_id: broker.id,
      is_launch: broker.is_launch ?? false,
    },
  });

  // Fetch previous month evaluation
  const { data: previousEvaluation } = useQuery({
    queryKey: ["previous-evaluation", broker.id, previousMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broker_evaluations")
        .select("*")
        .eq("broker_id", broker.id)
        .eq("year_month", previousMonth)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      if (existingEvaluation) {
        form.reset({
          broker_id: broker.id,
          is_launch: existingEvaluation.is_launch ?? broker.is_launch ?? false,
          c2s_perfil_cliente: existingEvaluation.c2s_perfil_cliente,
          c2s_atualiza_atividades: existingEvaluation.c2s_atualiza_atividades,
          c2s_atende_rapido: existingEvaluation.c2s_atende_rapido,
          c2s_cliente_remanejado: existingEvaluation.c2s_cliente_remanejado,
          c2s_bolsao: existingEvaluation.c2s_bolsao,
          c2s_agendamento_chaves: existingEvaluation.c2s_agendamento_chaves,
          c2s_agendamento_sem_chaves: existingEvaluation.c2s_agendamento_sem_chaves,
          c2s_cliente_potencial: existingEvaluation.c2s_cliente_potencial,
          c2s_justifica_arquivamento: existingEvaluation.c2s_justifica_arquivamento,
          c2s_insere_etiquetas: existingEvaluation.c2s_insere_etiquetas,
          c2s_etiqueta_construtora: existingEvaluation.c2s_etiqueta_construtora,
          c2s_feedback_visita: existingEvaluation.c2s_feedback_visita,
          c2s_cadastra_proposta: existingEvaluation.c2s_cadastra_proposta,
          c2s_negocio_fechado: existingEvaluation.c2s_negocio_fechado,
          obs_feedbacks: existingEvaluation.obs_feedbacks || "",
          acoes_melhorias_c2s: existingEvaluation.acoes_melhorias_c2s || "",
          metas_acoes_futuras: existingEvaluation.metas_acoes_futuras || "",
        });
      } else {
        // Pré-preencher com dados da avaliação anterior
        form.reset({
          broker_id: broker.id,
          is_launch: previousEvaluation?.is_launch ?? broker.is_launch ?? false,
          c2s_perfil_cliente: previousEvaluation?.c2s_perfil_cliente ?? null,
          c2s_atualiza_atividades: previousEvaluation?.c2s_atualiza_atividades ?? null,
          c2s_atende_rapido: previousEvaluation?.c2s_atende_rapido ?? null,
          c2s_cliente_remanejado: previousEvaluation?.c2s_cliente_remanejado ?? null,
          c2s_bolsao: previousEvaluation?.c2s_bolsao ?? null,
          c2s_agendamento_chaves: previousEvaluation?.c2s_agendamento_chaves ?? null,
          c2s_agendamento_sem_chaves: previousEvaluation?.c2s_agendamento_sem_chaves ?? null,
          c2s_cliente_potencial: previousEvaluation?.c2s_cliente_potencial ?? null,
          c2s_justifica_arquivamento: previousEvaluation?.c2s_justifica_arquivamento ?? null,
          c2s_insere_etiquetas: previousEvaluation?.c2s_insere_etiquetas ?? null,
          c2s_etiqueta_construtora: previousEvaluation?.c2s_etiqueta_construtora ?? null,
          c2s_feedback_visita: previousEvaluation?.c2s_feedback_visita ?? null,
          c2s_cadastra_proposta: previousEvaluation?.c2s_cadastra_proposta ?? null,
          c2s_negocio_fechado: previousEvaluation?.c2s_negocio_fechado ?? null,
          obs_feedbacks: previousEvaluation?.obs_feedbacks || "",
          acoes_melhorias_c2s: previousEvaluation?.acoes_melhorias_c2s || "",
          metas_acoes_futuras: previousEvaluation?.metas_acoes_futuras || "",
        });
      }
    }
  }, [open, existingEvaluation, broker, form, previousEvaluation]);

  // Fetch previous month performance data for comparison
  const { data: previousPerformanceData } = useQuery({
    queryKey: ["broker-performance-previous", broker.id, previousMonth],
    queryFn: async () => {
      const { data: leads } = await supabase
        .from("monthly_leads")
        .select("gimob_key_visits, builder_visits, scheduled_visits, leads_received, leads_archived")
        .eq("broker_id", broker.id)
        .eq("year_month", previousMonth)
        .maybeSingle();

      const { data: proposals } = await supabase
        .from("broker_monthly_proposals")
        .select("proposals_count")
        .eq("broker_id", broker.id)
        .eq("year_month", previousMonth)
        .maybeSingle();

      const { data: salesData } = await supabase
        .from("sales")
        .select("id")
        .eq("broker_id", broker.id)
        .eq("year_month", previousMonth);

      const totalVisits = (leads?.gimob_key_visits || 0) + 
                         (leads?.builder_visits || 0) + 
                         (leads?.scheduled_visits || 0);

      return {
        visits: totalVisits,
        proposals: proposals?.proposals_count || 0,
        contracts: salesData?.length || 0,
        leads: {
          received: leads?.leads_received || 0,
          archived: leads?.leads_archived || 0,
        },
      };
    },
    enabled: open,
    staleTime: 0,
  });

  // Fetch performance data (leads, proposals, sales)
  const { data: performanceData } = useQuery({
    queryKey: ["broker-performance", broker.id, yearMonth],
    queryFn: async () => {
      // Get visits from monthly_leads
      const { data: leads } = await supabase
        .from("monthly_leads")
        .select("gimob_key_visits, builder_visits, scheduled_visits, last_visit_date, leads_received, leads_archived")
        .eq("broker_id", broker.id)
        .eq("year_month", yearMonth)
        .maybeSingle();

      // Get proposals count from broker_monthly_proposals
      const { data: proposals } = await supabase
        .from("broker_monthly_proposals")
        .select("proposals_count, proposals_converted")
        .eq("broker_id", broker.id)
        .eq("year_month", yearMonth)
        .maybeSingle();

      // Get sales with full details
      const { data: salesData } = await supabase
        .from("sales")
        .select("id, sale_date, property_name, sale_value")
        .eq("broker_id", broker.id)
        .eq("year_month", yearMonth)
        .order("sale_date", { ascending: true });

      const totalVisits = (leads?.gimob_key_visits || 0) + 
                         (leads?.builder_visits || 0) + 
                         (leads?.scheduled_visits || 0);

      return {
        visits: {
          total: totalVisits,
          gimobKey: leads?.gimob_key_visits || 0,
          builder: leads?.builder_visits || 0,
          scheduled: leads?.scheduled_visits || 0,
          lastVisitDate: leads?.last_visit_date || null,
        },
        proposals: proposals?.proposals_count || 0,
        contracts: salesData || [],
        leads: {
          received: leads?.leads_received || 0,
          archived: leads?.leads_archived || 0,
        },
      };
    },
    enabled: open,
    staleTime: 0, // Sempre buscar dados frescos
  });

  // Calculate live average from current form values
  const watchedValues = form.watch();
  const liveAverage = useMemo(() => {
    let total = 0;
    let count = 0;
    
    c2sCriteria.forEach((c) => {
      const value = watchedValues[c.name as keyof EvaluationFormData];
      if (typeof value === "number" && !isNaN(value)) {
        total += value;
        count++;
      }
    });
    
    return count > 0 ? total / count : null;
  }, [watchedValues]);

  const previousAverage = previousEvaluation?.average_score ?? null;
  const averageVariation = liveAverage !== null && previousAverage !== null
    ? liveAverage - previousAverage
    : null;

  const renderVariation = (current: number | null | undefined, previous: number | null | undefined) => {
    if (current === null || current === undefined || previous === null || previous === undefined) {
      return null;
    }
    const diff = current - previous;
    if (diff > 0) {
      return (
        <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400 text-xs">
          <TrendingUp className="h-3 w-3" />+{diff.toFixed(1)}
        </span>
      );
    } else if (diff < 0) {
      return (
        <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 text-xs">
          <TrendingDown className="h-3 w-3" />{diff.toFixed(1)}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-0.5 text-muted-foreground text-xs">
        <Minus className="h-3 w-3" />0.0
      </span>
    );
  };

  const handleSubmit = (data: EvaluationFormData) => {
    onSubmit(data, isEdit);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl">{broker.name}</DialogTitle>
            {broker.is_launch && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                <Star className="h-3 w-3 mr-1 fill-current" />
                LANÇAMENTO
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground capitalize">{getMonthName(yearMonth)}</p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* C2S Criteria Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Critérios C2S</h3>
                  <p className="text-xs text-muted-foreground">Notas de 0 a 10</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Média</div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">
                      {liveAverage !== null ? liveAverage.toFixed(1) : "-"}
                    </span>
                    {renderVariation(liveAverage, previousAverage)}
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr,80px,80px,60px] gap-2 p-2 bg-muted/50 text-xs font-medium">
                  <div>Critério</div>
                  <div className="text-center">Anterior</div>
                  <div className="text-center">Atual</div>
                  <div className="text-center">Var.</div>
                </div>
                {c2sCriteria.map((c) => {
                  const previousValue = previousEvaluation?.[c.name as keyof typeof previousEvaluation] as number | null;
                  const currentValue = watchedValues[c.name as keyof EvaluationFormData] as number | null | undefined;
                  
                  return (
                    <div 
                      key={c.name} 
                      className="grid grid-cols-[1fr,80px,80px,60px] gap-2 p-2 border-t items-center"
                    >
                      <Label className="text-xs">{c.label}</Label>
                      <div className="text-center text-sm text-muted-foreground">
                        {previousValue?.toFixed(1) ?? "-"}
                      </div>
                      <FormField
                        control={form.control}
                        name={c.name as any}
                        render={({ field }) => (
                          <FormItem className="m-0">
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="10"
                                step="0.1"
                                className="h-8 text-center text-sm"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="text-center">
                        {renderVariation(currentValue ?? null, previousValue)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Performance Section - Auto-populated */}
            <div className="space-y-3">
              <h3 className="font-semibold">Desempenho</h3>
              <p className="text-xs text-muted-foreground">Dados extraídos automaticamente do sistema</p>
              
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="border rounded-lg p-4 text-center">
                   <Calendar className="h-5 w-5 mx-auto mb-2 text-primary" />
                   <div className="text-2xl font-bold">{performanceData?.visits.total ?? 0}</div>
                   <div className="text-xs text-muted-foreground">Visitas</div>
                   {previousPerformanceData && (
                     <div className="text-xs mt-1">
                       <span className="text-muted-foreground">Anterior: </span>
                       <span className={cn(
                         "font-medium",
                         (performanceData?.visits.total ?? 0) > previousPerformanceData.visits ? "text-green-600 dark:text-green-400" :
                         (performanceData?.visits.total ?? 0) < previousPerformanceData.visits ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                       )}>{previousPerformanceData.visits}</span>
                     </div>
                   )}
                   {performanceData && (
                     <div className="text-[10px] text-muted-foreground mt-1">
                       Chaves: {performanceData.visits.gimobKey} | 
                       Construtora: {performanceData.visits.builder} | 
                       Agendadas: {performanceData.visits.scheduled}
                     </div>
                   )}
                  {performanceData?.visits.lastVisitDate && (
                    <div className="text-[10px] text-primary mt-1">
                      Última: {(() => { const [y,m,d] = performanceData.visits.lastVisitDate.split("-").map(Number); return new Date(y, m-1, d).toLocaleDateString("pt-BR"); })()}
                    </div>
                  )}
                </div>
                <div className="border rounded-lg p-4 text-center">
                   <FileText className="h-5 w-5 mx-auto mb-2 text-primary" />
                   <div className="text-2xl font-bold">{performanceData?.proposals ?? 0}</div>
                   <div className="text-xs text-muted-foreground">Propostas</div>
                   {previousPerformanceData && (
                     <div className="text-xs mt-1">
                       <span className="text-muted-foreground">Anterior: </span>
                       <span className={cn(
                         "font-medium",
                         (performanceData?.proposals ?? 0) > previousPerformanceData.proposals ? "text-green-600 dark:text-green-400" :
                         (performanceData?.proposals ?? 0) < previousPerformanceData.proposals ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                       )}>{previousPerformanceData.proposals}</span>
                     </div>
                   )}
                 </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <div className="border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                      <Handshake className="h-5 w-5 mx-auto mb-2 text-primary" />
                       <div className="text-2xl font-bold">
                         {Array.isArray(performanceData?.contracts) ? performanceData.contracts.length : 0}
                       </div>
                       <div className="text-xs text-muted-foreground">Contratos</div>
                       {previousPerformanceData && (
                         <div className="text-xs mt-1">
                           <span className="text-muted-foreground">Anterior: </span>
                           <span className={cn(
                             "font-medium",
                             (Array.isArray(performanceData?.contracts) ? performanceData.contracts.length : 0) > previousPerformanceData.contracts ? "text-green-600 dark:text-green-400" :
                             (Array.isArray(performanceData?.contracts) ? performanceData.contracts.length : 0) < previousPerformanceData.contracts ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                           )}>{previousPerformanceData.contracts}</span>
                         </div>
                       )}
                       <div className="text-[10px] text-primary mt-1">clique para detalhes</div>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Contratos do Mês</h4>
                      {!Array.isArray(performanceData?.contracts) || performanceData.contracts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum contrato registrado.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {performanceData.contracts.map((sale) => (
                            <div 
                              key={sale.id} 
                              className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm"
                            >
                              <div>
                                <div className="font-medium">{sale.property_name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(sale.sale_date).toLocaleDateString("pt-BR")}
                                </div>
                              </div>
                              <div className="font-semibold text-primary">
                                {sale.sale_value.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {(() => {
                  const received = performanceData?.leads.received ?? 0;
                  const archived = performanceData?.leads.archived ?? 0;
                  const hasAlert = received > 0 && archived / received > 0.5;
                  const archivedPercent = received > 0 ? Math.round((archived / received) * 100) : 0;
                  return (
                    <div className={cn(
                      "rounded-lg p-4 text-center border",
                      hasAlert
                        ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                        : "bg-green-50/50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                    )}>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Users className={cn(
                          "h-5 w-5",
                          hasAlert ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                        )} />
                        {hasAlert ? (
                          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        )}
                      </div>
                      <div className="text-2xl font-bold">{received}</div>
                      <div className="text-xs text-muted-foreground">Leads Recebidos</div>
                      <div className="text-[10px] mt-1">
                        <span className="text-muted-foreground">Descartados: {archived} ({archivedPercent}%)</span>
                      </div>
                      {previousPerformanceData && (
                        <div className="text-xs mt-1">
                          <span className="text-muted-foreground">Anterior: </span>
                          <span className={cn(
                            "font-medium",
                            received > previousPerformanceData.leads.received ? "text-green-600 dark:text-green-400" :
                            received < previousPerformanceData.leads.received ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                          )}>{previousPerformanceData.leads.received}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <Separator />

            {/* Launch Toggle */}
            <FormField
              control={form.control}
              name="is_launch"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Star className={cn("h-5 w-5", field.value ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
                    <Label className="font-medium">Corretores de Lançamento</Label>
                  </div>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormItem>
              )}
            />

            {/* Text Areas */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="obs_feedbacks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OBS/Feedbacks</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Observações e feedbacks gerais..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="acoes_melhorias_c2s"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ações para Melhorias C2S</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Ações planejadas para melhorar os indicadores C2S..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="metas_acoes_futuras"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>METAS/AÇÕES FUTURAS</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Metas e ações planejadas para os próximos períodos..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : isEdit ? "Salvar Alterações" : "Registrar Avaliação"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
