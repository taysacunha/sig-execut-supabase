Contexto: Na tela de Cadastros de Despesas existe uma aba "Perfis de acesso" (`despesas_perfis_acesso`). Ela é apenas um cadastro genérico e não está integrada ao controle de acesso real do módulo, que usa `user_roles` (perfis globais do usuário) e `despesas_aba_permissoes` (nível por aba). O usuário não encontrou essa explicação na página de ajuda e prefere remover a aba e documentar corretamente.

Objetivo: Remover a aba do menu de Cadastros e deixar a página de ajuda transparente sobre o que esse cadastro era e onde funcionam as permissões de fato.

Escopo técnico:

1. Remover a aba "Perfis de acesso" de `src/pages/despesas/DespesasCadastros.tsx`
   - Remover o `<TabsTrigger value="perfis">`.
   - Remover o `<TabsContent value="perfis">` com o `SimpleCadastroCrud` para `despesas_perfis_acesso`.
   - Não alterar a tabela `despesas_perfis_acesso` no banco (dados permanecem intactos; apenas escondemos a interface).

2. Atualizar a página de ajuda `src/pages/despesas/DespesasHelp.tsx`
   - Adicionar um card explicando que "Perfis de acesso" era um cadastro auxiliar não utilizado no controle de permissões e que a aba foi removida.
   - Reforçar no card "Permissões por aba + centros de custo" quais são os mecanismos reais de controle de acesso: `user_roles` (Super Admin, Admin, Gerente, Supervisor, Colaborador, Corretor), acesso ao módulo em `/usuarios` e `despesas_aba_permissoes`.

3. (Opcional) Remover o rótulo de auditória `despesas_perfis_acesso` em `src/components/AuditLogsPanel.tsx` apenas se não houver risco de quebrar a exibição de logs históricos. Se mantiver, o rótulo fica, já que a tabela ainda existe e pode ter registros antigos.

Não está no escopo: excluir a tabela do banco, alterar RLS, alterar o funcionamento real de permissões (`user_roles`, `system_access`, `despesas_aba_permissoes`).

Validação: Após a mudança, a tela de Cadastros de Despesas não deve mais mostrar a aba "Perfis de acesso", e a página de ajuda deve conter a explicação correspondente.