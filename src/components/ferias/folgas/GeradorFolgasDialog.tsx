import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachWeekendOfInterval, isSaturday, differenceInDays, parseISO, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Users, Calendar, AlertTriangle, CheckCircle, Building2, Gift } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface Colaborador {
  id: string;
  nome: string;
  data_admissao: string;
  familiar_id: string | null;
  status: string | null;
  setor_titular_id: string;
  unidade_id: string | null;
}

interface Setor {
  id: string;
  nome: string;
  unidade_id: string | null;
}

interface FeriasAtivas {
  colaborador_id: string;
  quinzena1_inicio: string;
  quinzena1_fim: string;
  quinzena2_inicio: string;
  quinzena2_fim: string;
  gozo_diferente: boolean | null;
  gozo_quinzena1_inicio: string | null;
  gozo_quinzena1_fim: string | null;
  gozo_quinzena2_inicio: string | null;
  gozo_quinzena2_fim: string | null;
  is_excecao: boolean | null;
  status: string | null;
}

interface Perda {
  colaborador_id: string;
}

interface SetorChefe {
  setor_id: string;
  colaborador_id: string;
}

interface SetorSubstituto {
  colaborador_id: string;
  setor_id: string;
}

interface PreviewRow {
  setor_id: string;
  setor_nome: string;
  colaborador_id: string;
  colaborador_nome: string;
  data_sabado: string;
  is_familiar_match: boolean;
  motivo_exclusao?: string;
}

interface GeradorFolgasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
}

interface ConfigMap {
  FOLGAS_POR_MES: number;
  FOLGAS_PERIODO_EXPERIENCIA: number;
  FOLGAS_PRIORIZAR_FAMILIARES: boolean;
  FOLGAS_BLOQUEAR_LIDERES_MESMA_UNIDADE: boolean;
  FOLGAS_BLOQUEAR_MES_FERIAS: boolean;
  FOLGAS_FERIAS_DOIS_MESES: boolean;
  FOLGAS_DISTRIBUICAO_JUSTA: boolean;
}

const DEFAULT_CONFIG: ConfigMap = {
  FOLGAS_POR_MES: 1,
  FOLGAS_PERIODO_EXPERIENCIA: 45,
  FOLGAS_PRIORIZAR_FAMILIARES: true,
  FOLGAS_BLOQUEAR_LIDERES_MESMA_UNIDADE: true,
  FOLGAS_BLOQUEAR_MES_FERIAS: true,
  FOLGAS_FERIAS_DOIS_MESES: true,
  FOLGAS_DISTRIBUICAO_JUSTA: true,
};

// Allocation unit: single person or family pair
interface AllocationUnit {
  id: string;
  memberIds: string[];
  type: "family" | "single";
  availableSaturdays: string[];
  primarySetorId: string; // Setor usado para contagem (do primeiro membro ou do membro "titular")
  allSetorIds: string[]; // All unique sector IDs from all members (for cross-sector families)
}

