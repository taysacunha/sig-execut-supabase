import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { RoleGuard } from "@/components/RoleGuard";
import { EscalasLayout } from "@/layouts/EscalasLayout";
import { VendasLayout } from "@/layouts/VendasLayout";
import { FeriasLayout } from "@/layouts/FeriasLayout";
import { EstoqueLayout } from "@/layouts/EstoqueLayout";
import { StandaloneLayout } from "@/layouts/StandaloneLayout";
import { useSessionControl } from "@/hooks/useSessionControl";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import Auth from "./pages/Auth";

// Lazy load páginas para code splitting
const SelectSystem = lazy(() => import("./pages/SelectSystem"));

// Escalas
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Brokers = lazy(() => import("./pages/Brokers"));
const Locations = lazy(() => import("./pages/Locations"));
const Schedules = lazy(() => import("./pages/Schedules"));
const Queries = lazy(() => import("./pages/Queries"));
const EscalasReports = lazy(() => import("./pages/EscalasReports"));
const Profile = lazy(() => import("./pages/Profile"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const Help = lazy(() => import("./pages/Help"));
const EscalasAuditLogs = lazy(() => import("./pages/EscalasAuditLogs"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Vendas
const VendasDashboard = lazy(() => import("./pages/vendas/VendasDashboard"));
const SalesTeams = lazy(() => import("./pages/vendas/SalesTeams"));
const SalesBrokers = lazy(() => import("./pages/vendas/SalesBrokers"));
const Sales = lazy(() => import("./pages/vendas/Sales"));
const Proposals = lazy(() => import("./pages/vendas/Proposals"));
const Leads = lazy(() => import("./pages/vendas/Leads"));
const Evaluations = lazy(() => import("./pages/vendas/Evaluations"));
const SalesReports = lazy(() => import("./pages/vendas/SalesReports"));
const VendasAuditLogs = lazy(() => import("./pages/vendas/VendasAuditLogs"));

// Férias
const FeriasDashboard = lazy(() => import("./pages/ferias/FeriasDashboard"));
const FeriasEstrutura = lazy(() => import("./pages/ferias/FeriasEstrutura"));
const FeriasColaboradores = lazy(() => import("./pages/ferias/FeriasColaboradores"));
const FeriasFerias = lazy(() => import("./pages/ferias/FeriasFerias"));
const FeriasFolgas = lazy(() => import("./pages/ferias/FeriasFolgas"));
const FeriasAniversariantes = lazy(() => import("./pages/ferias/FeriasAniversariantes"));
const FeriasCalendario = lazy(() => import("./pages/ferias/FeriasCalendario"));
const FeriasConfiguracoes = lazy(() => import("./pages/ferias/FeriasConfiguracoes"));
const FeriasRelatorios = lazy(() => import("./pages/ferias/FeriasRelatorios"));
const FeriasCreditos = lazy(() => import("./pages/ferias/FeriasCreditos"));

// Estoque
const EstoqueDashboard = lazy(() => import("./pages/estoque/EstoqueDashboard"));
const EstoqueMateriais = lazy(() => import("./pages/estoque/EstoqueMateriais"));
const EstoqueLocais = lazy(() => import("./pages/estoque/EstoqueLocais"));
const EstoqueGestores = lazy(() => import("./pages/estoque/EstoqueGestores"));
const EstoqueAuditLogs = lazy(() => import("./pages/estoque/EstoqueAuditLogs"));
const EstoqueSolicitacoes = lazy(() => import("./pages/estoque/EstoqueSolicitacoes"));
const EstoqueSaldos = lazy(() => import("./pages/estoque/EstoqueSaldos"));
const EstoqueMovimentacoes = lazy(() => import("./pages/estoque/EstoqueMovimentacoes"));
const EstoqueNotificacoes = lazy(() => import("./pages/estoque/EstoqueNotificacoes"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  useSessionControl();
  useInactivityLogout(30);

  useEffect(() => {
    const timer = setTimeout(() => {
      import("./pages/Brokers");
      import("./pages/Locations");
      import("./pages/Schedules");
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<DashboardSkeleton />}>
                    <SelectSystem />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            {/* Sistema de Escalas */}
            <Route
              path="/escalas"
              element={
                <ProtectedRoute>
                  <EscalasLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="corretores" element={<Brokers />} />
              <Route path="locais" element={<Locations />} />
              <Route path="gerenciar" element={<Schedules />} />
              <Route path="consultas" element={<Queries />} />
              <Route path="relatorios" element={<EscalasReports />} />
              <Route path="perfil" element={<Profile />} />
              <Route path="usuarios" element={<RoleGuard allowedRoles={["super_admin", "admin"]}><UserManagement /></RoleGuard>} />
              <Route path="auditoria" element={<RoleGuard allowedRoles={["super_admin", "admin"]}><EscalasAuditLogs /></RoleGuard>} />
              <Route path="ajuda" element={<Help />} />
            </Route>

            {/* Gerenciamento Global de Usuários */}
            <Route
              path="/usuarios"
              element={<ProtectedRoute><StandaloneLayout /></ProtectedRoute>}
            >
              <Route index element={<RoleGuard allowedRoles={["super_admin", "admin"]}><UserManagement /></RoleGuard>} />
            </Route>

            {/* Sistema de Vendas */}
            <Route
              path="/vendas"
              element={<ProtectedRoute><VendasLayout /></ProtectedRoute>}
            >
              <Route index element={<VendasDashboard />} />
              <Route path="equipes" element={<SalesTeams />} />
              <Route path="corretores" element={<SalesBrokers />} />
              <Route path="leads" element={<Leads />} />
              <Route path="vendas" element={<Sales />} />
              <Route path="propostas" element={<Proposals />} />
              <Route path="avaliacoes" element={<Evaluations />} />
              <Route path="relatorios" element={<SalesReports />} />
              <Route path="perfil" element={<Profile />} />
              <Route path="usuarios" element={<RoleGuard allowedRoles={["super_admin", "admin"]}><UserManagement /></RoleGuard>} />
              <Route path="auditoria" element={<RoleGuard allowedRoles={["super_admin", "admin"]}><VendasAuditLogs /></RoleGuard>} />
            </Route>

            {/* Sistema de Férias */}
            <Route
              path="/ferias"
              element={<ProtectedRoute><FeriasLayout /></ProtectedRoute>}
            >
              <Route index element={<FeriasDashboard />} />
              <Route path="colaboradores" element={<FeriasColaboradores />} />
              <Route path="estrutura" element={<FeriasEstrutura />} />
              <Route path="ferias" element={<FeriasFerias />} />
              <Route path="folgas" element={<FeriasFolgas />} />
              <Route path="aniversariantes" element={<FeriasAniversariantes />} />
              <Route path="calendario" element={<FeriasCalendario />} />
              <Route path="relatorios" element={<FeriasRelatorios />} />
              <Route path="creditos" element={<FeriasCreditos />} />
              <Route path="configuracoes" element={<FeriasConfiguracoes />} />
              <Route path="perfil" element={<Profile />} />
              <Route path="usuarios" element={<RoleGuard allowedRoles={["super_admin", "admin"]}><UserManagement /></RoleGuard>} />
            </Route>

            {/* Sistema de Estoque */}
            <Route
              path="/estoque"
              element={<ProtectedRoute><EstoqueLayout /></ProtectedRoute>}
            >
              <Route index element={<EstoqueDashboard />} />
              <Route path="materiais" element={<EstoqueMateriais />} />
              <Route path="locais" element={<EstoqueLocais />} />
              <Route path="saldos" element={<EstoqueSaldos />} />
              <Route path="solicitacoes" element={<EstoqueSolicitacoes />} />
              <Route path="movimentacoes" element={<EstoqueMovimentacoes />} />
              <Route path="notificacoes" element={<EstoqueNotificacoes />} />
              <Route path="gestores" element={<EstoqueGestores />} />
              <Route path="perfil" element={<Profile />} />
              <Route path="usuarios" element={<RoleGuard allowedRoles={["super_admin", "admin"]}><UserManagement /></RoleGuard>} />
              <Route path="auditoria" element={<RoleGuard allowedRoles={["super_admin", "admin"]}><EstoqueAuditLogs /></RoleGuard>} />
            </Route>

            {/* 404 */}
            <Route
              path="*"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <NotFound />
                </Suspense>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
