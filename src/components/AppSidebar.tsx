import { useState, useEffect } from "react";
import { Home, Users, MapPin, Calendar, FileSearch, LogOut, UserCircle, Shield, Crown, Briefcase, User } from "lucide-react";
import executLogo from "@/assets/execut-logo.jpg";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
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

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: AppRole[];
}

const menuItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: Home, allowedRoles: ["admin", "manager", "broker"] },
  { title: "Corretores", url: "/corretores", icon: Users, allowedRoles: ["admin", "manager"] },
  { title: "Locais", url: "/locais", icon: MapPin, allowedRoles: ["admin", "manager"] },
  { title: "Escalas", url: "/escalas", icon: Calendar, allowedRoles: ["admin", "manager"] },
  { title: "Consultas", url: "/consultas", icon: FileSearch, allowedRoles: ["admin", "manager"] },
  { title: "Perfil", url: "/perfil", icon: UserCircle, allowedRoles: ["admin", "manager", "broker"] },
  { title: "Usuários", url: "/usuarios", icon: Shield, allowedRoles: ["super_admin", "admin"] },
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

export function AppSidebar() {
  const navigate = useNavigate();
  const { role, loading, hasAccess } = useUserRole();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("name")
          .eq("user_id", user.id)
          .single();
        setUserName(profile?.name || user.email?.split("@")[0] || null);
      }
    };
    fetchUserName();
  }, []);

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

  const visibleMenuItems = menuItems.filter((item) => 
    role ? hasAccess(item.allowedRoles) : false
  );

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
              <h2 className="text-base font-bold text-sidebar-foreground leading-tight">Gestão de Plantões</h2>
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
                visibleMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
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
        {userName && (
          <div className="px-2 py-1 text-sm text-sidebar-foreground/70">
            <span className="font-medium">{userName}</span>
          </div>
        )}
        {isDevOwner && (
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => navigate("/dev")}
          >
            <Code2 className="mr-2 h-4 w-4" />
            Registro Dev
          </Button>
        )}
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
