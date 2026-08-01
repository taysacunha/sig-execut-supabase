# Repasses: reabertura correta e beneficiários com múltiplos pagamentos

## 1. Reabrir competência (bug)

Hoje "Reabrir" muda o status para **Fechado**, e a edição de itens só é liberada quando o status é **Aberto** — por isso a competência continua travada.

- Reabrir passa a devolver a competência para **Aberto** (mantendo a justificativa mínima de 10 caracteres registrada na observação).
- O botão "Reabrir" fica disponível tanto para competências **Pagas** quanto **Fechadas**.
- Ao reabrir uma competência paga, a data de pagamento é limpa para não gerar relatório inconsistente.

## 2. Novo fluxo de beneficiários (fim do erro "duplicate key")

Hoje cada beneficiário é uma única linha com um valor por competência; tentar lançar um segundo valor para a mesma pessoa no mês quebra com erro de chave duplicada.

Novo modelo em duas etapas:

**Etapa A — cadastrar o beneficiário na competência**
- Selecionar a **pessoa**
- **Limite por mês** (teto do mês)
- **Limite por ano** (valor único do ano, herdado se já existir)
- Marcar se é **Proprietário** da conta ou não
- A pessoa já cadastrada some da lista de seleção, evitando duplicidade

**Etapa B — lançar repasses do beneficiário**
- Depois de adicionado, o beneficiário exibe uma lista de **repasses** com: **data**, **valor** e **imóvel de origem** (opcional)
- Pode haver **vários repasses no mesmo mês**, em datas diferentes
- Cada linha pode ser editada ou excluída (com confirmação)
- O valor do beneficiário no mês passa a ser a **soma** dos seus repasses
- Avisos quando a soma ultrapassa o limite do mês ou o limite do ano
- Regra de unicidade: um repasse por (beneficiário, data, imóvel) — repetições reais devem virar valores diferentes na mesma linha

A coluna "Sobra" (residual) continua funcionando: quem estiver marcado recebe o líquido não distribuído.

## Detalhes técnicos

- Migration nova:
  - remover `UNIQUE (repasse_id, pessoa_id)` não é necessário — ela passa a fazer sentido (um cadastro por pessoa por competência);
  - adicionar coluna `is_proprietario boolean not null default false` em `despesas_repasse_beneficiarios`;
  - criar tabela `despesas_repasse_beneficiario_pagamentos` (`beneficiario_id`, `data`, `valor`, `imovel_id`, `observacao`) com GRANTs, RLS espelhando as políticas de `despesas_repasse_beneficiarios`, índice único `(beneficiario_id, data, coalesce(imovel_id,...))` e trigger que recalcula `valor` do beneficiário como soma dos pagamentos.
- `useDespesasRepasses.ts`: incluir `pagamentos` no select dos beneficiários e hooks `useSaveBeneficiarioPagamento` / `useDeleteBeneficiarioPagamento` com tradução do erro de unicidade.
- `RepasseDialog.tsx`: formulário de cadastro (pessoa, limite mês, limite ano, proprietário), linha expansível por beneficiário com a tabela de repasses (data, valor, imóvel), e `confirmarReabertura` passando a usar status `aberto`.
