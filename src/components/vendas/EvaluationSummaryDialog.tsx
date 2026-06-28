import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, FileText, Handshake, Star, BarChart3, Users, AlertTriangle, CheckCircle2 } from "lucide-react";

interface EvaluationSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  broker: {
    id: string;
    name: string;
    is_launch?: boolean;
  };
  year: string;
}

export function EvaluationSummaryDialog({
  open,
  onOpenChange,
  broker,
  year,
}: EvaluationSummaryDialogProps) {
  // Fetch aggregated visits for the year
  const { data: visitsData } = useQuery({
    queryKey: ["broker-yearly-visits", broker.id, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_leads")
        .select("gimob_key_visits, builder_visits, scheduled_visits")
        .eq("broker_id", broker.id)
        .like("year_month", `${year}-%`);
      
      if (error) throw error;
      
      const totals = (data || []).reduce(
        (acc, row) => ({
          gimobKey: acc.gimobKey + (row.gimob_key_visits || 0),
          builder: acc.builder + (row.builder_visits || 0),
          scheduled: acc.scheduled + (row.scheduled_visits || 0),
        }),
        { gimobKey: 0, builder: 0, scheduled: 0 }
      );
      
      return {
        ...totals,
        total: totals.gimobKey + totals.builder + totals.scheduled,
      };
    },
    enabled: open,
  });

  // Fetch aggregated proposals for the year
  const { data: proposalsData } = useQuery({
    queryKey: ["broker-yearly-proposals", broker.id, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broker_monthly_proposals")
        .select("proposals_count, proposals_converted")
        .eq("broker_id", broker.id)
        .like("year_month", `${year}-%`);
      
      if (error) throw error;
      
      return (data || []).reduce(
        (acc, row) => ({
          count: acc.count + (row.proposals_count || 0),
          converted: acc.converted + (row.proposals_converted || 0),
        }),
        { count: 0, converted: 0 }
      );
    },
    enabled: open,
  });

  // Fetch sales count for the year
  const { data: salesCount } = useQuery({
    queryKey: ["broker-yearly-sales", broker.id, year],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .eq("broker_id", broker.id)
        .like("year_month", `${year}-%`);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: open,
  });

  // Fetch last evaluation of the year
  const { data: lastEvaluation } = useQuery({
    queryKey: ["broker-last-evaluation", broker.id, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broker_evaluations")
        .select("*")
        .eq("broker_id", broker.id)
        .like("year_month", `${year}-%`)
        .order("year_month", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch all evaluations for average calculation
  const { data: yearlyEvaluations } = useQuery({
    queryKey: ["broker-yearly-evaluations", broker.id, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broker_evaluations")
        .select("average_score, year_month")
        .eq("broker_id", broker.id)
        .like("year_month", `${year}-%`)
        .order("year_month");
      
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const yearlyAverage = yearlyEvaluations && yearlyEvaluations.length > 0
    ? yearlyEvaluations.reduce((sum, e) => sum + (e.average_score || 0), 0) / yearlyEvaluations.length
    : null;

  const getMonthName = (yearMonth: string) => {
    const [y, m] = yearMonth.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("pt-BR", { month: "short" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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
          <p className="text-sm text-muted-foreground">Resumo Anual - {year}</p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Performance Section */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Desempenho Anual
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <Calendar className="h-5 w-5 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{visitsData?.total ?? 0}</div>
                <div className="text-xs text-muted-foreground">Visitas</div>
                {visitsData && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Chaves: {visitsData.gimobKey} | 
                    Construtora: {visitsData.builder} | 
                    Agendadas: {visitsData.scheduled}
                  </div>
                )}
              </div>
              <div className="border rounded-lg p-4 text-center">
                <FileText className="h-5 w-5 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{proposalsData?.count ?? 0}</div>
                <div className="text-xs text-muted-foreground">Propostas</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Convertidas: {proposalsData?.converted ?? 0}
                </div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <Handshake className="h-5 w-5 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{salesCount ?? 0}</div>
                <div className="text-xs text-muted-foreground">Contratos</div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Yearly Average */}
          <div className="space-y-3">
            <h3 className="font-semibold">Média C2S Anual</h3>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="text-3xl font-bold">
                  {yearlyAverage !== null ? yearlyAverage.toFixed(1) : "-"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Baseado em {yearlyEvaluations?.length || 0} avaliação(ões)
                </div>
              </div>
              
              {yearlyEvaluations && yearlyEvaluations.length > 0 && (
                <div className="flex gap-1">
                  {yearlyEvaluations.map((e) => (
                    <div
                      key={e.year_month}
                      className="text-center px-2 py-1 bg-muted rounded text-xs"
                      title={`${getMonthName(e.year_month)}: ${e.average_score?.toFixed(1) ?? "-"}`}
                    >
                      <div className="font-medium">{e.average_score?.toFixed(1) ?? "-"}</div>
                      <div className="text-muted-foreground">{getMonthName(e.year_month)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Last Evaluation Notes */}
          {lastEvaluation && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold">
                  Última Avaliação ({getMonthName(lastEvaluation.year_month)})
                </h3>
                
                {lastEvaluation.obs_feedbacks && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs font-medium text-muted-foreground mb-1">OBS/Feedbacks</div>
                    <p className="text-sm">{lastEvaluation.obs_feedbacks}</p>
                  </div>
                )}
                
                {lastEvaluation.acoes_melhorias_c2s && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Ações para Melhorias C2S</div>
                    <p className="text-sm">{lastEvaluation.acoes_melhorias_c2s}</p>
                  </div>
                )}
                
                {lastEvaluation.metas_acoes_futuras && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Metas/Ações Futuras</div>
                    <p className="text-sm">{lastEvaluation.metas_acoes_futuras}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
