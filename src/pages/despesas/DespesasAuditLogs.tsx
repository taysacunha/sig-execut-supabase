import { AuditLogsPanel } from "@/components/AuditLogsPanel";

export default function DespesasAuditLogs() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auditoria — Despesas</h1>
        <p className="text-muted-foreground">Histórico de alterações no módulo de despesas.</p>
      </div>
      <AuditLogsPanel defaultModule={"despesas" as any} defaultTab="modules" showAdminTab={false} />
    </div>
  );
}