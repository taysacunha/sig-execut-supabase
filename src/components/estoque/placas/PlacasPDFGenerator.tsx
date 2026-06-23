import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import jsPDF from "jspdf";
import {
  Placa, PlacaHistorico, STATUS_LABELS, TIPO_USO_LABELS, TAMANHO_LABELS, HIST_LABELS,
} from "@/hooks/useEstoquePlacas";

const fromEstoque = (t: string) => supabase.from(t as any);

type Modo = "inventario" | "historico";

export function PlacasPDFGenerator({ placas }: { placas: Placa[] }) {
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState<Modo>("inventario");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [placaId, setPlacaId] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  const placaSelecionada = useMemo(
    () => placas.find((p) => p.id === placaId) || null,
    [placas, placaId]
  );

  const { data: locais = [] } = useQuery({
    queryKey: ["estoque-locais-pdf-placas"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_locais_armazenamento")
        .select("id, nome, unidade_id");
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: open,
  });

  const localNome = (id: string | null) =>
    id ? (locais.find((l) => l.id === id)?.nome || "—") : "—";

  const generate = async () => {
    setGenerating(true);
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      // Cabeçalho azul (mesmo padrão dos relatórios)
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, 0, pageWidth, 25, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(
        modo === "inventario" ? "RELATÓRIO DE PLACAS — INVENTÁRIO" : "HISTÓRICO DA PLACA",
        pageWidth / 2, 12, { align: "center" }
      );
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      const subtitulo = modo === "inventario"
        ? `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
        : placaSelecionada
          ? `Código ${placaSelecionada.codigo} • ${TIPO_USO_LABELS[placaSelecionada.tipo_uso]} • ${TAMANHO_LABELS[placaSelecionada.tamanho]}`
          : "";
      pdf.text(subtitulo, pageWidth / 2, 20, { align: "center" });
      pdf.setTextColor(0, 0, 0);

      let y = 32;

      if (modo === "inventario") {
        let rows = [...placas];
        if (statusFiltro !== "todos") rows = rows.filter((p) => p.status === statusFiltro);
        if (tipoFiltro !== "todos") rows = rows.filter((p) => p.tipo_uso === tipoFiltro);
        rows.sort((a, b) => a.codigo.localeCompare(b.codigo));

        if (rows.length === 0) {
          toast.error("Nenhuma placa para os filtros selecionados");
          return;
        }

        const cols = [
          { label: "Código", x: margin + 2, w: 28 },
          { label: "Tipo", x: margin + 32, w: 22 },
          { label: "Tamanho", x: margin + 56, w: 24 },
          { label: "Status", x: margin + 82, w: 28 },
          { label: "Imóvel atual", x: margin + 112, w: 38 },
          { label: "Local armazenamento", x: margin + 152, w: 68 },
          { label: "Atualizado em", x: margin + 222, w: pageWidth - margin - (margin + 222) - 2 },
        ];

        const drawHeader = () => {
          pdf.setFillColor(180, 180, 180);
          pdf.rect(margin, y, pageWidth - margin * 2, 8, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          cols.forEach((c) => pdf.text(c.label, c.x, y + 5.5));
          y += 8;
        };
        drawHeader();
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);

        const lineH = 4;
        const padY = 2;
        rows.forEach((r, idx) => {
          const cellTexts = [
            r.codigo,
            TIPO_USO_LABELS[r.tipo_uso],
            r.tamanho === "outro" ? `Outro (${r.tamanho_outro || "-"})` : TAMANHO_LABELS[r.tamanho],
            STATUS_LABELS[r.status],
            r.imovel_codigo_atual || "—",
            localNome(r.local_armazenamento_id),
            r.updated_at ? format(new Date(r.updated_at), "dd/MM/yyyy", { locale: ptBR }) : "—",
          ];
          const wrapped = cellTexts.map((txt, i) =>
            pdf.splitTextToSize(String(txt), Math.max(cols[i].w - 2, 8)) as string[]
          );
          const maxLines = Math.max(...wrapped.map((w) => w.length));
          const rowH = Math.max(7, maxLines * lineH + padY);

          if (y + rowH > pageHeight - 10) {
            pdf.addPage();
            y = 15;
            drawHeader();
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
          }

          const bg = idx % 2 === 0 ? 255 : 240;
          pdf.setFillColor(bg, bg, bg);
          pdf.rect(margin, y, pageWidth - margin * 2, rowH, "F");
          wrapped.forEach((lines, i) => pdf.text(lines, cols[i].x, y + 4));
          y += rowH;
        });

        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | Total: ${rows.length} placa(s)`,
          pageWidth / 2, pageHeight - 6, { align: "center" }
        );
        pdf.save(`placas-inventario-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      } else {
        // HISTÓRICO de uma placa
        if (!placaSelecionada) {
          toast.error("Selecione uma placa");
          return;
        }
        const { data: hist, error } = await fromEstoque("estoque_placas_historico")
          .select("*")
          .eq("placa_id", placaSelecionada.id)
          .order("data_evento", { ascending: true })
          .order("created_at", { ascending: true });
        if (error) throw error;
        const rows = (hist as unknown as PlacaHistorico[]) || [];

        if (rows.length === 0) {
          toast.error("Nenhum evento registrado para esta placa");
          return;
        }

        const cols = [
          { label: "Data evento", x: margin + 2, w: 28 },
          { label: "Tipo", x: margin + 32, w: 28 },
          { label: "Código do Imóvel", x: margin + 62, w: 40 },
          { label: "Data retorno", x: margin + 104, w: 28 },
          { label: "Observações", x: margin + 134, w: pageWidth - margin - (margin + 134) - 2 },
        ];

        const drawHeader = () => {
          pdf.setFillColor(180, 180, 180);
          pdf.rect(margin, y, pageWidth - margin * 2, 8, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          cols.forEach((c) => pdf.text(c.label, c.x, y + 5.5));
          y += 8;
        };
        drawHeader();
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        const lineH = 4;
        const padY = 2;

        rows.forEach((r, idx) => {
          const cellTexts = [
            format(new Date(r.data_evento), "dd/MM/yyyy", { locale: ptBR }),
            HIST_LABELS[r.tipo],
            r.imovel_codigo || "—",
            r.data_retorno ? format(new Date(r.data_retorno), "dd/MM/yyyy", { locale: ptBR }) : "—",
            r.observacoes || "—",
          ];
          const wrapped = cellTexts.map((txt, i) =>
            pdf.splitTextToSize(String(txt), Math.max(cols[i].w - 2, 8)) as string[]
          );
          const maxLines = Math.max(...wrapped.map((w) => w.length));
          const rowH = Math.max(7, maxLines * lineH + padY);
          if (y + rowH > pageHeight - 10) {
            pdf.addPage();
            y = 15;
            drawHeader();
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
          }
          const bg = idx % 2 === 0 ? 255 : 240;
          pdf.setFillColor(bg, bg, bg);
          pdf.rect(margin, y, pageWidth - margin * 2, rowH, "F");
          wrapped.forEach((lines, i) => pdf.text(lines, cols[i].x, y + 4));
          y += rowH;
        });

        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | Eventos: ${rows.length}`,
          pageWidth / 2, pageHeight - 6, { align: "center" }
        );
        pdf.save(`placa-${placaSelecionada.codigo}-historico.pdf`);
      }

      toast.success("PDF gerado!");
      setOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  // Agrupa placas por código para o seletor (mostra todas as versões)
  const placasOpts = useMemo(
    () =>
      [...placas].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [placas]
  );

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileDown className="h-4 w-4 mr-2" />
        PDF Placas
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar PDF de Placas</DialogTitle>
            <DialogDescription>
              Escolha entre o inventário geral ou o histórico de uma placa específica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de relatório</Label>
              <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inventario">Inventário (todas as placas)</SelectItem>
                  <SelectItem value="historico">Histórico de uma placa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {modo === "inventario" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de uso</Label>
                  <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {Object.entries(TIPO_USO_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Placa</Label>
                <Select value={placaId} onValueChange={setPlacaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma placa" /></SelectTrigger>
                  <SelectContent>
                    {placasOpts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo} — {STATUS_LABELS[p.status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={generate} disabled={generating || (modo === "historico" && !placaId)}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
              Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
