## Objetivo

Garantir que a informação do período aquisitivo da venda (1º/2º) apareça sempre no relatório do contador (preview e PDF), e fazer um backfill nos registros antigos sem `quinzena_venda` definido.

## 1. Mostrar sufixo do período sempre (não só em "Ambos")

Arquivo: `src/components/ferias/relatorios/ContadorPDFGenerator.tsx`

- Atualizar a função `formatDiasVendidos` para sempre adicionar o sufixo `(1º)` ou `(2º)` quando `dias > 0` e `f.quinzena_venda` estiver definido — atualmente o sufixo só aparece em `showingAmbos`.
- Resultado: no modo 1ª Quinzena, 2ª Quinzena e Ambos, a célula "Dias Vend." passa a exibir, por exemplo, `10 (1º)`.
- Atualizar o texto do rodapé do PDF para refletir que o sufixo aparece em todos os modos.
- O cabeçalho da coluna e o restante da lógica (`getDiasVendidosSelecionado`, filtragem por período) continuam iguais.

## 2. Backfill de `quinzena_venda` para registros antigos

Criar uma migration nova (`supabase/migrations/<timestamp>_backfill_quinzena_venda.sql`) com a regra:

- Aplicar somente onde `dias_vendidos > 0` AND `quinzena_venda IS NULL`.
- Regras de inferência, na ordem:
  1. `distribuicao_tipo = '1'` → `quinzena_venda = 1`
  2. `distribuicao_tipo = '2'` → `quinzena_venda = 2`
  3. Quinzena 1 com duração de exatamente 5 dias (ou seja, `quinzena1_fim - quinzena1_inicio + 1 = 5`) e quinzena 2 cheia → `quinzena_venda = 1` (caso da Ivone).
  4. Quinzena 2 com 5 dias e quinzena 1 cheia → `quinzena_venda = 2`.
  5. Qualquer outro caso (ambos/livre sem padrão claro, gozo flexível, gozo diferente, etc.) → `quinzena_venda = 2` (default solicitado).

Registros que já têm `quinzena_venda` preenchido não são alterados.

## 3. Verificação

- Abrir a aba "Tabela Contador" e conferir que Ivone aparece com `10 (1º)` tanto no preview quanto no PDF gerado.
- Conferir que registros sem `quinzena_venda` agora exibem `(2º)` (ou o inferido).
- Conferir os 3 modos de período (Ambos, 1ª Quinzena, 2ª Quinzena) — em modos individuais, o sufixo confirma de qual período veio a venda.

## Detalhes técnicos

```sql
-- Backfill
UPDATE public.ferias_ferias
SET quinzena_venda = CASE
  WHEN distribuicao_tipo = '1' THEN 1
  WHEN distribuicao_tipo = '2' THEN 2
  WHEN quinzena1_inicio IS NOT NULL AND quinzena1_fim IS NOT NULL
       AND (quinzena1_fim - quinzena1_inicio + 1) = 5
       AND quinzena2_inicio IS NOT NULL AND quinzena2_fim IS NOT NULL
       AND (quinzena2_fim - quinzena2_inicio + 1) >= 15 THEN 1
  WHEN quinzena2_inicio IS NOT NULL AND quinzena2_fim IS NOT NULL
       AND (quinzena2_fim - quinzena2_inicio + 1) = 5
       AND (quinzena1_fim - quinzena1_inicio + 1) >= 15 THEN 2
  ELSE 2
END
WHERE dias_vendidos > 0 AND quinzena_venda IS NULL;
```

```ts
// formatDiasVendidos novo
const formatDiasVendidos = (f: any) => {
  const dias = getDiasVendidosSelecionado(f);
  if (dias <= 0) return "0";
  if (f.quinzena_venda) return `${dias} (${f.quinzena_venda}º)`;
  return String(dias);
};
```
