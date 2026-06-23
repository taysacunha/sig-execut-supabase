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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileDown, Loader2, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import jsPDF from "jspdf";

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const MOTIVO_LABELS: Record<string, string> = {
  falta_injustificada: "Falta injustificada",
  aviso_previo: "Aviso prévio",
  suspensao: "Suspensão disciplinar",
  outro: "Outro motivo",
  // legado
  atestado_medico: "Atestado médico (legado)",
  atestado_sabado: "Atestado de sábado",
};
const MOTIVO_OPTIONS = Object.entries(MOTIVO_LABELS).map(([value, label]) => ({ value, label }));

interface Colaborador { id: string; nome: string; }

interface Perda {
  id: string;
  colaborador_id: string | null;
  ano: number;
  mes: number;
  motivo: string;
  observacoes: string | null;
  created_at?: string;
  colaborador?: { nome: string; setor?: { nome: string } | null } | null;
}

interface PerdasFolgaPDFGeneratorProps {
  year: number;
  month: number;
}

export function PerdasFolgaPDFGenerator({ year: initialYear, month: initialMonth }: PerdasFolgaPDFGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [colabIds, setColabIds] = useState<string[]>([]);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [colabPopover, setColabPopover] = useState(false);
  const [motivoPopover, setMotivoPopover] = useState(false);

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, []);

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["ferias-colaboradores-perda-pdf"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data as Colaborador[];
    },
    enabled: open,
  });

  const allColabSelected = colabIds.length === 0 || colabIds.length === colaboradores.length;
  const allMotivoSelected = motivos.length === 0 || motivos.length === MOTIVO_OPTIONS.length;

  const toggleColab = (id: string) =>
    setColabIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAllColab = () =>
    setColabIds(allColabSelected ? colaboradores.map(c => c.id) : []);
  const toggleMotivo = (v: string) =>
    setMotivos(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  const toggleAllMotivo = () =>
    setMotivos(allMotivoSelected ? MOTIVO_OPTIONS.map(m => m.value) : []);

  const motivoLabel = (m: string) => MOTIVO_LABELS[m] || m;

  const generate = async () => {
    setGenerating(true);
    try {
      let query = supabase
        .from("ferias_folgas_perdas")
        .select("id, colaborador_id, ano, mes, motivo, observacoes, created_at, colaborador:ferias_colaboradores!ferias_folgas_perdas_colaborador_id_fkey(nome, setor:ferias_setores!ferias_colaboradores_setor_titular_id_fkey(nome))")
        .eq("ano", year)
        .eq("mes", month);

      if (colabIds.length > 0 && !allColabSelected) {
        query = query.in("colaborador_id", colabIds);
      }
      if (motivos.length > 0 && !allMotivoSelected) {
        query = query.in("motivo", motivos);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []) as unknown as Perda[];
      rows.sort((a, b) => (a.colaborador?.nome || "").localeCompare(b.colaborador?.nome || ""));

      if (rows.length === 0) {
        toast.error("Nenhuma perda encontrada com os filtros selecionados");
        return;
      }

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, 0, pageWidth, 25, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("RELATÓRIO DE PERDAS DE FOLGA", pageWidth / 2, 12, { align: "center" });
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${MESES[month - 1]} de ${year}`, pageWidth / 2, 20, { align: "center" });
      pdf.setTextColor(0, 0, 0);

      let y = 32;
      const cols = [
        { label: "Colaborador", x: margin + 2, w: 70 },
        { label: "Setor", x: margin + 76, w: 55 },
        { label: "Motivo", x: margin + 134, w: 55 },
        { label: "Observações", x: margin + 192, w: 60 },
        { label: "Registrado em", x: margin + 254, w: 30 },
      ];

      const drawHeader = () => {
        pdf.setFillColor(180, 180, 180);
        pdf.rect(margin, y, pageWidth - margin * 2, 8, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        cols.forEach(c => pdf.text(c.label, c.x, y + 5.5));
        y += 8;
      };
      drawHeader();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);

      const truncate = (s: string, n: number) => s.length > n ? s.substring(0, n - 1) + "…" : s;

      rows.forEach((r, idx) => {
        if (y > pageHeight - 18) {
          pdf.addPage();
          y = 15;
          drawHeader();
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
        }
        const bg = idx % 2 === 0 ? 255 : 240;
        pdf.setFillColor(bg, bg, bg);
        pdf.rect(margin, y, pageWidth - margin * 2, 7, "F");

        pdf.text(truncate(r.colaborador?.nome || "-", 40), cols[0].x, y + 5);
        pdf.text(truncate(r.colaborador?.setor?.nome || "-", 32), cols[1].x, y + 5);
        pdf.text(truncate(motivoLabel(r.motivo), 32), cols[2].x, y + 5);
        pdf.text(truncate(r.observacoes || "-", 35), cols[3].x, y + 5);
        pdf.text(r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR }) : "-", cols[4].x, y + 5);
        y += 7;
      });

      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | Total: ${rows.length} perda(s)`,
        pageWidth / 2, pageHeight - 6, { align: "center" },
      );

      pdf.save(`perdas-folga-${String(month).padStart(2, "0")}-${year}.pdf`);
      toast.success("PDF gerado com sucesso!");
      setOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => { setYear(initialYear); setMonth(initialMonth); setOpen(true); }}>
        <FileDown className="h-4 w-4 mr-2" />
        PDF Perdas
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar PDF de Perdas de Folga</DialogTitle>
            <DialogDescription>
              Selecione o mês de referência e filtre por colaborador e motivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Colaboradores</Label>
              <Popover open={colabPopover} onOpenChange={setColabPopover}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    <span className="truncate">
                      {allColabSelected ? `Todos (${colaboradores.length})` : `${colabIds.length} selecionado(s)`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar colaborador..." />
                    <CommandList>
                      <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="__todos__" onSelect={toggleAllColab}>
                          <Checkbox checked={allColabSelected} className="mr-2" />
                          <span className="font-medium">Todos</span>
                        </CommandItem>
                        {colaboradores.map(c => (
                          <CommandItem key={c.id} value={c.nome} onSelect={() => toggleColab(c.id)}>
                            <Checkbox checked={!allColabSelected && colabIds.includes(c.id)} className="mr-2" />
                            {c.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Motivos</Label>
              <Popover open={motivoPopover} onOpenChange={setMotivoPopover}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    <span className="truncate">
                      {allMotivoSelected ? "Todos" : `${motivos.length} selecionado(s)`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem value="__todos__" onSelect={toggleAllMotivo}>
                          <Checkbox checked={allMotivoSelected} className="mr-2" />
                          <span className="font-medium">Todos</span>
                        </CommandItem>
                        {MOTIVO_OPTIONS.map(m => (
                          <CommandItem key={m.value} value={m.label} onSelect={() => toggleMotivo(m.value)}>
                            <Checkbox checked={!allMotivoSelected && motivos.includes(m.value)} className="mr-2" />
                            {m.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {!allMotivoSelected && motivos.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {motivos.map(v => (
                    <Badge key={v} variant="secondary" className="text-xs">{MOTIVO_LABELS[v] || v}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
              Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}