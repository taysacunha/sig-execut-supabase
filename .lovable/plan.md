

## Correção de Segurança RLS

### Situação atual

O erro **"RLS Disabled in Public"** que você viu era um **finding antigo** (de 8 de março). Ao rodar o scan agora, ele **não aparece mais** — todas as 65 tabelas têm RLS habilitado. Esse erro pode ser descartado.

O scan atualizado encontrou **1 problema real** que precisa de correção:

### Problema: `ferias_afastamentos` com policies permissivas

A tabela `ferias_afastamentos` tem 4 policies com `USING (true)` e `WITH CHECK (true)`, o que significa que **qualquer usuário autenticado** pode ler, criar, editar e deletar registros de afastamento de qualquer colaborador. Isso deveria seguir o padrão do módulo férias (`can_view_system / can_edit_system`).

### Correção (migração SQL)

Remover as 4 policies permissivas e criar novas policies restritivas:

```text
DROP POLICY "Authenticated users can read afastamentos"    → SELECT com can_view_system('ferias')
DROP POLICY "Authenticated users can insert afastamentos"  → INSERT com can_edit_system('ferias')
DROP POLICY "Authenticated users can update afastamentos"  → UPDATE com can_edit_system('ferias')
DROP POLICY "Authenticated users can delete afastamentos"  → DELETE com can_edit_system('ferias')
```

### Warnings que podem ser ignorados

1. **`module_audit_logs` INSERT true** — intencional, o trigger de auditoria precisa inserir logs para qualquer usuário que faça alterações. Será marcado como ignorado no scanner.
2. **`SUPA_security_definer_view`** — já ignorado (funções SECURITY DEFINER são o padrão recomendado para evitar recursão RLS).

### Ações

1. Criar migração SQL para corrigir `ferias_afastamentos`
2. Marcar o finding antigo `SUPA_rls_disabled_in_public` como resolvido
3. Marcar `module_audit_logs` INSERT true como ignorado (intencional)
4. Atualizar os 3 warnings de `rls_policy_always_true` (2 são de `ferias_afastamentos`, 1 é de `module_audit_logs`)

