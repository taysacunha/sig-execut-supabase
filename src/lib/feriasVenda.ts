export interface VendaConsolidadaInput {
  opcaoAdicional: string;
  excecaoTipo: "vender" | "gozo_diferente" | null;
  diasVendidos: number | null | undefined;
  quinzenaVenda: number | null | undefined;
  q1BloqueadoParaVenda: boolean;
  isExcecao: boolean;
}

export interface VendaConsolidada {
  venderDias: boolean;
  diasVendidos: number;
  quinzenaVenda: number | null;
  diasVendidosQ1: number | null;
  diasVendidosQ2: number | null;
}

/**
 * Consolida os campos principais da venda antes do diff e da persistência.
 * O valor do formulário é a fonte única porque ele é também o que o usuário vê.
 */
export function resolverVendaConsolidada({
  opcaoAdicional,
  excecaoTipo,
  diasVendidos,
  quinzenaVenda,
  q1BloqueadoParaVenda,
  isExcecao,
}: VendaConsolidadaInput): VendaConsolidada {
  const dias = Math.max(0, Number(diasVendidos) || 0);
  const venderDias = (opcaoAdicional === "vender" || excecaoTipo === "vender") && dias > 0;

  if (!venderDias) {
    return {
      venderDias: false,
      diasVendidos: 0,
      quinzenaVenda: null,
      diasVendidosQ1: null,
      diasVendidosQ2: null,
    };
  }

  const periodo = q1BloqueadoParaVenda ? 2 : quinzenaVenda === 2 ? 2 : 1;
  return {
    venderDias: true,
    diasVendidos: dias,
    quinzenaVenda: periodo,
    diasVendidosQ1: isExcecao ? null : periodo === 1 ? dias : 0,
    diasVendidosQ2: isExcecao ? null : periodo === 2 ? dias : 0,
  };
}