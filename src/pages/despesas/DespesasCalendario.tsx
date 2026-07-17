import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
import { ShieldAlert } from "lucide-react";

export default function DespesasCalendario() {
  const { podeVer } = useDespesasPermissions();
  if (!podeVer("calendario")) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <CardTitle>Sem acesso</CardTitle>
          <CardDescription>Você não tem permissão para visualizar esta aba.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendário de Despesas</h1>
        <p className="text-muted-foreground">Contas a pagar e receber, filtros e exportações.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em construção — Fase 2</CardTitle>
          <CardDescription>
            Nesta aba entra o formulário Conta a Pagar/Receber (fiel ao GIMOB, com múltiplas formas de pagamento),
            listagem paginada, filtros, KPIs e exportação. Fundação e permissões desta aba já estão prontas.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}