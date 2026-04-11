
Problema identificado:
- A página `/dev` mostra os registros lendo direto da tabela `dev_tracker` em `src/pages/DevTracker.tsx`.
- Essa tabela está com RLS ativo e só permite acesso para usuário autenticado com role admin/super_admin (`.lovable/dev_tracker_migration.sql`).
- Porém a rota `/dev` em `src/App.tsx` não usa `ProtectedRoute`. Então a página abre só com o código secreto, mesmo sem sessão Supabase válida.
- Resultado: você entra na tela, mas a query em `loadFeatures()` não consegue ler `dev_tracker`, e a UI acaba parecendo “vazia”.
- Além disso, não existe no frontend nenhum uso da edge function `log-dev-work`; então um “pedido no chat” não grava automaticamente algo nessa tabela. Hoje os dados só aparecem se alguém inserir manualmente na página ou chamar essa function por fora.

O que vou corrigir:
1. Proteger `/dev` com autenticação real
- Envolver a rota `/dev` e `/dev/deploy-guide` com `ProtectedRoute`.
- Isso evita abrir a tela sem sessão e elimina o falso estado de “sem registros” para usuário deslogado.

2. Melhorar o diagnóstico da página
- Ajustar `loadFeatures()` para diferenciar:
  - sem dados de fato
  - erro de permissão/autenticação
  - falha de leitura
- Exibir mensagem clara quando o usuário estiver sem sessão ou sem permissão, em vez de mostrar lista vazia.

3. Ligar a página ao fluxo automatizado correto
- Decidir entre dois caminhos:
  - manter `/dev` como cadastro manual apenas
  - ou adicionar um botão/ação para consumir a edge function `log-dev-work`
- Se a intenção é ver “o registro que pedi” ao Lovable, então a UI precisa refletir esse fluxo ou pelo menos deixar claro que pedidos no chat não populam `dev_tracker` automaticamente hoje.

4. Revisar segurança do fluxo dev
- Remover dependência do código secreto hardcoded como única proteção prática.
- Manter a verificação por role como fonte real de acesso.
- Opcionalmente, trocar o fluxo para usar a edge function em vez de CRUD direto no cliente, se quiser centralizar regras.

Arquivos a ajustar:
- `src/App.tsx`
- `src/pages/DevTracker.tsx`

Detalhe técnico:
- Hoje há um desalinhamento entre frontend e banco:
  - frontend: libera `/dev` com senha local (`DEV_CODE`)
  - banco: exige usuário autenticado admin/super_admin via RLS
- Isso explica por que a página pode abrir e ainda assim não mostrar o conteúdo.
- A edge function `supabase/functions/log-dev-work/index.ts` existe, mas não é chamada por nenhum arquivo em `src/`.

Validação depois da implementação:
- Entrar em `/dev` logado como admin/super_admin e confirmar que os registros aparecem.
- Entrar deslogado e confirmar redirecionamento para `/auth`.
- Validar que erro de permissão não aparece mais como “Nenhuma funcionalidade registrada”.
- Se o fluxo automatizado for ligado à function, confirmar que um novo registro criado por esse caminho aparece na lista logo após salvar.
