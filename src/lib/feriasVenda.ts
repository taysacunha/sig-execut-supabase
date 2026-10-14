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

  if (quinzenaVenda === 3) {
    // Alocação apenas para o contador: o total e a distribuição interna não mudam.
    if (dias < 10) throw new Error("A divisão 5 + 5 no contador exige pelo menos 10 dias vendidos.");
    if (q1BloqueadoParaVenda) throw new Error("O primeiro período já foi concluído. Use a correção histórica justificada para alterar sua alocação.");
    const padrao10 = dias === 10 && !isExcecao;
    return { venderDias: true, diasVendidos: dias, quinzenaVenda: 3, diasVendidosQ1: padrao10 ? 5 : null, diasVendidosQ2: padrao10 ? 5 : null };
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

export interface VendaContabilInput {
  vender_dias?: boolean | null;
  dias_vendidos?: number | null;
  quinzena_venda?: number | null;
}

/** Alocação oficial; nas exceções não confundir venda interna com os 10 dias do contador. */
export function vendaContabilPorPeriodo(f: VendaContabilInput): { v1: number; v2: number } {
  const total = Math.min(Math.max(f.dias_vendidos || 0, 0), 10);
  if (f.quinzena_venda === 3 && total === 10) return { v1: 5, v2: 5 };
  return { v1: f.quinzena_venda === 1 ? total : 0, v2: f.quinzena_venda === 2 ? total : 0 };
}

export function labelPeriodoVenda(periodo?: number | null): string {
  return periodo === 3 ? "5 dias no 1º + 5 dias no 2º" : periodo ? `${periodo}º período` : "—";
}

export function validarVendaDividida(input: {
  periodo: number | null | undefined;
  dias: number;
  q1Bloqueado: boolean;
  q2Cancelado: boolean;
  q2Inicio?: string | null;
  q2Fim?: string | null;
  alocacaoAlterada?: boolean;
  enviadoQ1?: boolean | null;
  enviadoQ2?: boolean | null;
}): string | null {
  if (input.alocacaoAlterada && (input.enviadoQ1 || input.enviadoQ2)) return "A alocação já foi enviada ao contador. Regularize o envio do período antes de alterar a venda.";
  if (input.periodo !== 3) return null;
  if (input.dias < 10) return "A divisão 5 + 5 no contador exige pelo menos 10 dias vendidos.";
  if (input.q1Bloqueado) return "O primeiro período já foi concluído. Use a correção histórica justificada.";
  if (input.q2Cancelado || !input.q2Inicio || !input.q2Fim) return "A divisão 5 + 5 exige segundo período cadastrado e não cancelado.";
  return null;
}