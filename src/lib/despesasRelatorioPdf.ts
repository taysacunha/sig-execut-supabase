import type { Lancamento } from "@/hooks/useDespesasLancamentos";

/** Colunas do modelo de relatório (MODELO_RELATÓRIO.csv). */
export const COLUNAS_RELATORIO = [
  "Vencimento", "Conta bancária", "Imóvel", "Descrição",
  "Pessoa", "Centro de custo", "Plano de Contas", "Categoria",
];

export interface MapasRelatorio {
  contas: Record<string, string>;
  planos: Record<string, string>;
  veiculos?: Record<string, string>;
}

const fmtData = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** Converte lançamentos nas linhas do relatório, na ordem das colunas. */
export function linhasRelatorio(rows: Lancamento[], mapas: MapasRelatorio, modoVeiculo = false): string[][] {
  return rows.map((r) => [
    fmtData(r.data_vencimento),
    r.conta_bancaria_id ? mapas.contas[r.conta_bancaria_id] ?? "" : "",
    modoVeiculo
      ? (r.veiculo_id ? mapas.veiculos?.[r.veiculo_id] ?? "" : "")
      : r.imovel
        ? [r.imovel.codigo, r.imovel.endereco].filter(Boolean).join(" — ")
        : "",
    r.descricao ?? "",
    r.pessoa?.nome ?? "",
    r.centro_custo?.nome ?? "",
    r.plano_conta_id ? mapas.planos[r.plano_conta_id] ?? "" : "",
    r.categoria?.nome ?? "",
  ]);
}

export async function gerarRelatorioPdf(opts: {
  titulo: string;
  filtros: string;
  colunas: string[];
  linhas: string[][];
  arquivo: string;
}) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const m = 8;
  // pesos de largura por coluna
  const pesos = [9, 13, 15, 26, 18, 12, 12, 13];
  const total = pesos.reduce((a, b) => a + b, 0);
  const larg = pesos.map((p) => ((W - 2 * m) * p) / total);
  const lh = 3.6;

  const header = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(opts.titulo, m, 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    const sub = pdf.splitTextToSize(
      `${opts.filtros} • ${opts.linhas.length} lançamento(s) • Gerado em ${new Date().toLocaleString("pt-BR")}`,
      W - 2 * m,
    );
    pdf.text(sub, m, 17);
    let y = 17 + sub.length * lh + 1;
    pdf.setFillColor(230, 230, 230);
    pdf.rect(m, y, W - 2 * m, 6, "F");
    pdf.setFont("helvetica", "bold");
    let x = m;
    opts.colunas.forEach((c, i) => { pdf.text(c, x + 1, y + 4); x += larg[i]; });
    pdf.setFont("helvetica", "normal");
    return y + 7;
  };

  let y = header();
  for (const linha of opts.linhas) {
    const partes = linha.map((t, i) => pdf.splitTextToSize(t || "—", larg[i] - 2) as string[]);
    const alt = Math.max(...partes.map((p) => p.length)) * lh + 1.5;
    if (y + alt > H - 10) { pdf.addPage(); y = header(); }
    let x = m;
    partes.forEach((p, i) => { pdf.text(p, x + 1, y + 3); x += larg[i]; });
    y += alt;
    pdf.setDrawColor(220, 220, 220);
    pdf.line(m, y - 0.5, W - m, y - 0.5);
  }
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.text(`Página ${i} de ${n}`, W - m, H - 5, { align: "right" });
  }
  pdf.save(opts.arquivo);
}
