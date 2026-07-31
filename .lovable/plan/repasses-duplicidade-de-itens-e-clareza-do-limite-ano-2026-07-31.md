# Repasses: duplicidade de itens e clareza do Limite Ano

## 1. Impedir itens duplicados

Hoje é possível adicionar dois itens iguais (ex.: dois créditos de Aluguel do mesmo imóvel) na mesma competência.

- **Regra**: dentro de uma competência, não pode existir mais de um item com a mesma combinação **tipo + origem + imóvel** (quando não houver imóvel, considera-se "sem imóvel").
- **Banco**: índice único parcial em `despesas_repasse_itens` sobre `(repasse_id, tipo, origem, coalesce(imovel_id,'00000000-...'))`, ignorando itens gerados a partir de lançamentos distintos (`lancamento_id`), que podem legitimamente repetir — nesse caso a unicidade passa a ser por `lancamento_id`.
- **Interface**: antes de salvar, o diálogo verifica a lista atual e, se houver conflito, mostra aviso "Já existe um item de Crédito / Aluguel para este imóvel nesta competência" com as opções **Editar o item existente** ou **Cancelar**. Nada é salvo sem resolução.
- Mesma checagem ao editar um item existente.

## 2. Limite Ano: como funciona e como será exibido

Hoje o campo aparece dentro de cada competência, o que dá a impressão de precisar ser preenchido mês a mês — e gera a dúvida de "esquecer" em outra competência.

Esclarecimento do comportamento real: o limite anual é **um único valor por beneficiário, por conta de repasse, por ano** (não por mês). Preencher em julho vale para o ano inteiro; preencher de novo em outra competência apenas sobrescreve o mesmo registro.

Ajustes para deixar isso evidente:

- Renomear a coluna/campo para **"Limite do ano (2026)"**, com o ano explícito.
- Ao lado do valor, mostrar **consumido no ano** e **saldo restante**, somando todas as competências daquela conta no ano.
- Texto de apoio: "Valor único para o ano todo — vale para todas as competências desta conta".
- Bloquear novo repasse ao beneficiário quando o limite anual já estiver atingido, com aviso claro na hora da distribuição. Mas o valor anual pode ser atualizado para receber mais, se assim o usuário quiser. 
  &nbsp;
- Criar, na aba Beneficiários, um bloco recolhível **"Limites anuais"** listando todos os beneficiários da conta com limite, consumido e saldo — ponto único para revisar/editar sem depender da competência aberta.

## Detalhes técnicos

- Migration nova: índice único parcial em `despesas_repasse_itens` + função de checagem usada pelo trigger de item.
- `useDespesasRepasses.ts`: nova query agregando consumo anual por pessoa (`despesas_repasse_itens` × `despesas_repasses` filtrando por conta e ano) e tratamento do erro de unicidade.
- `RepasseDialog.tsx`: validação de duplicidade no formulário de item, painel de limites anuais e colunas consumido/saldo.