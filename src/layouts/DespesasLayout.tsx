import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DespesasSidebar } from "@/components/DespesasSidebar";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { SystemGuard } from "@/components/SystemGuard";
import { Menu, Eye, EyeOff } from "lucide-react";
import { DespesasNotificacoesBell } from "@/components/despesas/DespesasNotificacoesBell";
import { Button } from "@/components/ui/button";
import {
  DespesasValuesProvider,
  useDespesasValues,
} from "@/contexts/DespesasValuesContext";

function ToggleValuesButton() {
  const { showValues, toggleValues } = useDespesasValues();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleValues}
      title={showValues ? "Ocultar valores" : "Mostrar valores"}
      aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}
    >
      {showValues ? (
        <EyeOff className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Eye className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}

export function DespesasLayout() {
  return (
    <SystemGuard system="despesas">
      <DespesasValuesProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <DespesasSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <header className="flex items-center h-14 border-b bg-background px-4">
                <SidebarTrigger className="p-2 -ml-2 md:hidden">
                  <Menu className="h-5 w-5" />
                </SidebarTrigger>
                <span className="ml-2 font-semibold md:hidden">Despesas</span>
                <div className="ml-auto flex items-center gap-1">
                  <ToggleValuesButton />
                  <DespesasNotificacoesBell />
                </div>
              </header>
              <main className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden">
                <Suspense fallback={<DashboardSkeleton />}>
                  <Outlet />
                </Suspense>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </DespesasValuesProvider>
    </SystemGuard>
  );
}