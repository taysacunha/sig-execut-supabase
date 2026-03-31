import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Calendar, Clock, X, Plus } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface InternalPeriodConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  periodName: string;
}

const weekdaysOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const weekdaysMap: Record<string, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

export function InternalPeriodConfigDialog({
  open,
  onOpenChange,
  periodId,
  periodName,
}: InternalPeriodConfigDialogProps) {
  const queryClient = useQueryClient();

  // Estado para os dias selecionados (seg-sex)
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  
  // Estados para sábado e domingo
  const [saturdayEnabled, setSaturdayEnabled] = useState(false);
  const [sundayEnabled, setSundayEnabled] = useState(false);
  
  // Estado para turnos habilitados
  const [hasMorning, setHasMorning] = useState(true);
  const [hasAfternoon, setHasAfternoon] = useState(true);
  
  // Estado para horários
  const [morningStart, setMorningStart] = useState("08:00");
  const [morningEnd, setMorningEnd] = useState("12:00");
  const [afternoonStart, setAfternoonStart] = useState("13:00");
  const [afternoonEnd, setAfternoonEnd] = useState("18:00");
  
  // Horários específicos para sábado
  const [saturdayStart, setSaturdayStart] = useState("08:00");
  const [saturdayEnd, setSaturdayEnd] = useState("12:00");
  
  // Horários específicos para domingo
  const [sundayStart, setSundayStart] = useState("08:00");
  const [sundayEnd, setSundayEnd] = useState("12:00");
  
  // Estados para datas excluídas
  const [selectedExcludedDate, setSelectedExcludedDate] = useState<Date>();
  const [excludedDateReason, setExcludedDateReason] = useState("");
  const [excludedShiftMorning, setExcludedShiftMorning] = useState(false);
  const [excludedShiftAfternoon, setExcludedShiftAfternoon] = useState(false);

  // Buscar configurações existentes
  const { data: existingConfigs, isLoading, error } = useQuery({
    queryKey: ["period-day-configs", periodId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("period_day_configs")
        .select("*")
        .eq("period_id", periodId);
      if (error) throw error;
      return data;
    },
    enabled: open && !!periodId && periodId.length > 0,
  });

  // Buscar datas excluídas
  const { data: excludedDates = [] } = useQuery({
    queryKey: ["period-excluded-dates", periodId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("period_excluded_dates")
        .select("*")
        .eq("period_id", periodId)
        .order("excluded_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open && !!periodId && periodId.length > 0,
  });

  // Preencher dados existentes quando o diálogo abre
  useEffect(() => {
    if (isLoading) return;
    
    if (existingConfigs && existingConfigs.length > 0) {
      const weekdayConfigs = existingConfigs.filter(c => !["saturday", "sunday"].includes(c.weekday));
      const saturdayConfig = existingConfigs.find(c => c.weekday === "saturday");
      const sundayConfig = existingConfigs.find(c => c.weekday === "sunday");
      
      const configuredDays = weekdayConfigs.map((c) => c.weekday);
      setSelectedDays(configuredDays);

      if (saturdayConfig) {
        setSaturdayEnabled(true);
        setSaturdayStart(saturdayConfig.morning_start?.substring(0, 5) || "08:00");
        setSaturdayEnd(saturdayConfig.morning_end?.substring(0, 5) || "12:00");
      } else {
        setSaturdayEnabled(false);
      }
      
      if (sundayConfig) {
        setSundayEnabled(true);
        setSundayStart(sundayConfig.morning_start?.substring(0, 5) || "08:00");
        setSundayEnd(sundayConfig.morning_end?.substring(0, 5) || "12:00");
      } else {
        setSundayEnabled(false);
      }

      if (weekdayConfigs.length > 0) {
        const firstConfig = weekdayConfigs[0];
        setHasMorning(firstConfig.has_morning || false);
        setHasAfternoon(firstConfig.has_afternoon || false);
        setMorningStart(firstConfig.morning_start?.substring(0, 5) || "08:00");
        setMorningEnd(firstConfig.morning_end?.substring(0, 5) || "12:00");
        setAfternoonStart(firstConfig.afternoon_start?.substring(0, 5) || "13:00");
        setAfternoonEnd(firstConfig.afternoon_end?.substring(0, 5) || "18:00");
      }
    } else if (!isLoading) {
      setSelectedDays(["monday", "tuesday", "wednesday", "thursday", "friday"]);
      setSaturdayEnabled(true);
      setSundayEnabled(false);
      setHasMorning(true);
      setHasAfternoon(true);
      setMorningStart("08:00");
      setMorningEnd("12:00");
      setAfternoonStart("13:00");
      setAfternoonEnd("18:00");
      setSaturdayStart("08:00");
      setSaturdayEnd("12:00");
      setSundayStart("08:00");
      setSundayEnd("12:00");
    }
  }, [existingConfigs, open, isLoading, periodId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Deletar todas as configurações antigas deste período
      const { error: deleteError } = await supabase
        .from("period_day_configs")
        .delete()
        .eq("period_id", periodId);

      if (deleteError) throw deleteError;

      // 2. Inserir novas configurações apenas para os dias selecionados
      const newConfigs = [];
      
      // Adicionar dias da semana (seg-sex)
      selectedDays.forEach((weekday) => {
        newConfigs.push({
          period_id: periodId,
          weekday,
          has_morning: hasMorning,
          morning_start: hasMorning ? `${morningStart}:00` : null,
          morning_end: hasMorning ? `${morningEnd}:00` : null,
          has_afternoon: hasAfternoon,
          afternoon_start: hasAfternoon ? `${afternoonStart}:00` : null,
          afternoon_end: hasAfternoon ? `${afternoonEnd}:00` : null,
          max_brokers_count: 1, // Sempre 1 para plantões internos
        });
      });
      
      // Adicionar sábado se habilitado
      if (saturdayEnabled) {
        newConfigs.push({
          period_id: periodId,
          weekday: "saturday",
          has_morning: true,
          morning_start: `${saturdayStart}:00`,
          morning_end: `${saturdayEnd}:00`,
          has_afternoon: false,
          afternoon_start: null,
          afternoon_end: null,
          max_brokers_count: 1, // Sempre 1 para plantões internos
        });
      }
      
      // Adicionar domingo se habilitado
      if (sundayEnabled) {
        newConfigs.push({
          period_id: periodId,
          weekday: "sunday",
          has_morning: true,
          morning_start: `${sundayStart}:00`,
          morning_end: `${sundayEnd}:00`,
          has_afternoon: false,
          afternoon_start: null,
          afternoon_end: null,
          max_brokers_count: 1, // Sempre 1 para plantões internos
        });
      }

      if (newConfigs.length > 0) {
        const { error: insertError } = await supabase
          .from("period_day_configs")
          .insert(newConfigs);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["location-periods"] });
      queryClient.invalidateQueries({ queryKey: ["period-day-configs"] });
      toast.success("Configurações salvas com sucesso!");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configurações");
    },
  });

  // Mutation para adicionar data excluída
  const addExcludedDateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedExcludedDate) return;
      
      // Calcular excluded_shifts: null = dia todo, array com os turnos selecionados
      let excluded_shifts: string[] | null = null;
      if (excludedShiftMorning || excludedShiftAfternoon) {
        excluded_shifts = [];
        if (excludedShiftMorning) excluded_shifts.push("morning");
        if (excludedShiftAfternoon) excluded_shifts.push("afternoon");
      }

      const { error } = await supabase
        .from("period_excluded_dates")
        .insert({
          period_id: periodId,
          excluded_date: format(selectedExcludedDate, "yyyy-MM-dd"),
          reason: excludedDateReason || null,
          excluded_shifts,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["period-excluded-dates"] });
      toast.success("Data excluída adicionada!");
      setSelectedExcludedDate(undefined);
      setExcludedDateReason("");
      setExcludedShiftMorning(false);
      setExcludedShiftAfternoon(false);
    },
    onError: (error: any) => {
      console.error("Erro ao adicionar data excluída:", error);
      if (error?.code === "23505") {
        toast.error("Esta data já está excluída");
      } else {
        toast.error("Erro ao adicionar data excluída");
      }
    },
  });

  // Mutation para remover data excluída
  const removeExcludedDateMutation = useMutation({
    mutationFn: async (excludedDateId: string) => {
      const { error } = await supabase
        .from("period_excluded_dates")
        .delete()
        .eq("id", excludedDateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["period-excluded-dates"] });
      toast.success("Data excluída removida!");
    },
    onError: (error) => {
      console.error("Erro ao remover data excluída:", error);
      toast.error("Erro ao remover data excluída");
    },
  });

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const selectWeekdays = () => {
    setSelectedDays(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  };

  const selectAllDays = () => {
    setSelectedDays(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  };

  const unselectAllDays = () => {
    setSelectedDays([]);
  };

  const handleSave = () => {
    if (selectedDays.length === 0 && !saturdayEnabled && !sundayEnabled) {
      toast.error("Selecione pelo menos um dia da semana");
      return;
    }

    if (selectedDays.length > 0 && !hasMorning && !hasAfternoon) {
      toast.error("Selecione pelo menos um turno (manhã ou tarde) para os dias da semana");
      return;
    }

    saveMutation.mutate();
  };

  const handleAddExcludedDate = () => {
    if (!selectedExcludedDate) {
      toast.error("Selecione uma data para excluir");
      return;
    }
    addExcludedDateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Configurar Período: {periodName}
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              Selecione os dias da semana que terão plantões e configure os horários
            </span>
            <span className="block text-yellow-600 dark:text-yellow-500 text-sm font-medium">
              ⚠️ Para excluir feriados ou datas específicas, use a seção "Datas Excluídas" abaixo
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Seleção de Dias */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-base font-semibold">Dias da Semana</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectWeekdays}
                >
                  Seg-Sex
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllDays}
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={unselectAllDays}
                >
                  Limpar
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {["monday", "tuesday", "wednesday", "thursday", "friday"].map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <div 
                    key={day} 
                    className={`flex items-center space-x-2 p-2.5 rounded-md transition-all ${
                      isSelected 
                        ? "bg-primary/10 border-2 border-primary shadow-sm" 
                        : "bg-muted/50 border-2 border-transparent hover:bg-muted"
                    }`}
                  >
                    <Checkbox
                      id={day}
                      checked={isSelected}
                      onCheckedChange={() => toggleDay(day)}
                    />
                    <Label
                      htmlFor={day}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {weekdaysMap[day]}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Turnos */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Turnos Disponíveis</Label>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-morning"
                  checked={hasMorning}
                  onCheckedChange={(checked) => setHasMorning(checked as boolean)}
                />
                <Label htmlFor="has-morning" className="cursor-pointer">
                  Manhã
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-afternoon"
                  checked={hasAfternoon}
                  onCheckedChange={(checked) => setHasAfternoon(checked as boolean)}
                />
                <Label htmlFor="has-afternoon" className="cursor-pointer">
                  Tarde
                </Label>
              </div>
            </div>
          </div>

          {/* Horários Manhã */}
          {hasMorning && (
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horários - Manhã
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="morning-start" className="text-sm">
                    Início
                  </Label>
                  <Input
                    id="morning-start"
                    type="time"
                    value={morningStart}
                    onChange={(e) => setMorningStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="morning-end" className="text-sm">
                    Fim
                  </Label>
                  <Input
                    id="morning-end"
                    type="time"
                    value={morningEnd}
                    onChange={(e) => setMorningEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Horários Tarde */}
          {hasAfternoon && (
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horários - Tarde
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="afternoon-start" className="text-sm">
                    Início
                  </Label>
                  <Input
                    id="afternoon-start"
                    type="time"
                    value={afternoonStart}
                    onChange={(e) => setAfternoonStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="afternoon-end" className="text-sm">
                    Fim
                  </Label>
                  <Input
                    id="afternoon-end"
                    type="time"
                    value={afternoonEnd}
                    onChange={(e) => setAfternoonEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sábado */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="saturday-enabled"
                checked={saturdayEnabled}
                onCheckedChange={(checked) => setSaturdayEnabled(checked as boolean)}
              />
              <Label htmlFor="saturday-enabled" className="text-base font-semibold cursor-pointer">
                Sábado
              </Label>
            </div>
            
            {saturdayEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="saturday-start" className="text-sm">
                    Início
                  </Label>
                  <Input
                    id="saturday-start"
                    type="time"
                    value={saturdayStart}
                    onChange={(e) => setSaturdayStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saturday-end" className="text-sm">
                    Fim
                  </Label>
                  <Input
                    id="saturday-end"
                    type="time"
                    value={saturdayEnd}
                    onChange={(e) => setSaturdayEnd(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Domingo */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="sunday-enabled"
                checked={sundayEnabled}
                onCheckedChange={(checked) => setSundayEnabled(checked as boolean)}
              />
              <Label htmlFor="sunday-enabled" className="text-base font-semibold cursor-pointer">
                Domingo
              </Label>
            </div>
            
            {sundayEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="sunday-start" className="text-sm">
                    Início
                  </Label>
                  <Input
                    id="sunday-start"
                    type="time"
                    value={sundayStart}
                    onChange={(e) => setSundayStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sunday-end" className="text-sm">
                    Fim
                  </Label>
                  <Input
                    id="sunday-end"
                    type="time"
                    value={sundayEnd}
                    onChange={(e) => setSundayEnd(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Datas Excluídas */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <X className="h-5 w-5 text-destructive" />
              <Label className="text-base font-semibold">Datas Excluídas deste Local (Feriados/Fechamentos)</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              As datas excluídas abaixo valem apenas para este local e período ({periodName}). O gerador de escalas não criará plantões nestas datas.
            </p>
            
            <div className="flex flex-col gap-3 p-4 bg-muted/30 rounded-md">
              <div className="flex flex-col sm:flex-row gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal flex-1",
                        !selectedExcludedDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {selectedExcludedDate ? format(selectedExcludedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedExcludedDate}
                      onSelect={setSelectedExcludedDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                
                <Input
                  placeholder="Motivo (opcional)"
                  value={excludedDateReason}
                  onChange={(e) => setExcludedDateReason(e.target.value)}
                  className="flex-1"
                />
              </div>

              {/* Seleção de turno excluído */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  Turnos excluídos (deixe ambos desmarcados = dia inteiro):
                </Label>
                <div className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="excl-morning"
                      checked={excludedShiftMorning}
                      onCheckedChange={(checked) => setExcludedShiftMorning(checked as boolean)}
                    />
                    <Label htmlFor="excl-morning" className="cursor-pointer text-sm">Manhã</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="excl-afternoon"
                      checked={excludedShiftAfternoon}
                      onCheckedChange={(checked) => setExcludedShiftAfternoon(checked as boolean)}
                    />
                    <Label htmlFor="excl-afternoon" className="cursor-pointer text-sm">Tarde</Label>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleAddExcludedDate}
                disabled={!selectedExcludedDate || addExcludedDateMutation.isPending}
                size="default"
                className="self-start"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>

              {excludedDates && excludedDates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Datas que NÃO terão plantão:</Label>
                  <div className="space-y-1">
                    {excludedDates.map((ed: any) => {
                      const shifts: string[] | null = (ed as any).excluded_shifts ?? null;
                      const shiftsLabel = !shifts || shifts.length === 0
                        ? "Dia inteiro"
                        : shifts.includes("morning") && shifts.includes("afternoon")
                          ? "Ambos os turnos"
                          : shifts.includes("morning")
                            ? "Manhã"
                            : "Tarde";
                      return (
                        <div
                          key={ed.id}
                          className="flex items-center justify-between p-2 bg-background rounded border"
                        >
                          <span className="text-sm">
                            <span className="font-medium">
                              {format(parse(ed.excluded_date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                            <span className="text-muted-foreground ml-1">— {shiftsLabel}</span>
                            {ed.reason && <span className="text-muted-foreground"> ({ed.reason})</span>}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExcludedDateMutation.mutate(ed.id)}
                            disabled={removeExcludedDateMutation.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full sm:w-auto">
            {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
