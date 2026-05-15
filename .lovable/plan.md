
## Problema

Dois pontos do `FeriasDialog` apagam dados sem necessidade quando o usuário só navega entre abas/botões:

### Bug 1 — Aba "Padrão" zera Motivo e Justificativa da Exceção
`src/components/ferias/ferias/FeriasDialog.tsx`, linha 1409:

```tsx
onClick={() => {
  form.setValue("is_excecao", false);
  form.setValue("excecao_motivo", "");          // <- apaga
  form.setValue("excecao_justificativa", "");   // <- apaga
}}
```

Clicar em "Padrão" e voltar a "Exceção" perde o que estava preenchido/salvo. Esses campos só são validados quando `is_excecao === true`, então não há razão para limpá-los aqui.

### Bug 2 — Em "Vender dias", alternar Ambos → 2º Período some com o card e zera as datas
`src/components/ferias/ferias/ExcecaoPeriodosSection.tsx`:

- O botão de distribuição (linhas 446–463) só dispara `onDistribuicaoTipoChange(tipo)`. Não ajusta a lista `periodos`.
- O efeito de inicialização (linhas 240–288) considera "compatível" qualquer estado que contenha a referência esperada — então ao sair de `"ambos"` (refs `[1, 2]`) para `"2"`, ele detecta `refsAtuais.includes(2)` e não faz nada.
- O render do período único (linha 481) exige `venderPeriodos.length === 1`. Como ainda existem 2 períodos, nada aparece.
- Para "consertar visualmente", o usuário clica Ambos → Livre → 2º. Ao passar por "Livre", o efeito reinicializa do zero (refs `[0]`), e ao voltar para "2" cria um novo período com `data_inicio: ""`, perdendo o que estava salvo.

O mesmo padrão afeta a transição inversa (2º → Ambos: o segundo período renasce vazio em vez de manter o que existia).

## O que fazer

Reduzir a um princípio: **só limpar dados quando o usuário muda a intenção; nunca em cliques que apenas navegam.**

### Correção Bug 1
Em `FeriasDialog.tsx` linha 1408–1410, remover os dois `setValue("excecao_motivo", "")` e `setValue("excecao_justificativa", "")`. Manter apenas `form.setValue("is_excecao", false)`. Os valores ficam preservados no estado do formulário e voltam a aparecer ao reabrir "Exceção". Como o schema os marca como `optional()` e a validação de obrigatoriedade só é aplicada quando `is_excecao` é true (linha 1345), não há risco de salvar lixo no banco.

### Correção Bug 2
Tratar a transição de `distribuicaoTipo` no próprio handler do botão (linha 459 de `ExcecaoPeriodosSection.tsx`), preservando os dados quando possível, em vez de depender do `useEffect` reinicializador.

Lógica do novo handler para o modo `vender`:

1. Se `tipo === distribuicaoTipo`: no-op.
2. Separar `keepParalelo` (linhas com `tipo === "gozo_diferente"`) e `vender` (demais).
3. Para o novo `tipo`:
   - `"1"`: pegar o item existente com `referencia_periodo === 1` (se houver), ajustar `dias = diasGozo` e recalcular `data_fim` mantendo `data_inicio`. Se não houver, criar vazio.
   - `"2"`: idem para `referencia_periodo === 2`.
   - `"ambos"`: garantir 1 item com ref 1 e 1 item com ref 2. Se já existirem, **manter** seus `data_inicio` e recalcular `data_fim`. Se faltar algum, criar vazio com metade dos dias.
   - `"livre"`: se já existir item com ref 0, manter; senão converter o(s) existente(s) em uma única entrada ref 0 com `diasGozo`, preservando `data_inicio` do primeiro item com data preenchida.
4. `onPeriodosChange([...novosVender, ...keepParalelo])` e então `onDistribuicaoTipoChange(tipo)`.

Para o modo `gozo_diferente` (linhas 692–702), aplicar a mesma ideia mais simples: ao mudar para `"1"`, `"2"` ou `"ambos"`, manter os sub-períodos cujas `referencia_periodo` continuam relevantes e descartar apenas as referências que deixam de aparecer. Nunca zerar a lista inteira.

Com isso, o `useEffect` da linha 240 passa a só agir em casos realmente vazios (cadastro novo) — adicionar a guarda `if (periodos.length > 0) return;` no início desse efeito reforça que nunca sobrescreve dados existentes ao mudar `distribuicaoTipo`. O efeito de reconciliação pós-hidratação (linhas 294–340) permanece como rede de segurança apenas quando a lista está realmente vazia.

## Detalhes técnicos

- Arquivos afetados: `src/components/ferias/ferias/FeriasDialog.tsx` (linha 1409), `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx` (handlers dos botões em ~459 e ~698, e endurecimento dos `useEffect` em 240 e 294).
- Sem mudança de schema, sem migrations, sem alteração na persistência (`onSubmit` continua lendo `excPeriodos` e os campos do form como já faz).
- Helper `calcEndDate` já existe e é usado para recalcular `data_fim` quando `dias` muda.
- Não mexer em outras regras (preview de folgas, bloqueio de meses, etc.) — escopo restrito a preservação de estado da UI.

## Validação

1. Editar férias do Pedro → ir em Exceção → preencher Motivo + Justificativa → clicar Padrão → clicar Exceção: campos continuam preenchidos.
2. Editar férias com venda em "Ambos" com datas salvas → clicar "2º Período": card do 2º período aparece imediatamente com a `data_inicio` salva. Voltar a "Ambos": o 1º período reaparece com sua data preservada.
3. Cadastro novo (sem dados) continua funcionando: ao escolher "Ambos" pela primeira vez, os dois períodos são criados vazios como hoje.
