import { useNavigate } from "react-router-dom";
import { useSystemAccess, SystemName } from "@/hooks/useSystemAccess";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, Loader2, LogOut, Crown, Briefcase, User, Users, Palmtree, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import executLogo from "@/assets/execut-logo.jpg";

interface SystemCardProps {
  name: SystemName;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

function SystemCard({ title, description, icon, color, onClick }: SystemCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl border-2 hover:border-primary/50 ${color}`}
      onClick={onClick}
    >
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button className="w-full">Acessar</Button>
      </CardContent>
    </Card>
  );
}

const systemConfigs: Record<SystemName, { title: string; description: string; icon: React.ReactNode; color: string; route: string }> = {
  escalas: {
    title: "Gestão de Plantões",
    description: "Gerenciamento de plantões, corretores e locais",
    icon: <Calendar className="h-8 w-8 text-primary" />,
    color: "bg-card",
    route: "/escalas",
  },
  vendas: {
    title: "Sistema de Vendas",
    description: "Controle de vendas, equipes e performance",
    icon: <TrendingUp className="h-8 w-8 text-primary" />,
    color: "bg-card",
    route: "/vendas",
  },
  ferias: {
    title: "Gestão Férias e Folgas",
    description: "Férias, folgas de sábado e aniversariantes",
    icon: <Palmtree className="h-8 w-8 text-green-600" />,
    color: "bg-card",
    route: "/ferias",
  },
};

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  manager: "Gerente",
  supervisor: "Supervisor",
  collaborator: "Colaborador",
  broker: "Corretor",
};

const roleIcons: Record<string, React.ReactNode> = {
  super_admin: <Crown className="h-3 w-3" />,
  admin: <Crown className="h-3 w-3" />,
  manager: <Briefcase className="h-3 w-3" />,
  supervisor: <Briefcase className="h-3 w-3" />,
  collaborator: <User className="h-3 w-3" />,
  broker: <User className="h-3 w-3" />,
};

const roleColors: Record<string, string> = {
  super_admin: "bg-purple-600 text-white",
  admin: "bg-destructive/80 text-destructive-foreground",
  manager: "bg-primary/80 text-primary-foreground",
  supervisor: "bg-blue-600/80 text-white",
  collaborator: "bg-secondary text-secondary-foreground",
  broker: "bg-secondary text-secondary-foreground",
};

const SelectSystem = () => {
  const navigate = useNavigate();
  const { systems, loading: loadingSystems } = useSystemAccess();
  const { role, loading: loadingRole, user } = useUserRole();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erro ao sair");
    } else {
      navigate("/auth");
    }
  };

  const handleSelectSystem = (system: SystemName) => {
    const config = systemConfigs[system];
    if (config) {
      navigate(config.route);
    }
  };

  if (loadingSystems || loadingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const accessibleSystems = systems
    .map((s) => s.system_name)
    .filter((name) => systemConfigs[name]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src={executLogo} 
              alt="Execut Imóveis" 
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Portal de Sistemas</h1>
              {user?.email && (
                <p className="text-sm text-muted-foreground">{user.email}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {role && (
              <Badge className={roleColors[role]}>
                <span className="flex items-center gap-1">
                  {roleIcons[role]}
                  {roleLabels[role]}
                </span>
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Selecione um Sistema
          </h2>
          <p className="text-muted-foreground">
            Escolha o sistema que deseja acessar
          </p>
        </div>

        {accessibleSystems.length === 0 ? (
          <div className="text-center py-12">
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle className="text-destructive">Sem Acesso</CardTitle>
                <CardDescription>
                  Você não tem acesso a nenhum sistema. Entre em contato com um administrador.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
            {accessibleSystems.map((system) => {
              const config = systemConfigs[system];
              return (
                <SystemCard
                  key={system}
                  name={system}
                  title={config.title}
                  description={config.description}
                  icon={config.icon}
                  color={config.color}
                  onClick={() => handleSelectSystem(system)}
                />
              );
            })}
          </div>
        )}

        {/* Admin/Super Admin: User Management */}
        {(role === "admin" || role === "super_admin") && (
          <div className="mt-12 text-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/usuarios")}
              className="gap-2"
            >
              <Users className="h-5 w-5" />
              Gerenciar Usuários
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default SelectSystem;
