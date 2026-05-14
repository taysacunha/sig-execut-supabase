import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, isWeekend, getDate, isSaturday, isSunday, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface GozoPeriodo {
  ferias_id: string;
  data_inicio: string;
  data_fim: string;
  tipo?: string;
}

interface Ferias {
  id: string;
  colaborador_id: string;
  quinzena1_inicio: string;
  quinzena1_fim: string;
  quinzena2_inicio: string | null;
  quinzena2_fim: string | null;
  gozo_diferente: boolean;
  gozo_quinzena1_inicio: string | null;
  gozo_quinzena1_fim: string | null;
  gozo_quinzena2_inicio: string | null;
  gozo_quinzena2_fim: string | null;
  gozo_flexivel?: boolean;
  is_excecao: boolean;
  vender_dias?: boolean;
  dias_vendidos?: number | null;
  quinzena_venda?: number | null;
  colaborador?: {
    nome: string;
    setor?: { id: string; nome: string } | null;
    unidade?: { nome: string } | null;
  } | null;
  _gozoPeriodos?: GozoPeriodo[];
}

interface Props {
  ferias: Ferias[];
  year: number;
  /** months selected (0-11) — empty means single month from rangeStart */
  selectedMonths: number[];
  /** true if "year" mode (full year) */
  isFullYear: boolean;
  /** Visible range start (month start) — used when selectedMonths is empty */
  rangeStart: Date;
}

// Paleta RGB para setores (espelha SETOR_COLORS do GanttFeriasView)
const SETOR_COLORS: Array<{ bg: [number, number, number]; border: [number, number, number] }> = [
  { bg: [217, 232, 247], border: [51, 122, 204] },
  { bg: [219, 240, 228], border: [51, 153, 102] },
  { bg: [253, 230, 207], border: [232, 144, 32] },
  { bg: [232, 219, 240], border: [128, 90, 175] },
  { bg: [250, 218, 218], border: [217, 64, 64] },
  { bg: [212, 234, 234], border: [54, 138, 138] },
  { bg: [247, 244, 207], border: [194, 175, 36] },
  { bg: [247, 219, 232], border: [204, 76, 142] },
];

interface GozoInterval { start: Date; end: Date; diasGozados: number; diasVendidos: number; }

const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
const mk = (start: Date, end: Date, diasVendidos = 0): GozoInterval => ({ start, end, diasGozados: daysBetween(start, end), diasVendidos });

