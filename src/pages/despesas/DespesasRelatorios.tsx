import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Download } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
import { useLancamentos } from "@/hooks/useDespesasLancamentos";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function ymKey(iso: string) {
  return iso.slice(0, 7);
}

export default function DespesasRelatorios() {
  const { podeVer } = useDespesasPermissions();

  const hoje = new Date();
  const doceMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
  const [dataInicio, setDataInicio] = useState(doceMesesAtras.toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(
    new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10)
  );

  const { data: rows = [], isLoading } = useLancamentos({ dataInicio, dataFim });

  const kpis = useMemo(() => {
    let previstoPagar = 0, previstoReceber = 0, pago = 0, recebido = 0, aberto = 0, atrasado = 0;
    for (const r of rows) {
      if (r.status === "cancelado") continue;
      const total = Number(r.valor_total);
      const pg = Number(r.valor_pago);
      const restante = total - pg;
      if (r.tipo === "a_pagar") { previstoPagar += total; pago += pg; }
      else { previstoReceber += total; recebido += pg; }
      if (r.status !== "pago") aberto += restante;
      if (r.status === "vencido") atrasado += restante;
    }
    const inadimplencia = previstoPagar + previstoReceber > 0
      ? (atrasado / (previstoPagar + previstoReceber)) * 100 : 0;
    return { previstoPagar, previstoReceber, pago, recebido, aberto, atrasado, inadimplencia };
  }, [rows]);

  const curvaMensal = useMemo(() => {
    const map = new Map<string, { mes: string; previsto: number; pago: number }>();
    for (const r of rows) {
      if (r.status === "cancelado") continue;
      const k = ymKey(r.data_vencimento);
      const cur = map.get(k) ?? { mes: k, previsto: 0, pago: 0 };
      cur.previsto += Number(r.valor_total);
      cur.pago += Number(r.valor_pago);
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [rows]);

  const porCentro = useMemo(() => {
    const map = new Map<string, { nome: string; previsto: number; pago: number }>();
    for (const r of rows) {
      if (r.status === "cancelado") continue;
      const nome = r.centro_custo?.nome ?? "—";
      const cur = map.get(nome) ?? { nome, previsto: 0, pago: 0 };
      cur.previsto += Number(r.valor_total);
      cur.pago += Number(r.valor_pago);
      map.set(nome, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.pago - a.pago).slice(0, 10);
  }, [rows]);

  const topPessoas = useMemo(() => {
    const map = new Map<string, { nome: string; pago: number; count: number }>();
    for (const r of rows) {
      if (r.status === "cancelado") continue;
      const nome = r.pessoa?.nome ?? "—";
      const cur = map.get(nome) ?? { nome, pago: 0, count: 0 };
      cur.pago += Number(r.valor_pago);
      cur.count += 1;
      map.set(nome, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.pago - a.pago).slice(0, 10);
  }, [rows]);

  function exportar() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(curvaMensal), "Curva mensal");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porCentro), "Por centro de custo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topPessoas), "Top pessoas");
    XLSX.writeFile(wb, `despesas-relatorios-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const encargos = useQuery({
    queryKey: ["despesas-relatorios-encargos"],
    enabled: podeVer("imoveis") || podeVer("calendario"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_imovel_encargos" as any)
        .select(`id, tipo, descricao, valor_anual, parcelas, vencimento_primeira_parcela, ativo,
                 imovel:despesas_imoveis(codigo, descricao, situacao, centro_custo:despesas_centros_custo(nome))`)
        .eq("ativo", true)
        .order("tipo");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  if (!podeVer("calendario")) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <CardTitle>Sem acesso</CardTitle>
          <CardDescription>Você precisa ter acesso ao Calendário para ver relatórios.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios — Despesas</h1>
          <p className="text-muted-foreground">
            Visão consolidada do período selecionado (baseado no vencimento).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportar} disabled={!rows.length}>
          <Download className="h-4 w-4 mr-2" /> Exportar XLSX
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Período</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 max-w-md">
          <div className="space-y-1">
            <Label>De</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Até</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Previsto (pagar)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmtBRL(kpis.previstoPagar)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Previsto (receber)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmtBRL(kpis.previstoReceber)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pago no período</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmtBRL(kpis.pago)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Atrasado</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{fmtBRL(kpis.atrasado)}</p>
            <Badge variant="outline" className="mt-1">{kpis.inadimplencia.toFixed(1)}% inadimplência</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Curva mensal — previsto vs pago</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 320 }}>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : curvaMensal.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={curvaMensal}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`} />
                <RTooltip formatter={(v: number) => fmtBRL(v)} />
                <Legend />
                <Bar dataKey="previsto" name="Previsto" fill="hsl(var(--muted-foreground))" />
                <Bar dataKey="pago" name="Pago" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 centros de custo (pago)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Centro</TableHead>
                  <TableHead className="text-right">Previsto</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCentro.map((c) => (
                  <TableRow key={c.nome}>
                    <TableCell>{c.nome}</TableCell>
                    <TableCell className="text-right">{fmtBRL(c.previsto)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(c.pago)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 pessoas (pago)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead className="text-right">Lançamentos</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPessoas.map((p) => (
                  <TableRow key={p.nome}>
                    <TableCell>{p.nome}</TableCell>
                    <TableCell className="text-right">{p.count}</TableCell>
                    <TableCell className="text-right">{fmtBRL(p.pago)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}