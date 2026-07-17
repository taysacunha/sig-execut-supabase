import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Check, CircleAlert, Clock, Loader2, Save } from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  useMarcarLida, useNotifPrefs, useNotificacoes, useSaveNotifPrefs,
} from "@/hooks/useDespesasNotificacoes";

const OPCOES_DIAS = [30, 15, 7, 3, 1];

export default function DespesasNotificacoes() {
  const { data: prefs, isLoading: loadingPrefs } = useNotifPrefs();
  const { data: notifs = [], isLoading: loadingNotifs } = useNotificacoes();
  const savePrefs = useSaveNotifPrefs();
  const marcarMut = useMarcarLida();

  const [dias, setDias] = useState<number[]>([7, 1]);
  const [notifVencidos, setNotifVencidos] = useState(true);
  const [notifPagos, setNotifPagos] = useState(false);

  useEffect(() => {
    if (prefs) {
      setDias(prefs.dias_antecedencia ?? [7, 1]);
      setNotifVencidos(prefs.notificar_vencidos);
      setNotifPagos(prefs.notificar_pagos);
    }
  }, [prefs]);

  function toggleDia(d: number) {
    setDias((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => b - a)
    );
  }

  async function salvar() {
    try {
      await savePrefs.mutateAsync({
        dias_antecedencia: dias,
        notificar_vencidos: notifVencidos,
        notificar_pagos: notifPagos,
      });
      toast.success("Preferências salvas");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar preferências");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notificações</h1>
        <p className="text-sm text-muted-foreground">
          Configure alertas de vencimento e visualize sua caixa de notificações.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preferências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingPrefs ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Avisar com antecedência</Label>
                <div className="flex flex-wrap gap-2">
                  {OPCOES_DIAS.map((d) => {
                    const active = dias.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDia(d)}
                        className={`px-3 py-1 rounded-full text-xs border ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        {d === 1 ? "1 dia" : `${d} dias`}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Notificar quando vencer</Label>
                  <p className="text-xs text-muted-foreground">
                    Envia um alerta assim que o lançamento passar da data de vencimento.
                  </p>
                </div>
                <Switch checked={notifVencidos} onCheckedChange={setNotifVencidos} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Notificar quando pago</Label>
                  <p className="text-xs text-muted-foreground">
                    Confirma a baixa após o pagamento total do lançamento.
                  </p>
                </div>
                <Switch checked={notifPagos} onCheckedChange={setNotifPagos} />
              </div>
              <div className="flex justify-end">
                <Button onClick={salvar} disabled={savePrefs.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {savePrefs.isPending ? "Salvando…" : "Salvar preferências"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Caixa de notificações</CardTitle>
          <Button
            variant="outline" size="sm"
            onClick={() =>
              marcarMut.mutate(notifs.filter((n) => !n.lida).map((n) => n.id))
            }
            disabled={notifs.filter((n) => !n.lida).length === 0}
          >
            <Check className="h-3 w-3 mr-1" /> Marcar todas como lidas
          </Button>
        </CardHeader>
        <CardContent>
          {loadingNotifs ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : notifs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma notificação por enquanto.
            </div>
          ) : (
            <ul className="divide-y">
              {notifs.map((n) => {
                const icon =
                  n.tipo === "vencido" ? <CircleAlert className="h-4 w-4 text-destructive" /> :
                  n.tipo === "pago" ? <Check className="h-4 w-4 text-emerald-500" /> :
                  <Clock className="h-4 w-4 text-amber-500" />;
                return (
                  <li
                    key={n.id}
                    className={`py-3 flex gap-3 text-sm ${n.lida ? "" : "bg-muted/30 -mx-4 px-4"}`}
                  >
                    <div className="mt-0.5">{icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {n.lancamento?.descricao ?? "Lançamento"}
                        </span>
                        {!n.lida && <Badge variant="secondary" className="text-[10px]">nova</Badge>}
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
                      <Button variant="ghost" size="sm" onClick={() => marcarMut.mutate([n.id])}>
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}