# Contas bancárias por usuário e correção dos vencimentos

## 1. Aba Contas bancárias
- Adicionar a aba ao lado de **Centros de custo**, com usuários nas linhas, contas ativas nas colunas e marcação individual.
- Reutilizar busca, seleção de usuários e ações em lote da página de permissões.
- **Nenhuma conta marcada = nenhuma conta disponível**, conforme sua escolha. Marcar uma conta não concede acesso a uma página nem amplia os centros de custo permitidos.
- Administradores poderão gerenciar a matriz; a disponibilidade operacional seguirá as contas marcadas, inclusive para administradores, sem liberação automática de todas.
- Aplicar a restrição aos seletores, consultas e gravações relacionadas às contas em lançamentos, pagamentos e recorrências, além de conferir os caminhos de repasses que utilizem contas bancárias.
- Não ocultar lançamentos inteiros apenas porque têm uma conta não autorizada: preservar o acesso permitido ao lançamento e seu histórico, sem expor os dados da conta nem permitir utilizá-la em novas operações. Uma edição de outro campo deve preservar o vínculo existente sem exigir troca da conta.
- Não atribuir automaticamente todas as contas aos usuários existentes; os administradores farão as marcações. A implantação pode deixar seletores vazios até essa configuração.

## 2. Corrigir o status de vencimento
### Diagnóstico confirmado
A auditoria registra dois lançamentos alterados em **05/10/2026**, de vencimento **02/10 para 10/10**, mantendo o status **Vencido**. Isso explica o caso relatado em 06/10. Os gatilhos atuais de lançamentos não recalculam o status ao alterar a data; a rotina de vencidos apenas marca atrasos, sem corrigir esse caminho inverso.

### Correção
- Centralizar a coerência de vencimento no banco, cobrindo cadastro, edição, estorno, geração de recorrências e rotinas automáticas.
- Vencimento no dia de referência ou no futuro não deve ficar como **Vencido**; vencimento anterior ao dia de referência deve refletir atraso quando não houver quitação.
- Usar o dia de **Fortaleza (UTC−3)** tanto no banco quanto na rotina diária. A rotina atualmente utiliza UTC, o que também pode antecipar a virada do dia, mas não explica sozinho a diferença de quatro dias do exemplo.
- Preservar pagamentos parciais, pagamentos completos, cancelamentos, estados Quitado/GIMOB e baixas de veículos; não transformar um lançamento já liquidado em pendente ao trocar a data.
- Conferir a ordem dos gatilhos para não marcar parcelas automáticas como edição manual apenas por atualização automática do status.
- Revisar os registros inconsistentes com a regra validada e corrigir somente os necessários, mantendo auditoria e sem alterar datas ou pagamentos.

## Detalhes técnicos
- Criar tabela separada de permissões de contas por usuário, com unicidade do vínculo, grants explícitos, RLS e gestão autorizada por papéis armazenados em `user_roles`.
- Aplicar validação no servidor, além da interface, sem depender de armazenamento do navegador; revisar policies permissivas que possam contornar o novo escopo.
- Manter a gestão administrativa das contas distinta da autorização para usá-las operacionalmente.
- Atualizar consultas e caches após mudanças na matriz, respeitando as permissões por aba e centro de custo.
- Implementar normalização/validação de status sem recursão e alinhar as funções de recálculo e a rotina diária.

## Verificação e entrega
- Testar nenhuma conta, uma conta, várias contas, acesso negado por chamada direta e impossibilidade de um usuário conceder acesso a si próprio.
- Conferir persistência das marcações, ações em lote e preservação de vínculos históricos.
- Testar o exemplo concreto: em **06/10/2026**, vencimento **10/10/2026** não pode estar vencido; editar **02/10 para 10/10** deve corrigir o status imediatamente.
- Testar o próprio dia do vencimento, dia seguinte, virada UTC/Fortaleza, estorno, pagamento parcial, quitação e baixa de veículo.
- Registrar as alterações em `/dev` e as decisões técnicas na documentação do projeto.
- Validar os fluxos com sessão real se disponível; se a sessão de teste do Supabase externo continuar indisponível, informar separadamente a conferência visual pendente, sem declarar esse fluxo validado.