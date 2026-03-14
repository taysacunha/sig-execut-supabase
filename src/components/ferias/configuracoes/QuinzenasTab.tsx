import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Save, Calendar, Wand2 } from "lucide-react";
import { format, parse, lastDayOfMonth, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const MONTHS = [
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
];

interface Quinzena {
  id: string;
  ano: number;
  mes: number;
  quinzena: number;
  data_inicio: string;
  data_fim: string;
}

export function QuinzenasTab() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const years = getYearOptions(0, 5);

  const { data: quinzenas = [], isLoading } = useQuery({
    queryKey: ["ferias-quinzenas", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_quinzenas")
        .select("*")
        .eq("ano", selectedYear)
        .order("mes")
        .order("quinzena");

      if (error) throw error;
      return data as Quinzena[];
    },
  });

  // Group by month
  const quinzenasByMonth = useMemo(() => {
    const grouped: Record<number, { q1?: Quinzena; q2?: Quinzena }> = {};
    
    MONTHS.forEach(m => {
      grouped[m.value] = { q1: undefined, q2: undefined };
    });

    quinzenas.forEach(q => {
      if (grouped[q.mes]) {
        if (q.quinzena === 1) grouped[q.mes].q1 = q;
        else grouped[q.mes].q2 = q;
      }
    });

    return grouped;
  }, [quinzenas]);

  // Auto-generate quinzenas for the year
  const generateMutation = useMutation({
    mutationFn: async () => {
      // Delete existing quinzenas for this year (except jan/dec)
      const { error: deleteError } = await supabase
        .from("ferias_quinzenas")
        .delete()
        .eq("ano", selectedYear)
        .gte("mes", 2)
        .lte("mes", 11);

      if (deleteError) throw deleteError;

      // Generate new quinzenas
      const newQuinzenas: Omit<Quinzena, "id">[] = [];

      for (const month of MONTHS) {
        const firstDay = new Date(selectedYear, month.value - 1, 1);
        const lastDay = lastDayOfMonth(firstDay);

        // 1ª Quinzena: dia 1 ao dia 15
        newQuinzenas.push({
          ano: selectedYear,
          mes: month.value,
          quinzena: 1,
          data_inicio: format(firstDay, "yyyy-MM-dd"),
          data_fim: format(new Date(selectedYear, month.value - 1, 15), "yyyy-MM-dd"),
        });

        // 2ª Quinzena: dia 16 ao último dia do mês
        newQuinzenas.push({
          ano: selectedYear,
          mes: month.value,
          quinzena: 2,
          data_inicio: format(new Date(selectedYear, month.value - 1, 16), "yyyy-MM-dd"),
          data_fim: format(lastDay, "yyyy-MM-dd"),
        });
      }

      const { error: insertError } = await supabase
        .from("ferias_quinzenas")
        .insert(newQuinzenas);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias-quinzenas", selectedYear] });
      toast.success(`Quinzenas de ${selectedYear} geradas com sucesso!`);
    },
    onError: (error) => {
      console.error("Erro ao gerar quinzenas:", error);
      toast.error("Erro ao gerar quinzenas");
    },
  });

  // Update quinzena dates
  const updateMutation = useMutation({
    mutationFn: async ({ id, data_inicio, data_fim }: { id: string; data_inicio: string; data_fim: string }) => {
      const { error } = await supabase
        .from("ferias_quinzenas")
        .update({ data_inicio, data_fim })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias-quinzenas", selectedYear] });
      toast.success("Quinzena atualizada!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar quinzena:", error);
      toast.error("Erro ao atualizar quinzena");
    },
  });

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + "T12:00:00"), "dd/MM", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasQuinzenas = Object.values(quinzenasByMonth).some(m => m.q1 || m.q2);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Definição de Quinzenas
          </CardTitle>
          <CardDescription>
            Configure as datas de início e fim de cada quinzena por mês (exceto janeiro e dezembro)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Label>Ano:</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              variant={hasQuinzenas ? "outline" : "default"}
            >
              {generateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              {hasQuinzenas ? "Regenerar Quinzenas" : "Gerar Quinzenas Automaticamente"}
            </Button>
          </div>

          {!hasQuinzenas ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/50">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">Nenhuma quinzena definida</h3>
              <p className="text-muted-foreground">
                Clique em "Gerar Quinzenas Automaticamente" para criar as definições do ano
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>1ª Quinzena</TableHead>
                    <TableHead>2ª Quinzena</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MONTHS.map((month) => {
                    const data = quinzenasByMonth[month.value];
                    return (
                      <TableRow key={month.value}>
                        <TableCell className="font-medium">{month.label}</TableCell>
                        <TableCell>
                          {data?.q1 ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="date"
                                value={data.q1.data_inicio}
                                onChange={(e) => updateMutation.mutate({
                                  id: data.q1!.id,
                                  data_inicio: e.target.value,
                                  data_fim: data.q1!.data_fim,
                                })}
                                className="w-36"
                              />
                              <span>a</span>
                              <Input
                                type="date"
                                value={data.q1.data_fim}
                                onChange={(e) => updateMutation.mutate({
                                  id: data.q1!.id,
                                  data_inicio: data.q1!.data_inicio,
                                  data_fim: e.target.value,
                                })}
                                className="w-36"
                              />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {data?.q2 ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="date"
                                value={data.q2.data_inicio}
                                onChange={(e) => updateMutation.mutate({
                                  id: data.q2!.id,
                                  data_inicio: e.target.value,
                                  data_fim: data.q2!.data_fim,
                                })}
                                className="w-36"
                              />
                              <span>a</span>
                              <Input
                                type="date"
                                value={data.q2.data_fim}
                                onChange={(e) => updateMutation.mutate({
                                  id: data.q2!.id,
                                  data_inicio: data.q2!.data_inicio,
                                  data_fim: e.target.value,
                                })}
                                className="w-36"
                              />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Nota:</strong> Janeiro e Dezembro são bloqueados por padrão e não aparecem na lista de quinzenas. 
            Férias nesses meses só podem ser cadastradas como exceção por um administrador.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
