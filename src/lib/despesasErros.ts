/** Traduz erros técnicos do banco em mensagens compreensíveis (PT-BR). */
export function traduzirErroDespesas(e: unknown): string {
  const msg = (e as any)?.message ?? String(e ?? "");

  if (/despesas_lancamentos_referencia_ck|despesas_recorrencias_referencia_ck|referencia_ck/i.test(msg)) {
    return "O lançamento precisa de uma referência (pessoa, imóvel, pasta, venda ou veículo). Aplique a atualização do banco de dados de referência por veículo e tente novamente.";
  }
  if (/centro de custo/i.test(msg)) {
    return "Defina o centro de custo do veículo antes de gerar encargos.";
  }
  if (/division by zero/i.test(msg)) {
    return "Há documento com número de parcelas inválido. Corrija o documento do veículo e tente novamente.";
  }
  if (/valor/i.test(msg) && /null|zero/i.test(msg)) {
    return "Há documento sem valor informado. Preencha o valor do documento e tente novamente.";
  }
  if (/row-level security|permission denied/i.test(msg)) {
    return "Você não tem permissão para realizar esta ação.";
  }
  if (/duplicate key|unique constraint/i.test(msg)) {
    return "Estes lançamentos já existem e não foram duplicados.";
  }
  return msg || "Erro inesperado";
}
