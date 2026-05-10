# Distribuição rígida em setores pequenos

## Problema

No `GeradorFolgasDialog.tsx`, dois colaboradores do mesmo setor (ex.: Apoio com 3 elegíveis e 4+ sábados) estão sendo alocados no mesmo sábado, mesmo havendo sábado vazio do setor.

A lógica atual *prefere* sábados sem o setor (`satsSemSetor`), mas falha em alguns cenários:

1. **Ordem entre setores**: sectores com substitutos misturados podem alocar uma unidade em um sábado que depois empilha o Apoio quando outra unidade do Apoio tem `availableSaturdays` reduzido por chefes/conflitos.
2. **Rebalanceamento global (Step 7)**: tenta nivelar pessoas/sábado e pode mover unidade para um sábado já ocupado pelo mesmo setor (a guarda atual `destCount > 0 && srcCount <= 1` permite empilhar quando a fonte tem só 1 do setor).
3. **Empilhamento aceito como "sem alternativa"** quando, na verdade, existe um sábado livre do setor mas indisponível só para *aquela* unidade — a unidade já alocada poderia ter sido colocada em outro lugar.

A regra desejada: **em setores onde nº de unidades ≤ nº de sábados disponíveis e não há vínculo familiar entre os colaboradores empilhados, é proibido colocar dois no mesmo sábado**. Famílias continuam compartilhando sábado normalmente.

## Mudanças

Arquivo único: `src/components/ferias/folgas/GeradorFolgasDialog.tsx`.

### 1. Reforçar regra "no-stacking" em setores pequenos (Step 6A)

Para cada `setoresRestritos` (unidades ≤ sábados):

- Se `unit.availableSaturdays` tem ao menos um `sat` com `sectorSaturdayCount[setorId][sat] === 0`, **só** considerar esses candidatos. Nunca cair no fallback que empilha. Manter o tratamento de chefe-conflict como hoje.
- Se *todos* os sábados disponíveis daquela unidade já têm o setor (ou seja, empilhamento é mesmo inevitável para essa unidade), aí sim cair no fallback atual e logar diagnóstico.

### 2. Corrigir guarda do rebalanceamento global (Step 7)

Substituir a condição que permite mover para sábado já ocupado pelo mesmo setor:

```text
if (destCount > 0 && srcCount <= 1) return false;
```

por uma versão mais estrita: **bloquear qualquer move que aumente empilhamento de setor** quando o setor é pequeno (`unitsBySetorId[sid].length <= saturdaysOfMonth.length`). Famílias seguem isentas (são do mesmo setor por definição e contam como 1 unidade).

### 3. Nova fase de pós-rebalanceamento por setor (Step 7.5)

Após o rebalanceamento global, rodar uma varredura por setor que:

- Para cada setor restrito com algum sábado tendo `sectorSaturdayCount[sid][sat] >= 2`:
  - Identificar um sábado vazio do setor (`count === 0`) que esteja em `availableSaturdays` de alguma unidade *single* atualmente empilhada.
  - Se não houver `chefeConflict` no destino e o move não criar empilhamento em outro setor pequeno, mover a unidade.
  - Repetir até não haver mais movimentos possíveis ou todos os sábados do setor terem ≤ 1.

Apenas unidades `single` são candidatas a mover (famílias permanecem onde estão).

### 4. Diagnóstico

Quando o algoritmo realmente não conseguir desempilhar (sem alternativa por férias/afastamento), manter a mensagem atual `Empilhamento de setor (...)` e adicionar `— sem alternativa após pós-rebalanceamento` para distinguir de empilhamento por bug.

## Detalhes técnicos

- Sem mudança de schema, sem mudança de UI.
- Preserva regra: pares familiares sempre no mesmo sábado.
- Preserva regra: setores grandes (`> sábados`) podem empilhar normalmente — comportamento já existente.
- Funções afetadas dentro de `generatePreview()`:
  - bloco `setoresRestritos` (linhas ~695–734)
  - bloco rebalance global (linhas ~782–849)
  - novo bloco entre Step 7 e Step 8

## Validação

- Apoio com 3 elegíveis, 4 sábados: cada um em sábado diferente.
- Apoio com 2 familiares + 1 single, 4 sábados: par familiar juntos em um sábado, single em outro.
- Apoio com 4 elegíveis, 4 sábados, um com férias na metade do mês: 3 sábados distintos + 1 não-folga, sem dois no mesmo sábado.
- Setor grande (10 colabs, 4 sábados): comportamento inalterado.
