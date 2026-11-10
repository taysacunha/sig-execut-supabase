import { addDays, addYears, format, parseISO, subDays } from "date-fns";

export interface ConcessivoInfo {
  aquisitivoInicio: string;
  aquisitivoFim: string;
  concessivoInicio: string;
  concessivoFim: string;
  /** true quando a data de referência é anterior ao início do período concessivo devido */
  antesDoConcessivo: boolean;
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * Período aquisitivo/concessivo devido para uma data de referência.
 * Escolhe o primeiro período cujo concessivo ainda não venceu na data.
 */
export function getConcessivoInfo(admissao: string, referencia: string): ConcessivoInfo | null {
  if (!admissao || !referencia) return null;
  const adm = parseISO(admissao);
  const ref = parseISO(referencia);
  if (isNaN(adm.getTime()) || isNaN(ref.getTime())) return null;
  for (let n = 0; n < 80; n++) {
    const aqIni = addYears(adm, n);
    const aqFim = subDays(addYears(adm, n + 1), 1);
    const coIni = addDays(aqFim, 1);
    const coFim = subDays(addYears(coIni, 1), 1);
    if (coFim >= ref) {
      return {
        aquisitivoInicio: fmt(aqIni),
        aquisitivoFim: fmt(aqFim),
        concessivoInicio: fmt(coIni),
        concessivoFim: fmt(coFim),
        antesDoConcessivo: ref < coIni,
      };
    }
  }
  return null;
}

export interface Intervalo { inicio: string; fim: string }

const overlap = (a: Intervalo, b: Intervalo) => a.inicio <= b.fim && a.fim >= b.inicio;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Sugere um 2º período de 15 dias dentro de [limiteInicio, limiteFim] que não se sobreponha
 * ao 1º período nem a nenhum período ocupado (colegas do setor). Escolha pseudoaleatória
 * determinística pela semente. Retorna null quando não há opção válida.
 */
export function suggestSecondPeriod(params: {
  q1: Intervalo;
  limiteInicio: string;
  limiteFim: string;
  ocupados: Intervalo[];
  seed?: string;
  duracao?: number;
  /** meses bloqueados (1-12) para o início/fim */
  mesesBloqueados?: number[];
}): Intervalo | null {
  const dur = params.duracao ?? 15;
  const bloq = new Set(params.mesesBloqueados ?? [1, 12]);
  const validos: Intervalo[] = [];
  let d = parseISO(params.limiteInicio);
  const lim = parseISO(params.limiteFim);
  while (addDays(d, dur - 1) <= lim) {
    const fim = addDays(d, dur - 1);
    const cand = { inicio: fmt(d), fim: fmt(fim) };
    if (
      !bloq.has(d.getMonth() + 1) && !bloq.has(fim.getMonth() + 1) &&
      !overlap(cand, params.q1) &&
      !params.ocupados.some((o) => overlap(cand, o))
    ) validos.push(cand);
    d = addDays(d, 1);
  }
  if (validos.length === 0) return null;
  return validos[hashSeed(params.seed ?? "") % validos.length];
}

export function periodsOverlap(a: Intervalo, b: Intervalo): boolean {
  return overlap(a, b);
}
