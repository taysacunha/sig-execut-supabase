import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, AlertTriangle, Calendar, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import { toast } from "sonner";

type ExcecaoTipo = "ferias" | "folgas" | "_all_";

export function ExcecoesPDFGenerator() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedTipo, setSelectedTipo] = useState<ExcecaoTipo>("_all_");
  const [generating, setGenerating] = useState(false);

  const years = getYearOptions(3, 3);

  const { data: excecoes, isLoading } = useQuery({
    queryKey: ["excecoes-relatorio", selectedYear, selectedTipo],
    queryFn: async () => {
      const results: any[] = [];

      // Buscar exceções de férias
      if (selectedTipo === "_all_" || selectedTipo === "ferias") {
        const { data: feriasExcecoes, error: feriasError } = await supabase
          .from("ferias_ferias")
          .select(`
            id, quinzena1_inicio, excecao_motivo, excecao_justificativa, created_at,
            colaborador:ferias_colaboradores(nome, setor:ferias_setores(nome))
          `)
          .eq("is_excecao", true)
          .gte("quinzena1_inicio", `${selectedYear}-01-01`)
          .lte("quinzena1_inicio", `${selectedYear}-12-31`);

        if (feriasError) throw feriasError;

        feriasExcecoes?.forEach((f) => {
          results.push({
            tipo: "Férias",
            colaborador: f.colaborador?.nome || "N/A",
            setor: f.colaborador?.setor?.nome || "-",
            data: f.quinzena1_inicio,
            motivo: f.excecao_motivo || "-",
            justificativa: f.excecao_justificativa || "-",
            criadoEm: f.created_at,
          });
        });
      }

      // Buscar exceções de folgas
      if (selectedTipo === "_all_" || selectedTipo === "folgas") {
        const { data: folgasExcecoes, error: folgasError } = await supabase
          .from("ferias_folgas")
          .select(`
            id, data_sabado, excecao_motivo, excecao_justificativa, created_at,
            colaborador:ferias_colaboradores(nome, setor:ferias_setores(nome))
          `)
          .eq("is_excecao", true)
          .gte("data_sabado", `${selectedYear}-01-01`)
          .lte("data_sabado", `${selectedYear}-12-31`);

        if (folgasError) throw folgasError;

        folgasExcecoes?.forEach((f) => {
          results.push({
            tipo: "Folga",
            colaborador: f.colaborador?.nome || "N/A",
            setor: f.colaborador?.setor?.nome || "-",
            data: f.data_sabado,
            motivo: f.excecao_motivo || "-",
            justificativa: f.excecao_justificativa || "-",
            criadoEm: f.created_at,
          });
        });
      }

      // Ordenar por nome do colaborador
      return results.sort((a, b) => a.colaborador.localeCompare(b.colaborador));
    },
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  };

  const generatePDF = async () => {
    if (!excecoes || excecoes.length === 0) {
      toast.error("Nenhuma exceção encontrada");
      return;
    }

    setGenerating(true);

    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Header
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Relatório de Exceções", pageWidth / 2, 20, { align: "center" });

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      const tipoLabel = selectedTipo === "_all_" ? "Todos os Tipos" : selectedTipo === "ferias" ? "Férias" : "Folgas";
      pdf.text(`Ano: ${selectedYear} | Tipo: ${tipoLabel}`, pageWidth / 2, 28, { align: "center" });
      pdf.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 34, { align: "center" });

      // Table header
      const startY = 45;
      const colWidths = [25, 45, 35, 28, 50, 70];
      const headers = ["Tipo", "Colaborador", "Setor", "Data", "Motivo", "Justificativa"];

      pdf.setFillColor(239, 68, 68);
      pdf.rect(margin, startY, pageWidth - margin * 2, 10, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");

      let xPos = margin + 2;
      headers.forEach((header, i) => {
        pdf.text(header, xPos, startY + 7);
        xPos += colWidths[i];
      });

      // Table rows
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      let yPos = startY + 15;

      excecoes.forEach((exc, index) => {
        if (yPos > pageHeight - 25) {
          pdf.addPage();
          yPos = 25;
        }

        // Zebra striping
        if (index % 2 === 0) {
          pdf.setFillColor(254, 242, 242);
          pdf.rect(margin, yPos - 5, pageWidth - margin * 2, 8, "F");
        }

        xPos = margin + 2;
        const rowData = [
          exc.tipo,
          exc.colaborador.substring(0, 25),
          exc.setor.substring(0, 18),
          formatDate(exc.data),
          exc.motivo.substring(0, 28),
          exc.justificativa.substring(0, 40),
        ];

        rowData.forEach((text, i) => {
          pdf.text(text, xPos, yPos);
          xPos += colWidths[i];
        });

        yPos += 8;
      });

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Total de exceções: ${excecoes.length}`, margin, pageHeight - 10);

      pdf.save(`relatorio-excecoes-${selectedYear}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Relatório de Exceções
          </CardTitle>
          <CardDescription>
            Lista todas as exceções registradas em férias e folgas, incluindo motivo e justificativa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={selectedTipo} onValueChange={(v) => setSelectedTipo(v as ExcecaoTipo)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">Todos os Tipos</SelectItem>
                  <SelectItem value="ferias">Férias</SelectItem>
                  <SelectItem value="folgas">Folgas de Sábado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={generatePDF} disabled={generating || isLoading || !excecoes?.length} variant="destructive">
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Gerar PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Preview das Exceções
            {excecoes && (
              <Badge variant="destructive" className="ml-2">
                {excecoes.length} exceções
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !excecoes?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mb-2 opacity-50" />
              <p>Nenhuma exceção encontrada para os filtros selecionados</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Justificativa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {excecoes.slice(0, 20).map((exc, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Badge variant={exc.tipo === "Férias" ? "default" : "secondary"}>
                          {exc.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{exc.colaborador}</TableCell>
                      <TableCell className="text-muted-foreground">{exc.setor}</TableCell>
                      <TableCell>{formatDate(exc.data)}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{exc.motivo}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{exc.justificativa}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {excecoes.length > 20 && (
                <div className="p-2 text-center text-sm text-muted-foreground border-t">
                  Mostrando 20 de {excecoes.length} registros. O PDF conterá todos.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
