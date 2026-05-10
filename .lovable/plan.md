## Problema 1 — Distribuição do gozo confusa quando gozo > 15 dias

**Onde:** `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx` (linhas 177, 432-444 — botões de distribuição no modo "vender").

**Comportamento atual:** quando o colaborador vende dias mas o gozo restante (`diasGozo = diasDisponiveis - diasVendidos`) é maior que 15, os botões "1º Período" e "2º Período" continuam habilitados. Ao clicar, o sistema cria um período único de 20 dias dentro de uma quinzena de 15 — não há campo de data renderizado de forma coerente, e o usuário fica perdido. Caso similar ocorre no modo "gozo_diferente" (linhas 670-700) quando, por regra, só "Ambos" faz sentido.

**Mudanças:**

1. Calcular um flag `singlePeriodInviavel = diasGozo > 15` no escopo do componente.
2. No render dos botões de distribuição (modo `vender`, linhas 432-443):
   - Manter os botões "1º Período" e "2º Período" visíveis, porém com `disabled={singlePeriodInviavel}` e `title` explicativo no hover.
   - Adicionar um `<Alert>` informativo logo acima ou abaixo dos botões, condicional a `singlePeriodInviavel`, com texto:
     "Como o gozo é de {diasGozo} dias (acima de 15), só é possível distribuir em **Ambos** os períodos ou **Livre**. Para usar apenas um período, aumente os dias vendidos para que sobrem no máximo 15 dias de gozo."
3. Auto-correção: efeito que, se `singlePeriodInviavel && (distribuicaoTipo === "1" || distribuicaoTipo === "2")`, força `onDistribuicaoTipoChange("ambos")` (respeitando `isHydrating`, igual ao efeito de `q1JaGozada`).
4. Repetir o mesmo padrão no bloco `gozo_diferente` (linhas ~670-680): "1º Período" e "2º Período" só fazem sentido quando há 15 dias disponíveis para um único período. Como o modo `gozo_diferente` cria sempre 15 dias por bloco (linhas 263-270), a desabilitação ocorre quando `q1JaGozada === false && diasDisponiveis > 15` — manter "Ambos" como única opção válida quando o cenário exige (na prática, quando ainda há os 30 dias completos para gozar e o usuário escolheu "gozo em datas diferentes" precisa marcar os dois).

## Problema 2 — Conflito com Gabriella não atualiza após mudar setores substitutos de Jair

**Onde:** `src/components/ferias/ferias/FeriasDialog.tsx`, função `checkConflicts` (linhas 694-929), e `useEffect` que dispara recheck (linhas 931-939).

**Causa provável:**
- A regra de conflito é simétrica e considera 3 casos: (a) mesmo setor titular, (b) eu cubro o setor titular do outro, (c) **o outro cobre meu setor titular** (linhas 709-712, 718-720, 731-740). Se o usuário removeu Gabriella como substituta de Jair, o conflito ainda persiste se Gabriella permanece cadastrada como substituta do setor titular do Jair (caso c) — mas o usuário não percebe isso porque a UI só fala em "conflito de setor".
- Adicionalmente, o `useEffect` de recheck só dispara quando mudam campos do formulário (`watchedFields`, `excecaoTipo`, `excPeriodos`, etc.). Reabrir o dialog após mudar substitutos em outra tela não força revalidação se o cache do React Query do FeriasDialog ainda estiver válido.

**Mudanças:**

1. **Refetch ao abrir o dialog:** adicionar `open` e `ferias?.id` como dependências do `useEffect` (linha 939) para garantir que `checkConflicts` rode toda vez que o dialog é aberto, sem cache.
2. **Invalidar/forçar consulta direta:** as queries de `ferias_colaborador_setores_substitutos` em `checkConflicts` já são feitas direto ao Supabase (não usam React Query), então estão sempre frescas. Apenas garantir que o efeito dispare.
3. **Mensagem de conflito mais clara:** no push para `foundConflicts` (linha 825-826 e 830-834), além do tipo, incluir uma frase explicativa do *motivo do vínculo*:
   - `"Mesmo setor titular ({nome do setor})"`
   - `"Você é substituto do setor titular de {nome} ({nome do setor})"`
   - `"{nome} é substituto do seu setor titular ({nome do setor})"`
   Isso elimina a percepção de "conflito fantasma" — o usuário entende exatamente por qual vínculo Gabriella aparece e pode agir (remover Gabriella como substituta do setor de Jair, por exemplo).
4. **Botão "Recarregar conflitos"** opcional ao lado do título do bloco de conflitos (linha ~1705) chamando `checkConflicts(form.getValues())` manualmente — útil quando o usuário ajusta substitutos em outra aba e volta.

## Detalhes técnicos

- Tipo `ConflictInfo` (atualmente com `colaborador_nome`, `tipo`, `periodo`) ganha campo opcional `motivo_vinculo?: string` para a explicação detalhada. Onde o conflict é renderizado (linhas 1705-1720), exibir o motivo abaixo do nome em texto menor/`text-muted-foreground`.
- Nenhuma mudança de schema necessária.
- Manter regras de RLS e padrões PT-BR.

## Arquivos a modificar

- `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx`
- `src/components/ferias/ferias/FeriasDialog.tsx`
