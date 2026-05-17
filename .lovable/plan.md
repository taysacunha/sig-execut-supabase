## Correções na Premiação de Férias

### 1) Erro "Could not find the table 'public.ferias_premiacoes' in the schema cache"

A tabela `ferias_premiacoes` (e as colunas de recebimento/exportação) ainda não foram aplicadas no Supabase — os arquivos em `db/migrations/` e `supabase/migrations/` existem, mas nunca foram executados.

**Ação:** rodar as duas migrações via ferramenta de migração do Supabase (em vez de só deixar o `.sql` no repositório), o que também regenera os types:

- `20260516120000_ferias_premiacoes.sql` (cria a tabela + RLS + triggers de ordem + auditoria)
- `20260517120000_premiacao_recebimento.sql` (colunas `ultima_exportacao_pdf`, `recebimento_confirmado*` + trigger de validação)

### 2) Cálculos corretos (planilha)

Reescrever `src/lib/premiacaoCalc.ts` para refletir exatamente a planilha. O input passa a ser o **valor da premiação por quinzena (B4)** — não o valor mensal — porque é assim que a planilha trata.

Fórmulas por cenário:


| Célula | Fórmula                        | Vende 0  | Vende 5  | Vende 10 | Vende 15   |
| ------ | ------------------------------ | -------- | -------- | -------- | ---------- |
| B4     | input do usuário               | 1600     | 1600     | 1600     | 1600       |
| B5     | B4 / 3                         | 533,33   | 533,33   | 533,33   | 533,33     |
| B6     | B4 + B5                        | 2.133,33 | 2.133,33 | 2.133,33 | 2.133,33   |
| B7     | B6 / 30 × `dias_vendidos`      | —        | 355,56   | 711,11   | 1.066,67   |
| B8     | B5 / 30 × `dias_gozados`       | —        | 177,78   | 88,89    | 0 (omitir) |
| B9     | B7 + B8 (ou B5 quando vende 0) | 533,33   | 533,33   | 800,00   | 1.066,67   |


Regras:

- `dias_gozados = 15 - dias_vendidos`.
- Vende 0: PDF mostra apenas PREMIAÇÃO (B4), Acréscimo 1/3 (B5) e RECEBIDO DIA = B5.
- Vende 15: omitir a linha "1/3 DE FÉRIAS REFERENTE A 0 DIAS USUFRUÍDO" (multiplicação por zero).
- Atualizar `PremiacaoCalculo` (remover `valorMensal`/`quinzena`, renomear para `valorPremiacao`/`acrescimoUmTerco`/`total`/`vendaParcela`/`umTercoGozados`/`recebe`).

### 3) Dialog "Lançar Premiação" + PDF

- **Remover** o campo "Data de emissão do PDF" do `PremiacaoDialog.tsx` e do payload.
- A `data_recebimento` passa a ser usada também como `ultima_exportacao_pdf` ao gerar o PDF (já que ela é a referência única de quando foi emitido/recebido).
- O label do input de valor muda de "Valor mensal da premiação" para **"Valor da premiação (B4)"** com placeholder de exemplo `1600,00`.
- Em `premiacaoPdf.ts` e no preview, substituir `RECEBE DIA dd/mm/aaaa` por `**RECEBIDO DIA dd/mm/aaaa**` (mantendo caixa alta).
- Em `useSetExportacaoPremiacao`, manter o uso da `data_recebimento` informada no momento do PDF (atualiza `ultima_exportacao_pdf` para essa data).

### Arquivos afetados

- `supabase/migrations/20260516120000_ferias_premiacoes.sql` — aplicar (já existente)
- `supabase/migrations/20260517120000_premiacao_recebimento.sql` — aplicar (já existente)
- `src/lib/premiacaoCalc.ts` — novas fórmulas
- `src/lib/premiacaoPdf.ts` — usar novas chaves, omitir B8 quando vende 15, trocar "RECEBE" por "RECEBIDO"
- `src/components/ferias/ferias/PremiacaoDialog.tsx` — remover campo de data de emissão; label do valor; preview com novas fórmulas e "RECEBIDO DIA"
- `src/pages/ferias/FeriasFerias.tsx` — ao reimprimir PDF, passar `data_recebimento` como referência (sem popover separado de data de emissão)

### Pergunta única

Para o cenário **"não vende" (gozo 15 dias)**, confirma que o recibo deve mostrar apenas:

- PREMIAÇÃO = B4
- Acréscimo 1/3 = B5
- RECEBIDO DIA = **B5** (ou seja, 1/3 da premiação)? Sim. O cálculo de não vende está correto.

É como já estava antes (e bate com a aba 1 da planilha), mas como você só descreveu as abas de 5/10/15, quero confirmar antes de mexer.

Para finalizar, acabei de executar as duas migrations manualmente no supabase e passaram sem erros.