import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, Loader2 } from "lucide-react";
import { format, parseISO, addYears } from "date-fns";
import jsPDF from "jspdf";
import { toast } from "sonner";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const MESES_DISPONIVEIS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface FormularioPDFGeneratorProps {
  anoReferencia: number;
}

export function FormularioPDFGenerator({ anoReferencia }: FormularioPDFGeneratorProps) {
  const [selectedColaborador, setSelectedColaborador] = useState<string>("_all_");
  const [generating, setGenerating] = useState(false);

  const { data: colaboradores } = useQuery({
    queryKey: ["colaboradores-formulario-pdf"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select(`
          id, nome, data_admissao, data_nascimento,
          setor:ferias_setores!setor_titular_id(id, nome),
          cargo:ferias_cargos(id, nome),
          unidade:ferias_unidades(id, nome)
        `)
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      const list = data || [];
      const ids = list.map((c: any) => c.id);
      let cpfMap = new Map<string, string>();
      if (ids.length) {
        const { data: sensiveis } = await (supabase as any)
          .from("ferias_colaboradores_dados_sensiveis")
          .select("colaborador_id, cpf")
          .in("colaborador_id", ids);
        for (const r of (sensiveis || [])) if (r.cpf) cpfMap.set(r.colaborador_id, r.cpf);
      }
      return list.map((c: any) => ({ ...c, cpf: cpfMap.get(c.id) ?? null }));
    },
  });

  const { data: formularios } = useQuery({
    queryKey: ["formularios-pdf", anoReferencia, selectedColaborador],
    queryFn: async () => {
      let query = supabase
        .from("ferias_formulario_anual")
        .select(`*, colaborador:ferias_colaboradores!colaborador_id(id, nome, data_admissao, setor:ferias_setores!setor_titular_id(nome), cargo:ferias_cargos(nome))`)
        .eq("ano_referencia", anoReferencia);
      if (selectedColaborador !== "_all_") {
        query = query.eq("colaborador_id", selectedColaborador);
      }
      const { data, error } = await query;
      if (error) throw error;
      const list = data || [];
      const ids = Array.from(new Set(list.map((f: any) => f.colaborador?.id).filter(Boolean)));
      let cpfMap = new Map<string, string>();
      if (ids.length) {
        const { data: sensiveis } = await (supabase as any)
          .from("ferias_colaboradores_dados_sensiveis")
          .select("colaborador_id, cpf")
          .in("colaborador_id", ids);
        for (const r of (sensiveis || [])) if (r.cpf) cpfMap.set(r.colaborador_id, r.cpf);
      }
      return list.map((f: any) => f.colaborador
        ? { ...f, colaborador: { ...f.colaborador, cpf: cpfMap.get(f.colaborador.id) ?? null } }
        : f);
    },
  });

  const calcularPeriodoAquisitivo = (dataAdmissao: string, anoRef: number) => {
    const admissao = parseISO(dataAdmissao);
    let inicioPA = new Date(admissao.getFullYear(), admissao.getMonth(), admissao.getDate());
    let fimPA = addYears(inicioPA, 1);
    fimPA.setDate(fimPA.getDate() - 1);
    while (fimPA.getFullYear() < anoRef - 1) {
      inicioPA = addYears(inicioPA, 1);
      fimPA = addYears(fimPA, 1);
    }
    return { inicio: format(inicioPA, "dd/MM/yyyy"), fim: format(fimPA, "dd/MM/yyyy") };
  };

  const generatePage = (pdf: jsPDF, colaborador: any, formulario?: any) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("FORMULÁRIO DE FÉRIAS", pageWidth / 2, 20, { align: "center" });

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Ano de Referência: ${anoReferencia}`, pageWidth / 2, 28, { align: "center" });

    let yPos = 35;
    pdf.setDrawColor(0, 0, 0);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("DADOS DO COLABORADOR", margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    const dados = [
      ["Nome:", colaborador.nome],
      ["Setor:", colaborador.setor?.nome || "—"],
      ["Cargo:", colaborador.cargo?.nome || "—"],
      ["Data de Admissão:", format(parseISO(colaborador.data_admissao), "dd/MM/yyyy")],
    ];

    dados.forEach(([label, value]) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(label, margin, yPos);
      pdf.setFont("helvetica", "normal");
      pdf.text(value, margin + 42, yPos);
      yPos += 6;
    });

    yPos += 2;
    const pa = calcularPeriodoAquisitivo(colaborador.data_admissao, anoReferencia);
    pdf.setFont("helvetica", "bold");
    pdf.text("Período Aquisitivo:", margin, yPos);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${pa.inicio} a ${pa.fim}`, margin + 42, yPos);

    yPos += 8;
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("ESCOLHA DOS MESES PARA FÉRIAS (marque entre 2 ou 3 meses)", margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    const colsPerRow = 4;
    const colWidth = contentWidth / colsPerRow;
    const boxSize = 4;

    MESES_DISPONIVEIS.forEach((mes, idx) => {
      const col = idx % colsPerRow;
      const row = Math.floor(idx / colsPerRow);
      const x = margin + col * colWidth;
      const y = yPos + row * 10;

      const isSelected = formulario && (
        formulario.periodo1_mes === mes ||
        formulario.periodo2_mes === mes ||
        formulario.periodo3_mes === mes
      );

      pdf.setDrawColor(0, 0, 0);
      pdf.rect(x, y - 3, boxSize, boxSize);

      if (isSelected) {
        pdf.setFont("helvetica", "bold");
        pdf.text("X", x + 0.8, y + 0.5);
        pdf.setFont("helvetica", "normal");
      }

      pdf.text(MONTHS[mes - 1], x + boxSize + 3, y);
    });

    yPos += Math.ceil(MESES_DISPONIVEIS.length / colsPerRow) * 10 + 5;

    pdf.setFont("helvetica", "bold");
    pdf.text("Mês de Preferência:", margin, yPos);
    pdf.setFont("helvetica", "normal");

    if (formulario && formulario.periodo_preferencia) {
      const prefMes = formulario[`periodo${formulario.periodo_preferencia}_mes`];
      pdf.text(prefMes ? MONTHS[prefMes - 1] : "_______________", margin + 45, yPos);
    } else {
      pdf.text("_______________", margin + 45, yPos);
    }

    yPos += 10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Deseja vender dias (abono pecuniário)?", margin, yPos);
    yPos += 7;
    pdf.setFont("helvetica", "normal");

    const venderSim = formulario?.vender_dias === true;
    const venderNao = formulario?.vender_dias === false;

    pdf.rect(margin, yPos - 3, boxSize, boxSize);
    if (venderNao) {
      pdf.setFont("helvetica", "bold");
      pdf.text("X", margin + 0.8, yPos + 0.5);
      pdf.setFont("helvetica", "normal");
    }
    pdf.text("Não", margin + boxSize + 3, yPos);

    const simX = margin + 30;
    pdf.rect(simX, yPos - 3, boxSize, boxSize);
    if (venderSim) {
      pdf.setFont("helvetica", "bold");
      pdf.text("X", simX + 0.8, yPos + 0.5);
      pdf.setFont("helvetica", "normal");
    }
    pdf.text(`Sim, ${formulario?.dias_vender || "___"} dias`, simX + boxSize + 3, yPos);

    yPos += 10;
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("OBSERVAÇÃO", margin, yPos);
    yPos += 6;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(80, 80, 80);
    pdf.text("(Use este espaço para especificar datas, períodos específicos ou outras informações)", margin, yPos);
    pdf.setTextColor(0, 0, 0);
    yPos += 6;

    if (formulario?.observacao) {
      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(formulario.observacao, contentWidth);
      pdf.text(lines, margin, yPos);
      yPos += lines.length * 5;
    } else {
      for (let i = 0; i < 4; i++) {
        yPos += 8;
        pdf.setDrawColor(180, 180, 180);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
      }
    }

    pdf.setDrawColor(0, 0, 0);
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageWidth / 2, 285, { align: "center" });
    pdf.setTextColor(0, 0, 0);
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const targetColabs = selectedColaborador !== "_all_"
        ? colaboradores?.filter(c => c.id === selectedColaborador)
        : colaboradores;

      if (!targetColabs?.length) {
        toast.error("Nenhum colaborador encontrado");
        return;
      }

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      targetColabs.forEach((colab, index) => {
        if (index > 0) pdf.addPage();
        const formulario = formularios?.find(f => f.colaborador_id === colab.id);
        generatePage(pdf, colab, formulario);
      });

      const fileName = selectedColaborador !== "_all_"
        ? `formulario-ferias-${targetColabs[0].nome.replace(/\s+/g, "-").toLowerCase()}-${anoReferencia}.pdf`
        : `formularios-ferias-todos-${anoReferencia}.pdf`;

      pdf.save(fileName);
      toast.success(`PDF gerado com ${targetColabs.length} formulário(s)!`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1">
        <Label className="text-xs">Colaborador</Label>
        <Select value={selectedColaborador} onValueChange={setSelectedColaborador}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all_">Todos os Colaboradores</SelectItem>
            {colaboradores?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={generatePDF} disabled={generating || !colaboradores?.length} variant="outline" className="gap-2">
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Gerar PDF
      </Button>
    </div>
  );
}
