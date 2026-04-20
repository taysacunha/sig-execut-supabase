import { supabase } from "@/integrations/supabase/client";
import { addDays, parseISO, format } from "date-fns";

export interface FormularioAnual {
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
  observacao: string | null;
  data_inicio_preferencia: string | null;
  status: string | null;
  colaborador?: {
    id: string;
    nome: string;
    familiar_id: string | null;
    setor_titular_id: string;
    data_admissao: string;
    setor_titular?: { id: string; nome: string; } | null;
  } | null;
}

export interface GeneratedVacation {
  colaborador_id: string;
  colaborador_nome: string;
  setor_nome: string;
  quinzena1_inicio: string;
  quinzena1_fim: string;
  quinzena2_inicio: string;
  quinzena2_fim: string;
  vender_dias: boolean;
  dias_vendidos: number;
  quinzena_venda: number;
  is_excecao: boolean;
  excecao_motivo: string | null;
  conflicts: ConflictInfo[];
  familiar_match: boolean;
  origem: string;
}

export interface ConflictInfo {
  tipo: "setor" | "familiar" | "substituto" | "mes_bloqueado";
  descricao: string;
  colaborador_nome?: string;
}

export interface GenerationResult {
  success: GeneratedVacation[];
  conflicts: GeneratedVacation[];
  unprocessed: { colaborador_nome: string; motivo: string }[];
}

interface CandidateWindow {
  start: string;
  end: string;
}

// Generate candidate 15-day windows for a month, including cross-month windows
function generateCandidateWindows(ano: number, mes: number): CandidateWindow[] {
  const startDays = [1, 8, 16, 23];
  return startDays.map(day => {
    const start = new Date(ano, mes - 1, day);
    const end = addDays(start, 14);
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    };
  });
}

// Generate a single window from a specific date
function generateWindowFromDate(dateStr: string): CandidateWindow {
  const start = parseISO(dateStr);
  const end = addDays(start, 14);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  };
}

// Fetch forms for the year
export async function fetchForms(ano: number): Promise<FormularioAnual[]> {
  const { data, error } = await supabase
    .from("ferias_formulario_anual")
    .select(`
      *,
      colaborador:ferias_colaboradores!colaborador_id (
        id, nome, familiar_id, setor_titular_id, data_admissao,
        setor_titular:ferias_setores!setor_titular_id (id, nome)
      )
    `)
    .eq("ano_referencia", ano);

  if (error) throw error;
  return data || [];
}

// Fetch existing vacations for the year
export async function fetchExistingVacations(ano: number): Promise<any[]> {
  const { data, error } = await supabase
    .from("ferias_ferias")
    .select(`*, colaborador:ferias_colaboradores!colaborador_id (id, nome, setor_titular_id)`)
    .gte("quinzena1_inicio", `${ano}-01-01`)
    .lte("quinzena1_inicio", `${ano}-12-31`)
    .in("status", ["aprovada", "em_gozo"]);

  if (error) throw error;
  return data || [];
}

// Fetch configuration rules
export async function fetchRules(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("ferias_configuracoes").select("chave, valor");
  if (error) throw error;
  const rules: Record<string, string> = {};
  (data || []).forEach(item => { rules[item.chave] = item.valor; });
  return rules;
}

// Fetch substitute sectors for collaborators (returns both directions)
async function fetchSubstituteSectors(): Promise<{
  colabToSectors: Record<string, string[]>;
  sectorToColabs: Record<string, string[]>;
}> {
  const { data, error } = await supabase
    .from("ferias_colaborador_setores_substitutos")
    .select("colaborador_id, setor_id");
  if (error) throw error;
  const colabToSectors: Record<string, string[]> = {};
  const sectorToColabs: Record<string, string[]> = {};
  (data || []).forEach(item => {
    if (item.colaborador_id && item.setor_id) {
      if (!colabToSectors[item.colaborador_id]) colabToSectors[item.colaborador_id] = [];
      colabToSectors[item.colaborador_id].push(item.setor_id);
      if (!sectorToColabs[item.setor_id]) sectorToColabs[item.setor_id] = [];
      sectorToColabs[item.setor_id].push(item.colaborador_id);
    }
  });
  return { colabToSectors, sectorToColabs };
}

// Check if two date ranges overlap
function datesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
  return start1 <= end2 && end1 >= start2;
}

