import { addDays, differenceInDays, parseISO } from "date-fns";

export interface FeriasVendaIntervalosInput {
  quinzena_venda?: number | null;
  quinzena1_inicio: string;
  quinzena1_fim: string;
  quinzena2_inicio?: string | null;
  quinzena2_fim?: string | null;
  gozo_quinzena1_inicio?: string | null;
  gozo_quinzena1_fim?: string | null;
  gozo_quinzena2_inicio?: string | null;
  gozo_quinzena2_fim?: string | null;
  _gozoPeriodos?: Array<{ data_inicio: string; data_fim: string; tipo?: string }>;
}

/** Na divisão, descanso informado é soberano; só o fallback oficial desconta 5 de cada lado. */
export function intervalosVendaDividida(f: FeriasVendaIntervalosInput) {
  const periodos = f._gozoPeriodos?.filter(p => p.tipo !== "venda" && p.data_inicio && p.data_fim);
  if (periodos?.length) return periodos.map(p => ({ start: parseISO(p.data_inicio), end: parseISO(p.data_fim), diasGozados: differenceInDays(parseISO(p.data_fim), parseISO(p.data_inicio)) + 1, diasVendidos: 0 }));
  return [
    [f.gozo_quinzena1_inicio, f.gozo_quinzena1_fim, f.quinzena1_inicio, f.quinzena1_fim],
    [f.gozo_quinzena2_inicio, f.gozo_quinzena2_fim, f.quinzena2_inicio, f.quinzena2_fim],
  ].flatMap(([realInicio, realFim, oficialInicio, oficialFim]) => {
    const inicio = realInicio && realFim ? realInicio : oficialInicio;
    const fim = realInicio && realFim ? realFim : oficialFim;
    if (!inicio || !fim) return [];
    const start = parseISO(inicio);
    const total = differenceInDays(parseISO(fim), start) + 1;
    const vendidos = realInicio && realFim ? 0 : 5;
    const diasGozados = Math.max(0, total - vendidos);
    return diasGozados ? [{ start, end: addDays(start, diasGozados - 1), diasGozados, diasVendidos: vendidos }] : [];
  });
}