import { addMonths, format, parseISO } from "date-fns";

/** Always offset from the original due date, never from the clamped preceding month. */
export function datasParcelasVeiculo(inicio: string, parcelas: number): string[] {
  if (!inicio || !Number.isInteger(parcelas) || parcelas < 1 || parcelas > 24) return [];
  return Array.from({ length: parcelas }, (_, i) => format(addMonths(parseISO(inicio), i), "yyyy-MM-dd"));
}

export function proximoCicloVeiculo(inicio: string, ultimo?: number | null): number {
  const base = parseISO(inicio).getFullYear();
  return ultimo == null ? base : Math.max(base, ultimo + 1);
}

export function podeBaixarEncargoVeiculo(status: string, data: string): boolean {
  return !!data && (status === "a_vencer" || status === "vencido");
}