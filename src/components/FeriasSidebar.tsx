import { Home, Users, Building2, Calendar, CalendarDays, Cake, FileText, Settings, LogOut, UserCircle, Shield, Crown, Briefcase, User, ArrowLeft, History, CalendarRange, FileBarChart, CreditCard, HelpCircle } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import executLogo from "@/assets/execut-logo.jpg";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Itens que aparecem para QUALQUER usuário com acesso ao sistema "ferias"
const moduleMenuItems: MenuItem[] = [
  { title: "Dashboard", url: "/ferias", icon: Home },
  { title: "Colaboradores", url: "/ferias/colaboradores", icon: Users },
  { title: "Estrutura", url: "/ferias/estrutura", icon: Building2 },
  { title: "Férias", url: "/ferias/ferias", icon: Calendar },
  { title: "Folgas de Sábado", url: "/ferias/folgas", icon: CalendarDays },
  { title: "Calendário", url: "/ferias/calendario", icon: CalendarRange },
  { title: "Aniversariantes", url: "/ferias/aniversariantes", icon: Cake },
  
  { title: "Relatórios", url: "/ferias/relatorios", icon: FileBarChart },
  { title: "Créditos", url: "/ferias/creditos", icon: CreditCard },
  { title: "Configurações", url: "/ferias/configuracoes", icon: Settings },
  { title: "Perfil", url: "/ferias/perfil", icon: UserCircle },
  { title: "Ajuda", url: "/ferias/ajuda", icon: HelpCircle },
];

// Itens restritos a super_admin/admin (verificação de ROLE)
const adminMenuItems: MenuItem[] = [
  { title: "Usuários", url: "/ferias/usuarios", icon: Shield },
  { title: "Auditoria", url: "/ferias/auditoria", icon: History },
];

const roleLabels: Partial<Record<AppRole, string>> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  manager: "Gerente",
  supervisor: "Supervisor",
  collaborator: "Colaborador",
  broker: "Corretor",
};

const roleIcons: Partial<Record<AppRole, React.ReactNode>> = {
  super_admin: <Crown className="h-3 w-3" />,
  admin: <Crown className="h-3 w-3" />,
  manager: <Briefcase className="h-3 w-3" />,
  supervisor: <Briefcase className="h-3 w-3" />,
  collaborator: <User className="h-3 w-3" />,
  broker: <User className="h-3 w-3" />,
};

const roleColors: Partial<Record<AppRole, string>> = {
  super_admin: "bg-purple-600 text-white",
  admin: "bg-destructive/80 text-destructive-foreground",
  manager: "bg-primary/80 text-primary-foreground",
  supervisor: "bg-blue-600/80 text-white",
  collaborator: "bg-secondary text-secondary-foreground",
  broker: "bg-secondary text-secondary-foreground",
};

export function FeriasSidebar() {
  const navigate = useNavigate();
  const { role, loading: roleLoading, hasAccess: hasRoleAccess } = useUserRole();
  const { hasAccess: hasSystemAccess, loading: systemLoading } = useSystemAccess();

  const loading = roleLoading || systemLoading;

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error("Não foi possível sair. Tente novamente.");
    } else {
      toast.success("Logout realizado com sucesso!");
      navigate("/auth");
    }
  };

  const handleBackToSystems = () => {
    navigate("/");
  };

  // Itens do módulo aparecem se o usuário tem acesso ao sistema "ferias"
  const visibleModuleItems = hasSystemAccess("ferias") ? moduleMenuItems : [];

  // Itens admin aparecem apenas para super_admin ou admin
  const visibleAdminItems = hasRoleAccess(["super_admin", "admin"]) ? adminMenuItems : [];

  const allVisibleItems = [...visibleModuleItems, ...visibleAdminItems];

  return (
    <Sidebar>
      <SidebarContent>
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-start gap-3">
            <img 
              src={executLogo} 
              alt="Execut Imóveis" 
              className="h-10 w-10 object-contain flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-sidebar-foreground leading-tight">Gestão Férias e Folgas</h2>
              {loading ? (
                <Skeleton className="h-5 w-24 mt-1" />
              ) : role ? (
                <Badge className={`mt-1 ${roleColors[role]}`}>
                  <span className="flex items-center gap-1">
                    {roleIcons[role]}
                    {roleLabels[role]}
                  </span>
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-1">Sem permissão</Badge>
              )}
            </div>
          </div>
        </div>
        <SidebarGroup>
          <SidebarGroupLabel className="text-base font-semibold px-3">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </SidebarMenuItem>
                ))
              ) : (
                allVisibleItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/ferias"}
                        className={({ isActive }) =>
                          isActive
                            ? "flex items-center gap-4 rounded-lg bg-primary/20 px-4 py-3 text-white font-semibold text-base"
                            : "flex items-center gap-4 rounded-lg px-4 py-3 text-sidebar-foreground hover:bg-primary/20 hover:text-white font-medium text-base"
                        }
                      >
                        <item.icon className="h-6 w-6" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-2">
        <Button 
          variant="secondary" 
          className="w-full justify-start bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80" 
          onClick={handleBackToSystems}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Trocar Sistema
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" 
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
