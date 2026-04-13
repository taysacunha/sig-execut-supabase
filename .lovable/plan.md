

## Diagnóstico

Os logs confirmam: o erro é **429 - email rate limit exceeded** do Supabase Auth. A Germana tentou adicionar `sti@execut.com.br` várias vezes seguidas e bateu no limite de envio de emails do Supabase (plano gratuito: ~4 emails/hora por destinatário).

O problema tem duas camadas:
1. A edge function recebe o 429 mas retorna **status 500** ao frontend (linha 344), o que gera a mensagem genérica "Edge Function returned a non-2xx status code"
2. O frontend não trata o status 429, então mostra um erro genérico sem orientar a Germana a esperar

Além disso, no fluxo de novo convite, o código **deleta o usuário pendente existente ANTES** de tentar recriar. Se o `inviteUserByEmail` falha com 429, o usuário fica deletado sem ser recriado — loop destrutivo.

## Correções

### 1. Edge function: tratar 429 antes de deletar (`supabase/functions/invite-user/index.ts`)

**Para novos convites (linha ~310-345):**
- Verificar se `inviteError` tem `status === 429` ou `code === "over_email_send_rate_limit"`
- Retornar status **429** (não 500) com mensagem clara: "Limite de envio de emails atingido. Aguarde alguns minutos antes de tentar novamente."
- Mover a deleção do usuário existente para DEPOIS de confirmar que o convite foi enviado com sucesso (ou não deletar se o convite falhar)

**Para reenvios (linha ~180-210):**
- Mesma verificação de 429 após `inviteUserByEmail`
- Se falhar com 429 após já ter deletado o usuário antigo, recriar o usuário sem envio de email para não perder o registro

### 2. Frontend: mensagem amigável (`src/pages/UserManagement.tsx`)

- No `catch` do `handleInviteUser` e `handleResendInvite`, verificar se o erro contém "rate limit" ou "limite"
- Mostrar toast específico: "Limite de emails atingido. Aguarde alguns minutos e tente novamente."

### Arquivos
- `supabase/functions/invite-user/index.ts`
- `src/pages/UserManagement.tsx`

### Resultado
- Germana verá "Limite de emails atingido. Aguarde alguns minutos" em vez do erro genérico
- Usuários pendentes não serão deletados se o reenvio falhar
- Após aguardar ~5 minutos, o convite funcionará normalmente

