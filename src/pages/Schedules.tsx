import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Loader2, Edit, Trash2, FileText, ArrowUpDown, AlertCircle, MapPin, Plus, ArrowLeftRight, ClipboardCheck, RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateWeeklySchedule, generateMonthlySchedule, generateSelectedWeeksSchedule, ScheduleAssignment, validateGeneratedSchedule, ValidationResult, GenerateMonthlyResult } from "@/lib/scheduleGenerator";
import { getLastGenerationTrace } from "@/lib/generationTrace";
import { RuleViolation } from "@/lib/scheduleValidator";
import { validateGeneratedSchedule as postValidateSchedule, logValidationResult, PostValidationResult, UnallocatedDemand, detectUnallocatedDemands } from "@/lib/schedulePostValidation";
import { normalizeText } from "@/lib/textUtils";
import { ScheduleReplacementDialog } from "@/components/ScheduleReplacementDialog";
import { SchedulePDFGenerator } from "@/components/SchedulePDFGenerator";
import { ScheduleCalendarView } from "@/components/ScheduleCalendarView";
import { EditAssignmentDialog } from "@/components/EditAssignmentDialog";
import { AddAssignmentDialog } from "@/components/AddAssignmentDialog";
import { ScheduleSwapDialog } from "@/components/ScheduleSwapDialog";
import { useDebounceSearch } from "@/hooks/useDebounceSearch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ValidationReportPanel } from "@/components/ValidationReportPanel";
import { WeekSelectionDialog } from "@/components/WeekSelectionDialog";

