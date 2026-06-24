## Resposta: não criei e não precisei

O `estoque_placas_saldo_trigger.sql` previsto no plano anterior **não foi criado** porque o código JavaScript já cuida da sincronização placa ↔ saldo inserindo registros em `estoque_movimentacoes` (que é o que abate/reabastece o saldo via mecanismo já existente).

## Onde isso já está implementado

Todos os fluxos que alteram status de placa já criam a movimentação correspondente:


| Ação                                                              | Arquivo                                    | Movimentação criada                                              |
| ----------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| Instalar placa em imóvel (botão por linha)                        | `EstoquePlacas.tsx` → `instalarMutation`   | `saida` -1 do local de origem                                    |
| Retirar placa do imóvel (retorno)                                 | `EstoquePlacas.tsx` → `retirarMutation`    | `entrada` +1 no local de destino                                 |
| Registrar roubo/perda                                             | `EstoquePlacas.tsx` → `perdaRouboMutation` | `saida` -1 do local de origem                                    |
| Nova saída unificada (selecionar disponível OU criar novo código) | `NovaSaidaDialog.tsx` → `mutation`         | `saida` -1 do local                                              |
| Pré-cadastro de placa em Materiais                                | `NovaPlacaDialog.tsx`                      | **nenhuma** (proposital — saldo é controlado em /estoque/saldos) |


## Por que evitei o trigger SQL

1. **Duplicação de regra**: como o JS já insere a movimentação, um trigger inseriria de novo a cada UPDATE de status — gerando saldo dobrado.
2. **Pré-cadastro sem mexer no saldo**: a regra "criar código em Materiais não afeta saldo" é mais fácil de garantir do lado da aplicação. Um trigger global em `estoque_placas` precisaria de uma flag/coluna para distinguir "criado como rastreio" de "criado direto em saída" — adiciona complexidade.
3. **Validação de saldo antes da saída**: o `NovaSaidaDialog` já bloqueia a saída quando `saldoLocal <= 0`, ação que um trigger faria tarde (depois do INSERT).

## Quando valeria criar o trigger

Apenas se:

- Você quiser permitir mudar status de placa **direto pelo Supabase Studio** ou via outra interface fora desses dialogs.
- Quiser uma garantia "defesa em profundidade" no banco mesmo que o JS falhe.

Se for o caso, posso criar um trigger **idempotente** que só insere movimentação quando ela ainda não existe para aquele evento (via observação textual ou nova coluna `placa_evento_id` em `estoque_movimentacoes`). Mas, do jeito atual, o sistema está consistente sem ele.

## Próximo passo

Me confirma uma das opções:

1. **Manter como está** (sem trigger). Eu apenas atualizo o `.lovable/plan.md` removendo a menção ao arquivo SQL que não foi criado.
2. **Criar o trigger mesmo assim** como rede de segurança — e, neste caso, remover as inserções de movimentação do JS para não duplicar.

Qual prefere? Manter como está.

&nbsp;