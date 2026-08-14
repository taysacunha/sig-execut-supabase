# Confirmação de alterações ao editar Férias

## Objetivo
Impedir mudanças silenciosas em férias: ao editar uma férias existente e clicar em Salvar, exibir um diálogo de confirmação que mostre, campo a campo, **o que está cadastrado hoje** e **para o que vai mudar**, com os botões "Cancelar" e "Confirmar alterações".

## Sobre o caso relatado (Taysa)
Não posso afirmar a causa sem consultar os dados. Antes de implementar, o primeiro passo é levantar o histórico:
- consultar `ferias_audit_logs` filtrando o registro da Taysa (ações de UPDATE, autor e data);
- comparar os valores atuais de `is_excecao`, `gozo_flexivel`, `distribuicao_tipo` e das linhas em `ferias_gozo_periodos`.

Se o histórico mostrar um UPDATE feito por um usuário, foi edição manual. Se não houver registro correspondente, a mudança veio de migração/processo em lote e aí investigo qual. O resultado é reportado antes de seguir com o restante.

## O que será implementado

### 1. Diálogo de confirmação de alterações
Novo diálogo aberto apenas em modo edição e apenas quando houver diferenças reais:
- lista de linhas "Campo — Antes → Depois", com valores em português (datas dd/MM/yyyy, Sim/Não, rótulos de tipo);
- destaque para mudança de natureza do cadastro (Padrão ↔ Exceção);
- bloco separado "Períodos de gozo" comparando a lista antiga com a nova;
- botões "Cancelar" (volta ao formulário sem salvar) e "Confirmar alterações".

### 2. Campos comparados
- Colaborador; 1º período (início/fim); 2º período (início/fim) e cancelamento do 2º período (motivo/justificativa)
- Tipo de cadastro: Padrão x Exceção, motivo e justificativa da exceção
- Gozo diferente e datas de gozo (Q1/Q2)
- Venda: vende dias, dias vendidos, período da venda, dias vendidos por quinzena
- Gozo flexível e tipo de distribuição
- Subperíodos de gozo: quantidade, tipo, referência, datas e dias

### 3. Registro em auditoria
Ao confirmar, gravar um evento `ALTERACAO_FERIAS` via `registrar_evento_ferias` com o mesmo diff exibido no diálogo, para que dúvidas futuras do tipo "quem mudou isso?" sejam respondidas na tela de Logs de Férias.

## Detalhes técnicos
- Em `src/components/ferias/ferias/FeriasDialog.tsx`, extrair a montagem do `payload` (hoje dentro de `mutation.mutationFn`) para uma função pura `buildPayload(data)`, para que o diff possa ser calculado antes de salvar.
- Em `onSubmit`, após as validações atuais, calcular o diff entre (férias original + períodos de gozo originais) e (payload novo + subperíodos editados). Se estiver editando e houver diferenças, guardar os dados em estado e abrir o diálogo de confirmação em vez de chamar `mutation.mutate`. Sem diferenças, ou em criação, salva direto.
- Novo componente `src/components/ferias/ferias/ConfirmarAlteracoesFeriasDialog.tsx` (apenas apresentação) e helper `src/lib/feriasDiff.ts` com rótulos e formatadores dos campos.
- Os eventos de auditoria já existentes (cancelamento do 2º período e correção de quinzena de venda) continuam funcionando como hoje.