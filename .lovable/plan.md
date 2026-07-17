## Objetivo

No diálogo de mover folga de sábado (aba "Folgas do Mês"), quando o colaborador selecionado tem familiar com folga no mesmo mês, permitir escolher entre mover **ambos juntos** (comportamento atual) ou mover **apenas o colaborador selecionado**, deixando o familiar no sábado original.

## Alterações

Arquivo único: `src/components/ferias/folgas/MoverFolgaDialog.tsx`

1. Adicionar um estado local `modoMovimentacao` com valores `"ambos"` (default) ou `"apenas"`.

2. Dentro do bloco de aviso que só aparece quando existe `familiarFolga`, transformar o texto atual num aviso + um `RadioGroup` (shadcn) com duas opções:
   - **"Mover ambos juntos"** (recomendado) — mantém a regra de familiares folgando juntos.
   - **"Mover apenas este colaborador (exceção)"** — o familiar permanece no sábado original. Um texto complementar deixa claro que isso quebra a regra e será registrado como exceção.

3. Ajustar a mutation:
   - Continuar sempre movendo a folga principal.
   - Só executar o update da folga do familiar quando `familiarFolga && modoMovimentacao === "ambos"`.
   - Quando `modoMovimentacao === "apenas"`, gravar `excecao_motivo: "Mudança de sábado (familiar mantido)"` e uma justificativa explicando que o familiar foi intencionalmente mantido no sábado original, para ficar rastreável no histórico/auditoria.

4. Ajustar textos dependentes de `familiarFolga`:
   - Texto do botão: `"Mover Ambos"` quando modo `ambos`, `"Mover Apenas Este"` quando modo `apenas`, `"Mover Folga"` quando não há familiar.
   - Toast de sucesso: incluir mensagem específica para o caso `apenas` (ex.: *"Folga movida. Familiar mantido no sábado original."*).

5. Resetar `modoMovimentacao` para `"ambos"` ao fechar o diálogo (junto com o reset de `newSaturday`), para não vazar estado entre aberturas.

Nenhuma alteração de schema, RLS, hooks ou outros componentes é necessária — todo o comportamento já é suportado pelas colunas existentes (`is_excecao`, `excecao_motivo`, `excecao_justificativa`) da tabela `ferias_folgas`.

## Fora do escopo

- `TrocarFolgaDialog` e `MoverFolgasLoteDialog` continuam com o comportamento atual (troca só ocorre quando ambos os lados têm familiar com folga, ou nenhum tem). Se quiser a mesma flexibilidade lá, é uma segunda solicitação.
