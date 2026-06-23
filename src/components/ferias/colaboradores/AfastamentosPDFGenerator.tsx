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
  atestado_medico: "Atestado Médico",
  acompanhamento_familiar: "Acompanhamento de Pessoa da Família",
  doacao_sangue: "Doação de Sangue",
  licenca_maternidade: "Licença Maternidade",
  licenca_paternidade: "Licença Paternidade",
  outros: "Outros",
};
const MOTIVO_OPTIONS = Object.entries(MOTIVO_LABELS).map(([value, label]) => ({ value, label }));

const MOTIVO_LABELS_DISPLAY: Record<string, string> = {
  ...MOTIVO_LABELS,
  acidente: "Acidente",
  doenca: "Doença",
  licenca_medica: "Licença Médica",
};

interface Colaborador {
  id: string;
  nome: string;
  setor?: { nome: string } | null;
}

interface Afastamento {
  id: string;
  colaborador_id: string;
  motivo: string;
  motivo_descricao: string | null;
  data_inicio: string;
  data_fim: string;
  observacoes: string | null;
  colaborador?: { nome: string; setor?: { nome: string } | null } | null;
}

export function AfastamentosPDFGenerator() {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [colabIds, setColabIds] = useState<string[]>([]);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [colabPopover, setColabPopover] = useState(false);
  const [motivoPopover, setMotivoPopover] = useState(false);

  const years = useMemo(() => {
    const y = today.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [today]);

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["ferias-colaboradores-afastamento-pdf"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, setor:ferias_setores!ferias_colaboradores_setor_titular_id_fkey(nome)")
        .order("nome");
      if (error) throw error;
      return data as unknown as Colaborador[];
    },
    enabled: open,
  });

  const allColabSelected = colabIds.length === 0 || colabIds.length === colaboradores.length;
  const allMotivoSelected = motivos.length === 0 || motivos.length === MOTIVO_OPTIONS.length;

  const toggleColab = (id: string) => {
    setColabIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleAllColab = () => {
    setColabIds(allColabSelected ? colaboradores.map(c => c.id) : []);
  };
  const toggleMotivo = (v: string) => {
    setMotivos(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };
  const toggleAllMotivo = () => {
    setMotivos(allMotivoSelected ? MOTIVO_OPTIONS.map(m => m.value) : []);
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d + "T12:00:00"), "dd/MM/yyyy"); } catch { return d; }
  };
  const motivoLabel = (m: string, desc?: string | null) => {
    const base = MOTIVO_LABELS_DISPLAY[m] || m;
    return m === "outros" && desc ? `${base} – ${desc}` : base;
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const monthEnd = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

      let query = supabase
        .from("ferias_afastamentos")
        .select("id, colaborador_id, motivo, motivo_descricao, data_inicio, data_fim, observacoes, colaborador:ferias_colaboradores!ferias_afastamentos_colaborador_id_fkey(nome, setor:ferias_setores!ferias_colaboradores_setor_titular_id_fkey(nome))")
        .lte("data_inicio", monthEnd)
        .gte("data_fim", monthStart)
        .order("data_inicio");

      if (colabIds.length > 0 && !allColabSelected) {
        query = query.in("colaborador_id", colabIds);
      }
      if (motivos.length > 0 && !allMotivoSelected) {
        query = query.in("motivo", motivos);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []) as unknown as Afastamento[];
      rows.sort((a, b) => (a.colaborador?.nome || "").localeCompare(b.colaborador?.nome || ""));

      if (rows.length === 0) {
        toast.error("Nenhum afastamento encontrado com os filtros selecionados");
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
      pdf.text("RELATÓRIO DE AFASTAMENTOS", pageWidth / 2, 12, { align: "center" });
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${MESES[month - 1]} de ${year}`, pageWidth / 2, 20, { align: "center" });
      pdf.setTextColor(0, 0, 0);

      let y = 32;
      const cols = [
        { label: "Colaborador", x: margin + 2, w: 60 },
        { label: "Setor", x: margin + 64, w: 45 },
        { label: "Motivo", x: margin + 111, w: 60 },
        { label: "Início", x: margin + 173, w: 22 },
        { label: "Fim", x: margin + 197, w: 22 },
        { label: "Dias", x: margin + 221, w: 14 },
        { label: "Observações", x: margin + 237, w: pageWidth - margin - (margin + 237) },
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

        const dias = Math.floor((new Date(r.data_fim).getTime() - new Date(r.data_inicio).getTime()) / 86400000) + 1;

        pdf.text(truncate(r.colaborador?.nome || "-", 35), cols[0].x, y + 5);
        pdf.text(truncate(r.colaborador?.setor?.nome || "-", 26), cols[1].x, y + 5);
        pdf.text(truncate(motivoLabel(r.motivo, r.motivo_descricao), 36), cols[2].x, y + 5);
        pdf.text(formatDate(r.data_inicio), cols[3].x, y + 5);
        pdf.text(formatDate(r.data_fim), cols[4].x, y + 5);
        pdf.text(String(dias), cols[5].x, y + 5);
        pdf.text(truncate(r.observacoes || "-", 28), cols[6].x, y + 5);
        y += 7;
      });

      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | Total: ${rows.length} afastamento(s)`,
        pageWidth / 2, pageHeight - 6, { align: "center" },
      );

      pdf.save(`afastamentos-${String(month).padStart(2, "0")}-${year}.pdf`);
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
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileDown className="h-4 w-4 mr-2" />
        PDF Afastamentos
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar PDF de Afastamentos</DialogTitle>
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
                      {allColabSelected
                        ? `Todos (${colaboradores.length})`
                        : `${colabIds.length} selecionado(s)`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start" onWheel={(e) => e.stopPropagation()}>
                  <Command>
                    <CommandInput placeholder="Buscar colaborador..." />
                    <CommandList className="max-h-72 overflow-y-auto overscroll-contain">
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
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start" onWheel={(e) => e.stopPropagation()}>
                  <Command>
                    <CommandList className="max-h-72 overflow-y-auto overscroll-contain">
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