import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, CalendarClock, TrendingDown, TrendingUp, Wallet,
  Building2, ArrowLeftRight, Database, Bell, ChevronRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
import { useDespesasDashboard } from "@/hooks/useDespesasDashboard";
import { useNotificacoes } from "@/hooks/useDespesasNotificacoes";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const brlFull = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dm = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const statusLabel: Record<string, string> = {
  a_vencer: "A vencer",
  vencido: "Vencido",
  pago_parcial: "Parcial",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  a_vencer: "secondary",
  vencido: "destructive",
  pago_parcial: "outline",
};

export default function DespesasDashboard() {
  const navigate = useNavigate();
  const { podeVer } = useDespesasPermissions();
  const { data, isLoading } = useDespesasDashboard();
  const { data: notifs = [] } = useNotificacoes();
  const naoLidas = notifs.filter((n) => !n.lida).slice(0, 5);

  const kpis = data?.kpis;

  const tiles = [
    { key: "calendario" as const, title: "Calendário", icon: Wallet, url: "/despesas/calendario" },
    { key: "imoveis" as const, title: "Imóveis", icon: Building2, url: "/despesas/imoveis" },
    { key: "repasses" as const, title: "Repasses", icon: ArrowLeftRight, url: "/despesas/repasses" },
    { key: "cadastros" as const, title: "Cadastros", icon: Database, url: "/despesas/cadastros" },
  ].filter((t) => podeVer(t.key));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Despesas</h1>
        <p className="text-muted-foreground">Visão do que precisa da sua atenção agora.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Vencendo em 7 dias"
          icon={<CalendarClock className="h-4 w-4" />}
          count={kpis?.vencendo7.count}
          total={kpis?.vencendo7.total}
          loading={isLoading}
          onClick={() => navigate("/despesas/calendario")}
        />
        <KpiCard
          title="Vencidos"
          icon={<AlertTriangle className="h-4 w-4" />}
          count={kpis?.vencidos.count}
          total={kpis?.vencidos.total}
          loading={isLoading}
          tone="destructive"
          onClick={() => navigate("/despesas/calendario")}
        />
        <KpiCard
          title="A receber no mês"
          icon={<TrendingUp className="h-4 w-4" />}
          count={kpis?.aReceberMes.count}
          total={kpis?.aReceberMes.total}
          loading={isLoading}
          onClick={() => navigate("/despesas/calendario")}
        />
        <KpiCard
          title="Pago no mês"
          icon={<TrendingDown className="h-4 w-4" />}
          total={kpis?.pagoNoMes}
          loading={isLoading}
          onClick={() => navigate("/despesas/relatorios")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Próximos vencimentos */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Próximos vencimentos</CardTitle>
              <CardDescription>Vencidos e a vencer nos próximos 7 dias</CardDescription>
            </div>
            <Link to="/despesas/calendario" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (data?.proximos ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada vencendo por aqui. 👌</p>
            ) : (
              <ul className="divide-y">
                {data!.proximos.map((l) => {
                  const restante = Math.max(0, Number(l.valor_total ?? 0) - Number(l.valor_pago ?? 0));
                  return (
                    <li
                      key={l.id}
                      className="flex items-center justify-between gap-3 py-2 cursor-pointer hover:bg-muted/40 rounded px-2 -mx-2"
                      onClick={() => navigate("/despesas/calendario")}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={statusVariant[l.status] ?? "outline"} className="text-[10px]">
                            {statusLabel[l.status] ?? l.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{dm(l.data_vencimento)}</span>
                        </div>
                        <div className="text-sm font-medium truncate">{l.descricao}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {l.centro_custo?.nome ?? "—"} · {l.tipo === "a_pagar" ? "A pagar" : "A receber"}
                        </div>
                      </div>
                      <div className={`text-sm font-semibold ${l.tipo === "a_pagar" ? "text-destructive" : "text-primary"}`}>
                        {brl(restante || Number(l.valor_total ?? 0))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coisas para atualizar</CardTitle>
            <CardDescription>Cadastros incompletos e pendências</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (data?.checklist ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem pendências. Tudo em dia!</p>
            ) : (
              <ul className="space-y-2">
                {data!.checklist.map((c) => (
                  <li key={c.key}>
                    <Link
                      to={c.url}
                      className="flex items-center justify-between gap-3 rounded-md border p-2 hover:bg-muted/50 transition"
                    >
                      <span className="text-sm">{c.label}</span>
                      <span className="flex items-center gap-1 text-sm font-semibold">
                        <Badge variant="secondary">{c.count}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Fluxo 30 dias */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Fluxo dos próximos 30 dias</CardTitle>
            <CardDescription>Valores em aberto por data de vencimento</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.fluxo30d ?? []}>
                  <defs>
                    <linearGradient id="rec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pag" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="data" tickFormatter={dm} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => brl(Number(v))} tick={{ fontSize: 11 }} width={80} />
                  <Tooltip
                    formatter={(v: number) => brlFull(v)}
                    labelFormatter={(l) => dm(String(l))}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Area type="monotone" dataKey="a_receber" name="A receber" stroke="hsl(var(--primary))" fill="url(#rec)" />
                  <Area type="monotone" dataKey="a_pagar" name="A pagar" stroke="hsl(var(--destructive))" fill="url(#pag)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top centros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 centros de custo</CardTitle>
            <CardDescription>Pago no mês corrente</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (data?.topCentros ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem pagamentos neste mês.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data!.topCentros} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(v) => brl(Number(v))} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nome" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => brlFull(v)}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notificações + atalhos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" /> Notificações não lidas
              </CardTitle>
              <CardDescription>Últimos avisos do módulo</CardDescription>
            </div>
            <Link to="/despesas/notificacoes" className="text-xs text-primary hover:underline">
              Ver todas
            </Link>
          </CardHeader>
          <CardContent>
            {naoLidas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma notificação pendente.</p>
            ) : (
              <ul className="divide-y">
                {naoLidas.map((n) => (
                  <li key={n.id} className="py-2">
                    <div className="text-sm">{n.mensagem ?? n.lancamento?.descricao ?? "Notificação"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString("pt-BR")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atalhos</CardTitle>
            <CardDescription>Ir direto para uma aba</CardDescription>
          </CardHeader>
          <CardContent>
            {tiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem abas disponíveis. Solicite acesso ao administrador.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {tiles.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => navigate(t.url)}
                    className="flex items-center gap-2 rounded-md border p-3 hover:bg-muted/50 transition text-sm"
                  >
                    <t.icon className="h-4 w-4 text-primary" />
                    {t.title}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title, icon, count, total, loading, tone, onClick,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  total?: number;
  loading?: boolean;
  tone?: "destructive";
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer hover:border-primary/50 transition ${
        tone === "destructive" ? "border-destructive/40" : ""
      }`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <>
            <div className={`text-2xl font-bold ${tone === "destructive" ? "text-destructive" : ""}`}>
              {brl(total ?? 0)}
            </div>
            {typeof count === "number" && (
              <div className="text-xs text-muted-foreground mt-1">{count} lançamento(s)</div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}