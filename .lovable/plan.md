Vou corrigir o problema no formulário de edição de férias, especificamente nos dados de exceção/venda/gozo diferente que já estão salvos mas somem ao abrir o modal.

## Diagnóstico

O problema não parece estar no salvamento nem na consulta principal. A lógica atual chega a buscar `ferias_gozo_periodos` ao abrir o diálogo de edição, mas logo depois o componente `ExcecaoPeriodosSection` executa efeitos automáticos de “reset” quando `isHydrating` passa de `true` para `false`.

Na prática, acontece isto:

```text
1. Clica em Editar Anderson
2. FeriasDialog carrega os períodos salvos de ferias_gozo_periodos
3. Define excecaoTipo, distribuição, dias vendidos e excPeriodos
4. Hydration termina
5. ExcecaoPeriodosSection entende isso como mudança manual do usuário
6. Limpa distribuição e periodos
7. Os campos aparecem vazios/ocultos no modal
```

Isso explica por que os dados não aparecem mesmo estando cadastrados.

## Plano de correção

### 1. Impedir reset automático após hidratação
No arquivo `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx`, vou ajustar os efeitos que limpam dados para que eles só rodem em ações reais do usuário, não no primeiro carregamento da edição.

Mudanças principais:
- Remover ou substituir o efeito que faz:
  - `onDistribuicaoTipoChange("")`
  - `onPeriodosChange([])`
  ao detectar `excecaoTipo`.
- Trocar essa limpeza automática por handlers explícitos nos botões:
  - quando o usuário clicar em “Vender dias de férias”
  - quando clicar em “Gozo em datas diferentes”
- Preservar os períodos já carregados quando o modal abre em edição.

### 2. Ajustar mudança de “dias vendidos” para não limpar dados carregados
Hoje existe outro efeito que, ao mudar `diasVendidos`, zera temporariamente a distribuição para recalcular os campos. Esse efeito também pode disparar depois da hidratação e apagar os dados salvos.

Vou ajustar para:
- não rodar no primeiro carregamento do registro;
- preservar períodos `gozo_diferente` paralelos no caso misto;
- só recalcular quando o usuário realmente alterar a quantidade de dias vendidos.

### 3. Melhorar a hidratação do caso misto Anderson
No `src/components/ferias/ferias/FeriasDialog.tsx`, vou reforçar a leitura para o caso:

```text
Venda de dias + gozo real diferente do contador
```

Ajustes:
- manter todas as linhas vindas de `ferias_gozo_periodos`, separando por `tipo` (`vender` e `gozo_diferente`);
- inferir corretamente a distribuição usando apenas as linhas de venda quando houver mistura;
- manter `excecaoTipo = "vender"` quando houver venda, mas sem descartar as linhas `gozo_diferente`;
- se não houver linhas em `ferias_gozo_periodos`, criar fallback a partir dos campos legados (`gozo_quinzena1_*`, `gozo_quinzena2_*`, `dias_vendidos`, `quinzena_venda`).

### 4. Corrigir a renderização dos períodos carregados
No `ExcecaoPeriodosSection.tsx`, vou garantir que:
- a seção de venda mostre os campos de gozo já salvos;
- a seção paralela “Gozo real diferente do enviado ao contador” apareça quando houver linhas `tipo = "gozo_diferente"`;
- os campos de data carreguem imediatamente, sem precisar alternar entre “Livre” e “2º Período”.

### 5. Validação final
Depois da implementação, vou verificar os principais fluxos:

```text
Editar férias simples
Editar venda padrão
Editar venda como exceção
Editar gozo em datas diferentes
Editar caso misto: venda + gozo diferente
Salvar sem alterar e reabrir
```

## Arquivos que serão alterados

- `src/components/ferias/ferias/FeriasDialog.tsx`
- `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx`

Não deve ser necessária alteração no banco de dados, porque a tabela `ferias_gozo_periodos` já possui os campos necessários (`tipo`, `referencia_periodo`, `dias`, `data_inicio`, `data_fim`).