// Get ordered month choices from form (preferred first)
function getOrderedMonths(form: FormularioAnual): number[] {
  const months: { mes: number; priority: number }[] = [];
  if (form.periodo1_mes) months.push({ mes: form.periodo1_mes, priority: form.periodo_preferencia === 1 ? 0 : 1 });
  if (form.periodo2_mes) months.push({ mes: form.periodo2_mes, priority: form.periodo_preferencia === 2 ? 0 : 2 });
  if (form.periodo3_mes) months.push({ mes: form.periodo3_mes, priority: form.periodo_preferencia === 3 ? 0 : 3 });
  months.sort((a, b) => a.priority - b.priority);
  return months.map(m => m.mes);
}

// Get the preferred month from the form
function getPreferredMonth(form: FormularioAnual): number | null {
  if (form.periodo_preferencia === 1) return form.periodo1_mes;
  if (form.periodo_preferencia === 2) return form.periodo2_mes;
  if (form.periodo_preferencia === 3) return form.periodo3_mes;
  return form.periodo1_mes;
}

// Check if a window conflicts with allocated/existing vacations for relevant sectors
function checkWindowConflicts(
  window: CandidateWindow,
  setorId: string,
  substituteSectorIds: string[],
  colaboradorId: string,
  allocatedVacations: GeneratedVacation[],
  existingVacations: any[],
  forms: FormularioAnual[],
  sectorToColabs: Record<string, string[]>,
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  const wStart = parseISO(window.start);
  const wEnd = parseISO(window.end);
  // Symmetric rule:
  // (a) same titular sector, (b) I cover their titular sector, (c) they cover my titular sector
  const titularSectorsToMatch = new Set<string>([setorId, ...substituteSectorIds]);
  const colabsThatCoverMe = new Set<string>(sectorToColabs[setorId] || []);

  // Check allocated vacations
  for (const alloc of allocatedVacations) {
    const allocSetorId = forms.find(f => f.colaborador_id === alloc.colaborador_id)?.colaborador?.setor_titular_id;
    const matches =
      (allocSetorId && titularSectorsToMatch.has(allocSetorId)) ||
      colabsThatCoverMe.has(alloc.colaborador_id);
    if (!matches) continue;

    const aQ1S = parseISO(alloc.quinzena1_inicio), aQ1E = parseISO(alloc.quinzena1_fim);
    const aQ2S = alloc.quinzena2_inicio ? parseISO(alloc.quinzena2_inicio) : null;
    const aQ2E = alloc.quinzena2_fim ? parseISO(alloc.quinzena2_fim) : null;

    let hasOverlap = datesOverlap(wStart, wEnd, aQ1S, aQ1E);
    if (aQ2S && aQ2E) {
      hasOverlap = hasOverlap || datesOverlap(wStart, wEnd, aQ2S, aQ2E);
    }
    if (hasOverlap) {
      conflicts.push({
        tipo: allocSetorId !== setorId ? "substituto" : "setor",
        descricao: `Conflito com ${alloc.colaborador_nome}`,
        colaborador_nome: alloc.colaborador_nome,
      });
    }
  }

  // Check existing DB vacations
  for (const existing of existingVacations) {
    if (existing.colaborador_id === colaboradorId) continue;
    const existSetorId = existing.colaborador?.setor_titular_id;
    const matches =
      (existSetorId && titularSectorsToMatch.has(existSetorId)) ||
      colabsThatCoverMe.has(existing.colaborador_id);
    if (!matches) continue;

    const eQ1S = parseISO(existing.quinzena1_inicio), eQ1E = parseISO(existing.quinzena1_fim);
    const eQ2S = existing.quinzena2_inicio ? parseISO(existing.quinzena2_inicio) : null;
    const eQ2E = existing.quinzena2_fim ? parseISO(existing.quinzena2_fim) : null;

    let hasOverlap = datesOverlap(wStart, wEnd, eQ1S, eQ1E);
    if (eQ2S && eQ2E) {
      hasOverlap = hasOverlap || datesOverlap(wStart, wEnd, eQ2S, eQ2E);
    }

    if (hasOverlap) {
      conflicts.push({
        tipo: existSetorId !== setorId ? "substituto" : "setor",
        descricao: `Conflito com ${existing.colaborador?.nome || 'colaborador'} (já cadastrado)`,
        colaborador_nome: existing.colaborador?.nome,
      });
    }
  }

  return conflicts;
}

