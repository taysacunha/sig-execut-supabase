# Ajustes na página Férias

Três melhorias na página `/ferias/ferias` com base no feedback:

## 1. Filtro de Ano sempre visível

**Problema:** O filtro de ano vive dentro do card de filtros da aba "Tabela de Férias". Ao trocar para "Tabela do Contador", o usuário perde a referência de qual ano está sendo exibido (e não consegue trocar sem voltar para a outra aba).

**Solução:** Mover o `Select` de ano para o cabeçalho da página, ao lado do título "Férias", fora das abas. O estado `anoFilter` continua o mesmo e passa a controlar simultaneamente as três abas (Tabela de Férias, Períodos Aquisitivos e Tabela do Contador). Mostrar um chip/badge discreto com o ano ativo nas abas internas como reforço visual.

**Arquivos:** `src/pages/ferias/FeriasFerias.tsx` e `src/components/ferias/ferias/PeriodosAquisitivosTab.tsx` (recebe `anoFilter` por prop e remove o filtro de ano interno, ou mantém apenas o controle "Todos os anos / ano específico" sincronizado).

## 2. Carregamento de dados na edição (caso Anderson)

**Problema raiz:** O caso do Anderson combina **venda de 10 dias no 1º período** + **gozo em datas diferentes do contador no 2º período** (datas oficiais 05/10–19/10, gozo real 28/09–12/10). O formulário hoje trata `excecaoTipo` como exclusivo (`"vender"` OU `"gozo_diferente"`), nunca os dois juntos. Na hidratação (linhas 562–617 de `FeriasDialog.tsx`), quando ambas as flags estão presentes, `vender` ganha e os dados de gozo diferente do 2º período não aparecem visualmente, mesmo estando salvos em `ferias_gozo_periodos`.

Também: os campos planos (`gozo_quinzena2_inicio/fim`, `gozo_venda_*`) só são preenchidos quando o registro NÃO está em modo exceção complexa. Se houver linhas em `ferias_gozo_periodos`, o caminho legacy é ignorado e nada cai naqueles campos planos.

**Solução:**

- **Hidratação combinada:** quando `ferias_gozo_periodos` retornar linhas com `tipo` misto (alguns `"vender"`, outros `"gozo_diferente"`) OU quando o registro tiver `vender_dias=true` E `gozo_diferente=true` simultaneamente, ativar um modo "misto" no diálogo: marcar `is_excecao=true`, popular `excDiasVendidos` e popular `excPeriodos` com TODAS as linhas (mantendo `referencia_periodo` e `tipo`).
- **Renderização do misto:** ajustar `ExcecaoPeriodosSection` para aceitar um modo `"misto"` (ou aceitar `excecaoTipo="vender"` mas renderizar adicionalmente os períodos com `tipo="gozo_diferente"` quando existirem). Cada referência (1º/2º) mostra: dias vendidos (read-only quando aplicável), datas oficiais para o contador e datas reais de gozo separadamente.
- **Inferência de distribuição:** ao hidratar, se houver período com `referencia_periodo=1` e outro com `=2`, definir `distribuicaoTipo="ambos"` (não escolher arbitrariamente um lado).
- **Fallback legacy:** quando NÃO houver linhas em `ferias_gozo_periodos`, mas o registro tiver `gozo_diferente=true` E `vender_dias=true`, sintetizar `excPeriodos` a partir dos campos planos (`gozo_quinzena1_*` para venda, `gozo_quinzena2_*` para gozo diferente), aplicando `tipo` por inferência: o período correspondente ao `quinzena_venda` recebe `tipo="vender"`, o outro recebe `tipo="gozo_diferente"`.
- **Salvamento:** garantir que o submit já existente (linhas ~1011–1126 com `excecaoTipo` e `excPeriodos`) preserve o `tipo` por linha em vez de gravar tudo com um `tipo` único derivado de `excecaoTipo`.

**Arquivos:** `src/components/ferias/ferias/FeriasDialog.tsx` e `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx`.

## 3. Reorganização da aba Períodos Aquisitivos

**Problema:** Hoje a aba lista todos os anos juntos em accordions. "Quitados" são apenas registro histórico e poluem a visão dos pendentes. Os cards de stats no topo (Quitados/Parciais/Pendentes/A Vencer/Vencidos) são informativos mas não clicáveis.

**Solução UI/UX:**

- **Sub-abas internas:** dentro de "Períodos Aquisitivos" criar duas abas:
  - **Pendentes** (default) — mostra apenas itens com status `pendente`, `a_vencer`, `parcial`, `vencido`. Mantém a agrupação por ano em accordion.
  - **Quitados** — mostra apenas itens com status `quitado`. Lista por ano em accordion (colapsado por padrão), para consulta histórica.
- **Cards clicáveis:** os 6 cards de stats (Total, Quitados, Parciais, Pendentes, A Vencer, Vencidos) viram filtros rápidos. Clicar em um card aplica o filtro de status correspondente e muda para a sub-aba apropriada (clicar em "Quitados" leva para a sub-aba Quitados; os demais ficam em Pendentes com `statusFilter` definido). O card ativo recebe destaque visual (ring + bg).
- **Filtro de status existente:** continua funcional; cliques nos cards atualizam-no e recebem-no de volta (estado controlado).
- **Exportar PDF:** preservado, exporta o conjunto atualmente filtrado (sub-aba + filtros).

**Arquivos:** `src/components/ferias/ferias/PeriodosAquisitivosTab.tsx`.

## Detalhes técnicos

```text
FeriasFerias.tsx
  header
    ├─ título "Férias"
    └─ Select(anoFilter)   ← MOVIDO p/ aqui
  Tabs
    ├─ Tabela de Férias  (filtros: busca, status, setor)
    ├─ Períodos Aquis.   (sub-Tabs: Pendentes | Quitados)
    └─ Tabela do Contador (filtros: mês, período)
```

- `anoFilter` permanece em `FeriasFerias`; passar `ano={anoFilter}` para `PeriodosAquisitivosTab` e remover o `yearFilter` interno (ou manter "Todos os anos" como override local).
- Em `FeriasDialog.tsx`, adicionar tipo interno `excecaoModo: "vender" | "gozo_diferente" | "misto" | null` mantendo retrocompatibilidade com `excecaoTipo`.
- Migração de schema NÃO é necessária — `ferias_gozo_periodos` já tem `tipo` e `referencia_periodo`. Apenas a leitura/renderização precisa respeitar valores mistos.
- Adicionar nota no resumo do diálogo deixando claro: "10 dias vendidos (1º período) + Gozo real diferente (2º período)".

## Fora de escopo

- Mudanças de schema/migrations.
- Reescrita do gerador automático.
- Alteração do PDF do contador.