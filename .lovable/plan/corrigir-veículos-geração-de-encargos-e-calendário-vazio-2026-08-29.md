# Corrigir Veículos: geração de encargos e calendário vazio

## O que está acontecendo

Os dois problemas têm a mesma origem.

Ao clicar em "Gerar" (aba Recorrências ou botão "Gerar ano"), o banco recusa a criação dos lançamentos com o erro:

```text
new row for relation "despesas_lancamentos" violates check constraint "despesas_lancamentos_referencia_ck"
```

Essa regra exige que todo lançamento tenha pelo menos uma referência: pessoa, imóvel, número de pasta ou número de venda. O gerador de encargos de veículo grava apenas o vínculo com o **veículo**, que não é aceito pela regra. Resultado: nenhum encargo é criado.

Como nenhum lançamento de veículo chega a existir, a aba Calendário fica vazia em todos os meses — ela filtra exatamente os lançamentos vinculados a um veículo. Não é um bug de exibição.

## Correção

1. **Aceitar o veículo como referência válida** (migração no banco): a regra de referência das tabelas de lançamentos e recorrências passa a considerar também o vínculo com veículo. Nada muda para lançamentos manuais — eles continuam exigindo pelo menos uma das quatro referências atuais.
2. **Gerar os encargos**: com a regra ajustada, o botão "Gerar" passa a criar as parcelas (IPVA, seguro, licenciamento etc.) já vinculadas ao veículo, e elas aparecem no calendário do veículo e no calendário geral de despesas.
3. **Mensagens de erro claras**: hoje o erro técnico do banco aparece cru no canto da tela. Passa a exibir mensagens compreensíveis ("veículo sem centro de custo", "documento sem valor/parcelas", etc.) mantendo o detalhe técnico apenas quando não houver tradução.
4. **Calendário mais útil**: além do mês atual, incluir a opção de ver o ano inteiro, para que encargos anuais (IPVA em janeiro, por exemplo) não deem a impressão de que "não há nada".

## Detalhes técnicos

- Migração: recriar `despesas_lancamentos_referencia_ck` e `despesas_recorrencias_referencia_ck` adicionando `OR veiculo_id IS NOT NULL` ao bloco de referências obrigatórias, preservando as validações numéricas de `referencia_numero_pasta` / `referencia_numero_venda`.
- `db/migrations/20260815130000_despesas_lancamentos_veiculo_id.sql` já grava `veiculo_id` no gerador `despesas_gerar_encargos_veiculo`; nenhuma alteração na função é necessária além de validar `r.valor`/`r.parcelas` para evitar divisão por zero.
- `src/components/despesas/veiculos/VeiculosRecorrencias.tsx` e `src/pages/despesas/DespesasVeiculos.tsx`: mapear mensagens de erro conhecidas (`referencia_ck`, `centro de custo`) em textos em PT-BR.
- `src/components/despesas/veiculos/VeiculosCalendario.tsx`: adicionar alternância "Mês / Ano" que amplia `dataInicio`/`dataFim` do `useLancamentos`.
- Sem mudanças em RLS ou permissões.