// Generate vacations from forms
export async function generateVacations(
  ano: number,
  setorFilter?: string
): Promise<GenerationResult> {
  const result: GenerationResult = { success: [], conflicts: [], unprocessed: [] };

  const [forms, existingVacations, rules, substituteData] = await Promise.all([
    fetchForms(ano),
    fetchExistingVacations(ano),
    fetchRules(),
    fetchSubstituteSectors(),
  ]);
  const substituteSectors = substituteData.colabToSectors;
  const sectorToColabs = substituteData.sectorToColabs;

  // Filter by setor if provided
  const filteredForms = setorFilter && setorFilter !== "all"
    ? forms.filter(f => f.colaborador?.setor_titular_id === setorFilter)
    : forms;

  // Track allocated vacations during generation
  const allocatedVacations: GeneratedVacation[] = [];

  // Sort: preference first, then familiars
  const sortedForms = [...filteredForms].sort((a, b) => {
    const prefA = a.periodo_preferencia ? 1 : 0;
    const prefB = b.periodo_preferencia ? 1 : 0;
    if (prefB !== prefA) return prefB - prefA;
    const famA = a.colaborador?.familiar_id ? 1 : 0;
    const famB = b.colaborador?.familiar_id ? 1 : 0;
    return famB - famA;
  });

  for (const form of sortedForms) {
    if (!form.colaborador) {
      result.unprocessed.push({ colaborador_nome: "Desconhecido", motivo: "Colaborador não encontrado" });
      continue;
    }

    // Check if already has vacation
    const existingForColab = existingVacations.filter(v => v.colaborador_id === form.colaborador_id);
    const hasComplete = existingForColab.some(v => v.quinzena2_inicio != null);
    const hasPendingQ2 = existingForColab.some(v => v.quinzena2_inicio == null);
    if (hasComplete) {
      result.unprocessed.push({ colaborador_nome: form.colaborador.nome, motivo: "Já possui férias completas cadastradas para este ano" });
      continue;
    }
    if (hasPendingQ2) {
      result.unprocessed.push({ colaborador_nome: form.colaborador.nome, motivo: "Possui férias com 2º período pendente — defina antes de gerar novas" });
      continue;
    }

    const orderedMonths = getOrderedMonths(form);
    if (orderedMonths.length === 0) {
      result.unprocessed.push({ colaborador_nome: form.colaborador.nome, motivo: "Formulário sem meses preenchidos" });
      continue;
    }

    const setorId = form.colaborador.setor_titular_id;
    const subSectors = substituteSectors[form.colaborador_id] || [];
    const preferredMonth = getPreferredMonth(form);
    let allocated = false;

    // Generate candidate windows for the preferred month
    for (const chosenMonth of orderedMonths) {
      let candidateWindows: CandidateWindow[];

      // If this is the preferred month and there's a specific start date, use it
      if (chosenMonth === preferredMonth && form.data_inicio_preferencia) {
        candidateWindows = [generateWindowFromDate(form.data_inicio_preferencia)];
        // Also add fallback windows in case the specific date has conflicts
        candidateWindows.push(...generateCandidateWindows(ano, chosenMonth));
      } else {
        candidateWindows = generateCandidateWindows(ano, chosenMonth);
      }

      // Find best window for first period
      let bestQ1: CandidateWindow | null = null;
      let bestQ1Conflicts: ConflictInfo[] = [];

      for (const window of candidateWindows) {
        const windowConflicts = checkWindowConflicts(window, setorId, subSectors, form.colaborador_id, allocatedVacations, existingVacations, forms, sectorToColabs);
        if (windowConflicts.length === 0) {
          bestQ1 = window;
          bestQ1Conflicts = [];
          break;
        }
        if (!bestQ1 || windowConflicts.length < bestQ1Conflicts.length) {
          bestQ1 = window;
          bestQ1Conflicts = windowConflicts;
        }
      }

      if (!bestQ1) continue;

      // Find best window for second period (different month if available)
      let secondMonth = orderedMonths.find(m => m !== chosenMonth);
      let bestQ2: CandidateWindow;
      let q2Conflicts: ConflictInfo[] = [];

      if (secondMonth) {
        const q2Windows = generateCandidateWindows(ano, secondMonth);
        bestQ2 = q2Windows[0];
        q2Conflicts = [];

        for (const window of q2Windows) {
          const windowConflicts = checkWindowConflicts(window, setorId, subSectors, form.colaborador_id, allocatedVacations, existingVacations, forms, sectorToColabs);
          if (windowConflicts.length === 0) {
            bestQ2 = window;
            q2Conflicts = [];
            break;
          }
          if (windowConflicts.length < q2Conflicts.length || q2Conflicts.length === 0) {
            bestQ2 = window;
            q2Conflicts = windowConflicts;
          }
        }
      } else {
        // Only one month: use second half windows
        const allWindows = generateCandidateWindows(ano, chosenMonth);
        // Pick a window that doesn't overlap with Q1
        bestQ2 = allWindows[allWindows.length - 1]; // Default to last window
        for (const window of allWindows) {
          const wStart = parseISO(window.start), wEnd = parseISO(window.end);
          const q1Start = parseISO(bestQ1.start), q1End = parseISO(bestQ1.end);
          if (!datesOverlap(wStart, wEnd, q1Start, q1End)) {
            const windowConflicts = checkWindowConflicts(window, setorId, subSectors, form.colaborador_id, allocatedVacations, existingVacations, forms, sectorToColabs);
            if (windowConflicts.length === 0) {
              bestQ2 = window;
              q2Conflicts = [];
              break;
            }
          }
        }
      }

      const allConflicts = [...bestQ1Conflicts, ...q2Conflicts];

      // Check Jan/Dec block
      const q1Month = parseISO(bestQ1.start).getMonth() + 1;
      const q2Month = parseISO(bestQ2.start).getMonth() + 1;
      if ((q1Month === 1 || q1Month === 12 || q2Month === 1 || q2Month === 12) && rules["BLOQUEAR_JAN_DEZ"] === "true") {
        allConflicts.push({ tipo: "mes_bloqueado", descricao: "Férias em janeiro ou dezembro requerem exceção" });
      }

      // Family alignment check
      let familiarMatch = false;
      if (form.colaborador.familiar_id) {
        const familiarVacation = allocatedVacations.find(v => v.colaborador_id === form.colaborador!.familiar_id);
        if (familiarVacation) {
          familiarMatch = datesOverlap(
            parseISO(bestQ1.start), parseISO(bestQ1.end),
            parseISO(familiarVacation.quinzena1_inicio), parseISO(familiarVacation.quinzena1_fim)
          );
          if (!familiarMatch) {
            allConflicts.push({ tipo: "familiar", descricao: `Período diferente do familiar ${familiarVacation.colaborador_nome}`, colaborador_nome: familiarVacation.colaborador_nome });
          }
        }
      }

      const hasSectorConflict = allConflicts.some(c => c.tipo === "setor" || c.tipo === "substituto");

      const vacation: GeneratedVacation = {
        colaborador_id: form.colaborador_id,
        colaborador_nome: form.colaborador.nome,
        setor_nome: form.colaborador.setor_titular?.nome || "",
        quinzena1_inicio: bestQ1.start,
        quinzena1_fim: bestQ1.end,
        quinzena2_inicio: bestQ2.start,
        quinzena2_fim: bestQ2.end,
        vender_dias: form.vender_dias || false,
        dias_vendidos: form.dias_vender || 0,
        quinzena_venda: 2,
        is_excecao: allConflicts.some(c => c.tipo === "mes_bloqueado") || (form.dias_vender != null && form.dias_vender > 10),
        excecao_motivo: allConflicts.some(c => c.tipo === "mes_bloqueado") ? "mes_bloqueado" : (form.dias_vender != null && form.dias_vender > 10 ? "venda_acima_limite" : null),
        conflicts: allConflicts,
        familiar_match: familiarMatch,
        origem: "formulario_anual",
      };

      if (!hasSectorConflict) {
        result.success.push(vacation);
      } else {
        result.conflicts.push(vacation);
      }
      allocatedVacations.push(vacation);
      allocated = true;
      break;
    }

    if (!allocated) {
      result.unprocessed.push({ colaborador_nome: form.colaborador.nome, motivo: "Nenhum mês disponível sem conflitos" });
    }
  }

  return result;
}

