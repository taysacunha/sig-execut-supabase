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
