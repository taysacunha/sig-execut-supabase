import { useSystemAccess, SystemName } from "@/hooks/useSystemAccess";
import { Loader2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface SystemGuardProps {
  system: SystemName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

function SystemAccessDenied({ system }: { system: SystemName }) {
  const navigate = useNavigate();
  
  const systemNames: Record<SystemName, string> = {
    escalas: "Gestão de Escalas",
    vendas: "Sistema de Vendas",
    ferias: "Gestão de Férias",
    estoque: "Gestão de Estoques",
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Acesso Negado</CardTitle>
          <CardDescription>
            Você não tem permissão para acessar o sistema "{systemNames[system]}".
            Entre em contato com um administrador se precisar de acesso.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={() => navigate("/")}>
            Voltar à Seleção de Sistemas
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function SystemGuard({ system, children, fallback }: SystemGuardProps) {
  const { hasAccess, loading } = useSystemAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess(system)) {
    return fallback ?? <SystemAccessDenied system={system} />;
  }

  return <>{children}</>;
}
