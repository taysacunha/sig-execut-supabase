import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit, AlertTriangle, Loader2 } from "lucide-react";
import { format, parseISO, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AfastamentosSectionProps {
  colaboradorId: string;
  colaboradorNome: string;
  canEdit?: boolean;
}

const MOTIVO_LABELS: Record<string, string> = {
  acidente: "Acidente",
  doenca: "Doença",
  licenca_maternidade: "Licença Maternidade",
  licenca_paternidade: "Licença Paternidade",
  licenca_medica: "Licença Médica",
  outros: "Outros",
};

export function AfastamentosSection({ colaboradorId, colaboradorNome, canEdit = true }: AfastamentosSectionProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [motivo, setMotivo] = useState("doenca");
  const [motivoDescricao, setMotivoDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const { data: afastamentos = [], isLoading } = useQuery({
    queryKey: ["ferias-afastamentos", colaboradorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_afastamentos" as any)
        .select("*")
        .eq("colaborador_id", colaboradorId)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!colaboradorId,
  });

  // Check for vacation conflicts
  const { data: ferias = [] } = useQuery({
    queryKey: ["ferias-afastamento-conflicts", colaboradorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_ferias")
        .select("id, quinzena1_inicio, quinzena1_fim, quinzena2_inicio, quinzena2_fim, status")
        .eq("colaborador_id", colaboradorId)
        .in("status", ["pendente", "aprovada", "em_gozo_q1", "q1_concluida", "em_gozo_q2", "em_gozo"]);
      if (error) throw error;
      return data;
    },
    enabled: !!colaboradorId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!dataInicio || !dataFim) throw new Error("Datas são obrigatórias");
      if (dataFim < dataInicio) throw new Error("Data fim deve ser após data início");

      // Validate overlap with existing afastamentos
      const overlapping = afastamentos.find((a: any) => {
        if (editing && a.id === editing.id) return false;
        return dataInicio <= a.data_fim && dataFim >= a.data_inicio;
      });
      if (overlapping) {
        throw new Error(`Conflito com afastamento existente (${formatDate(overlapping.data_inicio)} a ${formatDate(overlapping.data_fim)})`);
      }

      const payload = {
        colaborador_id: colaboradorId,
        motivo,
        motivo_descricao: motivoDescricao || null,
        data_inicio: dataInicio,
        data_fim: dataFim,
        observacoes: observacoes || null,
      };

      if (editing) {
        const { error } = await supabase
          .from("ferias_afastamentos" as any)
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ferias_afastamentos" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias-afastamentos"] });
      toast.success(editing ? "Afastamento atualizado" : "Afastamento registrado");
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ferias_afastamentos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias-afastamentos"] });
      toast.success("Afastamento excluído");
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setMotivo("doenca");
    setMotivoDescricao("");
    setDataInicio("");
    setDataFim("");
    setObservacoes("");
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setMotivo(a.motivo);
    setMotivoDescricao(a.motivo_descricao || "");
    setDataInicio(a.data_inicio);
    setDataFim(a.data_fim);
    setObservacoes(a.observacoes || "");
    setDialogOpen(true);
  };

  // Check conflicts with existing vacations
  const conflicts = dataInicio && dataFim ? ferias.filter(f => {
    const afStart = new Date(dataInicio + "T00:00:00");
    const afEnd = new Date(dataFim + "T00:00:00");
    const checkOverlap = (inicio: string, fim: string) => {
      const s = new Date(inicio + "T00:00:00");
      const e = new Date(fim + "T00:00:00");
      return s <= afEnd && e >= afStart;
    };
    if (checkOverlap(f.quinzena1_inicio, f.quinzena1_fim)) return true;
    if (f.quinzena2_inicio && f.quinzena2_fim && checkOverlap(f.quinzena2_inicio, f.quinzena2_fim)) return true;
    return false;
  }) : [];

  const getStatus = (a: any): "agendado" | "ativo" | "encerrado" => {
    const today = new Date().toISOString().split("T")[0];
    if (today < a.data_inicio) return "agendado";
    if (today <= a.data_fim) return "ativo";
    return "encerrado";
  };

  const formatDate = (d: string) => {
    try { return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-muted-foreground">Afastamentos</h4>
        {canEdit && (
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-3 w-3" /> Registrar
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : afastamentos.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nenhum afastamento registrado</p>
      ) : (
        <div className="space-y-2">
          {afastamentos.map((a: any) => (
            <Card key={a.id} className={isActive(a) ? "border-destructive/30 bg-destructive/5" : ""}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={isActive(a) ? "destructive" : "secondary"} className="text-xs">
                      {isActive(a) ? "Ativo" : "Encerrado"}
                    </Badge>
                    <span className="text-sm font-medium">{MOTIVO_LABELS[a.motivo] || a.motivo}</span>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(a)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir afastamento</AlertDialogTitle>
                            <AlertDialogDescription>Tem certeza que deseja excluir este afastamento?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(a.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(a.data_inicio)} a {formatDate(a.data_fim)}
                </p>
                {a.motivo_descricao && <p className="text-xs mt-1">{a.motivo_descricao}</p>}
                {a.observacoes && <p className="text-xs text-muted-foreground mt-1">{a.observacoes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Afastamento" : "Novo Afastamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MOTIVO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {motivo === "outros" && (
              <div>
                <Label>Descrição do motivo</Label>
                <Input value={motivoDescricao} onChange={(e) => setMotivoDescricao(e.target.value)} placeholder="Descreva o motivo..." />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações opcionais..." rows={3} />
            </div>

            {conflicts.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Conflito com férias</p>
                  <p className="text-xs text-muted-foreground">
                    Este colaborador possui {conflicts.length} férias marcada(s) que conflitam com o período de afastamento. Considere alterar as datas das férias.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !dataInicio || !dataFim}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
