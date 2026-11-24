import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { getConcessivoInfo } from "@/lib/feriasConcessivo";
import type { GeneratedVacation, GenerationContext } from "@/lib/vacationGenerator";

export interface JanelaSugerida {
  inicio: string;
  fim: string;
  /** Deslocamento em dias em relação à data atual do período */
  deslocamento: number;
}

export interface SugestaoMover {
  /** Colaborador cujo período será mantido */
  manterId: string;
  manterNome: string;
  /** Colaborador cujo período será movido */
  moverId: string;
  moverNome: string;
  moverPeriodo: 1 | 2;
  atualInicio: string;
  atualFim: string;
  opcoes: JanelaSugerida[];
  /** Motivo quando não há sugestão (já cadastrado, sem janela livre etc.) */
  bloqueio?: string;
}

export interface SugestoesConflito {
  outroId: string;
  outroNome: string;
  periodo: 1 | 2;
  outroPeriodo?: 1 | 2;
  /** Mantém este colaborador e move o outro */
  moverOutro: SugestaoMover;
  /** Mantém o outro e move este colaborador */
  moverEste: SugestaoMover;
}

interface Intervalo { inicio: string; fim: string }

const fmt = (d: Date) => format(d, "yyyy-MM-dd");
const sobrepoe = (a: Intervalo, b: Intervalo) => a.inicio <= b.fim && a.fim >= b.inicio;

function periodosDe(v: { quinzena1_inicio?: string | null; quinzena1_fim?: string | null; quinzena2_inicio?: string | null; quinzena2_fim?: string | null }): Intervalo[] {
  const out: Intervalo[] = [];
  if (v.quinzena1_inicio && v.quinzena1_fim) out.push({ inicio: v.quinzena1_inicio, fim: v.quinzena1_fim });
  if (v.quinzena2_inicio && v.quinzena2_fim) out.push({ inicio: v.quinzena2_inicio, fim: v.quinzena2_fim });
  return out;
}

/**
 * Períodos de colegas que não podem coincidir com as férias do colaborador, seguindo a mesma
 * regra simétrica do gerador: mesmo setor titular, setor que ele cobre ou colegas que cobrem o setor dele.
 */
function ocupadosRelevantes(colaboradorId: string, todos: GeneratedVacation[], ctx: GenerationContext): Intervalo[] {
  const form = ctx.forms.find((f) => f.colaborador_id === colaboradorId);
  const setorId = form?.colaborador?.setor_titular_id || "";
  const setores = new Set<string>([setorId, ...(ctx.substituteSectors[colaboradorId] || [])]);
  const cobremMe = new Set<string>(ctx.sectorToColabs[setorId] || []);
  const relevante = (id: string, setor?: string | null) => id !== colaboradorId && ((!!setor && setores.has(setor)) || cobremMe.has(id));
  const out: Intervalo[] = [];
  for (const v of todos) {
    const setor = ctx.forms.find((f) => f.colaborador_id === v.colaborador_id)?.colaborador?.setor_titular_id;
    if (relevante(v.colaborador_id, setor)) out.push(...periodosDe(v));
  }
  for (const e of ctx.existingVacations) {
    if (relevante(e.colaborador_id, e.colaborador?.setor_titular_id)) out.push(...periodosDe(e));
  }
  return out;
}

/**
 * Datas alternativas para um período de um colaborador da prévia, sem conflito com colegas,
 * sem sobrepor o outro período dele, dentro do período concessivo e do ano de referência,
 * fora dos meses bloqueados. Ordena pela menor mudança em relação à data atual.
 */