export function GeradorFolgasDialog({ open, onOpenChange, year, month }: GeradorFolgasDialogProps) {
  const queryClient = useQueryClient();
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [diagnosticMessage, setDiagnosticMessage] = useState<string | null>(null);
  const [creditsToUse, setCreditsToUse] = useState<Set<string>>(new Set());
  const [selectedSaturdays, setSelectedSaturdays] = useState<Set<string>>(new Set());

  // Get ALL saturdays of the month
  const allSaturdaysOfMonth = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    const weekends = eachWeekendOfInterval({ start, end });
    return weekends.filter(d => isSaturday(d)).map(d => format(d, "yyyy-MM-dd"));
  }, [year, month]);

  // Initialize selected saturdays when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedSaturdays(new Set(allSaturdaysOfMonth));
    }
  }, [open, allSaturdaysOfMonth]);

  // Active saturdays (only selected ones used in generation)
  const saturdaysOfMonth = useMemo(() => {
    return allSaturdaysOfMonth.filter(s => selectedSaturdays.has(s));
  }, [allSaturdaysOfMonth, selectedSaturdays]);

  // Query configurações
  const { data: configs = [] } = useQuery({
    queryKey: ["ferias-configuracoes-folgas-gerador"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_configuracoes")
        .select("chave, valor")
        .like("chave", "FOLGAS_%");
      if (error) throw error;
      return data;
    },
  });

  // Parse configs
  const configMap = useMemo((): ConfigMap => {
    const result = { ...DEFAULT_CONFIG };
    configs.forEach(c => {
      if (c.chave === "FOLGAS_POR_MES") result.FOLGAS_POR_MES = parseInt(c.valor) || 1;
      if (c.chave === "FOLGAS_PERIODO_EXPERIENCIA") result.FOLGAS_PERIODO_EXPERIENCIA = parseInt(c.valor) || 45;
      if (c.chave === "FOLGAS_PRIORIZAR_FAMILIARES") result.FOLGAS_PRIORIZAR_FAMILIARES = c.valor === "true";
      if (c.chave === "FOLGAS_BLOQUEAR_LIDERES_MESMA_UNIDADE") result.FOLGAS_BLOQUEAR_LIDERES_MESMA_UNIDADE = c.valor === "true";
      if (c.chave === "FOLGAS_BLOQUEAR_MES_FERIAS") result.FOLGAS_BLOQUEAR_MES_FERIAS = c.valor === "true";
      if (c.chave === "FOLGAS_FERIAS_DOIS_MESES") result.FOLGAS_FERIAS_DOIS_MESES = c.valor === "true";
      if (c.chave === "FOLGAS_DISTRIBUICAO_JUSTA") result.FOLGAS_DISTRIBUICAO_JUSTA = c.valor === "true";
    });
    return result;
  }, [configs]);

  // Query todos os setores ativos
  const { data: setores = [] } = useQuery({
    queryKey: ["ferias-setores-gerador"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setores")
        .select("id, nome, unidade_id")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data as Setor[];
    },
  });

  // Query TODOS os colaboradores ativos
  const { data: colaboradores = [] } = useQuery({
    queryKey: ["ferias-colaboradores-gerador-todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, data_admissao, familiar_id, status, setor_titular_id, unidade_id")
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data as Colaborador[];
    },
  });

  // Query férias ativas no mês
  const { data: feriasAtivas = [] } = useQuery({
    queryKey: ["ferias-ativas-gerador", year, month],
    queryFn: async () => {
      const monthStart = format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("ferias_ferias")
        .select("colaborador_id, quinzena1_inicio, quinzena1_fim, quinzena2_inicio, quinzena2_fim, gozo_diferente, gozo_quinzena1_inicio, gozo_quinzena1_fim, gozo_quinzena2_inicio, gozo_quinzena2_fim, is_excecao, status")
        .or(`quinzena1_inicio.lte.${monthEnd},quinzena2_fim.gte.${monthStart}`)
        // Bloqueia folga para QUALQUER férias agendada/em curso (incluindo "pendente" e exceções).
        // Só liberamos quando a férias está em estado terminal: cancelada, reprovada ou concluída.
        .not("status", "in", '("cancelada","reprovada","concluida")');
      
      if (error) throw error;
      return data as FeriasAtivas[];
    },
  });

  // Query perdas do mês
  const { data: perdas = [] } = useQuery({
    queryKey: ["ferias-perdas-gerador", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_folgas_perdas")
        .select("colaborador_id")
        .eq("ano", year)
        .eq("mes", month);
      if (error) throw error;
      return data as Perda[];
    },
  });

  // Query afastamentos ativos no mês
  const { data: afastamentos = [] } = useQuery({
    queryKey: ["ferias-afastamentos-gerador", year, month],
    queryFn: async () => {
      const monthStart = format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("ferias_afastamentos")
        .select("colaborador_id, motivo, data_inicio, data_fim")
        .lte("data_inicio", monthEnd)
        .gte("data_fim", monthStart);
      if (error) throw error;
      return data || [];
    },
  });


  const { data: setorChefes = [] } = useQuery({
    queryKey: ["ferias-setor-chefes-gerador"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setor_chefes")
        .select("setor_id, colaborador_id");
      if (error) throw error;
      return data as SetorChefe[];
    },
  });

  // Query setores substitutos
  const { data: setoresSubstitutos = [] } = useQuery({
    queryKey: ["ferias-setores-substitutos-gerador"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaborador_setores_substitutos")
        .select("colaborador_id, setor_id");
      if (error) throw error;
      return data as SetorSubstituto[];
    },
  });

  // Query available credits (folga type)
  const { data: availableCredits = [] } = useQuery({
    queryKey: ["ferias-folgas-creditos-disponiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_folgas_creditos")
        .select("id, colaborador_id, origem_data, dias, justificativa, ferias_colaboradores(nome)")
        .eq("tipo", "folga")
        .eq("status", "disponivel")
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });
  const countVacationDaysInMonth = (colabId: string): number => {
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(new Date(year, month - 1));
    let totalDays = 0;

    feriasAtivas.forEach(ferias => {
      if (ferias.colaborador_id !== colabId) return;

      const q1Start = parseISO(ferias.gozo_diferente && ferias.gozo_quinzena1_inicio 
        ? ferias.gozo_quinzena1_inicio : ferias.quinzena1_inicio);
      const q1End = parseISO(ferias.gozo_diferente && ferias.gozo_quinzena1_fim 
        ? ferias.gozo_quinzena1_fim : ferias.quinzena1_fim);

      const q1OverlapStart = q1Start > monthStart ? q1Start : monthStart;
      const q1OverlapEnd = q1End < monthEnd ? q1End : monthEnd;
      if (q1OverlapStart <= q1OverlapEnd) {
        totalDays += differenceInDays(q1OverlapEnd, q1OverlapStart) + 1;
      }

      const q2Raw = ferias.gozo_diferente && ferias.gozo_quinzena2_inicio 
        ? ferias.gozo_quinzena2_inicio : ferias.quinzena2_inicio;
      const q2EndRaw = ferias.gozo_diferente && ferias.gozo_quinzena2_fim 
        ? ferias.gozo_quinzena2_fim : ferias.quinzena2_fim;

      if (q2Raw && q2EndRaw) {
        const q2Start = parseISO(q2Raw);
        const q2End = parseISO(q2EndRaw);
        const q2OverlapStart = q2Start > monthStart ? q2Start : monthStart;
        const q2OverlapEnd = q2End < monthEnd ? q2End : monthEnd;
        if (q2OverlapStart <= q2OverlapEnd) {
          totalDays += differenceInDays(q2OverlapEnd, q2OverlapStart) + 1;
        }
      }
    });

    return totalDays;
  };

  const shouldSkipDueToTwoMonthVacation = (colabId: string): boolean => {
    if (!configMap.FOLGAS_FERIAS_DOIS_MESES) return false;

    const currentMonthDays = countVacationDaysInMonth(colabId);
    if (currentMonthDays === 0) return false;

    let otherMonthDays = 0;

    feriasAtivas.forEach(ferias => {
      if (ferias.colaborador_id !== colabId) return;

      const q1Start = parseISO(ferias.gozo_diferente && ferias.gozo_quinzena1_inicio 
        ? ferias.gozo_quinzena1_inicio : ferias.quinzena1_inicio);
      const q2EndRaw = ferias.gozo_diferente && ferias.gozo_quinzena2_fim 
        ? ferias.gozo_quinzena2_fim : ferias.quinzena2_fim;
      const q2End = q2EndRaw ? parseISO(q2EndRaw) : parseISO(ferias.gozo_diferente && ferias.gozo_quinzena1_fim 
        ? ferias.gozo_quinzena1_fim : ferias.quinzena1_fim);

      const startMonth = q1Start.getMonth() + 1;
      const endMonth = q2End.getMonth() + 1;

      if (startMonth !== month || endMonth !== month) {
        if (startMonth !== month) {
          const otherMonthStart = startOfMonth(q1Start);
          const otherMonthEnd = endOfMonth(q1Start);
          const overlapStart = q1Start > otherMonthStart ? q1Start : otherMonthStart;
          const overlapEnd = q2End < otherMonthEnd ? q2End : otherMonthEnd;
          if (overlapStart <= overlapEnd) {
            otherMonthDays = Math.max(otherMonthDays, differenceInDays(overlapEnd, overlapStart) + 1);
          }
        }
      }
    });

    return otherMonthDays > 0 && currentMonthDays > otherMonthDays;
  };

  const hasFullMonthVacation = (colabId: string): boolean => {
    if (!configMap.FOLGAS_BLOQUEAR_MES_FERIAS) return false;
    const vacationDays = countVacationDaysInMonth(colabId);
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    return vacationDays > daysInMonth / 2;
  };

  const isInExperiencePeriod = (colab: Colaborador): boolean => {
    const admissao = parseISO(colab.data_admissao);
    const referenceDate = new Date(year, month - 1, 1);
    const diasDesdeAdmissao = differenceInDays(referenceDate, admissao);
    return diasDesdeAdmissao < configMap.FOLGAS_PERIODO_EXPERIENCIA;
  };

  const hasPerda = (colabId: string): boolean => {
    return perdas.some(p => p.colaborador_id === colabId);
  };

  const getAfastamentoMotivo = (colabId: string): string | null => {
    const af = afastamentos.find(a => a.colaborador_id === colabId);
    if (!af) return null;
    const motivos: Record<string, string> = {
      acidente: "Acidente", doenca: "Doença", licenca_maternidade: "Licença maternidade",
      licenca_paternidade: "Licença paternidade", licenca_medica: "Licença médica", outros: "Outros",
    };
    return motivos[af.motivo] || af.motivo;
  };

  const isAfastadoAnySaturday = (colabId: string): boolean => {
    const colabAfastamentos = afastamentos.filter(a => a.colaborador_id === colabId);
    if (colabAfastamentos.length === 0) return false;
    return saturdaysOfMonth.some(sat =>
      colabAfastamentos.some(a => sat >= a.data_inicio && sat <= a.data_fim)
    );
  };

  const isColabAfastado = (colabId: string, saturdayDate: string): boolean => {
    return afastamentos.some(a =>
      a.colaborador_id === colabId && saturdayDate >= a.data_inicio && saturdayDate <= a.data_fim
    );
  };

  const isColabOnVacation = (colabId: string, saturdayDate: string): boolean => {
    return feriasAtivas.some(ferias => {
      if (ferias.colaborador_id !== colabId) return false;
      
      const q1Start = ferias.gozo_diferente && ferias.gozo_quinzena1_inicio 
        ? ferias.gozo_quinzena1_inicio : ferias.quinzena1_inicio;
      const q1End = ferias.gozo_diferente && ferias.gozo_quinzena1_fim 
        ? ferias.gozo_quinzena1_fim : ferias.quinzena1_fim;
      const q2Start = ferias.gozo_diferente && ferias.gozo_quinzena2_inicio 
        ? ferias.gozo_quinzena2_inicio : ferias.quinzena2_inicio;
      const q2End = ferias.gozo_diferente && ferias.gozo_quinzena2_fim 
        ? ferias.gozo_quinzena2_fim : ferias.quinzena2_fim;
      
      return (saturdayDate >= q1Start && saturdayDate <= q1End) || (saturdayDate >= q2Start && saturdayDate <= q2End);
    });
  };

  // GLOBAL ALLOCATION ALGORITHM
  const handleGeneratePreview = () => {
    if (colaboradores.length === 0) {
      toast.error("Nenhum colaborador ativo encontrado");
      return;
    }

    setGenerating(true);
    setDiagnosticMessage(null);

    // Step 1: Determine exclusions GLOBALLY
    const exclusionReasons = new Map<string, string>();
    colaboradores.forEach(colab => {
      if (isAfastadoAnySaturday(colab.id)) {
        const motivo = getAfastamentoMotivo(colab.id);
        exclusionReasons.set(colab.id, `Afastado (${motivo})`);
      } else if (isInExperiencePeriod(colab)) {
        exclusionReasons.set(colab.id, "Período de experiência");
      } else if (hasPerda(colab.id)) {
        exclusionReasons.set(colab.id, "Perda registrada");
      } else if (hasFullMonthVacation(colab.id)) {
        exclusionReasons.set(colab.id, "Férias no mês");
      } else if (shouldSkipDueToTwoMonthVacation(colab.id)) {
        exclusionReasons.set(colab.id, "Folga no outro mês (férias dividida)");
      }
    });

    // Step 2: Build eligible collaborators
    const eligibleColabs = colaboradores.filter(c => !exclusionReasons.has(c.id));
    const colabById = new Map(colaboradores.map(c => [c.id, c]));
    const setorById = new Map(setores.map(s => [s.id, s]));

    // Step 3: Build chefes map (setor_id -> Set of colaborador_ids)
    const chefesBySetor = new Map<string, Set<string>>();
    setorChefes.forEach(sc => {
      if (!chefesBySetor.has(sc.setor_id)) {
        chefesBySetor.set(sc.setor_id, new Set());
      }
      chefesBySetor.get(sc.setor_id)!.add(sc.colaborador_id);
    });

    // Helper: get all setor IDs where a collaborator is a chefe
    const getChefeSectors = (colabId: string): string[] => {
      const sectors: string[] = [];
      for (const [setorId, chefes] of chefesBySetor) {
        if (chefes.has(colabId)) sectors.push(setorId);
      }
      return sectors;
    };

    // Build map of substitute sectors per collaborator (colabId -> Set<setorId>)
    const substituteSectorsByColab = new Map<string, Set<string>>();
    setoresSubstitutos.forEach(ss => {
      if (!ss.colaborador_id || !ss.setor_id) return;
      if (!substituteSectorsByColab.has(ss.colaborador_id)) {
        substituteSectorsByColab.set(ss.colaborador_id, new Set());
      }
      substituteSectorsByColab.get(ss.colaborador_id)!.add(ss.setor_id);
    });

    // Helper: get all sectors (titular + substitutes) for a collaborator
    const getAllSectorsForColab = (colabId: string, titularSetorId: string): string[] => {
      const set = new Set<string>();
      set.add(titularSetorId);
      const subs = substituteSectorsByColab.get(colabId);
      if (subs) subs.forEach(s => set.add(s));
      return [...set];
    };

    // Step 4: Build GLOBAL units (family pairs + singles)
    const processedIds = new Set<string>();
    const units: AllocationUnit[] = [];
    
    eligibleColabs.forEach(colab => {
      if (processedIds.has(colab.id)) return;
      
      let partnerId: string | null = colab.familiar_id;
      if (!partnerId) {
        const reversePartner = eligibleColabs.find(c => c.familiar_id === colab.id);
        if (reversePartner) partnerId = reversePartner.id;
      }
      
      const partner = partnerId ? eligibleColabs.find(c => c.id === partnerId) : null;
      
      if (partner && !processedIds.has(partner.id)) {
        const memberIds = [colab.id, partner.id];
        const availableSats = saturdaysOfMonth.filter(sat => 
          !isColabOnVacation(colab.id, sat) && !isColabOnVacation(partner.id, sat) &&
          !isColabAfastado(colab.id, sat) && !isColabAfastado(partner.id, sat)
        );
        
        units.push({
          id: `family-${colab.id}-${partner.id}`,
          memberIds,
          type: "family",
          availableSaturdays: availableSats,
          primarySetorId: colab.setor_titular_id,
          allSetorIds: [...new Set([
            ...getAllSectorsForColab(colab.id, colab.setor_titular_id),
            ...getAllSectorsForColab(partner.id, partner.setor_titular_id),
          ])],
        });
        
        processedIds.add(colab.id);
        processedIds.add(partner.id);
      } else if (!processedIds.has(colab.id)) {
        const availableSats = saturdaysOfMonth.filter(sat => !isColabOnVacation(colab.id, sat) && !isColabAfastado(colab.id, sat));
        
        units.push({
          id: `single-${colab.id}`,
          memberIds: [colab.id],
          type: "single",
          availableSaturdays: availableSats,
          primarySetorId: colab.setor_titular_id,
          allSetorIds: getAllSectorsForColab(colab.id, colab.setor_titular_id),
        });
        
        processedIds.add(colab.id);
      }
    });

    // Step 5: Classify sectors into restricted (units <= saturdays) and large (units > saturdays)
    const unitsBySetorId = new Map<string, AllocationUnit[]>();
    units.forEach(u => {
      for (const sid of u.allSetorIds) {
        if (!unitsBySetorId.has(sid)) unitsBySetorId.set(sid, []);
        unitsBySetorId.get(sid)!.push(u);
      }
    });

    const setoresRestritos: string[] = []; // sectors where unit count <= saturday count
    const setoresGrandes: string[] = [];   // sectors where unit count > saturday count
    for (const [setorId, sectorUnits] of unitsBySetorId) {
      if (sectorUnits.length <= saturdaysOfMonth.length) {
        setoresRestritos.push(setorId);
      } else {
        setoresGrandes.push(setorId);
      }
    }
    // Sort restricted sectors by fewest units first (most constrained first)
    setoresRestritos.sort((a, b) => (unitsBySetorId.get(a)?.length || 0) - (unitsBySetorId.get(b)?.length || 0));

    const unitAssignments = new Map<string, string>();
    const unitSecondAssignments = new Map<string, string>();
    const diagnostics: string[] = [];

    // Track GLOBAL person count per saturday (family pairs count as 2)
    const globalPersonCount: Record<string, number> = {};
    saturdaysOfMonth.forEach(sat => globalPersonCount[sat] = 0);

    // Track which chefes are assigned to which saturdays (setor_id -> saturday -> Set<colabId>)
    const chefeAssignments = new Map<string, Map<string, Set<string>>>();

    // Determine credit collaborators
    const creditColabIds = new Set<string>();
    availableCredits.forEach(credit => {
      if (creditsToUse.has(credit.id)) {
        creditColabIds.add(credit.colaborador_id);
      }
    });

    // Track sector-per-saturday counts
    const sectorSaturdayCount: Record<string, Record<string, number>> = {};
    for (const [setorId] of unitsBySetorId) {
      sectorSaturdayCount[setorId] = {};
      saturdaysOfMonth.forEach(sat => sectorSaturdayCount[setorId][sat] = 0);
    }

    // Helper: assign a unit to a saturday, updating all tracking structures
    const assignUnit = (unit: AllocationUnit, saturday: string) => {
      unitAssignments.set(unit.id, saturday);
      globalPersonCount[saturday] += unit.memberIds.length;
      for (const sid of unit.allSetorIds) {
        if (sectorSaturdayCount[sid]) {
          sectorSaturdayCount[sid][saturday] += 1;
        }
      }
      // Record chefe assignments
      const unitChefeSectors: string[] = [];
      unit.memberIds.forEach(mid => {
        getChefeSectors(mid).forEach(sid => {
          if (!unitChefeSectors.includes(sid)) unitChefeSectors.push(sid);
        });
      });
      for (const chefeSectorId of unitChefeSectors) {
        if (!chefeAssignments.has(chefeSectorId)) {
          chefeAssignments.set(chefeSectorId, new Map());
        }
        const sectorMap = chefeAssignments.get(chefeSectorId)!;
        if (!sectorMap.has(saturday)) {
          sectorMap.set(saturday, new Set());
        }
        unit.memberIds.forEach(mid => {
          if (getChefeSectors(mid).includes(chefeSectorId)) {
            sectorMap.get(saturday)!.add(mid);
          }
        });
      }
    };

    // Helper: check chefe conflict for a unit on a given saturday
    const hasChefeConflict = (unit: AllocationUnit, saturday: string): boolean => {
      for (const mid of unit.memberIds) {
        const sectors = getChefeSectors(mid);
        for (const sid of sectors) {
          const satChefes = chefeAssignments.get(sid)?.get(saturday);
          if (satChefes && satChefes.size > 0) {
            // Check if any existing chefe is NOT from this unit
            for (const existingId of satChefes) {
              if (!unit.memberIds.includes(existingId)) return true;
            }
          }
        }
      }
      return false;
    };

    // Helper: how many people from any of this unit's sectors are already on `sat`
    const getUnitSectorDensity = (unit: AllocationUnit, sat: string): number => {
      let total = 0;
      for (const sid of unit.allSetorIds) {
        total += sectorSaturdayCount[sid]?.[sat] || 0;
      }
      return total;
    };

    // Comparator: sector-density first, then global count, then date (stable)
    const compareCandidates = (unit: AllocationUnit) => (a: string, b: string) => {
      const da = getUnitSectorDensity(unit, a);
      const db = getUnitSectorDensity(unit, b);
      if (da !== db) return da - db;
      const ga = globalPersonCount[a];
      const gb = globalPersonCount[b];
      if (ga !== gb) return ga - gb;
      return a.localeCompare(b);
    };

    // Helper: log when a unit had to overlap with same-sector colleague
    const logStackingIfAny = (unit: AllocationUnit, sat: string) => {
      const overlapSectors: string[] = [];
      for (const sid of unit.allSetorIds) {
        // count BEFORE this unit was added (assignUnit already ran, so subtract 1)
        const cnt = (sectorSaturdayCount[sid]?.[sat] || 0) - 1;
        if (cnt > 0) {
          const setorNome = setorById.get(sid)?.nome || sid;
          overlapSectors.push(setorNome);
        }
      }
      if (overlapSectors.length > 0) {
        const nomes = unit.memberIds.map(id => colabById.get(id)?.nome).join(", ");
        const dataFmt = format(new Date(sat + "T12:00:00"), "dd/MM");
        diagnostics.push(`Empilhamento de setor (${overlapSectors.join(", ")}) em ${dataFmt} para ${nomes} — sem alternativa`);
      }
    };

    // Step 6A: Allocate restricted sectors (units <= saturdays) — 1 per saturday, spread out
    for (const setorId of setoresRestritos) {
      const sectorUnits = [...(unitsBySetorId.get(setorId) || [])];
      // Sort by restriction (fewer available saturdays first)
      sectorUnits.sort((a, b) => a.availableSaturdays.length - b.availableSaturdays.length);

      for (const unit of sectorUnits) {
        if (unitAssignments.has(unit.id)) continue;
        if (unit.availableSaturdays.length === 0) continue;

        // Get saturdays that DON'T have anyone from this sector yet
        const satsSemSetor = unit.availableSaturdays
          .filter(sat => (sectorSaturdayCount[setorId]?.[sat] || 0) === 0);

        // Sort candidates: prefer saturdays without this sector, then by sector-density + global count
        const cmp = compareCandidates(unit);
        const candidates = satsSemSetor.length > 0
          ? satsSemSetor.sort(cmp)
          : [...unit.availableSaturdays].sort(cmp);

        let assigned = false;
        for (const candidateSat of candidates) {
          if (!hasChefeConflict(unit, candidateSat)) {
            assignUnit(unit, candidateSat);
            logStackingIfAny(unit, candidateSat);
            assigned = true;
            break;
          }
        }

        // Fallback: ignore chefe conflict
        if (!assigned) {
          const bestSat = candidates[0];
          if (bestSat) {
            assignUnit(unit, bestSat);
            logStackingIfAny(unit, bestSat);
            diagnostics.push(`Conflito de chefes ignorado para ${unit.memberIds.map(id => colabById.get(id)?.nome).join(", ")}`);
          }
        }
      }
    }

    // Step 6B: Allocate large sectors (units > saturdays) — ensure coverage + balance
    for (const setorId of setoresGrandes) {
      const sectorUnits = [...(unitsBySetorId.get(setorId) || [])];
      // Sort by restriction (fewer available saturdays first)
      sectorUnits.sort((a, b) => a.availableSaturdays.length - b.availableSaturdays.length);

      for (const unit of sectorUnits) {
        if (unitAssignments.has(unit.id)) continue;
        if (unit.availableSaturdays.length === 0) continue;

        // Get saturdays that DON'T have anyone from this sector yet
        const satsSemSetor = unit.availableSaturdays
          .filter(sat => (sectorSaturdayCount[setorId]?.[sat] || 0) === 0);

        const cmp = compareCandidates(unit);
        let candidates: string[];
        if (satsSemSetor.length > 0) {
          // Prioritize uncovered saturdays, sorted by sector-density + global count
          candidates = satsSemSetor.sort(cmp);
        } else {
          // All saturdays have coverage, sort by sector-density + global count
          candidates = [...unit.availableSaturdays].sort(cmp);
        }

        let assigned = false;
        for (const candidateSat of candidates) {
          if (!hasChefeConflict(unit, candidateSat)) {
            assignUnit(unit, candidateSat);
            logStackingIfAny(unit, candidateSat);
            assigned = true;
            break;
          }
        }

        // Fallback: ignore chefe conflict
        if (!assigned) {
          const bestSat = candidates[0];
          if (bestSat) {
            assignUnit(unit, bestSat);
            logStackingIfAny(unit, bestSat);
            diagnostics.push(`Conflito de chefes ignorado para ${unit.memberIds.map(id => colabById.get(id)?.nome).join(", ")}`);
          }
        }
      }
    }

    // Step 7: REBALANCING phase - try to move units from overloaded to underloaded saturdays
    // Prefer moving singles over families
    const maxCount = Math.max(...Object.values(globalPersonCount));
    const minCount = Math.min(...Object.values(globalPersonCount));
    const totalPersons = units.reduce((sum, u) => sum + u.memberIds.length, 0);
    const idealMax = Math.ceil(totalPersons / saturdaysOfMonth.length);
    
    if (maxCount - minCount > 2) {
      const overloaded = saturdaysOfMonth.filter(s => globalPersonCount[s] > idealMax);
      const underloaded = saturdaysOfMonth.filter(s => globalPersonCount[s] < idealMax);

      for (const underSat of underloaded) {
        for (const overSat of overloaded) {
          if (globalPersonCount[overSat] <= idealMax) break;
          if (globalPersonCount[underSat] >= idealMax) break;

          // Find movable units from overSat, preferring singles
          const movableUnits = units
            .filter(u => {
              if (unitAssignments.get(u.id) !== overSat) return false;
              if (!u.availableSaturdays.includes(underSat)) return false;
              if (hasChefeConflict(u, underSat)) return false;
              // Don't move if destination already has someone from any of the unit's sectors,
              // UNLESS the source already has duplicate of the same sector (move would reduce stacking)
              for (const sid of u.allSetorIds) {
                const destCount = sectorSaturdayCount[sid]?.[underSat] || 0;
                const srcCount = sectorSaturdayCount[sid]?.[overSat] || 0;
                if (destCount > 0 && srcCount <= 1) return false;
              }
              return true;
            })
            .sort((a, b) => (a.type === "single" ? -1 : 1) - (b.type === "single" ? -1 : 1));

          const movableUnit = movableUnits[0];
          if (movableUnit) {
            // Move unit
            unitAssignments.set(movableUnit.id, underSat);
            globalPersonCount[overSat] -= movableUnit.memberIds.length;
            globalPersonCount[underSat] += movableUnit.memberIds.length;
            for (const sid of movableUnit.allSetorIds) {
              if (sectorSaturdayCount[sid]) {
                sectorSaturdayCount[sid][overSat] -= 1;
                sectorSaturdayCount[sid][underSat] += 1;
              }
            }
            
            // Update chefe assignments
            const unitChefeSectors: string[] = [];
            movableUnit.memberIds.forEach(mid => {
              getChefeSectors(mid).forEach(sid => {
                if (!unitChefeSectors.includes(sid)) unitChefeSectors.push(sid);
              });
            });
            for (const chefeSectorId of unitChefeSectors) {
              chefeAssignments.get(chefeSectorId)?.get(overSat)?.clear();
              if (!chefeAssignments.get(chefeSectorId)?.has(underSat)) {
                chefeAssignments.get(chefeSectorId)!.set(underSat, new Set());
              }
              movableUnit.memberIds.forEach(mid => {
                if (getChefeSectors(mid).includes(chefeSectorId)) {
                  chefeAssignments.get(chefeSectorId)!.get(underSat)!.add(mid);
                }
              });
            }
          }
        }
      }
    }

    // Step 8: Assign SECOND saturday to units with credits
    for (const unit of units) {
      const hasCredit = unit.memberIds.some(id => creditColabIds.has(id));
      if (!hasCredit) continue;
      
      const firstSat = unitAssignments.get(unit.id);
      if (!firstSat) continue;
      
      const availableForSecond = unit.availableSaturdays
        .filter(s => s !== firstSat)
        .sort(compareCandidates(unit));
      
      if (availableForSecond.length > 0) {
        unitSecondAssignments.set(unit.id, availableForSecond[0]);
        globalPersonCount[availableForSecond[0]] += unit.memberIds.length;
      }
    }

    // Set diagnostic message
    if (diagnostics.length > 0) {
      setDiagnosticMessage(`Alertas: ${diagnostics.join("; ")}`);
    }

    // Add distribution summary to diagnostics
    const distSummary = saturdaysOfMonth.map(sat => 
      `${format(new Date(sat + "T12:00:00"), "dd/MM")}: ${globalPersonCount[sat]} pessoas`
    ).join(" | ");
    setDiagnosticMessage(prev => {
      const base = prev ? prev + " — " : "";
      return base + `Distribuição: ${distSummary}`;
    });

    // Build preview rows
    const allPreview: PreviewRow[] = [];
    
    for (const [unitId, saturday] of unitAssignments) {
      const unit = units.find(u => u.id === unitId)!;
      
      for (const memberId of unit.memberIds) {
        const colab = colabById.get(memberId)!;
        const setor = setorById.get(colab.setor_titular_id);
        
        allPreview.push({
          setor_id: colab.setor_titular_id,
          setor_nome: setor?.nome || "Setor não encontrado",
          colaborador_id: colab.id,
          colaborador_nome: colab.nome,
          data_sabado: saturday,
          is_familiar_match: unit.type === "family",
        });
      }
    }

    // Add second assignments (credit-based)
    for (const [unitId, saturday] of unitSecondAssignments) {
      const unit = units.find(u => u.id === unitId)!;
      
      for (const memberId of unit.memberIds) {
        const colab = colabById.get(memberId)!;
        const setor = setorById.get(colab.setor_titular_id);
        
        allPreview.push({
          setor_id: colab.setor_titular_id,
          setor_nome: setor?.nome || "Setor não encontrado",
          colaborador_id: colab.id,
          colaborador_nome: colab.nome,
          data_sabado: saturday,
          is_familiar_match: unit.type === "family",
        });
      }
    }

    // Add units that couldn't be assigned
    for (const unit of units) {
      if (!unitAssignments.has(unit.id)) {
        for (const memberId of unit.memberIds) {
          const colab = colabById.get(memberId)!;
          const setor = setorById.get(colab.setor_titular_id);
          
          allPreview.push({
            setor_id: colab.setor_titular_id,
            setor_nome: setor?.nome || "Setor não encontrado",
            colaborador_id: colab.id,
            colaborador_nome: colab.nome,
            data_sabado: "",
            is_familiar_match: unit.type === "family",
            motivo_exclusao: "Sem sábado disponível (férias)",
          });
        }
      }
    }

    // Add excluded collaborators
    colaboradores.forEach(colab => {
      if (exclusionReasons.has(colab.id)) {
        const setor = setorById.get(colab.setor_titular_id);
        allPreview.push({
          setor_id: colab.setor_titular_id,
          setor_nome: setor?.nome || "Setor não encontrado",
          colaborador_id: colab.id,
          colaborador_nome: colab.nome,
          data_sabado: "",
          is_familiar_match: false,
          motivo_exclusao: exclusionReasons.get(colab.id),
        });
      }
    });

    setPreviewData(allPreview);
    
    const validKeys = allPreview
      .filter(p => !p.motivo_exclusao && p.data_sabado)
      .map(p => `${p.setor_id}-${p.colaborador_id}-${p.data_sabado}`);
    setSelectedRows(new Set(validKeys));
    
    setShowPreview(true);
    setGenerating(false);
  };

  // Group preview by setor
  const previewBySetor = useMemo(() => {
    const groups: Record<string, { setor: Setor; rows: PreviewRow[] }> = {};
    
    previewData.forEach(row => {
      if (!groups[row.setor_id]) {
        groups[row.setor_id] = {
          setor: { id: row.setor_id, nome: row.setor_nome, unidade_id: null },
          rows: []
        };
      }
      groups[row.setor_id].rows.push(row);
    });

    return Object.values(groups).sort((a, b) => a.setor.nome.localeCompare(b.setor.nome));
  }, [previewData]);

  // Handle row toggle with family coupling
  const toggleRow = (key: string, row: PreviewRow) => {
    const newSet = new Set(selectedRows);
    const isSelected = newSet.has(key);
    
    if (row.is_familiar_match) {
      // Find partner row with same saturday
      const partnerRow = previewData.find(p => 
        p.is_familiar_match && 
        p.data_sabado === row.data_sabado && 
        p.colaborador_id !== row.colaborador_id
      );
      
      const partnerKey = partnerRow ? `${partnerRow.setor_id}-${partnerRow.colaborador_id}-${partnerRow.data_sabado}` : null;
      
      if (isSelected) {
        newSet.delete(key);
        if (partnerKey) newSet.delete(partnerKey);
      } else {
        newSet.add(key);
        if (partnerKey) newSet.add(partnerKey);
      }
    } else {
      if (isSelected) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
    }
    
    setSelectedRows(newSet);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedData = previewData.filter(p => 
        !p.motivo_exclusao && p.data_sabado && selectedRows.has(`${p.setor_id}-${p.colaborador_id}-${p.data_sabado}`)
      );

      if (selectedData.length === 0) {
        throw new Error("Nenhuma folga selecionada para salvar");
      }

      // Group by setor
      const bySetor = new Map<string, PreviewRow[]>();
      selectedData.forEach(row => {
        if (!bySetor.has(row.setor_id)) {
          bySetor.set(row.setor_id, []);
        }
        bySetor.get(row.setor_id)!.push(row);
      });

      let totalInserted = 0;

      for (const [setorId, rows] of bySetor) {
        // Check if escala exists
        const { data: existingEscala } = await supabase
          .from("ferias_folgas_escala")
          .select("id")
          .eq("ano", year)
          .eq("mes", month)
          .eq("setor_id", setorId)
          .maybeSingle();
        
        let escalaId = existingEscala?.id;
        
        if (!escalaId) {
          const { data: newEscala, error: escalaError } = await supabase
            .from("ferias_folgas_escala")
            .insert({ ano: year, mes: month, setor_id: setorId, status: "rascunho" })
            .select("id")
            .single();
          if (escalaError) throw escalaError;
          escalaId = newEscala.id;
        }

        // Delete existing folgas for this escala
        await supabase
          .from("ferias_folgas")
          .delete()
          .eq("escala_id", escalaId);

        // Insert folgas
        const toInsert = rows.map(p => ({
          colaborador_id: p.colaborador_id,
          data_sabado: p.data_sabado,
          escala_id: escalaId,
          is_excecao: false,
        }));

        const { error: insertError } = await supabase
          .from("ferias_folgas")
          .insert(toInsert);
        if (insertError) throw insertError;

        totalInserted += toInsert.length;
      }

      // Mark credits as used
      if (creditsToUse.size > 0) {
        const monthLabel = format(new Date(year, month - 1), "MMMM yyyy", { locale: ptBR });
        for (const creditId of creditsToUse) {
          await supabase
            .from("ferias_folgas_creditos")
            .update({
              status: "utilizado",
              utilizado_em: new Date().toISOString().split("T")[0],
              utilizado_referencia: `Folga extra - ${monthLabel}`,
            })
            .eq("id", creditId);
        }
      }

      return { count: totalInserted, setoresCount: bySetor.size };
    },
    onSuccess: (data) => {
      toast.success(`Escala gerada com ${data.count} folgas em ${data.setoresCount} setores!`);
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-table"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-pdf"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-escalas"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-folgas-creditos"] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao salvar escala");
    },
  });

  const handleClose = () => {
    setPreviewData([]);
    setShowPreview(false);
    setSelectedRows(new Set());
    setCreditsToUse(new Set());
    setSelectedSaturdays(new Set());
    setDiagnosticMessage(null);
    onOpenChange(false);
  };

  const toggleAllSetor = (setorId: string, rows: PreviewRow[]) => {
    const newSet = new Set(selectedRows);
    const setorKeys = rows.filter(r => !r.motivo_exclusao && r.data_sabado).map(r => `${r.setor_id}-${r.colaborador_id}-${r.data_sabado}`);
    const allSelected = setorKeys.every(k => newSet.has(k));
    
    if (allSelected) {
      setorKeys.forEach(k => newSet.delete(k));
    } else {
      setorKeys.forEach(k => newSet.add(k));
    }
    setSelectedRows(newSet);
  };

  const toggleAll = () => {
    const allKeys = previewData.filter(p => !p.motivo_exclusao && p.data_sabado).map(p => `${p.setor_id}-${p.colaborador_id}-${p.data_sabado}`);
    if (selectedRows.size === allKeys.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(allKeys));
    }
  };

  const assignedRows = previewData.filter(p => !p.motivo_exclusao && p.data_sabado);
  const excludedRows = previewData.filter(p => p.motivo_exclusao);
  const setoresComDados = previewBySetor.filter(g => g.rows.some(r => !r.motivo_exclusao && r.data_sabado));
  const familiarMatches = assignedRows.filter(r => r.is_familiar_match).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Gerar Escala de Folgas - Todos os Setores
          </DialogTitle>
          <DialogDescription>
            {format(new Date(year, month - 1), "MMMM yyyy", { locale: ptBR })} - {saturdaysOfMonth.length} sábados
          </DialogDescription>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4" />
                {setores.length} setores ativos
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                {colaboradores.length} colaboradores ativos
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4" />
                {saturdaysOfMonth.length} de {allSaturdaysOfMonth.length} sábados selecionados
              </div>


              <div className="border-t pt-3 mt-3">
                <p className="text-xs font-medium mb-2">Regras aplicadas:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• {configMap.FOLGAS_POR_MES} folga(s) por colaborador/mês</li>
                  <li>• Período de experiência: {configMap.FOLGAS_PERIODO_EXPERIENCIA} dias</li>
                  {configMap.FOLGAS_BLOQUEAR_MES_FERIAS && <li>• Sem folga em mês com férias</li>}
                  {configMap.FOLGAS_FERIAS_DOIS_MESES && <li>• Férias em 2 meses: folga no mês com menos dias</li>}
                  <li className="font-medium text-primary">• Familiares SEMPRE folgam juntos (obrigatório)</li>
                  <li className="font-medium text-primary">• Distribuição GLOBAL equilibrada entre sábados</li>
                  <li className="font-medium text-primary">• Chefes do mesmo setor não folgam juntos</li>
                  {configMap.FOLGAS_DISTRIBUICAO_JUSTA && <li>• Distribuição equilibrada dentro de cada setor</li>}
                  <li>• <strong>Perda de folga</strong>: bloqueia o mês inteiro (usar quando atestado cobre sábado)</li>
                  <li>• <strong>Afastamento</strong>: remove apenas os sábados específicos da disponibilidade</li>
                </ul>
              </div>
            </div>

            {/* Saturday selector */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Selecionar sábados para distribuição</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedSaturdays(new Set(allSaturdaysOfMonth))}>
                    Todos
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedSaturdays(new Set())}>
                    Nenhum
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Desmarque sábados com feriados ou que não devem ter folga distribuída.
              </p>
              <div className="flex flex-wrap gap-2">
                {allSaturdaysOfMonth.map(sat => (
                  <label key={sat} className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors",
                    selectedSaturdays.has(sat) ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-border opacity-60"
                  )}>
                    <Checkbox
                      checked={selectedSaturdays.has(sat)}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedSaturdays);
                        if (checked) newSet.add(sat); else newSet.delete(sat);
                        setSelectedSaturdays(newSet);
                      }}
                    />
                    <span className="text-sm font-medium">
                      {format(new Date(sat + "T12:00:00"), "dd/MM", { locale: ptBR })}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Credits section */}
            {availableCredits.length > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                  <Gift className="h-4 w-4" />
                  Créditos de Folga Disponíveis
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Os colaboradores abaixo possuem créditos de folga. Marque para usar neste mês (folgará 2 sábados).
                </p>
                <div className="space-y-2">
                  {availableCredits.map((credit: any) => {
                    const colabName = credit.ferias_colaboradores?.nome || "—";
                    const origemDate = format(new Date(credit.origem_data + "T12:00:00"), "dd/MM/yyyy");
                    return (
                      <div key={credit.id} className="flex items-center gap-3 p-2 bg-background rounded border">
                        <Checkbox
                          checked={creditsToUse.has(credit.id)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(creditsToUse);
                            if (checked) {
                              newSet.add(credit.id);
                            } else {
                              newSet.delete(credit.id);
                            }
                            setCreditsToUse(newSet);
                          }}
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium">{colabName}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            (Origem: {origemDate} — {credit.justificativa})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleGeneratePreview} disabled={generating || colaboradores.length === 0}>
                {generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Gerar Preview
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {diagnosticMessage && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{diagnosticMessage}</span>
              </div>
            )}
            
            <div className="flex items-center gap-4 flex-wrap">
              <Badge variant="secondary" className="gap-1">
                <Building2 className="h-3 w-3" />
                {setoresComDados.length} setores
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {assignedRows.length} alocações
              </Badge>
              {familiarMatches > 0 && (
                <Badge className="gap-1 bg-sky-100 text-sky-800 border-sky-300">
                  {familiarMatches / 2} pares familiares
                </Badge>
              )}
              {excludedRows.length > 0 && (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" />
                  {excludedRows.length} excluídos
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedRows.size === assignedRows.length && assignedRows.length > 0}
                  onChange={toggleAll}
                  id="selectAll"
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="selectAll" className="text-sm cursor-pointer">Selecionar todos</label>
              </div>
            </div>

            <ScrollArea className="h-[400px] rounded-md border">
              <Accordion type="multiple" defaultValue={setoresComDados.map(g => g.setor.id)} className="w-full">
                {previewBySetor.map(group => {
                  const setorAssigned = group.rows.filter(r => !r.motivo_exclusao && r.data_sabado);
                  const setorExcluded = group.rows.filter(r => r.motivo_exclusao || !r.data_sabado);
                  const setorKeys = setorAssigned.map(r => `${r.setor_id}-${r.colaborador_id}-${r.data_sabado}`);
                  const allSetorSelected = setorKeys.length > 0 && setorKeys.every(k => selectedRows.has(k));

                  return (
                    <AccordionItem key={group.setor.id} value={group.setor.id}>
                      <AccordionTrigger className="px-4 hover:no-underline">
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={allSetorSelected}
                            onChange={() => toggleAllSetor(group.setor.id, group.rows)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-input"
                          />
                          <span className="font-medium">{group.setor.nome}</span>
                          <Badge variant="secondary" className="ml-auto mr-2">
                            {setorAssigned.length} folgas
                          </Badge>
                          {setorExcluded.length > 0 && (
                            <Badge variant="outline" className="text-muted-foreground">
                              {setorExcluded.length} excluídos
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]"></TableHead>
                              <TableHead>Colaborador</TableHead>
                              <TableHead>Sábado</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {setorAssigned.map((row, idx) => {
                              const key = `${row.setor_id}-${row.colaborador_id}-${row.data_sabado}`;
                              return (
                                <TableRow key={idx}>
                                  <TableCell>
                                    <input
                                      type="checkbox"
                                      checked={selectedRows.has(key)}
                                      onChange={() => toggleRow(key, row)}
                                      className="h-4 w-4 rounded border-input"
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">{row.colaborador_nome}</TableCell>
                                  <TableCell>
                                    {format(new Date(row.data_sabado + "T12:00:00"), "dd/MM (EEEE)", { locale: ptBR })}
                                  </TableCell>
                                  <TableCell>
                                    {row.is_familiar_match ? (
                                      <Badge className="bg-sky-100 text-sky-800 border-sky-300">
                                        Par Familiar
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline">Individual</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {setorExcluded.map((row, idx) => (
                              <TableRow key={`exc-${idx}`} className="bg-muted/30">
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    disabled
                                    className="h-4 w-4 rounded border-input opacity-50"
                                  />
                                </TableCell>
                                <TableCell className="text-muted-foreground">{row.colaborador_nome}</TableCell>
                                <TableCell className="text-muted-foreground">-</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-muted-foreground">
                                    {row.motivo_exclusao}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>Voltar</Button>
              <Button 
                onClick={() => saveMutation.mutate()} 
                disabled={selectedRows.size === 0 || saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar {selectedRows.size} Folgas
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
