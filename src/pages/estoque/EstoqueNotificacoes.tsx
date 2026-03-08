import { Bell, BellOff, Check, CheckCheck, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEstoqueNotificacoes } from "@/hooks/useEstoqueNotificacoes";

const TIPO_ICONS: Record<string, string> = {
  nova_solicitacao: "📋",
  status_atualizado: "🔄",
  material_separado: "📦",
  material_entregue: "✅",
  estoque_baixo: "⚠️",
};

export default function EstoqueNotificacoes() {
  const { notificacoes, unreadCount, isLoading, markAsRead, markAllAsRead } = useEstoqueNotificacoes();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}` : "Todas lidas"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => markAllAsRead.mutate()} disabled={markAllAsRead.isPending}>
            <CheckCheck className="h-4 w-4 mr-2" /> Marcar todas como lidas
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : notificacoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <BellOff className="h-12 w-12 mb-4 opacity-50" />
            <p>Nenhuma notificação</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notificacoes.map((n) => (
            <Card
              key={n.id}
              className={`transition-colors ${n.lida ? "opacity-60" : "border-primary/30 bg-primary/5"}`}
            >
              <CardContent className="py-3 flex items-start gap-3">
                <span className="text-lg mt-0.5">{TIPO_ICONS[n.tipo] || "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.lida ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                    {n.mensagem}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleDateString("pt-BR")}{" "}
                    {new Date(n.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {!n.lida && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => markAsRead.mutate(n.id)}
                    className="shrink-0"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