export function sugerirJanelas(params: {
  vacation: GeneratedVacation;
  periodo: 1 | 2;
  todos: GeneratedVacation[];
  ctx: GenerationContext;
  ano: number;
  limite?: number;
}): JanelaSugerida[] {
  const { vacation: v, periodo, todos, ctx, ano } = params;
  const inicio = periodo === 1 ? v.quinzena1_inicio : v.quinzena2_inicio;
  const fim = periodo === 1 ? v.quinzena1_fim : v.quinzena2_fim;
  if (!inicio || !fim) return [];
  const dur = differenceInCalendarDays(parseISO(fim), parseISO(inicio)) + 1;
  const outroPeriodo: Intervalo | null = periodo === 1
    ? (v.quinzena2_inicio && v.quinzena2_fim ? { inicio: v.quinzena2_inicio, fim: v.quinzena2_fim } : null)
    : { inicio: v.quinzena1_inicio, fim: v.quinzena1_fim };

  const bloquearJanDez = (ctx.rules?.["BLOQUEAR_JAN_DEZ"] ?? "true") === "true";
  const bloqueados = new Set(bloquearJanDez ? [1, 12] : []);

  let limIni = `${ano}-01-01`;
  let limFim = `${ano}-12-31`;
  const admissao = ctx.forms.find((f) => f.colaborador_id === v.colaborador_id)?.colaborador?.data_admissao;
  const info = admissao ? getConcessivoInfo(admissao, inicio) : null;
  if (info) {
    const ini = info.concessivoInicio > limIni ? info.concessivoInicio : limIni;
    const end = info.concessivoFim < limFim ? info.concessivoFim : limFim;
    // Só restringe ao concessivo quando ele cabe no ano de referência
    if (differenceInCalendarDays(parseISO(end), parseISO(ini)) + 1 >= dur) { limIni = ini; limFim = end; }
  }

  const outros = todos.filter((o) => o.colaborador_id !== v.colaborador_id);
  const ocupados = ocupadosRelevantes(v.colaborador_id, outros, ctx);
  const base = parseISO(inicio);
  const validos: JanelaSugerida[] = [];
  const lim = parseISO(limFim);
  for (let d = parseISO(limIni); addDays(d, dur - 1) <= lim; d = addDays(d, 1)) {
    const f = addDays(d, dur - 1);
    if (bloqueados.has(d.getMonth() + 1) || bloqueados.has(f.getMonth() + 1)) continue;
    const cand = { inicio: fmt(d), fim: fmt(f) };
    if (cand.inicio === inicio) continue;
    if (outroPeriodo && sobrepoe(cand, outroPeriodo)) continue;
    if (ocupados.some((o) => sobrepoe(cand, o))) continue;
    validos.push({ ...cand, deslocamento: differenceInCalendarDays(d, base) });
  }
  validos.sort((a, b) => Math.abs(a.deslocamento) - Math.abs(b.deslocamento) || a.deslocamento - b.deslocamento);
  // Variedade: opções com pelo menos 7 dias de distância entre si
  const escolhidas: JanelaSugerida[] = [];
  for (const c of validos) {
    if (escolhidas.every((e) => Math.abs(e.deslocamento - c.deslocamento) >= 7)) escolhidas.push(c);
    if (escolhidas.length >= (params.limite ?? 3)) break;
  }
  return escolhidas;
}

/** Sugestões para cada conflito de setor/substituto de um colaborador da prévia, nos dois sentidos. */
export function sugerirResolucoes(vacation: GeneratedVacation, todos: GeneratedVacation[], ctx: GenerationContext, ano: number): SugestoesConflito[] {
  const vistos = new Set<string>();
  const out: SugestoesConflito[] = [];
  for (const c of vacation.conflicts) {
    if ((c.tipo !== "setor" && c.tipo !== "substituto") || !c.periodo || !c.colaborador_id) continue;
    const chave = `${c.periodo}-${c.colaborador_id}-${c.outro_periodo ?? ""}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const outroNome = c.colaborador_nome || "colaborador";
    const outro = todos.find((t) => t.colaborador_id === c.colaborador_id);
    const atualEste = c.periodo === 1
      ? { inicio: vacation.quinzena1_inicio, fim: vacation.quinzena1_fim }
      : { inicio: vacation.quinzena2_inicio, fim: vacation.quinzena2_fim };

    const moverEste: SugestaoMover = {
      manterId: c.colaborador_id, manterNome: outroNome,
      moverId: vacation.colaborador_id, moverNome: vacation.colaborador_nome,
      moverPeriodo: c.periodo, atualInicio: atualEste.inicio, atualFim: atualEste.fim,
      opcoes: sugerirJanelas({ vacation, periodo: c.periodo, todos, ctx, ano }),
    };
    if (moverEste.opcoes.length === 0) moverEste.bloqueio = "Nenhuma data livre encontrada dentro das regras (setor, concessivo e meses permitidos).";

    const moverOutro: SugestaoMover = {
      manterId: vacation.colaborador_id, manterNome: vacation.colaborador_nome,
      moverId: c.colaborador_id, moverNome: outroNome,
      moverPeriodo: c.outro_periodo ?? 1, atualInicio: c.outro_inicio || "", atualFim: c.outro_fim || "",
      opcoes: [],
    };
    if (c.ja_cadastrado || !outro) {
      moverOutro.bloqueio = `${outroNome} já tem férias cadastradas; para mover, altere pelo cadastro de férias.`;
    } else if (c.outro_periodo) {
      moverOutro.opcoes = sugerirJanelas({ vacation: outro, periodo: c.outro_periodo, todos, ctx, ano });
      if (moverOutro.opcoes.length === 0) moverOutro.bloqueio = "Nenhuma data livre encontrada dentro das regras (setor, concessivo e meses permitidos).";
    }
    out.push({ outroId: c.colaborador_id, outroNome, periodo: c.periodo, outroPeriodo: c.outro_periodo, moverOutro, moverEste });
  }
  return out;
}

/** Aplica nova data a um período mantendo a ordem cronológica (1º período sempre o mais cedo). */
export function aplicarJanela(v: GeneratedVacation, periodo: 1 | 2, inicio: string, fim: string): GeneratedVacation {
  const next = periodo === 1 ? { ...v, quinzena1_inicio: inicio, quinzena1_fim: fim } : { ...v, quinzena2_inicio: inicio, quinzena2_fim: fim };
  if (next.quinzena2_inicio && next.quinzena2_inicio < next.quinzena1_inicio) {
    return { ...next, quinzena1_inicio: next.quinzena2_inicio, quinzena1_fim: next.quinzena2_fim, quinzena2_inicio: next.quinzena1_inicio, quinzena2_fim: next.quinzena1_fim };
  }
  return next;
}
