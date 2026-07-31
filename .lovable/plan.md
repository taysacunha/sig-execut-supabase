# Repasses: distribuir por limite, limite anual persistente e coluna de competências

## 1. "Distribuir por limite" hoje trava
O botão exige um beneficiário marcado como **residual** ("recebe a sobra"), mas essa marcação só existe dentro do formulário de adicionar/editar — na tabela não há como marcar. Correções:

- Adicionar na tabela de beneficiários uma coluna **"Recebe a sobra"** com um seletor (radio) por linha: clicar marca aquele beneficiário como residual e desmarca o anterior, salvando na hora.
- Se nenhum residual estiver marcado ao clicar em "Distribuir por limite", em vez do erro seco abrir um pequeno diálogo **"Quem recebe a sobra?"** listando os beneficiários da competência para escolher e já distribuir em seguida.
- Mensagens de bloqueio mais claras: sem beneficiários, sem valor líquido, ou limite anual já esgotado.

## 2. Limite do ano: herdar, mostrar origem e confirmar alteração
O limite já é único por beneficiário/conta/ano, mas não fica evidente e não indica onde foi definido.

- Ao adicionar um beneficiário que já tem limite anual naquele ano, o campo **Limite ano** vem preenchido automaticamente com o valor existente (não zera).
- Passar o mouse sobre o valor do limite mostra: **"Definido em jul/2026 por Fulano em 12/07/2026 — vale para todas as competências de 2026"**.
- Se o usuário digitar um valor diferente do já cadastrado, aparece confirmação: **"Alterar o limite anual de R$ X para R$ Y? Vale para todas as competências de 2026."** com Confirmar/Cancelar.
- Ao criar uma nova competência, os beneficiários copiados continuam com o limite do ano vigente; se a nova competência for de outro ano, o campo fica vazio com aviso "sem limite definido para 2027".

## 3. Coluna "Competências" na lista de repasses
Hoje mostra um badge por mês (mai/2026, jul/2026...) e cresce sem limite. Substituir por uma visão compacta agrupada por ano:

```text
2026  10 comp. · 8 pagas    2027  2 comp. · 0 pagas
```

- Um badge por **ano**, com contagem de competências e quantas estão pagas, em ordem decrescente de ano.
- Tooltip no badge do ano lista os meses daquele ano (jan, fev, mar...), com os pagos destacados.
- Clicar no badge do ano abre o diálogo da conta já posicionado naquele ano.

## Detalhes técnicos
- Migration: `despesas_repasse_benef_limite_anual` ganha `competencia_origem date` e `definido_por uuid` (preenchidos no upsert) para alimentar o tooltip de origem.
- `src/hooks/useDespesasRepasses.ts`: `useSaveLimiteAnual` grava origem; nova mutation para alternar `is_residual` (desmarca os demais da competência).
- `src/components/despesas/RepasseDialog.tsx`: coluna radio "Recebe a sobra", diálogo de escolha do residual no fluxo de distribuição, herança/tooltip/confirmação do limite anual.
- `src/pages/despesas/DespesasRepasses.tsx`: coluna de competências agrupada por ano com tooltip e clique navegando para o ano.
