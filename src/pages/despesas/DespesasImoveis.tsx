import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
import { ShieldAlert } from "lucide-react";

export default function DespesasImoveis() {
  const { podeVer } = useDespesasPermissions();
  if (!podeVer("imoveis")) {
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
        <h1 className="text-3xl font-bold tracking-tight">Imóveis</h1>
        <p className="text-muted-foreground">IPTU, TCR, SPU e situação dos imóveis.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em construção — Fase 3</CardTitle>
          <CardDescription>
            Cadastro completo de imóveis, garantias, histórico de situação e relatórios de alugados vs não alugados vs vendidos.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}