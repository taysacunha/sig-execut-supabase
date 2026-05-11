import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, isWeekend, getDate, isSaturday, isSunday } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface GozoPeriodo {
  ferias_id: string;
  data_inicio: string;
  data_fim: string;
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
  defaultMonth: number; // 1-12
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

function getGozoIntervals(f: Ferias): Array<{ start: Date; end: Date }> {
  if (f.gozo_flexivel && f._gozoPeriodos && f._gozoPeriodos.length > 0) {
    return f._gozoPeriodos.map((p) => ({ start: parseISO(p.data_inicio), end: parseISO(p.data_fim) }));
  }
  if (f.gozo_diferente) {
    const out: Array<{ start: Date; end: Date }> = [];
    if (f.gozo_quinzena1_inicio && f.gozo_quinzena1_fim)
      out.push({ start: parseISO(f.gozo_quinzena1_inicio), end: parseISO(f.gozo_quinzena1_fim) });
    if (f.gozo_quinzena2_inicio && f.gozo_quinzena2_fim)
      out.push({ start: parseISO(f.gozo_quinzena2_inicio), end: parseISO(f.gozo_quinzena2_fim) });
    return out;
  }
  const out = [{ start: parseISO(f.quinzena1_inicio), end: parseISO(f.quinzena1_fim) }];
  if (f.quinzena2_inicio && f.quinzena2_fim)
    out.push({ start: parseISO(f.quinzena2_inicio), end: parseISO(f.quinzena2_fim) });
  return out;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function GanttFeriasPDFGenerator({ ferias, year, defaultMonth }: Props) {
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth);
  const [generating, setGenerating] = useState(false);

  const monthOptions = useMemo(() => MESES.map((m, i) => ({ value: String(i + 1), label: m })), []);

  const handleGenerate = () => {
    setGenerating(true);
    try {
      const monthStart = startOfMonth(new Date(year, selectedMonth - 1));
      const monthEnd = endOfMonth(new Date(year, selectedMonth - 1));
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

      // Filtra férias com gozo dentro do mês
      const feriasMes = ferias.filter((f) =>
        getGozoIntervals(f).some((iv) => iv.start <= monthEnd && iv.end >= monthStart)
      );

      if (feriasMes.length === 0) {
        toast.error(`Nenhuma férias em ${MESES[selectedMonth - 1]} de ${year}`);
        setGenerating(false);
        return;
      }

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
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const headerH = 18;
      const colNomes = 60;
      const dayHeaderH = 7;
      const rowH = 7;
      const footerH = 8;

      const tableLeft = margin;
      const tableRight = pageW - margin;
      const tableWidth = tableRight - tableLeft;
      const dayWidth = (tableWidth - colNomes) / days.length;

      // Quantas linhas cabem por página
      const availH = pageH - headerH - dayHeaderH - footerH - margin;
      const rowsPerPage = Math.max(1, Math.floor(availH / rowH));
      const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));

      const drawHeader = (pageNum: number) => {
        // Título
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(20, 20, 20);
        pdf.text(`Calendário de Férias — ${MESES[selectedMonth - 1]} de ${year}`, margin, margin + 5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(
          `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • ${rows.length} colaborador(es)`,
          margin,
          margin + 10
        );
        // Page indicator (right)
        pdf.text(`Página ${pageNum} de ${totalPages}`, tableRight, margin + 10, { align: "right" });
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

      // Render pages
      for (let p = 0; p < totalPages; p++) {
        if (p > 0) pdf.addPage();
        drawHeader(p + 1);
        const top = margin + headerH;
        drawDayHeader(top);
        const startIdx = p * rowsPerPage;
        const pageRows = rows.slice(startIdx, startIdx + rowsPerPage);
        pageRows.forEach((row, i) => {
          drawRow(row, startIdx + i, top + dayHeaderH + i * rowH);
        });
        const gridBottom = top + dayHeaderH + pageRows.length * rowH;
        drawGrid(top + dayHeaderH, gridBottom);
        // legenda no rodapé da última página
        if (p === totalPages - 1) {
          drawLegend(pageH - margin - 1);
        }
      }

      pdf.save(`ferias-gantt-${year}-${String(selectedMonth).padStart(2, "0")}.pdf`);
      toast.success("PDF gerado com sucesso");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((m) => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating} className="gap-1.5">
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Gerar PDF do mês
      </Button>
    </div>
  );
}