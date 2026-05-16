## Contexto

Os períodos aquisitivos NÃO ficam salvos no banco — são calculados em tempo real a partir de `data_admissao` em `buildPeriodosAquisitivos` (PeriodosAquisitivosTab.tsx). Já a coluna `periodo_aquisitivo_inicio/fim` da tabela `ferias_ferias` é preenchida pelo `FeriasDialog` a partir do que o usuário escolhe.

A origem do "0225" foi um valor digitado errado em um `<Input type="date">` (campo `quinzena1_inicio` ou similar). O HTML aceita `0225-01-15` como data válida, e a partir dessa data o cálculo do período aquisitivo gera `0225–0226`. O dropdown de períodos aquisitivos do dialog em si gera valores corretos (parte da admissão), então o caminho do bug é a digitação manual das datas das quinzenas.

Por isso o "0225" continua aparecendo mesmo após a correção: ainda existe pelo menos um registro em `ferias_ferias` da Rostephania com `quinzena1_inicio` (ou `periodo_aquisitivo_inicio`) com ano 0225 — provavelmente outro lançamento dela que não foi editado.

## Plano

### 1. Prevenir o erro (FeriasDialog.tsx)

Adicionar validação no Zod schema e atributos `min`/`max` nos inputs `type="date"` para travar anos fora da faixa 1990–2100:

- Helper `isReasonableDate(s: string)` → true se YYYY entre 1990 e 2100.
- Refinar no schema:
  - `quinzena1_inicio`: obrigatório + `refine(isReasonableDate, "Ano inválido (use entre 1990 e 2100)")`.
  - `quinzena2_inicio`: opcional, mas se preenchido, refinar igual.
  - Mesmos refines para `gozo_quinzena1_inicio`, `gozo_quinzena2_inicio`, `gozo_venda_inicio`, `gozo_venda_q1_inicio`, `gozo_venda_q2_inicio` (quando preenchidos).
- Adicionar `min="1990-01-01"` e `max="2100-12-31"` em todos os `<Input type="date">` editáveis do dialog (q1/q2 início, gozo diferente, gozo venda). Os inputs `readOnly` de "fim" não precisam.

Isso bloqueia tanto digitação quanto colagem de datas com ano fora do range, em qualquer lançamento futuro.

### 2. Limpar o "0225" da Rostephania (correção de dados)

Como o acesso ao banco via `exec` não está habilitado nesta sessão, não consigo localizar/excluir o registro sozinho. Duas opções:

**Opção A — eu corrijo via migração (recomendado, definitivo):**
Você aprova uma migração SQL que faz uma varredura geral e:

- Lista (no log) todos os `ferias_ferias` cujo ano de `quinzena1_inicio`, `quinzena2_inicio`, `periodo_aquisitivo_inicio` ou `periodo_aquisitivo_fim` esteja fora de 1990–2100.
- Exclui esses registros órfãos (DELETE), pois nascem de erro de digitação e não têm valor histórico.
- Cria um CHECK via trigger (não constraint) bloqueando inserts/updates futuros com ano fora do range, como segunda camada de proteção além da validação de UI.

**Opção B — você corrige manualmente:**

1. Abrir a aba **Férias** filtrando por Rostephania.
2. Localizar o lançamento com data 0225-... e clicar em editar ou excluir.
3. Se não aparecer na lista (porque o ano é 0225 e os filtros padrão escondem), eu adiciono temporariamente um botão "Mostrar registros com ano inválido" para que ele apareça.

### 3. Fora de escopo

- Não vou alterar `buildPeriodosAquisitivos` nem o cálculo de períodos aquisitivos — ele está correto, só reflete o lixo que entrou.
- Não vou mexer em outros módulos (afastamentos, folgas) nesta etapa; podemos replicar o `min/max` neles depois se quiser.

## Decisão necessária

Confirma a **Opção A** (migração que limpa registros com ano fora de 1990–2100 + trigger de proteção)? Se preferir a **Opção B**, me avise para eu só aplicar a validação de UI e adicionar o filtro temporário. Opção A, pois a B não aparece mais 0225 no sistema. Sumiu da tela, só está no banco.