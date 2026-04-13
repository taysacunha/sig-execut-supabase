

## Criar página de Auditoria para o módulo de Férias e Folgas

### O que falta
- A sidebar já tem o link `/ferias/auditoria` (restrito a admin/super_admin)
- Mas **não existe** a página `src/pages/ferias/FeriasAuditLogs.tsx`
- E **não existe** a rota no `App.tsx` para `/ferias/auditoria`

### Alterações

**1. Criar `src/pages/ferias/FeriasAuditLogs.tsx`**
Seguindo o padrão idêntico aos outros módulos (Escalas, Vendas, Estoque):
```tsx
import { AuditLogsPanel } from "@/components/AuditLogsPanel";

export default function FeriasAuditLogs() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auditoria - Férias e Folgas</h1>
        <p className="text-muted-foreground">Histórico de alterações no módulo de férias e folgas</p>
      </div>
      <AuditLogsPanel defaultModule="ferias" defaultTab="modules" showAdminTab={false} />
    </div>
  );
}
```

**2. Registrar a rota em `src/App.tsx`**
- Adicionar lazy import: `const FeriasAuditLogs = lazy(() => import("./pages/ferias/FeriasAuditLogs"));`
- Adicionar rota dentro do bloco `<Route path="/ferias">`:
```tsx
<Route path="auditoria" element={
  <RoleGuard allowedRoles={["super_admin", "admin"]}>
    <FeriasAuditLogs />
  </RoleGuard>
} />
```

### Resultado
- Link "Auditoria" na sidebar de Férias passará a funcionar
- Apenas super_admin e admin terão acesso (mesma proteção dos outros módulos)
- Exibirá logs filtrados pelo módulo "ferias"

