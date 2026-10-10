# Homepage, preferências de notificações e ações de centros de custo

## 1. Voltar para Homepage em `/dev`
- Adicionar no topo um botão com ícone de início e texto **Homepage**, levando à seleção de sistemas (`/`).
- Disponibilizar o retorno também na tela de acesso restrito, sem mudar quem pode acessar o Registro de Desenvolvimento.

## 2. Corrigir o salvamento das preferências
**Causa confirmada:** a tabela de preferências usa `user_id`, não possui `id`, mas a função de auditoria tenta acessar `NEW.id`/`OLD.id`. Isso quebra o salvamento, inclusive ao habilitar “Notificar quando pago”.

- Ajustar a auditoria para identificar o registro por `id` ou, nas preferências, por `user_id`, sem acessar um campo inexistente.
- Preservar a auditoria e a proteção que permite ao usuário alterar apenas suas próprias preferências.
- Verificar criação e atualização das preferências, habilitando e desabilitando “Notificar quando pago”, com leitura posterior do valor salvo.
- A inspeção dos gatilhos que usam essa função identificou apenas a tabela de preferências sem coluna `id`; proteger também os caminhos de inclusão e exclusão dessa tabela.

## 3. Separar desativar e excluir em Centros de custo
**Situação confirmada:** a lixeira atual apenas marca o centro como inativo. A política de edição também permite exclusão a quem edita Cadastros, portanto esconder o botão não basta.

- Criar uma ação com ícone de desligar e identificação **Desativar**, mantendo a permissão atual exigida para essa ação e pedindo confirmação.
- Fazer a lixeira executar **exclusão definitiva**, com confirmação própria e aviso de irreversibilidade, tanto para centros ativos quanto inativos.
- Mostrar e autorizar a exclusão somente para **admin** ou **superadmin**, respeitando o acesso a Cadastros; validar a restrição também no banco.
- Não alterar as ações das outras abas de Cadastros.
- Bloquear exclusão quando o centro estiver vinculado a lançamentos, imóveis, bens, recorrências, repasses, veículos ou contas bancárias. Mostrar uma mensagem clara orientando a desativar em vez de apagar.
- Não apagar registros dependentes nem retirar silenciosamente o centro dos veículos ou das contas bancárias. Se o centro sem uso for excluído, remover suas vinculações de permissão junto com ele.
- Atualizar a listagem e os seletores de centros após desativação ou exclusão.

## Detalhes técnicos
- Ajustar `DevTracker.tsx` e limitar a alteração de `DespesasCadastros.tsx` à configuração de Centros de custo.
- Corrigir `audit_module_changes()` por migration, extraindo a chave do registro convertido para JSON, conforme a operação.
- Separar as políticas de inclusão, atualização e exclusão de `despesas_centros_custo`, removendo a permissão de exclusão concedida pela política atual de todas as operações.
- Implementar exclusão protegida, verificando vínculos sem depender do que o usuário consegue enxergar nas outras abas. Manter permissões de execução restritas e validação de perfil no servidor.
- Manter apenas um dos dois gatilhos idênticos de auditoria encontrados em Centros de custo, evitando registrar a mesma ação duas vezes.

## Validação e registro
- Testar persistência das preferências e auditoria sem erro de campo inexistente.
- Testar exclusão permitida para admin/superadmin e negada para os demais perfis, inclusive por chamada direta.
- Testar que desativação preserva o registro, exclusão remove um centro sem uso e vínculos impedem exclusão sem perdas.
- Conferir o retorno à Homepage e as duas confirmações na interface; a validação autenticada dependerá de sessão disponível no ambiente de teste.
- Registrar as correções de Despesas em `/dev`; não registrar o desenvolvimento do próprio botão da página `/dev`.