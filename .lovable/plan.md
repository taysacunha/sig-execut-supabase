

## Diagnóstico do problema

O fluxo de redefinição de senha tem um bug de race condition:

1. Usuário clica no link de recovery no email → abre `sigest.lovable.app/auth?flow=recovery&code=...`
2. O componente Auth monta e, após 50ms, executa `verifyAndDecide`
3. `verifyAndDecide` encontra o usuário (sessão restaurada pelo code exchange) com `password_set: true`
4. **Redireciona imediatamente para `/`** sem mostrar o formulário de redefinição
5. O evento `PASSWORD_RECOVERY` chega tarde demais — o componente já desmontou

O `verifyAndDecide` não verifica se a URL contém indicadores de recovery antes de redirecionar.

## Correção em `Auth.tsx`

Na função `verifyAndDecide` (linha ~96-106), antes de redirecionar para home, verificar se a URL contém `flow=recovery` ou `type=recovery`. Se sim, mostrar o formulário de redefinição em vez de redirecionar.

```
// Antes (bug):
if (isInvited && !passwordSet) {
  setIsSettingPassword(true);
} else {
  navigate("/"); // ← redireciona mesmo em recovery!
}

// Depois (corrigido):
if (isInvited && !passwordSet) {
  setIsSettingPassword(true);
} else if (isRecoveryUrl()) {
  // Recovery flow — mostrar form de redefinição
  setIsRecovery(true);
  setIsSettingPassword(true);
  window.history.replaceState(null, '', '/auth');
} else {
  navigate("/");
}
```

Isso garante que em **qualquer caminho** (seja via `onAuthStateChange`, seja via `verifyAndDecide`), a presença de recovery na URL impede o redirect automático.

### Arquivo impactado

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Auth.tsx` | Adicionar check de `isRecoveryUrl()` em `verifyAndDecide` antes de redirecionar |

