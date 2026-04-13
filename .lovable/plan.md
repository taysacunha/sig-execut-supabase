

## Correção do fluxo de convite — URL errada

### Problema
A edge function `invite-user` usa `"https://sigest.lovable.app"` como URL de redirecionamento. A URL correta é `https://sig-execut.lovable.app`. Não há secret `SITE_URL` configurado, então o fallback errado é sempre usado. Resultado: todo link de convite leva o usuário para um domínio inexistente.

### Correções

**1. Corrigir o fallback na edge function** (`supabase/functions/invite-user/index.ts`, linha 129)
- Trocar `"https://sigest.lovable.app"` por `"https://sig-execut.lovable.app"`
- Fazer redeploy da function

**2. Verificação manual necessária no painel Supabase**
- Abrir: https://supabase.com/dashboard/project/msbhhsrtfqfqcsofnsuy/auth/url-configuration
- Confirmar que **Site URL** = `https://sig-execut.lovable.app`
- Confirmar que **Redirect URLs** contém `https://sig-execut.lovable.app/auth`
- Se estiver diferente, corrigir lá

### Arquivos
- `supabase/functions/invite-user/index.ts` — uma linha alterada (129)

### Resultado
- Links de convite passarão a redirecionar para `https://sig-execut.lovable.app/auth`
- Convidados chegarão na tela de definir senha corretamente

