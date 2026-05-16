## Objetivo

Tratar os registros dos "Logs de Auditoria" exibidos em `/usuarios` (componente `AuditLogsPanel` configurado com `defaultModule="sistema"` e `defaultTab="admin"`) para que tudo apareça em português e com nomes legíveis — sem mais campos em inglês, valores técnicos ou UUIDs nus.

## Diagnóstico

A página usa `AuditLogsPanel` com duas abas:

1. **Ações Administrativas** (`admin_audit_logs`) — gerada pela edge `manage-user`. O bloco "Detalhes" mostra hoje chaves/valores crus como:
   - `reason: user_deactivated`, `reason: user_reactivated`, `reason: user_deleted`, `reason: password_reset`
   - `is_self: true`, `old_email`, `new_email`
   
2. **Alterações nos Módulos** filtrada por `module_name = 'sistema'` (`module_audit_logs`) — abrange tabelas de sistema (`user_roles`, `system_access`, `user_profiles`, etc.). Hoje exibe:
   - Coluna "Tabela": nomes crus (`user_roles`, `system_access`, `user_profiles`) sem entrada em `tableLabels`.
   - Coluna "Registro": cai no fallback `record_id.slice(0, 8)` porque os registros não têm `nome`/`nome_exibicao` e a função `getRecordLabel` não resolve via `user_id`.
   - Campos alterados: `role`, `system_name`, `can_view`, `can_edit`, `user_id`, `name` aparecem em inglês.
   - Valores de role (`super_admin`, `admin`, `manager`, `supervisor`, `collaborator`) e de `system_name` (`escalas`, `vendas`, `ferias`, `estoque`) aparecem em inglês/minúsculo.

Nenhuma lógica de negócio, query, RLS ou edge function precisa mudar — apenas o mapeamento de apresentação em `src/components/AuditLogsPanel.tsx`.

## Alterações em `src/components/AuditLogsPanel.tsx`

### 1) Ampliar `tableLabels`
Adicionar:
- `user_roles` → "Permissões de Usuário"
- `system_access` → "Acessos ao Sistema"
- `user_profiles` → "Perfis de Usuário"
- `admin_audit_logs` → "Logs Administrativos"
- `module_audit_logs` → "Logs de Módulos"

### 2) Ampliar `fieldLabels`
Adicionar campos do módulo sistema e dos detalhes administrativos:
- `user_id` → "Usuário"
- `role` → "Permissão"
- `system_name` → "Sistema"
- `can_view` → "Pode visualizar"
- `can_edit` → "Pode editar"
- `name` → "Nome"
- `email` → "E-mail"
- `phone` → "Telefone"
- `avatar_url` → "Foto"
- `reason` → "Motivo"
- `is_self` → "Auto-ação"
- `old_email` → "E-mail anterior"
- `new_email` → "Novo e-mail"
- `actor_id` / `actor_email` / `target_id` / `target_email` → rótulos em PT
- `granted_by`, `granted_at` → "Concedido por", "Concedido em"

### 3) Criar mapas de tradução de valores
Novo dicionário `valueLabels` por campo:

```ts
const valueLabels: Record<string, Record<string, string>> = {
  role: {
    super_admin: "Super Administrador",
    admin: "Administrador",
    manager: "Gerente",
    supervisor: "Supervisor",
    collaborator: "Colaborador",
  },
  system_name: {
    escalas: "Escalas",
    vendas: "Vendas",
    estoque: "Estoques",
    ferias: "Férias e Folgas",
    sistema: "Sistema",
  },
  reason: {
    user_deactivated: "Usuário desativado",
    user_reactivated: "Usuário reativado",
    user_deleted: "Usuário removido",
    password_reset: "Senha redefinida",
  },
};
```

Em `formatFieldValue`, antes do retorno padrão para string, consultar `valueLabels[field]?.[val]` e usar quando disponível. O mesmo se aplica quando o valor é booleano dentro de `is_self` (já cai em "Sim/Não", suficiente).

### 4) Resolver UUIDs de usuário em "Registro" e em valores `user_id`
Estender `useLookups().resolve` para reconhecer `user_id` (e variantes `actor_id`, `target_id`, `granted_by`, `changed_by`, `recebido_por_user_id`, `responsavel_user_id`) e mapear via cache `user_profiles` (já pré-carregado). Quando o campo `name` não existir no `user_profiles`, cair no e-mail (necessário expandir `loadLookup` para aceitar campos múltiplos ou criar uma função auxiliar `loadUserProfilesLookup` que monte o map combinando `name || email`).

Em `getRecordLabel`, antes do fallback de slice do UUID:
- Se `data.user_id` existir, tentar resolver pelo cache de `user_profiles`.
- Se `log.table_name === 'user_roles'` ou `'system_access'` e houver `user_id`, mostrar o nome resolvido + (para system_access) o sistema entre parênteses: `"Maria — Férias e Folgas"`.

### 5) Bloco "Detalhes" da aba Administrativa
Já passa pelo `formatFieldLabel` + `formatFieldValue`, então só com (2) e (3) as chaves e valores ficam em português. Verificar visualmente que `is_self: true` renderiza "Sim", `reason: user_deactivated` renderiza "Usuário desativado", `old_email`/`new_email` renderizam com seus rótulos.

### 6) Filtros de "Tabela" e busca
Sem mudança funcional — o `tableLabels` ampliado já reflete os novos nomes no `Select` (que usa `tableLabels[t] || t`).

## Resultado esperado

Na página `/usuarios` → aba "Logs de Auditoria":

- Aba **Ações Administrativas**: detalhes mostram "Motivo: Usuário desativado", "Auto-ação: Sim", "E-mail anterior: …", "Novo e-mail: …" em vez de chaves/valores em inglês.
- Aba **Alterações nos Módulos** (módulo Sistema): coluna "Tabela" mostra "Permissões de Usuário"/"Acessos ao Sistema"/"Perfis de Usuário"; coluna "Registro" mostra o nome (ou e-mail) do usuário afetado; campos alterados aparecem como "Permissão: Colaborador → Administrador", "Sistema: Férias e Folgas", "Pode editar: Não → Sim".

Nenhum dado, política RLS, edge function ou consulta SQL é alterada.