// Save generated vacations to database
export async function saveGeneratedVacations(
  vacations: GeneratedVacation[],
  forceExceptions: boolean = false
): Promise<{ saved: number; errors: string[] }> {
  const errors: string[] = [];
  let saved = 0;

  for (const vacation of vacations) {
    try {
      const { error } = await supabase.from("ferias_ferias").insert({
        colaborador_id: vacation.colaborador_id,
        quinzena1_inicio: vacation.quinzena1_inicio,
        quinzena1_fim: vacation.quinzena1_fim,
        quinzena2_inicio: vacation.quinzena2_inicio,
        quinzena2_fim: vacation.quinzena2_fim,
        gozo_diferente: false,
        vender_dias: vacation.vender_dias,
        dias_vendidos: vacation.dias_vendidos || null,
        quinzena_venda: vacation.vender_dias ? vacation.quinzena_venda : null,
        status: "aprovada",
        is_excecao: vacation.is_excecao || (forceExceptions && vacation.conflicts.length > 0),
        excecao_motivo: vacation.excecao_motivo,
        excecao_justificativa: vacation.conflicts.length > 0
          ? `Gerado automaticamente com conflitos: ${vacation.conflicts.map(c => c.descricao).join("; ")}`
          : null,
        origem: vacation.origem,
      });

      if (error) throw error;
      saved++;
    } catch (err: any) {
      errors.push(`${vacation.colaborador_nome}: ${err.message}`);
    }
  }

  return { saved, errors };
}
