# Correções no módulo de Férias

## 1. Aviso "Férias já enviada ao contador" quebrado

No diálogo de Editar Férias, esse alerta laranja no topo aparece com texto amassado e ainda contribui para o scroll duplo do diálogo.

- Reescrever o alerta em layout compacto: título em uma linha e o texto em uma única linha fluida, com `text-sm leading-relaxed` e quebra normal (sem `break-words` forçando quebras estranhas).
- Encurtar o texto: "Enviada ao contador em 27/07/2026. Alterações aqui ficam só no sistema interno."

## 2. Scroll duplo / espaço em branco no fim do diálogo

Hoje `DialogContent` usa `max-h-[90vh] overflow-y-auto`, e o conteúdo interno também rola, gerando duas barras e uma área vazia ao final.

- Transformar o diálogo em coluna com altura limitada: header fixo, uma única área rolável para o formulário e a barra de botões fixa no rodapé.
- Remover o `overflow-y-auto` do container externo, deixando o scroll apenas na área do formulário, e eliminar o padding-bottom excedente que cria o espaço em branco.
- Aplicar o mesmo ajuste no diálogo de Visualizar Férias.

## 3. Vanésia: cadastro padrão com venda no 2º período não aparece na visualização

Cenário: 2º período oficial 07/10 a 21/10/2026, 10 dias vendidos, gozo real de 13/10 a 17/10.

Hoje, quando o cadastro é Padrão (sem exceção), o diálogo de Visualizar mostra só "Vendido: 10 dias" e um período de gozo calculado automaticamente (contíguo), ignorando as datas reais gravadas em `gozo_quinzena2_inicio/fim`.

- Na visualização, quando existirem datas de gozo gravadas para um período (mesmo sem exceção/flexível), mostrar:
  - Período oficial: 07/10 a 21/10/2026
  - Gozo: 13/10 a 17/10/2026 (5 dias)
  - Vendidos: 10 dias — 07/10 a 12/10 e 18/10 a 21/10 (faixas derivadas do que sobra do período oficial fora do gozo)
- Só usar o cálculo automático atual quando não houver datas reais de gozo cadastradas.

## 4. Diálogo reabre na aba "Exceção" mesmo tendo salvo como "Padrão"

Ao reabrir, o formulário infere exceção a partir de `vender_dias`/`gozo_diferente`, então qualquer venda vira "Exceção".

- Respeitar o que foi salvo: usar apenas `is_excecao` (e `gozo_flexivel`, que só existe em cadastro de exceção) para escolher a aba inicial.
- Não forçar `is_excecao = true` na hidratação quando o registro é uma venda padrão (até 10 dias) sem períodos flexíveis.
- Manter a regra que exige exceção quando a venda passa de 10 dias.

## 5. Falso conflito relatado pela Germana (conflito com Taysa sem sobreposição real)

Na checagem de conflitos, para as férias já existentes de outra pessoa o sistema monta os intervalos de ausência assim: se não for flexível e não estiver marcada como "gozo diferente", usa os períodos oficiais completos. Um registro de venda padrão (Taysa) tem `gozo_diferente = false`, mas o gozo real está em `gozo_quinzena1/2` — então o sistema compara os 15 dias oficiais em vez dos dias realmente gozados, acusando conflito em dias que a pessoa está trabalhando (vendidos).

- Corrigir a montagem dos intervalos do registro existente: quando houver datas de gozo gravadas (`gozo_quinzena1_inicio/fim`, `gozo_quinzena2_inicio/fim`), usar essas datas como ausência real, independentemente das flags `gozo_diferente`/`gozo_flexivel`.
- Para o período sem datas de gozo, continuar usando o período oficial; ignorar períodos 100% vendidos (15 dias vendidos naquele período).
- Aplicar a mesma correção nos dois lugares que comparam datas: conflito por setor/substituição e conflito familiar.

## Detalhes técnicos

- `src/components/ferias/ferias/FeriasDialog.tsx`
  - layout do `DialogContent` (flex-col, scroll único, footer fixo) e alerta do contador
  - hidratação: `inferredIsExcecao` deixa de considerar `vender_dias`/`gozo_diferente`
  - `checkConflicts`: extrair um helper `intervalosAusencia(registro, gozoPeriodos)` usado nos dois loops
- `src/components/ferias/ferias/FeriasViewDialog.tsx`
  - mesmo ajuste de scroll
  - exibição de gozo real + faixas vendidas derivadas para cadastros padrão com venda
