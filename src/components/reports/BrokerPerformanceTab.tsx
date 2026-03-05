import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, AlertCircle, Database } from "lucide-react";
import { ExportButton } from "./ExportButton";
import { exportToExcel, formatBrokerPerformanceForExport } from "@/lib/exportUtils";
import { differenceInDays, subDays } from "date-fns";

interface BrokerPerformanceTabProps {
  enabled?: boolean;
}

export const BrokerPerformanceTab = ({ enabled = true }: BrokerPerformanceTabProps) => {
  const [period, setPeriod] = useState("30");
  
  const endDate = useMemo(() => new Date().toISOString().split('T')[0], []);
  const startDate = useMemo(() => {
    return subDays(new Date(), parseInt(period)).toISOString().split('T')[0];
  }, [period]);

  // Use hybrid function that supports historical data
  const { data: performance, isLoading } = useQuery({
    queryKey: ["broker_performance_hybrid", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_broker_performance_hybrid", {
        start_date: startDate,
        end_date: endDate,
      });
      if (error) throw error;
      // Filter out brokers with 0 assignments (no data in period)
      return (data || []).filter((b: any) => Number(b.total_assignments) > 0);
    },
    enabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Check if using historical data
  const { data: isHistorical } = useQuery({
    queryKey: ["is_historical_data", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_assignments")
        .select("id")
        .gte("assignment_date", startDate)
        .lte("assignment_date", endDate)
        .limit(1);
      if (error) throw error;
      return !data || data.length === 0;
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  const stats = useMemo(() => {
    if (!performance || performance.length === 0) return null;
    
    const totalDays = differenceInDays(new Date(endDate), new Date(startDate)) + 1;
    const topBroker = performance[0];
    const idleBroker = performance.reduce((min, broker) => 
      (!min || (broker.total_assignments < min.total_assignments)) ? broker : min
    , performance[0]);
    
    const occupancyRates = performance.map(b => 
      (Number(b.total_assignments) / totalDays) * 100
    );
    const avgOccupancy = occupancyRates.reduce((sum, rate) => sum + rate, 0) / occupancyRates.length;
    
    const variance = occupancyRates.reduce((sum, rate) => 
      sum + Math.pow(rate - avgOccupancy, 2), 0) / occupancyRates.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgOccupancy > 0 ? (stdDev / avgOccupancy) * 100 : 0;
    
    return {
      topBroker,
      idleBroker,
      avgOccupancy,
      balance: coefficientOfVariation < 30 ? 'Boa' : coefficientOfVariation < 50 ? 'Média' : 'Baixa',
      totalDays
    };
  }, [performance, startDate, endDate]);

  const handleExport = () => {
    if (performance && performance.length > 0) {
      const formatted = formatBrokerPerformanceForExport(performance);
      exportToExcel(formatted, `Performance_Corretores_${startDate}_${endDate}`, 'Performance');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-48">
            <Label>Período</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isHistorical && (
            <Badge variant="secondary" className="gap-1 mt-5">
              <Database className="h-3 w-3" />
              Dados históricos
            </Badge>
          )}
        </div>
        <ExportButton 
          onClick={handleExport} 
          disabled={!performance || performance.length === 0}
        />
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Corretor Mais Ativo</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.topBroker.broker_name}</div>
              <p className="text-xs text-muted-foreground">
                {stats.topBroker.total_assignments} plantões
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Corretor Mais Ocioso</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.idleBroker.broker_name}</div>
              <p className="text-xs text-muted-foreground">
                {stats.idleBroker.total_assignments} plantões
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa Média de Ocupação</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgOccupancy.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Dos {stats.totalDays} dias do período
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Distribuição</CardTitle>
              <AlertCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.balance}</div>
              <p className="text-xs text-muted-foreground">
                Equilíbrio entre corretores
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="text-center p-8 text-muted-foreground">Carregando...</div>
      ) : performance && performance.length > 0 ? (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Corretor</TableHead>
                <TableHead className="text-right">Total Plantões</TableHead>
                <TableHead className="text-right">Manhã</TableHead>
                <TableHead className="text-right">Tarde</TableHead>
                <TableHead className="text-right">Taxa Ocupação</TableHead>
                <TableHead className="text-right">Locais Únicos</TableHead>
                <TableHead>Último Plantão</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performance.map((broker: any) => {
                const occupancyRate = ((Number(broker.total_assignments) / stats!.totalDays) * 100);
                const daysSinceLastAssignment = broker.last_assignment 
                  ? differenceInDays(new Date(), new Date(broker.last_assignment))
                  : 999;
                
                return (
                  <TableRow key={broker.broker_id}>
                    <TableCell className="font-medium">{broker.broker_name}</TableCell>
                    <TableCell className="text-right">{broker.total_assignments}</TableCell>
                    <TableCell className="text-right">{broker.morning_count}</TableCell>
                    <TableCell className="text-right">{broker.afternoon_count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span>{occupancyRate.toFixed(1)}%</span>
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{broker.unique_locations}</TableCell>
                    <TableCell>
                      {broker.last_assignment 
                        ? new Date(broker.last_assignment).toLocaleDateString('pt-BR')
                        : 'N/A'
                      }
                    </TableCell>
                    <TableCell>
                      {daysSinceLastAssignment > 30 ? (
                        <Badge variant="destructive">Ocioso +30d</Badge>
                      ) : daysSinceLastAssignment > 14 ? (
                        <Badge variant="secondary">Atenção</Badge>
                      ) : broker.last_assignment ? (
                        <Badge className="bg-primary text-primary-foreground">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Histórico</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center p-8 text-muted-foreground">
          Nenhum dado encontrado para o período selecionado
        </div>
      )}
    </div>
  );
};
