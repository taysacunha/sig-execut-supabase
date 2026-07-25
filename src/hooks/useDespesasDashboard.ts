import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DASHBOARD_KEY = "despesas-dashboard";

export interface DashboardKpis {
  vencendo7: { count: number; total: number };
  vencidos: { count: number; total: number };
  aReceberMes: { count: number; total: number };
  pagoNoMes: number;
}

export interface ProximoVencimento {
  id: string;
  descricao: string;
  tipo: "a_pagar" | "a_receber";
  status: string;
  data_vencimento: string;
  valor_total: number | null;
  valor_pago: number;
  centro_custo?: { nome: string } | null;
}

export interface FluxoDia {
  data: string;
  a_pagar: number;
  a_receber: number;
}

export interface TopCentroCusto {
  nome: string;
  total: number;
}

export interface ChecklistItem {
  key: string;
  label: string;
  count: number;
  url: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  proximos: ProximoVencimento[];
  fluxo30d: FluxoDia[];
  topCentros: TopCentroCusto[];
  checklist: ChecklistItem[];
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const abertos = ["a_vencer", "vencido", "pago_parcial"] as const;

export function useDespesasDashboard() {
  return useQuery({
    queryKey: [DASHBOARD_KEY],
    staleTime: 60_000,
    queryFn: async (): Promise<DashboardData> => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const em7 = new Date(hoje);
      em7.setDate(hoje.getDate() + 7);
      const em30 = new Date(hoje);
      em30.setDate(hoje.getDate() + 30);
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

      const hojeIso = isoDay(hoje);
      const em7Iso = isoDay(em7);
      const em30Iso = isoDay(em30);
      const inicioMesIso = isoDay(inicioMes);
      const fimMesIso = isoDay(fimMes);

      // ---- Lançamentos abertos até +30 dias e vencidos ----
      const { data: lancsRaw, error: e1 } = await supabase
        .from("despesas_lancamentos" as any)
        .select(
          "id, tipo, descricao, status, data_vencimento, valor_total, valor_pago, centro_custo:despesas_centros_custo(nome)"
        )
        .in("status", abertos as unknown as string[])
        .lte("data_vencimento", em30Iso)
        .order("data_vencimento", { ascending: true })
        .limit(500);
      if (e1) throw e1;
      const lancs = (lancsRaw ?? []) as unknown as ProximoVencimento[];

      const restante = (l: ProximoVencimento) =>
        Math.max(0, Number(l.valor_total ?? 0) - Number(l.valor_pago ?? 0));

      const vencidosArr = lancs.filter((l) => l.data_vencimento < hojeIso);
      const vencendo7Arr = lancs.filter(
        (l) => l.data_vencimento >= hojeIso && l.data_vencimento <= em7Iso
      );

      // ---- A receber em aberto no mês (competência ou vencimento no mês) ----
      const { data: recMesRaw } = await supabase
        .from("despesas_lancamentos" as any)
        .select("id, valor_total, valor_pago")
        .eq("tipo", "a_receber")
        .in("status", abertos as unknown as string[])
        .gte("data_vencimento", inicioMesIso)
        .lte("data_vencimento", fimMesIso)
        .limit(1000);
      const recMes = (recMesRaw ?? []) as unknown as {
        valor_total: number | null;
        valor_pago: number;
      }[];

      // ---- Pago no mês ----
      const { data: pagosRaw } = await supabase
        .from("despesas_lancamento_pagamentos" as any)
        .select("valor, data_pagamento, lancamento:despesas_lancamentos(centro_custo:despesas_centros_custo(nome))")
        .gte("data_pagamento", inicioMesIso)
        .lte("data_pagamento", fimMesIso)
        .limit(1000);
      const pagos = (pagosRaw ?? []) as unknown as {
        valor: number;
        data_pagamento: string;
        lancamento?: { centro_custo?: { nome: string } | null } | null;
      }[];
      const pagoNoMes = pagos.reduce((s, p) => s + Number(p.valor ?? 0), 0);

      // Top 5 centros de custo (pago no mês)
      const mapaCC = new Map<string, number>();
      for (const p of pagos) {
        const nome = p.lancamento?.centro_custo?.nome ?? "Sem centro";
        mapaCC.set(nome, (mapaCC.get(nome) ?? 0) + Number(p.valor ?? 0));
      }
      const topCentros: TopCentroCusto[] = [...mapaCC.entries()]
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // ---- Fluxo dos próximos 30 dias ----
      const proximos30 = lancs.filter(
        (l) => l.data_vencimento >= hojeIso && l.data_vencimento <= em30Iso
      );
      const mapaFluxo = new Map<string, FluxoDia>();
      for (let i = 0; i <= 30; i++) {
        const d = new Date(hoje);
        d.setDate(hoje.getDate() + i);
        const iso = isoDay(d);
        mapaFluxo.set(iso, { data: iso, a_pagar: 0, a_receber: 0 });
      }
      for (const l of proximos30) {
        const item = mapaFluxo.get(l.data_vencimento);
        if (!item) continue;
        const v = restante(l);
        if (l.tipo === "a_pagar") item.a_pagar += v;
        else item.a_receber += v;
      }
      const fluxo30d = [...mapaFluxo.values()];

      // ---- Checklist "coisas para atualizar" ----
      const checklist: ChecklistItem[] = [];

      const { count: alugadosSemInquilino } = await supabase
        .from("despesas_imoveis" as any)
        .select("id", { count: "exact", head: true })
        .eq("situacao", "alugado")
        .is("inquilino_id", null);
      if ((alugadosSemInquilino ?? 0) > 0) {
        checklist.push({
          key: "alugados_sem_inquilino",
          label: "Imóveis alugados sem inquilino vinculado",
          count: alugadosSemInquilino ?? 0,
          url: "/despesas/imoveis",
        });
      }

      const { count: semRip } = await supabase
        .from("despesas_imoveis" as any)
        .select("id", { count: "exact", head: true })
        .or("matricula.is.null,inscricao_municipal.is.null");
      if ((semRip ?? 0) > 0) {
        checklist.push({
          key: "sem_rip",
          label: "Imóveis sem RIP ou inscrição municipal",
          count: semRip ?? 0,
          url: "/despesas/imoveis",
        });
      }

      const umAnoAtras = new Date(hoje);
      umAnoAtras.setFullYear(hoje.getFullYear() - 1);
      const { count: recAntigas } = await supabase
        .from("despesas_recorrencias" as any)
        .select("id", { count: "exact", head: true })
        .eq("ativo", true)
        .is("data_fim", null)
        .lte("data_inicio", isoDay(umAnoAtras));
      if ((recAntigas ?? 0) > 0) {
        checklist.push({
          key: "recorrencias_antigas",
          label: "Recorrências ativas sem data-fim há +12 meses",
          count: recAntigas ?? 0,
          url: "/despesas/recorrencias",
        });
      }

      const trintaDiasAtras = new Date(hoje);
      trintaDiasAtras.setDate(hoje.getDate() - 30);
      const { count: parciaisAntigos } = await supabase
        .from("despesas_lancamentos" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "pago_parcial")
        .lte("updated_at", trintaDiasAtras.toISOString());
      if ((parciaisAntigos ?? 0) > 0) {
        checklist.push({
          key: "parciais_parados",
          label: "Pagamentos parciais sem movimento há +30 dias",
          count: parciaisAntigos ?? 0,
          url: "/despesas/calendario",
        });
      }

      return {
        kpis: {
          vencendo7: {
            count: vencendo7Arr.length,
            total: vencendo7Arr.reduce((s, l) => s + restante(l), 0),
          },
          vencidos: {
            count: vencidosArr.length,
            total: vencidosArr.reduce((s, l) => s + restante(l), 0),
          },
          aReceberMes: {
            count: recMes.length,
            total: recMes.reduce(
              (s, l) => s + Math.max(0, Number(l.valor_total ?? 0) - Number(l.valor_pago ?? 0)),
              0
            ),
          },
          pagoNoMes,
        },
        proximos: [...vencidosArr, ...vencendo7Arr].slice(0, 10),
        fluxo30d,
        topCentros,
        checklist,
      };
    },
  });
}