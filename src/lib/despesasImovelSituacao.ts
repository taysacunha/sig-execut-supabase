export const IMOVEL_SITUACOES = [
  { v: "alugado", l: "Alugado" },
  { v: "vago", l: "Desocupado" },
  { v: "vendido", l: "Vendido" },
  { v: "proprio_uso", l: "Uso próprio" },
  { v: "em_aquisicao", l: "Em aquisição" },
  { v: "em_temporada", l: "Em temporada" },
] as const;

export type ImovelSituacao = typeof IMOVEL_SITUACOES[number]["v"];

export const IMOVEL_SITUACAO_LABEL: Record<string, string> = Object.fromEntries(
  IMOVEL_SITUACOES.map(({ v, l }) => [v, l]),
);

export function isImovelSituacao(value: unknown): value is ImovelSituacao {
  return IMOVEL_SITUACOES.some(({ v }) => v === value);
}