

## Correção: erro ao gerar preview de folgas

### Problema
O erro `Cannot read properties of null (reading 'split')` ocorre na função `countVacationDaysInMonth` (linha 292-295) e em `shouldSkipDueToTwoMonthVacation` (linha 326-327). O campo `quinzena2_inicio` e `quinzena2_fim` pode ser `null` no banco de dados, mas o código chama `parseISO()` sem verificar isso, causando o crash que trava o preview.

### Correção

**Arquivo**: `src/components/ferias/folgas/GeradorFolgasDialog.tsx`

1. Na função `countVacationDaysInMonth` (linhas 292-307): Adicionar verificação de nulidade antes de parsear quinzena2. Só calcular overlap da quinzena2 se os campos existirem.

2. Na função `shouldSkipDueToTwoMonthVacation` (linhas 324-327): Mesma verificação — se quinzena2 for null, usar apenas quinzena1 para determinar o fim do período.

3. Verificar todas as outras ocorrências de `parseISO` no arquivo que acessam `quinzena2_inicio/fim` e aplicar a mesma proteção contra null.

### Resultado
O gerador de preview funcionará normalmente mesmo quando colaboradores têm férias com apenas 1 período (quinzena2 nula).