const Schedules = () => {
  // ✅ USAR PERMISSÃO DE SISTEMA em vez de role
  const { canEdit } = useSystemAccess();
  const canEditEscalas = canEdit("escalas");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [editingAssignment, setEditingAssignment] = useState<ScheduleAssignment | null>(null);
  const [replacementDialogOpen, setReplacementDialogOpen] = useState(false);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [schedulesToDelete, setSchedulesToDelete] = useState<any[]>([]);
  const [replaceExistingSchedules, setReplaceExistingSchedules] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [postValidationResult, setPostValidationResult] = useState<PostValidationResult | null>(null);
  const [mainTab, setMainTab] = useState("escalas");
  
  // Estados para edição/adição de alocações
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAssignmentForLocation, setEditingAssignmentForLocation] = useState<ScheduleAssignment | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  
  // Estados para troca de plantões entre corretores
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [swappingAssignment, setSwappingAssignment] = useState<ScheduleAssignment | null>(null);
  
  // Estados para confirmação de remoção de alocação
  const [deleteAssignmentId, setDeleteAssignmentId] = useState<string | null>(null);
  const [deleteAssignmentInfo, setDeleteAssignmentInfo] = useState<{broker: string, location: string, date: string} | null>(null);
  
  // Estados para geração mensal
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Estados para exclusão de mês específico
  const [deleteMonthDialogOpen, setDeleteMonthDialogOpen] = useState(false);
  const [schedulesOfMonthToDelete, setSchedulesOfMonthToDelete] = useState<any[]>([]);
  
  // Estados para seleção de semanas (novo sistema de trava)
  const [weekSelectionDialogOpen, setWeekSelectionDialogOpen] = useState(false);
  
  // Estados para paginação e filtros
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, debouncedSearch, setSearchTerm] = useDebounceSearch("");
  const [sortBy, setSortBy] = useState<"date" | "broker" | "location">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const itemsPerPage = 20;
  
  const queryClient = useQueryClient();

  const { data: schedules } = useQuery({
    queryKey: ["generated_schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_schedules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
  });

  const { data: scheduleAssignments } = useQuery({
    queryKey: ["schedule_assignments", selectedScheduleId],
    queryFn: async () => {
      if (!selectedScheduleId) return [];
      const { data, error } = await supabase
        .from("schedule_assignments")
        .select(`
          *,
          broker:brokers(id, name, creci),
          location:locations(id, name, location_type, city)
        `)
        .eq("generated_schedule_id", selectedScheduleId)
        .order("assignment_date", { ascending: true });
      if (error) throw error;
      return data as ScheduleAssignment[];
    },
    enabled: !!selectedScheduleId,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ QUERY: Buscar validação salva (vinculada à primeira escala do mês)
  const { data: savedValidation, isLoading: isLoadingValidation } = useQuery({
    queryKey: ["schedule_validation", selectedScheduleId, schedules],
    queryFn: async () => {
      if (!selectedScheduleId || !schedules) return null;
      
      // Identificar o mês da escala selecionada
      const selectedSchedule = schedules.find(s => s.id === selectedScheduleId);
      if (!selectedSchedule) return null;
      
      const yearMonth = selectedSchedule.week_start_date.substring(0, 7);
      
      // Buscar a primeira escala do mês (âncora)
      const monthSchedules = schedules.filter(s => 
        s.week_start_date.startsWith(yearMonth)
      ).sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
      
      if (monthSchedules.length === 0) return null;
      
      const anchorScheduleId = monthSchedules[0].id;
      
      const { data, error } = await supabase
        .from("schedule_validation_results")
        .select("*")
        .eq("schedule_id", anchorScheduleId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedScheduleId && !!schedules,
  });

  // ✅ CARREGAR validação salva quando mudar de escala
  // Filtra violações antigas de "externos consecutivos" que não devem mais aparecer
  useEffect(() => {
    if (savedValidation) {
      // Filtrar violações antigas de "externos consecutivos" removidas do validador
      const allViolations = savedValidation.violations as any[] || [];
      const filteredViolations = allViolations.filter(
        v => v.rule !== "SEM_EXTERNOS_CONSECUTIVOS" && 
             !v.rule?.toLowerCase().includes("consecutiv")
      );
      
      // Recalcular contagens após filtro
      const errorCount = filteredViolations.filter(v => v.severity === 'error').length;
      const warningCount = filteredViolations.filter(v => v.severity === 'warning').length;
      
      setPostValidationResult({
        isValid: errorCount === 0,
        violations: filteredViolations,
        summary: {
          ...(savedValidation.summary as any),
          errorCount,
          warningCount,
        },
        brokerReports: savedValidation.broker_reports as any[] || [],
        unallocatedDemands: savedValidation.unallocated_demands as any[] || []
      });
    } else if (!isLoadingValidation && selectedScheduleId) {
      // Se não houver validação salva e não está carregando, limpar
      setPostValidationResult(null);
    }
  }, [savedValidation, isLoadingValidation, selectedScheduleId]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_assignments"] });
      toast.success("Alocação removida!");
    },
    onError: (error: any) => {
      console.error("Erro ao remover alocação:", error);
      toast.error("Não foi possível remover a alocação. Tente novamente.");
    },
  });

  // ✅ NOVA MUTATION: Fazer a TROCA de corretores (interno -> externo)
  const swapBrokersMutation = useMutation({
    mutationFn: async ({ 
      externalAssignmentId, 
      internalAssignmentId, 
      newBrokerId 
    }: { 
      externalAssignmentId: string; 
      internalAssignmentId: string; 
      newBrokerId: string;
    }) => {
      console.log(`🔄 Executando troca de corretores...`);
      console.log(`  - Plantão externo: ${externalAssignmentId} receberá corretor ${newBrokerId}`);
      console.log(`  - Plantão interno: ${internalAssignmentId} será DELETADO`);

      // 1. Atualizar o plantão EXTERNO com o novo corretor
      const { error: updateError } = await supabase
        .from("schedule_assignments")
        .update({ broker_id: newBrokerId })
        .eq("id", externalAssignmentId);
      
      if (updateError) throw updateError;

      // 2. DELETAR o plantão interno do novo corretor (ele agora está no externo)
      const { error: deleteError } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("id", internalAssignmentId);
      
      if (deleteError) throw deleteError;

      console.log(`✅ Troca concluída com sucesso!`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_assignments"] });
      toast.success("Corretor substituído! O plantão interno foi liberado.");
      setReplacementDialogOpen(false);
      setEditingAssignment(null);
    },
    onError: (error: any) => {
      console.error("Erro ao substituir corretor:", error);
      toast.error("Não foi possível substituir o corretor. Tente novamente.");
    },
  });

  // ✅ NOVA MUTATION: Substituir corretor diretamente (sem swap)
  const updateBrokerMutation = useMutation({
    mutationFn: async ({ 
      assignmentId, 
      newBrokerId 
    }: { 
      assignmentId: string; 
      newBrokerId: string;
    }) => {
      console.log(`🔄 Substituindo corretor diretamente...`);
      console.log(`  - Alocação: ${assignmentId} receberá corretor ${newBrokerId}`);

      const { error } = await supabase
        .from("schedule_assignments")
        .update({ broker_id: newBrokerId })
        .eq("id", assignmentId);
      
      if (error) throw error;

      console.log(`✅ Corretor substituído com sucesso!`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_assignments"] });
      toast.success("Corretor substituído com sucesso!");
      setReplacementDialogOpen(false);
      setEditingAssignment(null);
    },
    onError: (error: any) => {
      console.error("Erro ao substituir corretor:", error);
      toast.error("Não foi possível substituir o corretor. Tente novamente.");
    },
  });

  // ✅ Limpar escalas antigas (manter apenas as 2 últimas semanas PASSADAS)
  const cleanOldSchedulesMutation = useMutation({
    mutationFn: async () => {
      console.log("🗑️ Iniciando limpeza de escalas antigas...");
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 1. Buscar todas as escalas
      const { data: allSchedules, error: fetchError } = await supabase
        .from("generated_schedules")
        .select("*")
        .order("week_start_date", { ascending: false });
      
      if (fetchError) throw fetchError;
      if (!allSchedules || allSchedules.length === 0) return { kept: 0, deleted: 0 };
      
      // 2. ✅ Filtrar apenas escalas passadas ou da semana atual (não futuras)
      const pastSchedules = allSchedules.filter(s => {
        const scheduleDate = new Date(s.week_start_date + "T00:00:00");
        return scheduleDate <= today;
      });
      
      // 3. ✅ Manter as 2 últimas semanas passadas
      const schedulesToKeep = pastSchedules.slice(0, 2);
      const schedulesToDelete = allSchedules.filter(s => 
        !schedulesToKeep.find(k => k.id === s.id)
      );
      
      if (schedulesToDelete.length === 0) {
        return { kept: schedulesToKeep.length, deleted: 0 };
      }
      
      console.log(`🗑️ Mantendo ${schedulesToKeep.length} escalas, deletando ${schedulesToDelete.length}`);
      
      // 4. ✅ AGREGAR HISTÓRICO ANTES DE DELETAR
      const monthsToAggregate = new Set<string>();
      schedulesToDelete.forEach(s => {
        const yearMonth = s.week_start_date.substring(0, 7); // "2025-01"
        monthsToAggregate.add(yearMonth);
      });
      
      console.log(`📊 Agregando histórico de ${monthsToAggregate.size} mês(es) antes da limpeza...`);
      for (const yearMonth of Array.from(monthsToAggregate)) {
        try {
          const { data, error } = await supabase.rpc('aggregate_month_data', { 
            p_year_month: yearMonth 
          });
          if (error) throw error;
          console.log(`✅ Histórico agregado para ${yearMonth}:`, data);
        } catch (error) {
          console.error(`❌ Erro ao agregar histórico de ${yearMonth}:`, error);
        }
      }
      
      // 5. Deletar alocações das escalas antigas
      const idsToDelete = schedulesToDelete.map(s => s.id);
      
      const { error: delAssignErr } = await supabase
        .from("schedule_assignments")
        .delete()
        .in("generated_schedule_id", idsToDelete);
      
      if (delAssignErr) throw delAssignErr;
      
      // 6. Deletar as escalas antigas
      const { error: delSchedErr } = await supabase
        .from("generated_schedules")
        .delete()
        .in("id", idsToDelete);
      
      if (delSchedErr) throw delSchedErr;
      
      console.log(`✅ ${schedulesToDelete.length} escala(s) antiga(s) removida(s)`);
      
      return {
        kept: schedulesToKeep.length,
        deleted: schedulesToDelete.length,
        deletedNames: schedulesToDelete.map(s => s.name)
      };
    },
    onSuccess: (result) => {
      if (result.deleted === 0) {
        toast.info("Nenhuma escala antiga para limpar.");
      } else {
        toast.success(`✅ ${result.deleted} escala(s) antiga(s) removida(s). ${result.kept} mantida(s).`);
      }
      setSelectedScheduleId(null);
      queryClient.invalidateQueries({ queryKey: ["generated_schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedule_assignments"] });
    },
    onError: (error: any) => {
      console.error("❌ Erro ao limpar escalas antigas:", error);
      toast.error("Não foi possível limpar as escalas antigas.");
    }
  });

  // ✅ NOVA MUTATION: Excluir todas as escalas de um mês específico
  const deleteMonthSchedulesMutation = useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) => {
      const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;
      console.log(`🗑️ Iniciando exclusão de escalas de ${yearMonth}...`);
      
      // 1. Buscar todas as escalas
      const { data: allSchedules, error: fetchError } = await supabase
        .from("generated_schedules")
        .select("id, name, week_start_date, week_end_date");
      
      if (fetchError) throw fetchError;
      
      // Filtrar apenas as que realmente intersectam o mês
      const filteredSchedules = (allSchedules || []).filter(s => {
        const startMonth = s.week_start_date.substring(0, 7);
        const endMonth = s.week_end_date.substring(0, 7);
        return startMonth === yearMonth || endMonth === yearMonth;
      });
      
      if (filteredSchedules.length === 0) {
        throw new Error("Nenhuma escala encontrada para este mês");
      }
      
      console.log(`🗑️ Deletando ${filteredSchedules.length} escala(s) de ${yearMonth}...`);
      
      // 2. Deletar todas as alocações dessas escalas
      const scheduleIds = filteredSchedules.map(s => s.id);
      
      const { error: delAssignErr } = await supabase
        .from("schedule_assignments")
        .delete()
        .in("generated_schedule_id", scheduleIds);
      
      if (delAssignErr) throw delAssignErr;
      
      // 3. Deletar validações associadas
      const { error: delValidErr } = await supabase
        .from("schedule_validation_results")
        .delete()
        .in("schedule_id", scheduleIds);
      
      if (delValidErr) console.warn("Erro ao deletar validações:", delValidErr);
      
      // 4. Deletar as escalas
      const { error: delSchedErr } = await supabase
        .from("generated_schedules")
        .delete()
        .in("id", scheduleIds);
      
      if (delSchedErr) throw delSchedErr;
      
      console.log(`✅ ${filteredSchedules.length} escala(s) de ${yearMonth} removida(s)`);
      
      return {
        deleted: filteredSchedules.length,
        names: filteredSchedules.map(s => s.name)
      };
    },
    onSuccess: (result) => {
      toast.success(`✅ ${result.deleted} escala(s) removida(s) com sucesso!`);
      setSelectedScheduleId(null);
      setDeleteMonthDialogOpen(false);
      setSchedulesOfMonthToDelete([]);
      queryClient.invalidateQueries({ queryKey: ["generated_schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedule_assignments"] });
      queryClient.invalidateQueries({ queryKey: ["schedule_validation"] });
    },
    onError: (error: any) => {
      console.error("❌ Erro ao excluir escalas do mês:", error);
      toast.error(error.message || "Não foi possível excluir as escalas.");
    }
  });

  // Função para buscar escalas do mês antes de exibir o dialog
  const handleDeleteMonthClick = async () => {
    const yearMonth = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
    
    const { data: monthSchedules } = await supabase
      .from("generated_schedules")
      .select("id, name, week_start_date, week_end_date")
      .order("week_start_date", { ascending: true });
    
    const filteredSchedules = (monthSchedules || []).filter(s => {
      const startMonth = s.week_start_date.substring(0, 7);
      const endMonth = s.week_end_date.substring(0, 7);
      return startMonth === yearMonth || endMonth === yearMonth;
    });
    
    if (filteredSchedules.length === 0) {
      toast.warning(`Nenhuma escala encontrada para ${selectedMonth.toString().padStart(2, '0')}/${selectedYear}`);
      return;
    }
    
    setSchedulesOfMonthToDelete(filteredSchedules);
    setDeleteMonthDialogOpen(true);
  };

  // ✅ Mutation: Editar local de uma alocação (com possível troca)
  const editLocationMutation = useMutation({
    mutationFn: async ({ 
      assignmentId, 
      newLocationId, 
      conflictAssignmentId 
    }: { 
      assignmentId: string; 
      newLocationId: string; 
      conflictAssignmentId?: string;
    }) => {
      console.log(`🔄 Editando local da alocação ${assignmentId} para ${newLocationId}`);
      
      if (conflictAssignmentId) {
        // Trocar os locais entre as duas alocações
        const currentAssignment = scheduleAssignments?.find(a => a.id === assignmentId);
        const conflictAssignment = scheduleAssignments?.find(a => a.id === conflictAssignmentId);
        
        if (!currentAssignment || !conflictAssignment) throw new Error("Alocações não encontradas");
        
        // Atualizar a primeira alocação para o novo local
        const { error: err1 } = await supabase
          .from("schedule_assignments")
          .update({ location_id: newLocationId })
          .eq("id", assignmentId);
        if (err1) throw err1;
        
        // Atualizar a segunda alocação para o local antigo da primeira
        const { error: err2 } = await supabase
          .from("schedule_assignments")
          .update({ location_id: currentAssignment.location_id })
          .eq("id", conflictAssignmentId);
        if (err2) throw err2;
        
        console.log(`✅ Troca de locais concluída`);
      } else {
        // Apenas atualizar o local
        const { error } = await supabase
          .from("schedule_assignments")
          .update({ location_id: newLocationId })
          .eq("id", assignmentId);
        if (error) throw error;
        console.log(`✅ Local atualizado`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_assignments"] });
      toast.success("Local alterado com sucesso!");
      setEditDialogOpen(false);
      setEditingAssignmentForLocation(null);
    },
    onError: (error: any) => {
      console.error("Erro ao editar local:", error);
      toast.error("Não foi possível alterar o local. Tente novamente.");
    },
  });

  // ✅ Mutation: Adicionar nova alocação (SUBSTITUI alocação existente do corretor no mesmo turno/dia)
  const addAssignmentMutation = useMutation({
    mutationFn: async ({ 
      brokerId, 
      locationId, 
      date, 
      shift, 
      startTime, 
      endTime 
    }: { 
      brokerId: string; 
      locationId: string; 
      date: string; 
      shift: string; 
      startTime: string; 
      endTime: string;
    }) => {
      console.log(`➕ Adicionando/Substituindo alocação: ${brokerId} em ${locationId} (${date} ${shift})`);
      
      // 1. PRIMEIRO: Deletar qualquer alocação existente deste corretor neste turno/dia/escala
      const { error: deleteError } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("generated_schedule_id", selectedScheduleId)
        .eq("broker_id", brokerId)
        .eq("assignment_date", date)
        .eq("shift_type", shift);
      
      if (deleteError) {
        console.warn("⚠️ Erro ao deletar alocação anterior:", deleteError);
        // Não lançar erro, continuar com insert
      } else {
        console.log(`🗑️ Alocação anterior removida (se existia)`);
      }
      
      // 2. DEPOIS: Inserir a nova alocação
      const { error } = await supabase
        .from("schedule_assignments")
        .insert([{
          generated_schedule_id: selectedScheduleId,
          broker_id: brokerId,
          location_id: locationId,
          assignment_date: date,
          shift_type: shift,
          start_time: startTime,
          end_time: endTime,
        }]);
      
      if (error) throw error;
      console.log(`✅ Alocação adicionada/substituída`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_assignments"] });
      toast.success("Alocação adicionada com sucesso!");
      setAddDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Erro ao adicionar alocação:", error);
      toast.error("Não foi possível adicionar a alocação. Tente novamente.");
    },
  });

  // ✅ NOVA MUTATION: Trocar plantões entre dois corretores
  const swapShiftsMutation = useMutation({
    mutationFn: async ({ 
      assignmentA, 
      assignmentB 
    }: { 
      assignmentA: { id: string; broker_id: string; location_id: string };
      assignmentB: { id: string; broker_id: string; location_id: string };
    }) => {
      console.log(`🔄 Executando TROCA de plantões...`);
      console.log(`  - ${assignmentA.id} receberá local ${assignmentB.location_id}`);
      console.log(`  - ${assignmentB.id} receberá local ${assignmentA.location_id}`);

      // Atualizar assignment A com o local do B
      const { error: errorA } = await supabase
        .from("schedule_assignments")
        .update({ location_id: assignmentB.location_id })
        .eq("id", assignmentA.id);
      
      if (errorA) throw errorA;

      // Atualizar assignment B com o local do A
      const { error: errorB } = await supabase
        .from("schedule_assignments")
        .update({ location_id: assignmentA.location_id })
        .eq("id", assignmentB.id);
      
      if (errorB) throw errorB;

      console.log(`✅ Troca de plantões concluída!`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_assignments"] });
      toast.success("Plantões trocados com sucesso!");
      setSwapDialogOpen(false);
      setSwappingAssignment(null);
    },
    onError: (error: any) => {
      console.error("Erro ao trocar plantões:", error);
      toast.error("Não foi possível trocar os plantões. Tente novamente.");
    },
  });

  const calculateSchedulesToDelete = () => {
    if (!schedules) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pastSchedules = schedules.filter(s => {
      const scheduleDate = new Date(s.week_start_date + "T00:00:00");
      return scheduleDate <= today;
    });
    
    if (pastSchedules.length <= 2) return [];
    
    const sorted = [...pastSchedules].sort((a, b) => 
      new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime()
    );
    
    return sorted.slice(2);
  };

  // Abrir dialog de confirmação
  const handleCleanupClick = () => {
    const toDelete = calculateSchedulesToDelete();
    if (toDelete.length === 0) {
      toast.info("Apenas 2 escalas encontradas. Nada a limpar.");
      return;
    }
    setSchedulesToDelete(toDelete);
    setCleanupDialogOpen(true);
  };

  // ✅ FUNÇÃO: Salvar validação no banco de dados
  const saveValidationToDatabase = async (scheduleId: string, validation: PostValidationResult) => {
    try {
      // Deletar validação anterior se existir
      await supabase
        .from("schedule_validation_results")
        .delete()
        .eq("schedule_id", scheduleId);

      // Inserir nova validação
      const { error } = await supabase
        .from("schedule_validation_results")
        .insert([{
          schedule_id: scheduleId,
          is_valid: validation.isValid,
          violations: validation.violations as any,
          unallocated_demands: validation.unallocatedDemands as any,
          summary: validation.summary as any,
          broker_reports: validation.brokerReports as any
        }]);

      if (error) throw error;
      console.log("✅ Validação salva no banco de dados");
      
      // Invalidar cache da validação
      queryClient.invalidateQueries({ queryKey: ["schedule_validation", scheduleId] });
    } catch (error) {
      console.error("❌ Erro ao salvar validação:", error);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // HELPER: Buscar configuração de turnos por local/data para validação
  // Retorna Map<locationId, Map<dateStr, { hasMorning, hasAfternoon }>>
  // ═══════════════════════════════════════════════════════════
  const buildLocationShiftConfigs = async (
    locationIds: string[],
    assignmentDates: string[]
  ): Promise<Map<string, Map<string, { hasMorning: boolean; hasAfternoon: boolean }>>> => {
    const result = new Map<string, Map<string, { hasMorning: boolean; hasAfternoon: boolean }>>();
    
    if (locationIds.length === 0 || assignmentDates.length === 0) return result;

    const uniqueDates = [...new Set(assignmentDates)];
    const minDate = uniqueDates.sort()[0];
    const maxDate = uniqueDates.sort()[uniqueDates.length - 1];

    // Buscar period_day_configs (configuração por dia da semana)
    const { data: periods } = await supabase
      .from("location_periods")
      .select("id, location_id, start_date, end_date")
      .in("location_id", locationIds)
      .lte("start_date", maxDate)
      .gte("end_date", minDate);

    if (!periods || periods.length === 0) return result;

    const periodIds = periods.map(p => p.id);

    // Buscar configurações em paralelo
    const [weekdayConfigsRes, specificConfigsRes] = await Promise.all([
      supabase.from("period_day_configs").select("*").in("period_id", periodIds),
      supabase.from("period_specific_day_configs").select("*").in("period_id", periodIds)
    ]);

    const weekdayConfigs = weekdayConfigsRes.data || [];
    const specificConfigs = specificConfigsRes.data || [];

    const dayMap: Record<number, string> = {
      0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
      4: "thursday", 5: "friday", 6: "saturday"
    };

    for (const dateStr of uniqueDates) {
      const date = new Date(dateStr + "T00:00:00");
      const dayName = dayMap[date.getDay()];

      for (const period of periods) {
        if (dateStr < period.start_date || dateStr > period.end_date) continue;

        if (!result.has(period.location_id)) {
          result.set(period.location_id, new Map());
        }

        // Verificar config de data específica primeiro
        const specificConfig = specificConfigs.find(
          sc => sc.period_id === period.id && sc.specific_date === dateStr
        );

        if (specificConfig) {
          result.get(period.location_id)!.set(dateStr, {
            hasMorning: specificConfig.has_morning ?? true,
            hasAfternoon: specificConfig.has_afternoon ?? true
          });
        } else {
          // Fallback: config por dia da semana
          const weekdayConfig = weekdayConfigs.find(
            wc => wc.period_id === period.id && wc.weekday === dayName
          );

          if (weekdayConfig) {
            result.get(period.location_id)!.set(dateStr, {
              hasMorning: weekdayConfig.has_morning ?? true,
              hasAfternoon: weekdayConfig.has_afternoon ?? true
            });
          }
        }
      }
    }

    return result;
  };

  // ✅ FUNÇÃO: Re-validar escala existente
  const [isRevalidating, setIsRevalidating] = useState(false);
  
  const handleRevalidateSchedule = async () => {
    if (!selectedScheduleId || !schedules || schedules.length === 0) {
      toast.error("Selecione uma escala para re-validar");
      return;
    }

    setIsRevalidating(true);
    try {
      // 1. Identificar o mês da escala selecionada
      const selectedSchedule = schedules.find(s => s.id === selectedScheduleId);
      if (!selectedSchedule) {
        toast.error("Escala não encontrada");
        return;
      }
      
      const yearMonth = selectedSchedule.week_start_date.substring(0, 7); // "2024-12"
      console.log(`🔍 Re-validando TODAS as escalas do mês: ${yearMonth}`);
      
      // 2. Buscar TODAS as escalas desse mês
      const monthSchedules = schedules.filter(s => 
        s.week_start_date.startsWith(yearMonth)
      );
      console.log(`   📅 Encontradas ${monthSchedules.length} semanas no mês`);
      
      if (monthSchedules.length === 0) {
        toast.error("Nenhuma escala encontrada para este mês");
        return;
      }
      
      // 3. Buscar TODAS as alocações de TODAS essas escalas
      const scheduleIds = monthSchedules.map(s => s.id);
      const { data: allMonthAssignments, error: assignmentsError } = await supabase
        .from("schedule_assignments")
        .select(`
          *,
          broker:brokers(id, name),
          location:locations(id, name, location_type)
        `)
        .in("generated_schedule_id", scheduleIds);
      
      if (assignmentsError) throw assignmentsError;
      
      if (!allMonthAssignments || allMonthAssignments.length === 0) {
        toast.error("Nenhuma alocação encontrada para este mês");
        return;
      }
      
      console.log(`   📊 Total de alocações no mês: ${allMonthAssignments.length}`);

      // 4. Buscar dados de brokers e locations para a validação
      const { data: brokersData } = await supabase
        .from("brokers")
        .select("id, name, available_weekdays")
        .eq("is_active", true);
      
      const { data: locationsData } = await supabase
        .from("locations")
        .select("id, name, location_type")
        .eq("is_active", true);
      
      // 5. Buscar configuração de corretores por local
      const { data: locationBrokersData } = await supabase
        .from("location_brokers")
        .select("location_id, broker_id");
      
      // Criar Map de corretores configurados por local
      const locationBrokerConfigs = new Map<string, string[]>();
      for (const lb of locationBrokersData || []) {
        if (!locationBrokerConfigs.has(lb.location_id)) {
          locationBrokerConfigs.set(lb.location_id, []);
        }
        locationBrokerConfigs.get(lb.location_id)!.push(lb.broker_id);
      }
      
      // ✅ Incluir availableWeekdays para validação da REGRA 5 (alternância 1↔2)
      const brokersForValidation = (brokersData || []).map(b => ({ 
        id: b.id, 
        name: b.name,
        availableWeekdays: b.available_weekdays || []
      }));
      const locationsForValidation = (locationsData || []).map(l => ({ 
        id: l.id, 
        name: l.name, 
        type: l.location_type || 'external' 
      }));

      // 5b. Buscar configuração de turnos por local/data para validação TURNO_NAO_CONFIGURADO
      const locationShiftConfigs = await buildLocationShiftConfigs(
        (locationsData || []).map(l => l.id),
        allMonthAssignments.map(a => a.assignment_date)
      );

      // 5c. Detectar demandas não alocadas INDEPENDENTEMENTE
      const allDates = allMonthAssignments.map(a => a.assignment_date);
      const sortedDates = [...new Set(allDates)].sort();
      // Usar o range completo do mês (todas as semanas)
      const monthStart = monthSchedules.reduce((min, s) => s.week_start_date < min ? s.week_start_date : min, monthSchedules[0].week_start_date);
      const monthEnd = monthSchedules.reduce((max, s) => s.week_end_date > max ? s.week_end_date : max, monthSchedules[0].week_end_date);
      
      const detectedUnallocated = await detectUnallocatedDemands(
        allMonthAssignments.map(a => ({
          location_id: a.location_id,
          assignment_date: a.assignment_date,
          shift_type: a.shift_type,
          broker_id: a.broker_id
        })),
        monthStart,
        monthEnd
      );

      // 6. Executar validação com TODAS as alocações do mês
      const postValidation = postValidateSchedule(
        allMonthAssignments.map(a => ({
          broker_id: a.broker_id,
          location_id: a.location_id,
          assignment_date: a.assignment_date,
          shift_type: a.shift_type
        })),
        brokersForValidation,
        locationsForValidation,
        detectedUnallocated,
        locationBrokerConfigs,
        locationShiftConfigs
      );
      
      // Log detalhado
      logValidationResult(postValidation);
      
      // 7. Salvar no banco (vinculado à primeira escala do mês como âncora)
      const anchorScheduleId = monthSchedules.sort((a, b) => 
        a.week_start_date.localeCompare(b.week_start_date)
      )[0].id;
      
      await saveValidationToDatabase(anchorScheduleId, postValidation);
      
      // Atualizar estado
      setPostValidationResult(postValidation);
      
      const monthName = new Date(yearMonth + "-01").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      
      if (postValidation.isValid) {
        toast.success(`✅ Mês de ${monthName} validado - ${monthSchedules.length} semanas, todas as regras respeitadas!`);
      } else {
        toast.warning(`Validação de ${monthName}: ${postValidation.summary.errorCount} erro(s) em ${monthSchedules.length} semanas`);
      }
    } catch (error) {
      console.error("❌ Erro ao re-validar:", error);
      toast.error("Erro ao re-validar escala");
    } finally {
      setIsRevalidating(false);
    }
  };

  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    const affectedMonths = new Set<string>();
    let skippedWeeksCount = 0;
    
    try {
      console.log(`🔄 Iniciando geração mensal com retry: ${selectedMonth}/${selectedYear}`);
      
      // ═══════════════════════════════════════════════════════════
      // PRÉ-BUSCA: Verificar quais semanas já existem ANTES de gerar
      // Isso permite pular a geração de semanas duplicadas
      // ═══════════════════════════════════════════════════════════
      const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
      const monthEnd = new Date(selectedYear, selectedMonth, 0);
      
      // Buscar margem de 7 dias antes e depois para capturar semanas de virada
      const { data: existingSchedules } = await supabase
        .from("generated_schedules")
        .select("id, week_start_date, week_end_date")
        .gte("week_start_date", format(addDays(monthStart, -7), "yyyy-MM-dd"))
        .lte("week_end_date", format(addDays(monthEnd, 7), "yyyy-MM-dd"));
      
      // Set de semanas já existentes (por week_start_date)
      const existingWeeksMap = new Map<string, { id: string; hasAssignments: boolean }>();
      
      // Verificar quais escalas existentes têm alocações
      for (const schedule of existingSchedules || []) {
        const { count } = await supabase
          .from("schedule_assignments")
          .select("*", { count: 'exact', head: true })
          .eq("generated_schedule_id", schedule.id);
        
        existingWeeksMap.set(schedule.week_start_date, {
          id: schedule.id,
          hasAssignments: (count ?? 0) > 0
        });
      }
      
      console.log(`📊 Escalas existentes no período: ${existingWeeksMap.size}`);
      
      // ✅ Gerar todas as escalas do mês com sistema de retry (até 50 tentativas por semana)
      const result = await generateMonthlySchedule(
        selectedMonth, 
        selectedYear,
        (current, total, attempt, maxAttempts) => {
          setGenerationProgress(Math.round((current / total) * 40));
          if (attempt && attempt > 1) console.log(`   Tentativa ${attempt}/${maxAttempts}`);
        },
        50
      );
      
      // Verificar se falhou
      if (!result.success) {
        // NOVO: Converter violações para formato PostValidationResult e exibir na aba de validação
        const failedValidation: PostValidationResult = {
          isValid: false,
          violations: (result.violations || []).map(v => ({
            brokerId: v.brokerId || '',
            brokerName: v.brokerName || 'Desconhecido',
            rule: v.rule || 'REGRA DESCONHECIDA',
            details: `${v.details || ''} ${result.failedWeek ? `(Semana: ${result.failedWeek})` : ''}`,
            severity: (v.severity === 'critical' ? 'error' : 'warning') as 'error' | 'warning',
            dates: v.date ? [v.date] : undefined
          })),
          summary: {
            totalBrokers: 0,
            totalAssignments: 0,
            errorCount: (result.violations || []).filter(v => v.severity === 'critical').length,
            warningCount: (result.violations || []).filter(v => v.severity === 'warning').length,
            unallocatedCount: 0
          },
          brokerReports: [],
          unallocatedDemands: []
        };
        
        setPostValidationResult(failedValidation);
        setMainTab("validacao"); // Auto-mudar para aba de validação
        
        toast.error(`Não foi possível gerar a escala para ${result.failedWeek || 'a semana'}. Verifique a aba de Validação.`, { duration: 8000 });
        return;
      }
      
      const weeklySchedules = result.schedules;
      
      if (weeklySchedules.length === 0) {
        toast.error("Nenhuma semana foi gerada. Verifique os períodos configurados.");
        return;
      }
      
      console.log(`✅ ${weeklySchedules.length} semanas geradas com SUCESSO`);
      
      // Salvar cada escala semanal no banco
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < weeklySchedules.length; i++) {
        const week = weeklySchedules[i];
        // ✅ Progresso de salvamento (50-90%)
        setGenerationProgress(50 + Math.round(((i + 1) / weeklySchedules.length) * 40));
        try {
          const weekStartStr = format(week.weekStart, "yyyy-MM-dd");
          const weekEndStr = format(week.weekEnd, "yyyy-MM-dd");
          
          // ✅ Registrar AMBOS os meses afetados (weekStart E weekEnd)
          const yearMonthStart = format(week.weekStart, "yyyy-MM");
          const yearMonthEnd = format(week.weekEnd, "yyyy-MM");
          affectedMonths.add(yearMonthStart);
          affectedMonths.add(yearMonthEnd);
          
          // ═══════════════════════════════════════════════════════════
          // ✅ CORREÇÃO: Sempre buscar e deletar TODAS as escalas duplicadas
          // para a mesma week_start_date antes de inserir nova
          // ═══════════════════════════════════════════════════════════
          const { data: existingForDate } = await supabase
            .from("generated_schedules")
            .select("id")
            .eq("week_start_date", weekStartStr);
          
          const existingWeekInfo = existingWeeksMap.get(weekStartStr);
          
          if (existingForDate && existingForDate.length > 0) {
            const hasAnyWithAssignments = existingWeekInfo?.hasAssignments;
            
            if (!hasAnyWithAssignments) {
              // ✅ Escalas existem mas estão VAZIAS → deletar todas e regenerar
              console.log(`⚠️ Escala(s) ${weekStartStr} existe(m) mas está(ão) VAZIA(S). Regenerando...`);
              
              const idsToDelete = existingForDate.map(s => s.id);
              await supabase.from("schedule_assignments").delete().in("generated_schedule_id", idsToDelete);
              await supabase.from("generated_schedules").delete().in("id", idsToDelete);
            } else if (replaceExistingSchedules) {
              // ✅ Modo substituição: deletar TODAS as escalas dessa data
              console.log(`🔄 Substituindo ${existingForDate.length} escala(s) existente(s) (${weekStartStr})...`);
              
              const idsToDelete = existingForDate.map(s => s.id);
              await supabase.from("schedule_assignments").delete().in("generated_schedule_id", idsToDelete);
              await supabase.from("generated_schedules").delete().in("id", idsToDelete);
            } else {
              // ✅ Modo padrão: pular escala que já tem dados
              console.log(`⏭️ Semana ${weekStartStr} já existe, pulando...`);
              skippedWeeksCount++;
              continue;
            }
          }
          
          // Criar nome da escala
          const scheduleName = `Escala de ${format(week.weekStart, "dd/MM/yyyy")} a ${format(week.weekEnd, "dd/MM/yyyy")}`;
          
          // Salvar generated_schedule
          const { data: newSchedule, error: scheduleError } = await supabase
            .from("generated_schedules")
            .insert([{
              name: scheduleName,
              week_start_date: weekStartStr,
              week_end_date: weekEndStr,
            }])
            .select()
            .single();

          if (scheduleError) throw scheduleError;

          // Salvar alocações COM DEDUPLICAÇÃO
          if (week.assignments.length > 0) {
            const assignmentsWithScheduleId = week.assignments.map((a) => ({
              ...a,
              generated_schedule_id: newSchedule.id,
            }));

            // ═══════════════════════════════════════════════════════════
            // BUSCAR LOCATION_TYPE do banco para validar deduplicação
            // O assignment do gerador NÃO inclui location_type
            // ═══════════════════════════════════════════════════════════
            const locationIds = [...new Set(assignmentsWithScheduleId.map(a => a.location_id))];
            const { data: locationData } = await supabase
              .from("locations")
              .select("id, location_type")
              .in("id", locationIds);
            
            const locationTypeMap = new Map<string, string>();
            locationData?.forEach(loc => {
              locationTypeMap.set(loc.id, loc.location_type || "external");
            });

            // ═══════════════════════════════════════════════════════════
            // DEDUPLICAR: Um corretor só pode ter UMA alocação por dia/turno
            // Priorizar EXTERNO sobre INTERNO se houver conflito
            // ═══════════════════════════════════════════════════════════
            const assignmentKeys = new Map<string, typeof assignmentsWithScheduleId[0]>();
            for (const a of assignmentsWithScheduleId) {
              const key = `${a.broker_id}|${a.assignment_date}|${a.shift_type}`;
              const existing = assignmentKeys.get(key);
              if (!existing) {
                assignmentKeys.set(key, a);
              } else {
                // Usar mapa de location_type (dados do banco)
                const existingLocationType = locationTypeMap.get(existing.location_id);
                const newLocationType = locationTypeMap.get(a.location_id);
                const isNewExternal = newLocationType === "external";
                const isExistingInternal = existingLocationType === "internal";
                
                if (isNewExternal && isExistingInternal) {
                  console.log(`⚠️ DEDUP: Substituindo interno por externo para ${a.broker_id} em ${a.assignment_date}/${a.shift_type}`);
                  assignmentKeys.set(key, a);
                } else {
                  console.log(`⚠️ DEDUP: Mantendo alocação existente para ${a.broker_id} em ${a.assignment_date}/${a.shift_type}`);
                }
              }
            }
            
            const deduplicatedAssignments = Array.from(assignmentKeys.values());
            console.log(`📊 Alocações: ${assignmentsWithScheduleId.length} → ${deduplicatedAssignments.length} (após dedup)`);

            const { error: assignmentsError } = await supabase
              .from("schedule_assignments")
              .insert(deduplicatedAssignments);

            if (assignmentsError) throw assignmentsError;
          }
          
          console.log(`✅ Semana ${format(week.weekStart, "dd/MM")} salva: ${week.assignments.length} alocações`);
          successCount++;
        } catch (error) {
          console.error(`❌ Erro ao salvar semana ${format(week.weekStart, "dd/MM")}:`, error);
          errorCount++;
        }
      }
      
      // ✅ AGREGAR HISTÓRICO DOS MESES AFETADOS (90-100%)
      if (successCount > 0 && affectedMonths.size > 0) {
        console.log(`📊 Agregando histórico para ${affectedMonths.size} mês(es)...`);
        setGenerationProgress(90);
        
        for (const yearMonth of Array.from(affectedMonths)) {
          try {
            const { data, error } = await supabase.rpc('aggregate_month_data', { 
              p_year_month: yearMonth 
            });
            
            if (error) throw error;
            console.log(`✅ Histórico agregado para ${yearMonth}:`, data);
          } catch (error) {
            console.error(`❌ Erro ao agregar histórico de ${yearMonth}:`, error);
          }
        }
        setGenerationProgress(100);
      }
      
      // ✅ VALIDAÇÃO PÓS-GERAÇÃO: Executar para cada semana e acumular resultados
      console.log("🔍 Iniciando validação pós-geração...");
      const allValidationResults: ValidationResult[] = [];
      
      for (const week of weeklySchedules) {
        try {
          const weekValidation = await validateGeneratedSchedule(
            week.assignments,
            week.weekStart,
            week.weekEnd
          );
          allValidationResults.push(...weekValidation);
        } catch (error) {
          console.error("Erro na validação:", error);
        }
      }
      
      setValidationResults(allValidationResults);
      
      if (allValidationResults.length > 0) {
        const missingCount = allValidationResults.filter(r => r.status === "missing").length;
        toast.warning(`⚠️ Validação: ${missingCount} plantão(s) esperado(s) não foram gerados. Veja os detalhes abaixo.`);
      }
      
      // ═══════════════════════════════════════════════════════════
      // NOVA VALIDAÇÃO COMPLETA DE REGRAS
      // Verifica TODAS as regras críticas para cada corretor
      // ═══════════════════════════════════════════════════════════
      console.log("\n🔍 INICIANDO VALIDAÇÃO COMPLETA DE REGRAS...\n");
      
      // Coletar todos os assignments do mês
      const allMonthAssignments = weeklySchedules.flatMap(w => w.assignments);
      
      // Buscar dados de brokers e locations para a validação
      const { data: brokersData } = await supabase
        .from("brokers")
        .select("id, name, available_weekdays")
        .eq("is_active", true);
      
      const { data: locationsData } = await supabase
        .from("locations")
        .select("id, name, location_type")
        .eq("is_active", true);
      
      // Buscar configuração de corretores por local (quem está CONFIGURADO para cada local)
      const { data: locationBrokersData } = await supabase
        .from("location_brokers")
        .select("location_id, broker_id");
      
      // Criar Map de corretores configurados por local
      const locationBrokerConfigs = new Map<string, string[]>();
      for (const lb of locationBrokersData || []) {
        if (!locationBrokerConfigs.has(lb.location_id)) {
          locationBrokerConfigs.set(lb.location_id, []);
        }
        locationBrokerConfigs.get(lb.location_id)!.push(lb.broker_id);
      }
      
      // ✅ Incluir availableWeekdays para validação da REGRA 5 (alternância 1↔2)
      const brokersForValidation = (brokersData || []).map(b => ({ 
        id: b.id, 
        name: b.name,
        availableWeekdays: b.available_weekdays || []
      }));
      const locationsForValidation = (locationsData || []).map(l => ({ 
        id: l.id, 
        name: l.name, 
        type: l.location_type || 'external' 
      }));
      
      // Converter validationResults (missing shifts) para UnallocatedDemand[]
      // Detectar demandas não alocadas INDEPENDENTEMENTE (com justificativa)
      const genMonthStart = format(weeklySchedules[0].weekStart, "yyyy-MM-dd");
      const genMonthEnd = format(weeklySchedules[weeklySchedules.length - 1].weekEnd, "yyyy-MM-dd");
      const unallocatedDemands = await detectUnallocatedDemands(
        allMonthAssignments.map(a => ({
          location_id: a.location_id,
          assignment_date: a.assignment_date,
          shift_type: a.shift_type,
          broker_id: a.broker_id
        })),
        genMonthStart,
        genMonthEnd
      );

      // Buscar configuração de turnos por local/data para validação TURNO_NAO_CONFIGURADO
      const locationShiftConfigs = await buildLocationShiftConfigs(
        (locationsData || []).map(l => l.id),
        allMonthAssignments.map(a => a.assignment_date)
      );
      
      const postValidation = postValidateSchedule(
        allMonthAssignments.map(a => ({
          broker_id: a.broker_id,
          location_id: a.location_id,
          assignment_date: a.assignment_date,
          shift_type: a.shift_type
        })),
        brokersForValidation,
        locationsForValidation,
        unallocatedDemands,
        locationBrokerConfigs,
        locationShiftConfigs
      );
      
      // Log detalhado no console
      logValidationResult(postValidation);
      
      // Salvar resultado para exibir no painel
      setPostValidationResult(postValidation);
      
      // ✅ SALVAR VALIDAÇÃO NO BANCO - USAR ANCHOR DO MÊS (primeira semana)
      // Identificar a primeira escala do mês para garantir consistência com o carregamento
      const yearMonthForAnchor = format(weeklySchedules[0].weekStart, "yyyy-MM");
      const { data: monthSchedulesForAnchor } = await supabase
        .from("generated_schedules")
        .select("id, week_start_date")
        .gte("week_start_date", `${yearMonthForAnchor}-01`)
        .lte("week_start_date", `${yearMonthForAnchor}-31`)
        .order("week_start_date", { ascending: true })
        .limit(1);

      const anchorScheduleId = monthSchedulesForAnchor?.[0]?.id;

      if (anchorScheduleId) {
        await saveValidationToDatabase(anchorScheduleId, postValidation);
        console.log(`✅ Validação salva no anchor schedule: ${anchorScheduleId} (mês ${yearMonthForAnchor})`);
      }
      
      // Mostrar resultado na UI
      if (!postValidation.isValid) {
        setMainTab("validacao");
        toast.warning(`Escala gerada com ${postValidation.summary.errorCount} violação(ões). Verifique a aba de Validação.`, {
          duration: 5000
        });
      } else {
        toast.success("✅ Todas as regras foram respeitadas!");
      }
      
      await queryClient.invalidateQueries({ queryKey: ["generated_schedules"] });
      
      // ═══════════════════════════════════════════════════════════
      // VERIFICAÇÃO DE LACUNAS PÓS-GERAÇÃO
      // Identificar dias do mês que não foram cobertos por nenhuma escala
      // ═══════════════════════════════════════════════════════════
      const monthStartForGap = new Date(selectedYear, selectedMonth - 1, 1);
      const monthEndForGap = new Date(selectedYear, selectedMonth, 0);
      
      // Buscar todas as datas com alocações no mês
      const { data: coveredDatesData } = await supabase
        .from("schedule_assignments")
        .select("assignment_date")
        .gte("assignment_date", format(monthStartForGap, "yyyy-MM-dd"))
        .lte("assignment_date", format(monthEndForGap, "yyyy-MM-dd"));
      
      const coveredDatesSet = new Set((coveredDatesData || []).map(d => d.assignment_date));
      
      // Identificar dias sem cobertura (excluindo domingos que normalmente não têm demanda)
      const uncoveredDays: string[] = [];
      let checkDay = new Date(monthStartForGap);
      while (checkDay <= monthEndForGap) {
        const dayStr = format(checkDay, "yyyy-MM-dd");
        const dayOfWeek = checkDay.getDay();
        
        // Domingo (0) geralmente não tem demanda, mas verificamos se há algum período configurado
        // Por simplicidade, consideramos como "normal" pular domingos
        if (dayOfWeek !== 0 && !coveredDatesSet.has(dayStr)) {
          uncoveredDays.push(dayStr);
        }
        checkDay = addDays(checkDay, 1);
      }
      
      if (uncoveredDays.length > 0) {
        const daysFormatted = uncoveredDays
          .slice(0, 5)
          .map(d => format(new Date(d + "T00:00:00"), "dd/MM"))
          .join(", ");
        const moreText = uncoveredDays.length > 5 ? ` e mais ${uncoveredDays.length - 5} dia(s)` : "";
        
        toast.warning(`⚠️ ${uncoveredDays.length} dia(s) sem alocações: ${daysFormatted}${moreText}`, {
          duration: 8000
        });
        console.log(`⚠️ Dias sem cobertura:`, uncoveredDays);
      }
      
      // ═══════════════════════════════════════════════════════════
      // FEEDBACK FINAL AO USUÁRIO
      // ═══════════════════════════════════════════════════════════
      if (successCount > 0) {
        let message = `${successCount} semana(s) gerada(s) com sucesso!`;
        if (skippedWeeksCount > 0) {
          message += ` (${skippedWeeksCount} já existia(m))`;
        }
        if (errorCount > 0) {
          message += ` (${errorCount} falha(s))`;
        }
        toast.success(message);
      } else if (skippedWeeksCount > 0) {
        toast.info(`Todas as ${skippedWeeksCount} semana(s) já existiam. Marque "Substituir escalas existentes" para regenerar.`);
      } else {
        toast.error("Não foi possível gerar nenhuma escala.");
      }
    } catch (error: any) {
      console.error("❌ Erro ao gerar escalas:", error);
      toast.error("Erro ao gerar escalas. Verifique os períodos configurados.");
    } finally {
      setGenerationProgress(0);
      setIsGenerating(false);
    }
  };

  // ✅ NOVO HANDLER: Geração seletiva de semanas
  const handleSelectiveGeneration = async (
    selectedWeeks: any[],
    lockedWeekIds: string[]
  ) => {
    if (selectedWeeks.length === 0) {
      toast.error("Nenhuma semana selecionada para gerar");
      return;
    }

    setIsGenerating(true);
    const affectedMonths = new Set<string>();

    try {
      console.log(`🔄 Iniciando geração SELETIVA: ${selectedWeeks.length} semana(s)`);
      console.log(`🔒 Semanas travadas como referência: ${lockedWeekIds.length}`);

      const result = await generateSelectedWeeksSchedule(
        selectedWeeks,
        selectedMonth,
        selectedYear,
        lockedWeekIds,
        (current, total, attempt, maxAttempts) => {
          setGenerationProgress(Math.round((current / total) * 40));
          if (attempt && attempt > 1) console.log(`   Tentativa ${attempt}/${maxAttempts}`);
        },
        50
      );

      if (!result.success) {
        const failedValidation: PostValidationResult = {
          isValid: false,
          violations: (result.violations || []).map(v => ({
            brokerId: v.brokerId || '',
            brokerName: v.brokerName || 'Desconhecido',
            rule: v.rule || 'REGRA DESCONHECIDA',
            details: `${v.details || ''} ${result.failedWeek ? `(Semana: ${result.failedWeek})` : ''}`,
            severity: (v.severity === 'critical' ? 'error' : 'warning') as 'error' | 'warning',
            dates: v.date ? [v.date] : undefined
          })),
          summary: {
            totalBrokers: 0,
            totalAssignments: 0,
            errorCount: (result.violations || []).filter(v => v.severity === 'critical').length,
            warningCount: (result.violations || []).filter(v => v.severity === 'warning').length,
            unallocatedCount: 0
          },
          brokerReports: [],
          unallocatedDemands: []
        };

        setPostValidationResult(failedValidation);
        setMainTab("validacao");
        toast.error(`Não foi possível gerar a escala para ${result.failedWeek || 'a semana'}. Verifique a aba de Validação.`, { duration: 8000 });
        return;
      }

      const weeklySchedules = result.schedules;

      if (weeklySchedules.length === 0) {
        toast.error("Nenhuma semana foi gerada.");
        return;
      }

      // Salvar cada escala semanal no banco
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < weeklySchedules.length; i++) {
        const week = weeklySchedules[i];
        setGenerationProgress(50 + Math.round(((i + 1) / weeklySchedules.length) * 40));

        try {
          const weekStartStr = format(week.weekStart, "yyyy-MM-dd");
          const weekEndStr = format(week.weekEnd, "yyyy-MM-dd");

          affectedMonths.add(format(week.weekStart, "yyyy-MM"));
          affectedMonths.add(format(week.weekEnd, "yyyy-MM"));

          // ✅ CORREÇÃO: Deletar TODAS as escalas existentes para esta week_start_date (evitar duplicatas)
          const { data: existingForDate } = await supabase
            .from("generated_schedules")
            .select("id")
            .eq("week_start_date", weekStartStr);

          if (existingForDate && existingForDate.length > 0) {
            const idsToDelete = existingForDate.map(s => s.id);
            console.log(`🗑️ Deletando ${idsToDelete.length} escala(s) existente(s) para ${weekStartStr}`);
            
            await supabase
              .from("schedule_assignments")
              .delete()
              .in("generated_schedule_id", idsToDelete);

            await supabase
              .from("generated_schedules")
              .delete()
              .in("id", idsToDelete);
          }

          // Criar nova escala
          const scheduleName = `Escala de ${format(week.weekStart, "dd/MM/yyyy")} a ${format(week.weekEnd, "dd/MM/yyyy")}`;

          const { data: newSchedule, error: scheduleError } = await supabase
            .from("generated_schedules")
            .insert([{
              name: scheduleName,
              week_start_date: weekStartStr,
              week_end_date: weekEndStr,
            }])
            .select()
            .single();

          if (scheduleError) throw scheduleError;

          if (week.assignments.length > 0) {
            const assignmentsWithScheduleId = week.assignments.map((a) => ({
              ...a,
              generated_schedule_id: newSchedule.id,
            }));

            // ═══════════════════════════════════════════════════════════
            // BUSCAR LOCATION_TYPE do banco para validar deduplicação
            // ═══════════════════════════════════════════════════════════
            const locationIds = [...new Set(assignmentsWithScheduleId.map(a => a.location_id))];
            const { data: locationData } = await supabase
              .from("locations")
              .select("id, location_type")
              .in("id", locationIds);
            
            const locationTypeMap = new Map<string, string>();
            locationData?.forEach(loc => {
              locationTypeMap.set(loc.id, loc.location_type || "external");
            });

            // ═══════════════════════════════════════════════════════════
            // DEDUPLICAR: Um corretor só pode ter UMA alocação por dia/turno
            // Priorizar EXTERNO sobre INTERNO se houver conflito
            // ═══════════════════════════════════════════════════════════
            const assignmentKeys = new Map<string, typeof assignmentsWithScheduleId[0]>();
            for (const a of assignmentsWithScheduleId) {
              const key = `${a.broker_id}|${a.assignment_date}|${a.shift_type}`;
              const existing = assignmentKeys.get(key);
              if (!existing) {
                assignmentKeys.set(key, a);
              } else {
                // Usar mapa de location_type (dados do banco)
                const existingLocationType = locationTypeMap.get(existing.location_id);
                const newLocationType = locationTypeMap.get(a.location_id);
                const isNewExternal = newLocationType === "external";
                const isExistingInternal = existingLocationType === "internal";
                
                if (isNewExternal && isExistingInternal) {
                  console.log(`⚠️ DEDUP: Substituindo interno por externo para ${a.broker_id} em ${a.assignment_date}/${a.shift_type}`);
                  assignmentKeys.set(key, a);
                } else {
                  console.log(`⚠️ DEDUP: Mantendo alocação existente para ${a.broker_id} em ${a.assignment_date}/${a.shift_type}`);
                }
              }
            }
            
            const deduplicatedAssignments = Array.from(assignmentKeys.values());
            console.log(`📊 Alocações: ${assignmentsWithScheduleId.length} → ${deduplicatedAssignments.length} (após dedup)`);

            const { error: assignmentsError } = await supabase
              .from("schedule_assignments")
              .insert(deduplicatedAssignments);

            if (assignmentsError) throw assignmentsError;
          }

          successCount++;
        } catch (error) {
          console.error(`❌ Erro ao salvar semana:`, error);
          errorCount++;
        }
      }

      // Agregar histórico
      if (successCount > 0 && affectedMonths.size > 0) {
        setGenerationProgress(90);
        for (const yearMonth of Array.from(affectedMonths)) {
          try {
            await supabase.rpc('aggregate_month_data', { p_year_month: yearMonth });
          } catch (error) {
            console.error(`❌ Erro ao agregar histórico de ${yearMonth}:`, error);
          }
        }
        setGenerationProgress(100);
      }

      await queryClient.invalidateQueries({ queryKey: ["generated_schedules"] });
      await queryClient.invalidateQueries({ queryKey: ["schedule_assignments"] });

      if (successCount > 0) {
        toast.success(`${successCount} semana(s) gerada(s) com sucesso!`);
      } else {
        toast.error("Não foi possível gerar nenhuma escala.");
      }
    } catch (error: any) {
      console.error("❌ Erro ao gerar escalas:", error);
      toast.error("Erro ao gerar escalas.");
    } finally {
      setGenerationProgress(0);
      setIsGenerating(false);
    }
  };

  const handleReplaceClick = (assignment: ScheduleAssignment) => {
    setEditingAssignment(assignment);
    setReplacementDialogOpen(true);
  };

  // ✅ Handler: Abrir dialog de edição de local
  const handleEditLocationClick = (assignment: ScheduleAssignment) => {
    setEditingAssignmentForLocation(assignment);
    setEditDialogOpen(true);
  };

  // ✅ Handler: Abrir dialog de adição de alocação
  const handleAddAssignmentClick = () => {
    setAddDialogOpen(true);
  };

  // ✅ NOVO HANDLER: Recebe o assignment interno OU corretor disponível e faz a substituição
  const handleReplaceBroker = (selection: any) => {
    if (!editingAssignment?.id) return;
    
    // Caso 1: Corretor DISPONÍVEL (sem alocação atual)
    if (selection.isAvailable && selection.broker?.id) {
      updateBrokerMutation.mutate({
        assignmentId: editingAssignment.id,
        newBrokerId: selection.broker.id
      });
      return;
    }
    
    // Caso 2: Corretor em plantão INTERNO (swap)
    if (selection?.id) {
      swapBrokersMutation.mutate({ 
        externalAssignmentId: editingAssignment.id, 
        internalAssignmentId: selection.id, 
        newBrokerId: selection.broker_id 
      });
    }
  };

  const weekdayMap: Record<number, string> = {
    0: "Domingo",
    1: "Segunda-feira",
    2: "Terça-feira",
    3: "Quarta-feira",
    4: "Quinta-feira",
    5: "Sexta-feira",
    6: "Sábado",
  };

  // Filtrar e ordenar assignments
  const filteredAndSortedAssignments = useMemo(() => {
    if (!scheduleAssignments) return [];
    
    // 1. Filtrar por termo de busca (com normalização de acentos)
    const normalizedSearch = normalizeText(debouncedSearch);
    let filtered = scheduleAssignments.filter((a) => {
      return (
        normalizeText(a.broker?.name || "").includes(normalizedSearch) ||
        normalizeText(a.location?.name || "").includes(normalizedSearch) ||
        format(new Date(a.assignment_date + "T00:00:00"), "dd/MM/yyyy").includes(debouncedSearch)
      );
    });
    
    // 2. Ordenar
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === "date") {
        comparison = new Date(a.assignment_date).getTime() - new Date(b.assignment_date).getTime();
      } else if (sortBy === "broker") {
        comparison = a.broker?.name.localeCompare(b.broker?.name);
      } else if (sortBy === "location") {
        comparison = a.location?.name.localeCompare(b.location?.name);
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    return filtered;
  }, [scheduleAssignments, debouncedSearch, sortBy, sortOrder]);

  // Paginar
  const paginatedAssignments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedAssignments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedAssignments, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedAssignments.length / itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Escalas</h1>
          <p className="text-muted-foreground">Gere e gerencie escalas semanais automaticamente</p>
        </div>
      </div>

      {/* Sistema de Abas Principal */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="escalas" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Escalas
          </TabsTrigger>
          <TabsTrigger value="validacao" className="flex items-center gap-2 relative">
            <ClipboardCheck className="h-4 w-4" />
            Validação
            {postValidationResult && !postValidationResult.isValid && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-xs">
                {postValidationResult.summary.errorCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ABA ESCALAS */}
        <TabsContent value="escalas" className="space-y-6">
          {canEditEscalas && (
            <div className="bg-card p-6 rounded-lg border">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Geração de Escalas Mensais</h3>
                  <p className="text-sm text-muted-foreground">
                    Selecione o mês e ano para gerar automaticamente todas as escalas semanais do período
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Mês</Label>
                    <Select 
                      value={selectedMonth.toString()} 
                      onValueChange={(v) => setSelectedMonth(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Janeiro</SelectItem>
                        <SelectItem value="2">Fevereiro</SelectItem>
                        <SelectItem value="3">Março</SelectItem>
                        <SelectItem value="4">Abril</SelectItem>
                        <SelectItem value="5">Maio</SelectItem>
                        <SelectItem value="6">Junho</SelectItem>
                        <SelectItem value="7">Julho</SelectItem>
                        <SelectItem value="8">Agosto</SelectItem>
                        <SelectItem value="9">Setembro</SelectItem>
                        <SelectItem value="10">Outubro</SelectItem>
                        <SelectItem value="11">Novembro</SelectItem>
                        <SelectItem value="12">Dezembro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ano</Label>
                    <Input
                      type="number"
                      min="2024"
                      max="2030"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <Checkbox
                    id="replace-existing"
                    checked={replaceExistingSchedules}
                    onCheckedChange={(checked) => setReplaceExistingSchedules(checked as boolean)}
                  />
                  <Label htmlFor="replace-existing" className="text-sm font-normal cursor-pointer">
                    Substituir escalas existentes (se houver)
                  </Label>
                </div>
                
                <div className="flex gap-3">
                  <Button
                    onClick={() => setWeekSelectionDialogOpen(true)}
                    disabled={isGenerating}
                    size="default"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Calendar className="mr-2 h-4 w-4" />
                        Gerar Escalas do Mês
                      </>
                    )}
                  </Button>

                  <Button
                    variant="destructive"
                    size="default"
                    onClick={handleCleanupClick}
                    disabled={cleanOldSchedulesMutation.isPending || !schedules || schedules.length <= 2}
                  >
                    {cleanOldSchedulesMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Limpando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Limpar Escalas Antigas
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="default"
                    onClick={handleDeleteMonthClick}
                    disabled={deleteMonthSchedulesMutation.isPending}
                    className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    {deleteMonthSchedulesMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir Escalas do Mês
                      </>
                    )}
                  </Button>
                </div>
                
                {isGenerating && (
                  <div className="space-y-2 mt-4">
                    <Progress value={generationProgress} className="w-full" />
                    <p className="text-sm text-center text-muted-foreground">
                      Gerando escalas... {generationProgress}%
                    </p>
                  </div>
                )}
                
                {schedules && schedules.length <= 2 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nenhuma escala antiga para limpar
                  </p>
                )}
                
                {/* VALIDAÇÃO: Mostrar alertas de divergências */}
                {validationResults.length > 0 && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Validação da Escala</AlertTitle>
                    <AlertDescription>
                      <p className="mb-2">
                        {validationResults.filter(r => r.status === "missing").length} plantão(s) esperado(s) não foram gerados:
                      </p>
                      <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                        {validationResults.filter(r => r.status === "missing").map((r, i) => (
                          <li key={i}>
                            • {r.locationName} - {new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR")} - {r.shift === "morning" ? "Manhã" : "Tarde"}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setValidationResults([])}
                      >
                        Fechar
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}

          {schedules && schedules.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Escalas Geradas</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {schedules
                  .sort((a, b) => new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime())
                  .map((schedule) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const scheduleStart = new Date(schedule.week_start_date + "T00:00:00");
                    const scheduleEnd = new Date(schedule.week_end_date + "T00:00:00");
                    const isCurrentWeek = today >= scheduleStart && today <= scheduleEnd;
                    
                    return (
                      <div key={schedule.id} className="relative">
                        <Button
                          variant={selectedScheduleId === schedule.id ? "default" : "outline"}
                          onClick={() => setSelectedScheduleId(schedule.id)}
                          size="sm"
                          className="w-full text-xs sm:text-sm whitespace-normal h-auto py-2 leading-tight"
                        >
                          {schedule.name}
                        </Button>
                        {isCurrentWeek && (
                          <Badge 
                            variant="secondary" 
                            className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0"
                          >
                            Ativa
                          </Badge>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {selectedScheduleId && scheduleAssignments && scheduleAssignments.length > 0 && (
            <Tabs defaultValue="assignments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="assignments">Alocações da Semana</TabsTrigger>
            <TabsTrigger value="schedule-view">Tabela de Plantões</TabsTrigger>
          </TabsList>
          
          {/* ABA 1: Alocações da Semana com Filtros e Paginação */}
          <TabsContent value="assignments" className="space-y-4">
            {/* Barra de Filtros */}
            <div className="flex flex-col md:flex-row gap-4 items-end">
              {/* Busca */}
              <div className="flex-1">
                <Label htmlFor="search">Buscar</Label>
                <Input
                  id="search"
                  placeholder="Buscar por corretor, local ou data..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              
              {/* Ordenar Por */}
              <div className="w-48">
                <Label htmlFor="sortBy">Ordenar Por</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger id="sortBy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Data</SelectItem>
                    <SelectItem value="broker">Corretor</SelectItem>
                    <SelectItem value="location">Local</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Ordem */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                title={sortOrder === "asc" ? "Ordem Crescente" : "Ordem Decrescente"}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
              
              {/* Botão Adicionar Alocação */}
              {canEditEscalas && (
                <Button onClick={handleAddAssignmentClick}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Alocação
                </Button>
              )}
            </div>

            {/* Tabela */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Corretor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Dia</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAssignments.map((assignment) => {
                    const date = new Date(assignment.assignment_date + "T00:00:00");
                    const isExternal = assignment.location?.location_type === "external";
                    const rowIndex = paginatedAssignments.indexOf(assignment);
                    return (
                      <TableRow 
                        key={assignment.id}
                        className={rowIndex % 2 === 0 ? "bg-muted/50" : ""}
                      >
                        <TableCell 
                          className="font-medium"
                          style={{ color: isExternal ? "#dc2626" : "inherit" }}
                        >
                          {assignment.broker?.name}
                        </TableCell>
                        <TableCell
                          style={{ color: isExternal ? "#dc2626" : "inherit" }}
                        >
                          {format(date, "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell
                          style={{ color: isExternal ? "#dc2626" : "inherit" }}
                        >
                          {weekdayMap[date.getDay()]}
                        </TableCell>
                        <TableCell>
                          <Badge variant={assignment.shift_type === "morning" ? "default" : "secondary"}>
                            {assignment.shift_type === "morning" ? "Manhã" : "Tarde"}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            {assignment.start_time?.substring(0, 5)} - {assignment.end_time?.substring(0, 5)}
                          </div>
                        </TableCell>
                        <TableCell
                          style={{ color: isExternal ? "#dc2626" : "inherit" }}
                        >
                          {assignment.location?.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant={assignment.location?.location_type === "external" ? "default" : "outline"}>
                            {assignment.location?.location_type === "external" ? "Externo" : "Interno"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canEditEscalas && (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleEditLocationClick(assignment)}
                                title="Mudar Local"
                              >
                                <MapPin className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleReplaceClick(assignment)}
                                title="Substituir Corretor"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  setSwappingAssignment(assignment);
                                  setSwapDialogOpen(true);
                                }}
                                title="Trocar Plantão"
                              >
                                <ArrowLeftRight className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => {
                                  if (assignment.id) {
                                    setDeleteAssignmentId(assignment.id);
                                    setDeleteAssignmentInfo({
                                      broker: assignment.broker?.name || "Corretor",
                                      location: assignment.location?.name || "Local",
                                      date: format(new Date(assignment.assignment_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
                                    });
                                  }
                                }}
                                title="Remover"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedAssignments.length)} de {filteredAndSortedAssignments.length} alocações
                </p>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => 
                        p === 1 || 
                        p === totalPages || 
                        Math.abs(p - currentPage) <= 1
                      )
                      .map((page, i, arr) => (
                        <div key={page} className="flex items-center">
                          {i > 0 && arr[i - 1] !== page - 1 && (
                            <span className="px-2 text-muted-foreground">...</span>
                          )}
                          <Button
                            variant={page === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        </div>
                      ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
          
          {/* ABA 2: Tabela de Plantões (Nova Visualização) */}
          <TabsContent value="schedule-view" className="space-y-4">
            <div className="flex justify-between items-center no-print">
              <h2 className="text-xl font-semibold">Tabela de Plantões</h2>
              <Button variant="outline" onClick={() => {
                const selectedSchedule = schedules?.find(s => s.id === selectedScheduleId);
                const originalTitle = document.title;
                
                // Fallback para caso a escala não seja encontrada
                let pdfTitle = "Plantões";
                
                if (selectedSchedule?.week_start_date && selectedSchedule?.week_end_date) {
                  const weekStartFormatted = format(new Date(selectedSchedule.week_start_date + "T00:00:00"), "dd-MM-yyyy");
                  const weekEndFormatted = format(new Date(selectedSchedule.week_end_date + "T00:00:00"), "dd-MM-yyyy");
                  const generatedDateTime = format(new Date(), "dd-MM-yyyy HH'h'mm");
                  pdfTitle = `Plantões - ${weekStartFormatted} a ${weekEndFormatted} - gerado em ${generatedDateTime}`;
                } else {
                  const generatedDateTime = format(new Date(), "dd-MM-yyyy HH'h'mm");
                  pdfTitle = `Plantões - gerado em ${generatedDateTime}`;
                }
                
                document.title = pdfTitle;
                window.print();
                setTimeout(() => { document.title = originalTitle; }, 1000);
              }}>
                <FileText className="mr-2 h-4 w-4" />
                Gerar PDF
              </Button>
            </div>
            
            <ScheduleCalendarView 
              assignments={scheduleAssignments || []}
              scheduleWeekStart={schedules?.find(s => s.id === selectedScheduleId)?.week_start_date}
              scheduleWeekEnd={schedules?.find(s => s.id === selectedScheduleId)?.week_end_date}
              scheduleId={selectedScheduleId || undefined}
            />
            </TabsContent>
            </Tabs>
          )}

          {selectedScheduleId && scheduleAssignments && scheduleAssignments.length > 0 && (
            <SchedulePDFGenerator 
              key={selectedScheduleId} 
              assignments={scheduleAssignments}
              scheduleWeekStart={schedules?.find(s => s.id === selectedScheduleId)?.week_start_date}
              scheduleWeekEnd={schedules?.find(s => s.id === selectedScheduleId)?.week_end_date}
              generatedAt={schedules?.find(s => s.id === selectedScheduleId)?.created_at}
              updatedAt={schedules?.find(s => s.id === selectedScheduleId)?.updated_at}
              scheduleId={selectedScheduleId || undefined}
            />
          )}
        </TabsContent>

        {/* ABA VALIDAÇÃO */}
        <TabsContent value="validacao" className="space-y-4">
          {postValidationResult ? (
            <div className="bg-card p-6 rounded-lg border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    {postValidationResult.isValid ? (
                      <span className="text-green-600">Relatório de Validação - OK</span>
                    ) : (
                      <span className="text-red-600">Relatório de Validação - Erros Encontrados</span>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {postValidationResult.summary.totalAssignments} alocações analisadas • 
                    {postValidationResult.summary.errorCount} erros • 
                    {postValidationResult.summary.warningCount} avisos
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRevalidateSchedule}
                    disabled={isRevalidating || !selectedScheduleId}
                  >
                    {isRevalidating ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3 w-3" />
                    )}
                    Re-validar Mês
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPostValidationResult(null)}>
                    Limpar
                  </Button>
                </div>
              </div>
              <ValidationReportPanel 
                result={postValidationResult} 
                onClose={() => setPostValidationResult(null)}
                brokerDiagnostics={getLastGenerationTrace()?.brokerDiagnostics}
              />
            </div>
          ) : (
            <div className="bg-card p-6 rounded-lg border text-center">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum Relatório de Validação</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {selectedScheduleId && scheduleAssignments && scheduleAssignments.length > 0
                  ? "Clique no botão abaixo para validar TODAS as semanas do mês selecionado."
                  : "O relatório de validação será gerado automaticamente após gerar uma nova escala mensal."
                }
              </p>
              {selectedScheduleId && scheduleAssignments && scheduleAssignments.length > 0 && (
                <Button 
                  onClick={handleRevalidateSchedule}
                  disabled={isRevalidating}
                  className="mt-2"
                >
                  {isRevalidating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validando mês completo...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Re-validar Mês Completo
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={replacementDialogOpen} onOpenChange={setReplacementDialogOpen}>
        <DialogContent className="overflow-hidden">
          <DialogHeader>
            <DialogTitle>Substituir Corretor</DialogTitle>
            <DialogDescription>
              Selecione um corretor de plantão interno para assumir este plantão externo.
            </DialogDescription>
          </DialogHeader>
          {editingAssignment && selectedScheduleId && (
            <ScheduleReplacementDialog
              generatedScheduleId={selectedScheduleId}
              locationId={editingAssignment.location_id}
              date={editingAssignment.assignment_date}
              shiftType={editingAssignment.shift_type}
              currentBrokerId={editingAssignment.broker_id}
              currentBrokerName={editingAssignment.broker?.name}
              onSelect={handleReplaceBroker}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🗑️ Limpar Escalas Antigas</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Esta ação irá:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>✅ <strong>Manter as 2 semanas mais recentes</strong></li>
                <li>❌ <strong>Deletar {schedulesToDelete.length} escala(s) antiga(s)</strong></li>
              </ul>
              
              {schedulesToDelete.length > 0 && (
                <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                  <p className="font-semibold text-sm mb-2">Escalas que serão removidas:</p>
                  <ul className="text-xs space-y-1">
                    {schedulesToDelete.map(s => (
                      <li key={s.id}>• {s.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <p className="text-sm text-yellow-600 font-medium mt-4">
                ⚠️ Esta ação não pode ser desfeita!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                cleanOldSchedulesMutation.mutate();
                setCleanupDialogOpen(false);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirmar Limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog de confirmação para remover alocação */}
      <AlertDialog open={deleteAssignmentId !== null} onOpenChange={(open) => !open && setDeleteAssignmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🗑️ Remover Alocação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a alocação de{" "}
              <strong>{deleteAssignmentInfo?.broker}</strong> em{" "}
              <strong>{deleteAssignmentInfo?.location}</strong> no dia{" "}
              <strong>{deleteAssignmentInfo?.date}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteAssignmentId) {
                  deleteMutation.mutate(deleteAssignmentId);
                  setDeleteAssignmentId(null);
                  setDeleteAssignmentInfo(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de edição de local */}
      <EditAssignmentDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        assignment={editingAssignmentForLocation}
        allAssignments={scheduleAssignments || []}
        generatedScheduleId={selectedScheduleId || ""}
        onSave={(data) => editLocationMutation.mutate(data)}
      />

      {/* Dialog de adição de alocação */}
      <AddAssignmentDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        weekStart={schedules?.find(s => s.id === selectedScheduleId)?.week_start_date || ""}
        weekEnd={schedules?.find(s => s.id === selectedScheduleId)?.week_end_date || ""}
        allAssignments={scheduleAssignments || []}
        generatedScheduleId={selectedScheduleId || ""}
        onSave={(data) => addAssignmentMutation.mutate(data)}
      />

      {/* Dialog de troca de plantões */}
      <Dialog open={swapDialogOpen} onOpenChange={(open) => {
        setSwapDialogOpen(open);
        if (!open) setSwappingAssignment(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Trocar Plantão
            </DialogTitle>
            <DialogDescription>
              Selecione um corretor para trocar o plantão com {swappingAssignment?.broker?.name}
            </DialogDescription>
          </DialogHeader>
          {swappingAssignment && selectedScheduleId && (
            <ScheduleSwapDialog
              generatedScheduleId={selectedScheduleId}
              currentAssignment={{
                id: swappingAssignment.id || "",
                broker_id: swappingAssignment.broker_id,
                broker_name: swappingAssignment.broker?.name || "Desconhecido",
                location_id: swappingAssignment.location_id,
                location_name: swappingAssignment.location?.name || "Desconhecido",
                location_type: swappingAssignment.location?.location_type || "internal",
              }}
              date={swappingAssignment.assignment_date}
              shiftType={swappingAssignment.shift_type as "morning" | "afternoon"}
              onConfirmSwap={(assignmentA, assignmentB) => {
                swapShiftsMutation.mutate({
                  assignmentA: {
                    id: assignmentA.id,
                    broker_id: assignmentA.broker_id,
                    location_id: assignmentA.location_id,
                  },
                  assignmentB: {
                    id: assignmentB.id,
                    broker_id: assignmentB.broker_id,
                    location_id: assignmentB.location_id,
                  },
                });
              }}
              onClose={() => {
                setSwapDialogOpen(false);
                setSwappingAssignment(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog para excluir escalas do mês */}
      <AlertDialog open={deleteMonthDialogOpen} onOpenChange={setDeleteMonthDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Excluir Escalas do Mês
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Você está prestes a excluir <strong>todas as escalas</strong> de{" "}
                  <strong>{selectedMonth.toString().padStart(2, '0')}/{selectedYear}</strong>.
                </p>
                
                {schedulesOfMonthToDelete.length > 0 && (
                  <div className="bg-muted p-3 rounded-md max-h-40 overflow-y-auto">
                    <p className="text-sm font-medium mb-2">
                      {schedulesOfMonthToDelete.length} escala(s) serão excluídas:
                    </p>
                    <ul className="text-sm space-y-1">
                      {schedulesOfMonthToDelete.map((s) => (
                        <li key={s.id} className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {s.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <p className="text-destructive font-medium">
                  Esta ação é irreversível!
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMonthSchedulesMutation.mutate({ 
                year: selectedYear, 
                month: selectedMonth 
              })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMonthSchedulesMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir Escalas"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de seleção de semanas */}
      <WeekSelectionDialog
        open={weekSelectionDialogOpen}
        onOpenChange={setWeekSelectionDialogOpen}
        month={selectedMonth}
        year={selectedYear}
        onConfirm={handleSelectiveGeneration}
      />
    </div>
  );
};

export default Schedules;
