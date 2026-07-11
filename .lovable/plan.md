## Contexto

Na aba **Disponíveis** aparece uma coluna **Status** com dois valores:
- `Disponível` — placa física individualizada
- `Saldo agregado` — saldo em `estoque_saldos` sem placa física criada ainda

Como você observou, toda linha da aba já é "disponível" por definição, então a coluna de status vira ruído.

## Ajuste

1. **Remover a coluna Status na aba Disponíveis.** O cabeçalho e a célula correspondente somem.
2. **Manter a distinção entre linha física e saldo agregado** de outra forma, sem coluna dedicada:
   - Linhas de saldo agregado continuam mostrando "sem código" + "N unidade(s) em saldo" na coluna Código (comportamento atual).
   - Nada mais muda visualmente para placas físicas — o código aparece normalmente.
3. **Nas abas Instaladas e Baixadas**, manter a coluna Status como está (lá o status é informativo: instalada, roubada, perdida, baixada).

## Escopo técnico

- `src/pages/estoque/EstoquePlacas.tsx`:
  - A tabela é compartilhada, então tornar a coluna Status condicional à aba atual (`abaAtual === "disponivel"` esconde `<TableHead>Status</TableHead>` e a `<TableCell>` correspondente).
  - Nada muda em dados, hooks ou migrações.

## Sem alterações

- Lógica de saldo agregado × placa física.
- Ações da tabela.
- Fluxo de reaproveitamento de código recém-implementado.