function getGozoIntervals(f: Ferias): GozoInterval[] {
  if (f.gozo_flexivel && f._gozoPeriodos && f._gozoPeriodos.length > 0) {
    const internos = f._gozoPeriodos.filter((p) => p.tipo !== "vender");
    const source = internos.length > 0 ? internos : f._gozoPeriodos;
    return source.map((p) => mk(parseISO(p.data_inicio), parseISO(p.data_fim)));
  }
  if (f.gozo_diferente) {
    const out: GozoInterval[] = [];
    if (f.gozo_quinzena1_inicio && f.gozo_quinzena1_fim)
      out.push(mk(parseISO(f.gozo_quinzena1_inicio), parseISO(f.gozo_quinzena1_fim)));
    if (f.gozo_quinzena2_inicio && f.gozo_quinzena2_fim)
      out.push(mk(parseISO(f.gozo_quinzena2_inicio), parseISO(f.gozo_quinzena2_fim)));
    return out;
  }
  const venda = f.vender_dias && f.dias_vendidos ? f.dias_vendidos : 0;
  const qV = f.quinzena_venda || 1;
  const out: GozoInterval[] = [];
  const q1s = parseISO(f.quinzena1_inicio);
  const q1e = parseISO(f.quinzena1_fim);
  if (venda > 0 && qV === 1) {
    const total = daysBetween(q1s, q1e);
    const goz = Math.max(0, total - venda);
    if (goz > 0) {
      const end = new Date(q1s.getTime() + (goz - 1) * 86400000);
      out.push({ start: q1s, end, diasGozados: goz, diasVendidos: Math.min(total, venda) });
    }
  } else {
    out.push(mk(q1s, q1e));
  }
  if (f.quinzena2_inicio && f.quinzena2_fim) {
    const q2s = parseISO(f.quinzena2_inicio);
    const q2e = parseISO(f.quinzena2_fim);
    if (venda > 0 && qV === 2) {
      const total = daysBetween(q2s, q2e);
      const goz = Math.max(0, total - venda);
      if (goz > 0) {
        const end = new Date(q2s.getTime() + (goz - 1) * 86400000);
        out.push({ start: q2s, end, diasGozados: goz, diasVendidos: Math.min(total, venda) });
      }
    } else {
      out.push(mk(q2s, q2e));
    }
  }
  return out;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function GanttFeriasPDFGenerator({ ferias, year, selectedMonths, isFullYear, rangeStart }: Props) {
  const [generating, setGenerating] = useState(false);

  const monthsToRender = useMemo<number[]>(() => {
    if (isFullYear) return Array.from({ length: 12 }, (_, i) => i);
    if (selectedMonths.length > 0) return [...selectedMonths].sort((a, b) => a - b);
    return [rangeStart.getMonth()];
  }, [isFullYear, selectedMonths, rangeStart]);

  const renderMonth = (pdf: jsPDF, month: number, isFirst: boolean) => {
    const monthStart = startOfMonth(new Date(year, month));
    const monthEnd = endOfMonth(new Date(year, month));
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const feriasMes = ferias.filter((f) =>
      getGozoIntervals(f).some((iv) => iv.start <= monthEnd && iv.end >= monthStart)
    );
    if (feriasMes.length === 0) return false;

      // Agrupar por colaborador
      const rowsMap = new Map<string, { nome: string; setorId: string; setorNome: string; unidade: string; ferias: Ferias[] }>();
      feriasMes.forEach((f) => {
        const id = f.colaborador_id;
        if (!rowsMap.has(id)) {
          rowsMap.set(id, {
            nome: f.colaborador?.nome || "Colaborador",
            setorId: f.colaborador?.setor?.id || "",
            setorNome: f.colaborador?.setor?.nome || "",
            unidade: f.colaborador?.unidade?.nome || "",
            ferias: [],
          });
        }
        rowsMap.get(id)!.ferias.push(f);
      });
      const rows = Array.from(rowsMap.values()).sort(
        (a, b) => a.setorNome.localeCompare(b.setorNome) || a.nome.localeCompare(b.nome)
      );

      // Mapa de cores por setor
      const uniqueSetores = [...new Set(rows.map((r) => r.setorId).filter(Boolean))];
      const colorBySetor = new Map<string, typeof SETOR_COLORS[0]>();
      uniqueSetores.forEach((sid, idx) => colorBySetor.set(sid, SETOR_COLORS[idx % SETOR_COLORS.length]));

      // Detectar sobreposições no mesmo setor (somente dentro do mês)
      const overlapColabIds = new Set<string>();
      const sectorIntervals = new Map<string, Array<{ start: Date; end: Date; colabId: string }>>();
      feriasMes.forEach((f) => {
        const sid = f.colaborador?.setor?.id || "";
        if (!sid) return;
        if (!sectorIntervals.has(sid)) sectorIntervals.set(sid, []);
        getGozoIntervals(f).forEach((iv) => {
          // intersect with month
          const s = iv.start < monthStart ? monthStart : iv.start;
          const e = iv.end > monthEnd ? monthEnd : iv.end;
          if (s <= e) sectorIntervals.get(sid)!.push({ start: s, end: e, colabId: f.colaborador_id });
        });
      });
      sectorIntervals.forEach((list) => {
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            if (list[i].colabId !== list[j].colabId &&
              list[i].start <= list[j].end && list[j].start <= list[i].end) {
              overlapColabIds.add(list[i].colabId);
              overlapColabIds.add(list[j].colabId);
            }
          }
        }
      });

      // PDF setup
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const headerH = 18;
      const colNomes = 60;
      const dayHeaderH = 7;
      const rowH = 7;
      const footerH = 8;
      const detailsBlockMin = 30; // espaço mínimo para detalhamento

      const tableLeft = margin;
      const tableRight = pageW - margin;
      const tableWidth = tableRight - tableLeft;
      const dayWidth = (tableWidth - colNomes) / days.length;

      // Quantas linhas cabem em UMA página (gráfico) reservando espaço para detalhamento
      const availH = pageH - headerH - dayHeaderH - footerH - margin - detailsBlockMin;
      const rowsPerPage = Math.max(1, Math.floor(availH / rowH));
      const ganttPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));

      const drawHeader = () => {
        // Título
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(20, 20, 20);
        pdf.text(`Calendário de Férias — ${MESES[month]} de ${year}`, margin, margin + 5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(
          `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • ${rows.length} colaborador(es)`,
          margin,
          margin + 10
        );
        // Page indicator (right)
        pdf.text(`Página ${pdf.getNumberOfPages()}`, tableRight, margin + 10, { align: "right" });
      };

      const drawDayHeader = (top: number) => {
        // fundo
        pdf.setFillColor(245, 245, 247);
        pdf.rect(tableLeft, top, tableWidth, dayHeaderH, "F");
        // coluna nome
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(60, 60, 60);
        pdf.text("Colaborador", tableLeft + 1.5, top + 4.8);
        // dias
        pdf.setFontSize(7);
        days.forEach((d, i) => {
          const x = tableLeft + colNomes + i * dayWidth;
          if (isWeekend(d)) {
            pdf.setFillColor(225, 225, 230);
            pdf.rect(x, top, dayWidth, dayHeaderH, "F");
          }
          pdf.setTextColor(isSunday(d) ? 180 : isSaturday(d) ? 80 : 80, 80, 80);
          pdf.text(String(getDate(d)), x + dayWidth / 2, top + 4.8, { align: "center" });
        });
        // bordas
        pdf.setDrawColor(200, 200, 205);
        pdf.setLineWidth(0.1);
        pdf.line(tableLeft, top + dayHeaderH, tableRight, top + dayHeaderH);
        pdf.line(tableLeft + colNomes, top, tableLeft + colNomes, top + dayHeaderH);
      };

      const drawRow = (row: typeof rows[number], rowIdx: number, top: number) => {
        // fundo zebra
        if (rowIdx % 2 === 1) {
          pdf.setFillColor(250, 250, 252);
          pdf.rect(tableLeft, top, tableWidth, rowH, "F");
        }
        // weekend bands
        days.forEach((d, i) => {
          if (isWeekend(d)) {
            pdf.setFillColor(235, 235, 240);
            pdf.rect(tableLeft + colNomes + i * dayWidth, top, dayWidth, rowH, "F");
          }
        });
        // bars
        const colors = colorBySetor.get(row.setorId) || SETOR_COLORS[0];
        const hasOverlap = overlapColabIds.has(row.ferias[0]?.colaborador_id);
        row.ferias.forEach((f) => {
          getGozoIntervals(f).forEach((iv) => {
            const s = iv.start < monthStart ? monthStart : iv.start;
            const e = iv.end > monthEnd ? monthEnd : iv.end;
            if (s > monthEnd || e < monthStart) return;
            const sIdx = days.findIndex((d) => format(d, "yyyy-MM-dd") === format(s, "yyyy-MM-dd"));
            const eIdx = days.findIndex((d) => format(d, "yyyy-MM-dd") === format(e, "yyyy-MM-dd"));
            if (sIdx < 0 || eIdx < 0) return;
            const x = tableLeft + colNomes + sIdx * dayWidth;
            const w = (eIdx - sIdx + 1) * dayWidth;
            // bar
            pdf.setFillColor(...colors.bg);
            pdf.rect(x + 0.3, top + 1, w - 0.6, rowH - 2, "F");
            // border esquerda colorida
            pdf.setFillColor(...colors.border);
            pdf.rect(x + 0.3, top + 1, 0.7, rowH - 2, "F");
            // borda direita vermelha em sobreposição
            if (hasOverlap) {
              pdf.setFillColor(204, 51, 51);
              pdf.rect(x + w - 1, top + 1, 0.7, rowH - 2, "F");
            }
            // label de dias
            const totalDias = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            if (w > 6) {
              pdf.setFont("helvetica", "bold");
              pdf.setFontSize(6.5);
              pdf.setTextColor(40, 40, 40);
              pdf.text(`${totalDias}d`, x + w / 2, top + rowH / 2 + 1.2, { align: "center" });
            }
          });
        });
        // nome (desenhado por cima do fundo, antes da grade vertical)
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(30, 30, 30);
        const nomeMax = colNomes - 4;
        const nomeText = pdf.splitTextToSize(row.nome + (hasOverlap ? "  •" : ""), nomeMax)[0];
        pdf.text(nomeText, tableLeft + 1.5, top + 3);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        pdf.setTextColor(110, 110, 115);
        const sub = [row.unidade, row.setorNome].filter(Boolean).join(" • ");
        if (sub) {
          const subText = pdf.splitTextToSize(sub, nomeMax)[0];
          pdf.text(subText, tableLeft + 1.5, top + 5.6);
        }
        // bullet vermelho ao lado do nome se overlap
        if (hasOverlap) {
          pdf.setFillColor(204, 51, 51);
          pdf.circle(tableLeft + colNomes - 2.5, top + 3, 0.9, "F");
        }
        // borda inferior linha
        pdf.setDrawColor(220, 220, 225);
        pdf.setLineWidth(0.1);
        pdf.line(tableLeft, top + rowH, tableRight, top + rowH);
        // separador coluna nome
        pdf.line(tableLeft + colNomes, top, tableLeft + colNomes, top + rowH);
      };

      const drawGrid = (top: number, bottom: number) => {
        pdf.setDrawColor(230, 230, 235);
        pdf.setLineWidth(0.05);
        for (let i = 1; i < days.length; i++) {
          const x = tableLeft + colNomes + i * dayWidth;
          pdf.line(x, top, x, bottom);
        }
        // borda externa
        pdf.setDrawColor(180, 180, 185);
        pdf.setLineWidth(0.2);
        pdf.rect(tableLeft, top, tableWidth, bottom - top);
      };

      const drawLegend = (top: number) => {
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        let x = tableLeft;
        const y = top;
        // weekend
        pdf.setFillColor(225, 225, 230);
        pdf.rect(x, y - 2.5, 3, 3, "F");
        pdf.text("Fim de semana", x + 4, y);
        x += 30;
        // gozo
        pdf.setFillColor(217, 232, 247);
        pdf.rect(x, y - 2.5, 3, 3, "F");
        pdf.setFillColor(51, 122, 204);
        pdf.rect(x, y - 2.5, 0.7, 3, "F");
        pdf.text("Período de gozo", x + 4, y);
        x += 30;
        // overlap
        pdf.setFillColor(204, 51, 51);
        pdf.circle(x + 1.2, y - 1, 0.9, "F");
        pdf.text("Sobreposição no setor", x + 4, y);
      };

      // Detalhamento textual por colaborador (lista) — desenhado abaixo do gráfico
      const drawDetails = (rowsSlice: typeof rows, top: number): number => {
        let y = top + 4;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(40, 40, 40);
        pdf.text("Detalhamento por colaborador", tableLeft, y);
        y += 4;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(60, 60, 60);
        const colW = tableWidth / 2;
        let col = 0;
        let rowY = y;
        rowsSlice.forEach((r) => {
          if (rowY > pageH - margin - 6) {
            pdf.addPage();
            drawHeader();
            rowY = margin + headerH + 4;
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9);
            pdf.text("Detalhamento por colaborador (cont.)", tableLeft, rowY);
            rowY += 4;
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7.5);
            col = 0;
          }
          const x = tableLeft + col * colW;
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(30, 30, 30);
          const sub = [r.unidade, r.setorNome].filter(Boolean).join(" • ");
          pdf.text(`• ${r.nome}${sub ? "  " + sub : ""}`, x, rowY);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(80, 80, 80);
          let lineY = rowY + 3;
          r.ferias.forEach((f) => {
            getGozoIntervals(f).forEach((iv) => {
              const txt = `  ${format(iv.start, "dd/MM/yyyy")} a ${format(iv.end, "dd/MM/yyyy")} — ${iv.diasGozados}d gozados${iv.diasVendidos > 0 ? ` • ${iv.diasVendidos}d vendidos` : ""}`;
              pdf.text(txt, x, lineY);
              lineY += 3;
            });
          });
          if (col === 0) {
            col = 1;
          } else {
            col = 0;
            rowY = lineY + 1;
          }
        });
        return rowY;
      };

      // Render gantt page(s) for this month
      for (let p = 0; p < ganttPages; p++) {
        if (!isFirst || p > 0) pdf.addPage();
        drawHeader();
        const top = margin + headerH;
        drawDayHeader(top);
        const startIdx = p * rowsPerPage;
        const pageRows = rows.slice(startIdx, startIdx + rowsPerPage);
        pageRows.forEach((row, i) => {
          drawRow(row, startIdx + i, top + dayHeaderH + i * rowH);
        });
        const gridBottom = top + dayHeaderH + pageRows.length * rowH;
        drawGrid(top + dayHeaderH, gridBottom);
        // Detalhamento na última página do gráfico do mês
        if (p === ganttPages - 1) {
          drawDetails(rows, gridBottom + 2);
          drawLegend(pageH - margin - 1);
        }
        isFirst = false;
      }
      return true;
  };

  const handleGenerate = () => {
    setGenerating(true);
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      let isFirst = true;
      let any = false;
      for (const m of monthsToRender) {
        const rendered = renderMonth(pdf, m, isFirst);
        if (rendered) {
          any = true;
          isFirst = false;
        }
      }
      if (!any) {
        toast.error("Nenhuma férias no período selecionado");
        setGenerating(false);
        return;
      }
      const suffix = isFullYear
        ? `${year}-ano`
        : monthsToRender.length === 1
          ? `${year}-${String(monthsToRender[0] + 1).padStart(2, "0")}`
          : `${year}-${monthsToRender.map((m) => String(m + 1).padStart(2, "0")).join("-")}`;
      pdf.save(`ferias-gantt-${suffix}.pdf`);
      toast.success("PDF gerado com sucesso");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating} className="gap-1.5">
      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Gerar PDF
    </Button>
  );
}