

## Problema

O `GeradorFolgasDialog` não consulta a tabela `ferias_afastamentos`. Na etapa de exclusões (linhas 363-375), ele verifica apenas:
- Período de experiência
- Perda registrada
- Férias no mês
- Férias dividida em dois meses

**Não verifica afastamentos.** Resultado: colaboradores afastados (licença médica, maternidade, etc.) entram na escala normalmente.

## Correção

**Arquivo:** `src/components/ferias/folgas/GeradorFolgasDialog.tsx`

**1. Adicionar query de afastamentos ativos no mês** (após a query de perdas, ~linha 210)
- Buscar `ferias_afastamentos` onde `data_inicio <= fim_do_mês` E `data_fim >= início_do_mês`
- Retornar `colaborador_id`, `motivo`, `data_inicio`, `data_fim`

**2. Adicionar função helper `isAfastado`** (junto com os outros helpers, ~linha 332)
- Verificar se o colaborador tem algum afastamento que cubra **todos os sábados do mês** → excluir completamente
- Se cobre apenas **alguns sábados** → remover esses sábados da lista de disponíveis (igual já faz com férias via `isColabOnVacation`)

**3. Adicionar exclusão no Step 1** (linha 363-375)
- Antes das outras verificações, checar se o colaborador está afastado durante todo o mês → adicionar razão "Afastado (licença médica)" ou similar
- Para afastamentos parciais, filtrar os sábados disponíveis no Step 4 (igual já filtra férias)

**4. Filtrar sábados por afastamento no Step 4** (linhas 417-433)
- Ao calcular `availableSats`, além de `isColabOnVacation`, verificar também se o sábado cai dentro de um período de afastamento

### Resultado
- Juliana (licença médica + maternidade) não aparecerá na escala de folgas
- Qualquer colaborador com afastamento registrado cobrindo sábados do mês será excluído ou terá esses sábados removidos
- A lógica segue o mesmo padrão das outras regras já existentes

