import { Bell, Check, CircleAlert, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  useNotificacoes, useMarcarLida,
} from "@/hooks/useDespesasNotificacoes";

export function DespesasNotificacoesBell() {
  const { data = [], isLoading } = useNotificacoes();
  const marcarMut = useMarcarLida();
  const naoLidas = data.filter((n) => !n.lida);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {naoLidas.length > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 bg-destructive text-destructive-foreground text-[10px]"
            >
              {naoLidas.length > 99 ? "99+" : naoLidas.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="text-sm font-semibold">Notificações</div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              onClick={() => marcarMut.mutate(naoLidas.map((n) => n.id))}
              disabled={naoLidas.length === 0 || marcarMut.isPending}
            >
              <Check className="h-3 w-3 mr-1" /> Marcar todas
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
          ) : data.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação por enquanto.
            </div>
          ) : (
            <ul className="divide-y">
              {data.map((n) => {
                const icon =
                  n.tipo === "vencido" ? <CircleAlert className="h-4 w-4 text-destructive" /> :
                  n.tipo === "pago" ? <Check className="h-4 w-4 text-emerald-500" /> :
                  <Clock className="h-4 w-4 text-amber-500" />;
                return (
                  <li
                    key={n.id}
                    className={`p-3 flex gap-3 text-sm ${n.lida ? "" : "bg-muted/40"}`}
                  >
                    <div className="mt-0.5">{icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {n.lancamento?.descricao ?? "Lançamento"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {n.mensagem ?? ""}
                      </div>
                      {n.lancamento?.data_vencimento && (
                        <div className="text-xs text-muted-foreground">
                          Vence em{" "}
                          {format(
                            new Date(n.lancamento.data_vencimento + "T00:00:00"),
                            "dd/MM/yyyy",
                            { locale: ptBR }
                          )}
                        </div>
                      )}
                    </div>
                    {!n.lida && (
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => marcarMut.mutate([n.id])}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="p-2 border-t text-right">
          <Button asChild variant="link" size="sm">
            <Link to="/despesas/notificacoes">Preferências</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}