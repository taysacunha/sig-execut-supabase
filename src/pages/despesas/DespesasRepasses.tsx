import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
import { ShieldAlert } from "lucide-react";

export default function DespesasRepasses() {
  const { podeVer } = useDespesasPermissions();
  if (!podeVer("repasses")) {
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
        <h1 className="text-3xl font-bold tracking-tight">Repasses</h1>
        <p className="text-muted-foreground">Repasses mensais de aluguel aos proprietários.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em construção — Fase 3</CardTitle>
          <CardDescription>
            Repasse mensal com créditos/débitos por categoria, taxa de administração, valor líquido calculado e exportação por CNPJ/CPF.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}