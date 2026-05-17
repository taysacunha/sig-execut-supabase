import jsPDF from "jspdf";
import executLogo from "@/assets/execut-logo.jpg";
import { format, parseISO } from "date-fns";
import { calcularPremiacao, formatBRL, type CenarioVenda } from "./premiacaoCalc";

export interface PremiacaoPdfInput {
  colaborador: string;
  periodo: 1 | 2;       // 1ª ou 2ª quinzena
  dataInicio: string;   // yyyy-mm-dd
  dataFim: string;
  dataRecebimento: string;
  valorMensal: number;
  diasVendidos: CenarioVenda;
}

function fmtDate(s: string) {
  try { return format(parseISO(s), "dd/MM/yyyy"); } catch { return s; }
}

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch(executLogo);
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function gerarPremiacaoPDF(input: PremiacaoPdfInput): Promise<void> {
  const calc = calcularPremiacao(input.valorMensal, input.diasVendidos);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;

  // Header: logo + título
  const logo = await loadLogo();
  let y = 15;
  if (logo) doc.addImage(logo, "JPEG", margin, y, 22, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("RECIBO", pageW / 2, y + 10, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Execut - Consultoria & Negócios Imobiliários Ltda.", pageW / 2, y + 17, { align: "center" });
  y += 32;

  // Subtítulo período / colaborador
  const quinzenaLabel = input.periodo === 1 ? "1ª" : "2ª";
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`PERÍODO DE ${fmtDate(input.dataInicio)} A ${fmtDate(input.dataFim)}`, margin, y);
  y += 7;
  doc.text(`COLABORADOR: ${input.colaborador.toUpperCase()}`, margin, y);
  y += 4;

  // Linha
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Tabela de cálculo
  const tableX = margin;
  const tableW = pageW - margin * 2;
  const valueX = pageW - margin - 5;
  const rowH = 8;

  function row(label: string, valueText: string, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.rect(tableX, y, tableW, rowH);
    doc.text(label, tableX + 2, y + 5.5);
    doc.text(valueText, valueX, y + 5.5, { align: "right" });
    y += rowH;
  }

  if (calc.cenario === 0) {
    // Não vende — modelo página 1
    row("PREMIAÇÃO", formatBRL(calc.valorMensal));
    row("Comissão 15 dias", formatBRL(calc.quinzena));
    row("1/3 da Comissão", formatBRL(calc.quinzena / 3));
    row(`RECEBE DIA ${fmtDate(input.dataRecebimento)}`, formatBRL(calc.recebe), true);
  } else {
    // Vende 5 / 10 / 15 — modelos páginas 2/3/4
    row("PREMIAÇÃO", formatBRL(calc.quinzena));
    row("Mais Acréscimo 1/3", formatBRL(calc.acrescimoUmTerco));
    row("TOTAL", formatBRL(calc.total), true);
    row(
      `VENDA DE ${calc.cenario} DIAS DE FÉRIAS (${quinzenaLabel} QUINZENA) + 1/3`,
      formatBRL(calc.vendaParcelaComUmTerco)
    );
    row(
      `1/3 DE FÉRIAS - REFERENTE A ${calc.diasGozados} DIAS USUFRUÍDO`,
      formatBRL(calc.umTercoDiasGozados)
    );
    row(`RECEBE DIA ${fmtDate(input.dataRecebimento)}`, formatBRL(calc.recebe), true);
  }

  // Assinatura
  y += 18;
  doc.line(margin + 30, y, pageW - margin - 30, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Assinatura", pageW / 2, y, { align: "center" });

  // Rodapé
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("EXECUT - Consultoria & Negócios Imobiliários Ltda.", pageW / 2, y, { align: "center" });

  const fileName = `Premiacao_${input.colaborador.replace(/\s+/g, "_")}_Q${input.periodo}_${input.dataInicio}.pdf`;
  doc.save(fileName);
}
