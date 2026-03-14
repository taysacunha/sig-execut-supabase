import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ExcecaoPeriodosSection, type GozoPeriodo } from "./ExcecaoPeriodosSection";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, Calendar, Check, ChevronsUpDown, Users, Info, ShieldAlert } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const feriasSchema = z.object({
  colaborador_id: z.string().min(1, "Colaborador é obrigatório"),
  quinzena1_inicio: z.string().min(1, "Data de início é obrigatória"),
  quinzena1_fim: z.string().min(1, "Data de fim é obrigatória"),
  quinzena2_inicio: z.string().optional().or(z.literal("")),
  quinzena2_fim: z.string().optional().or(z.literal("")),
  opcao_adicional: z.enum(["nenhum", "vender", "gozo_diferente"]).default("nenhum"),
  gozo_periodos: z.enum(["1", "2", "ambos"]).default("ambos"),
  gozo_quinzena1_inicio: z.string().optional(),
  gozo_quinzena1_fim: z.string().optional(),
  gozo_quinzena2_inicio: z.string().optional(),
  gozo_quinzena2_fim: z.string().optional(),
  dias_vendidos: z.number().min(0).max(30).optional(),
  quinzena_venda: z.number().min(1).max(2).optional(),
  gozo_venda_inicio: z.string().optional(),
  gozo_venda_fim: z.string().optional(),
  gozo_venda_periodos: z.enum(["1", "2"]).default("1"),
  gozo_venda_q1_inicio: z.string().optional(),
  gozo_venda_q1_fim: z.string().optional(),
  gozo_venda_q2_inicio: z.string().optional(),
  gozo_venda_q2_fim: z.string().optional(),
  is_excecao: z.boolean().default(false),
  excecao_motivo: z.string().optional(),
  excecao_justificativa: z.string().optional(),
});

type FeriasFormData = z.infer<typeof feriasSchema>;

interface FeriasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ferias?: any | null;
  anoReferencia?: number;
  onSuccess: () => void;
}

interface ConflictInfo {
  colaborador_nome: string;
  tipo: string;
  periodo: string;
}

export function FeriasDialog({ open, onOpenChange, ferias, anoReferencia, onSuccess }: FeriasDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!ferias;
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [gozoDateError, setGozoDateError] = useState<string | null>(null);
  const [excecaoTipo, setExcecaoTipo] = useState<"vender" | "gozo_diferente" | null>(null);
  const [excDistribuicaoTipo, setExcDistribuicaoTipo] = useState("");
  const [excDiasVendidos, setExcDiasVendidos] = useState(0);
  const [excPeriodos, setExcPeriodos] = useState<GozoPeriodo[]>([]);

  const form = useForm<FeriasFormData>({
    resolver: zodResolver(feriasSchema),
    defaultValues: {
      colaborador_id: "",
      quinzena1_inicio: "",
      quinzena1_fim: "",
      quinzena2_inicio: "",
      quinzena2_fim: "",
      opcao_adicional: "nenhum",
      gozo_periodos: "ambos",
      gozo_quinzena1_inicio: "",
      gozo_quinzena1_fim: "",
      gozo_quinzena2_inicio: "",
      gozo_quinzena2_fim: "",
      dias_vendidos: 0,
      quinzena_venda: 1,
      gozo_venda_inicio: "",
      gozo_venda_fim: "",
      gozo_venda_periodos: "1",
      gozo_venda_q1_inicio: "",
      gozo_venda_q1_fim: "",
      gozo_venda_q2_inicio: "",
      gozo_venda_q2_fim: "",
      is_excecao: false,
      excecao_motivo: "",
      excecao_justificativa: "",
    },
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["ferias-colaboradores-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, setor_titular_id, data_admissao, familiar_id")
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: colaboradoresComFerias = [] } = useQuery({
    queryKey: ["ferias-colaboradores-com-ferias", anoReferencia],
    queryFn: async () => {
      if (!anoReferencia) return [];
      const { data, error } = await supabase
        .from("ferias_ferias")
        .select("colaborador_id")
        .gte("quinzena1_inicio", `${anoReferencia}-01-01`)
        .lte("quinzena1_inicio", `${anoReferencia}-12-31`)
        .in("status", ["aprovada", "em_gozo_q1", "q1_concluida", "em_gozo_q2", "pendente", "em_gozo"]);
      if (error) throw error;
      return (data || []).map(f => f.colaborador_id).filter(Boolean) as string[];
    },
    enabled: open,
  });

  const { data: colaboradoresComFormulario = [] } = useQuery({
    queryKey: ["ferias-colaboradores-com-formulario-dialog", anoReferencia],
    queryFn: async () => {
      if (!anoReferencia) return [];
      const { data, error } = await supabase
        .from("ferias_formulario_anual")
        .select("colaborador_id")
        .eq("ano_referencia", anoReferencia);
      if (error) throw error;
      return (data || []).map(f => f.colaborador_id).filter(Boolean) as string[];
    },
    enabled: open,
  });

  const colaboradoresDisponiveis = colaboradores.filter(c => {
    if (isEditing && ferias?.colaborador_id === c.id) return true;
    return !colaboradoresComFerias.includes(c.id) && !colaboradoresComFormulario.includes(c.id);
  });

  const selectedColabId = form.watch("colaborador_id");
  const selectedColab = colaboradores.find(c => c.id === selectedColabId);
  const familiarId = selectedColab?.familiar_id;
  const familiarNome = familiarId ? colaboradores.find(c => c.id === familiarId)?.nome : null;

  const { data: feriasFamiliar } = useQuery({
    queryKey: ["ferias-familiar", familiarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_ferias")
        .select("quinzena1_inicio, quinzena1_fim, quinzena2_inicio, quinzena2_fim, gozo_diferente, gozo_quinzena1_inicio, gozo_quinzena1_fim, gozo_quinzena2_inicio, gozo_quinzena2_fim, status")
        .eq("colaborador_id", familiarId!)
        .in("status", ["aprovada", "em_gozo_q1", "q1_concluida", "em_gozo_q2", "pendente", "em_gozo"]);
      if (error) throw error;
      return data;
    },
    enabled: !!familiarId,
  });

  // ===== Watch declarations =====
  const q1Inicio = form.watch("quinzena1_inicio");
  const q2Inicio = form.watch("quinzena2_inicio");
  const q1Fim = form.watch("quinzena1_fim");
  const q2Fim = form.watch("quinzena2_fim");
  const opcaoAdicional = form.watch("opcao_adicional");
  const isExcecao = form.watch("is_excecao");
  const diasVendidos = form.watch("dias_vendidos") || 0;
  const quinzenaVenda = form.watch("quinzena_venda") || 1;
  const gozoPeriodos = form.watch("gozo_periodos");
  const gozoVendaInicio = form.watch("gozo_venda_inicio");
  const gozoVendaPeriodos = form.watch("gozo_venda_periodos");
  const gozoVendaQ1Inicio = form.watch("gozo_venda_q1_inicio");
  const gozoVendaQ2Inicio = form.watch("gozo_venda_q2_inicio");
  const gozoQ1Inicio = form.watch("gozo_quinzena1_inicio");
  const gozoQ2Inicio = form.watch("gozo_quinzena2_inicio");

  const isVenda = opcaoAdicional === "vender";
  const isGozoDiferente = opcaoAdicional === "gozo_diferente";
  const maxDiasVenda = isExcecao ? 30 : 10;
  const diasGozo = 30 - diasVendidos;
  const diasGozoNoPeriodoVenda = 15 - diasVendidos;
  const isVendaPadrao = isVenda && diasVendidos <= 10 && diasVendidos >= 1;
  const isVendaExcecao = isVenda && diasVendidos > 10;
  const forceSingleGozo = isVendaExcecao && diasVendidos > 15;

  useEffect(() => {
    if (forceSingleGozo) {
      form.setValue("gozo_venda_periodos", "1");
    }
  }, [forceSingleGozo]);

  useEffect(() => {
    if (q1Inicio) {
      try {
        const endDate = addDays(parseISO(q1Inicio), 14);
        form.setValue("quinzena1_fim", format(endDate, "yyyy-MM-dd"));
      } catch { /* ignore */ }
    }
  }, [q1Inicio]);

  useEffect(() => {
    if (q2Inicio) {
      try {
        const endDate = addDays(parseISO(q2Inicio), 14);
        form.setValue("quinzena2_fim", format(endDate, "yyyy-MM-dd"));
      } catch { /* ignore */ }
    }
  }, [q2Inicio]);

  useEffect(() => {
    if (gozoVendaInicio && isVendaPadrao && diasGozoNoPeriodoVenda > 0) {
      try {
        const endDate = addDays(parseISO(gozoVendaInicio), diasGozoNoPeriodoVenda - 1);
        form.setValue("gozo_venda_fim", format(endDate, "yyyy-MM-dd"));
      } catch { /* ignore */ }
    }
  }, [gozoVendaInicio, isVendaPadrao, diasGozoNoPeriodoVenda]);

  useEffect(() => {
    if (!isVendaPadrao || !gozoVendaInicio) {
      setGozoDateError(null);
      return;
    }
    try {
      const periodoInicio = quinzenaVenda === 1 ? q1Inicio : q2Inicio;
      const periodoFim = quinzenaVenda === 1 ? q1Fim : q2Fim;
      if (!periodoInicio || !periodoFim) { setGozoDateError(null); return; }
      const gozoStart = parseISO(gozoVendaInicio);
      const gozoEnd = addDays(gozoStart, diasGozoNoPeriodoVenda - 1);
      const pStart = parseISO(periodoInicio);
      const pEnd = parseISO(periodoFim);
      if (gozoStart < pStart) {
        setGozoDateError(`A data de início do gozo não pode ser antes de ${format(pStart, "dd/MM/yyyy")}`);
      } else if (gozoEnd > pEnd) {
        setGozoDateError(`A data final do gozo (${format(gozoEnd, "dd/MM/yyyy")}) ultrapassa o fim do período (${format(pEnd, "dd/MM/yyyy")})`);
      } else {
        setGozoDateError(null);
      }
    } catch { setGozoDateError(null); }
  }, [gozoVendaInicio, isVendaPadrao, quinzenaVenda, q1Inicio, q1Fim, q2Inicio, q2Fim, diasGozoNoPeriodoVenda]);

  useEffect(() => {
    if (gozoVendaQ1Inicio && isVendaExcecao && diasVendidos >= 1) {
      try {
        let dias: number;
        if (gozoVendaPeriodos === "1" || forceSingleGozo) { dias = diasGozo; } else { dias = Math.ceil(diasGozo / 2); }
        if (dias > 0) {
          const endDate = addDays(parseISO(gozoVendaQ1Inicio), dias - 1);
          form.setValue("gozo_venda_q1_fim", format(endDate, "yyyy-MM-dd"));
        }
      } catch { /* ignore */ }
    }
  }, [gozoVendaQ1Inicio, isVendaExcecao, diasVendidos, gozoVendaPeriodos]);

  useEffect(() => {
    if (gozoVendaQ2Inicio && isVendaExcecao && diasVendidos >= 1 && gozoVendaPeriodos === "2") {
      try {
        const dias = Math.floor(diasGozo / 2);
        if (dias > 0) {
          const endDate = addDays(parseISO(gozoVendaQ2Inicio), dias - 1);
          form.setValue("gozo_venda_q2_fim", format(endDate, "yyyy-MM-dd"));
        }
      } catch { /* ignore */ }
    }
  }, [gozoVendaQ2Inicio, isVendaExcecao, diasVendidos, gozoVendaPeriodos]);

  useEffect(() => {
    if (gozoQ1Inicio && isGozoDiferente) {
      try {
        const endDate = addDays(parseISO(gozoQ1Inicio), 14);
        form.setValue("gozo_quinzena1_fim", format(endDate, "yyyy-MM-dd"));
      } catch { /* ignore */ }
    }
  }, [gozoQ1Inicio, isGozoDiferente]);

  useEffect(() => {
    if (gozoQ2Inicio && isGozoDiferente) {
      try {
        const endDate = addDays(parseISO(gozoQ2Inicio), 14);
        form.setValue("gozo_quinzena2_fim", format(endDate, "yyyy-MM-dd"));
      } catch { /* ignore */ }
    }
  }, [gozoQ2Inicio, isGozoDiferente]);

  useEffect(() => {
    if (isVenda && diasVendidos > 10) {
      form.setValue("is_excecao", true);
      form.setValue("excecao_motivo", "venda_acima_limite");
    }
  }, [isVenda, diasVendidos]);

  useEffect(() => {
    if (!isExcecao && opcaoAdicional === "gozo_diferente") {
      form.setValue("opcao_adicional", "nenhum");
    }
    if (!isExcecao && isVenda && diasVendidos > 10) {
      form.setValue("dias_vendidos", 10);
    }
  }, [isExcecao]);

  useEffect(() => {
    if (opcaoAdicional === "nenhum") {
      form.setValue("gozo_quinzena1_inicio", "");
      form.setValue("gozo_quinzena1_fim", "");
      form.setValue("gozo_quinzena2_inicio", "");
      form.setValue("gozo_quinzena2_fim", "");
      form.setValue("dias_vendidos", 0);
      form.setValue("gozo_venda_inicio", "");
      form.setValue("gozo_venda_fim", "");
      form.setValue("gozo_venda_q1_inicio", "");
      form.setValue("gozo_venda_q1_fim", "");
      form.setValue("gozo_venda_q2_inicio", "");
      form.setValue("gozo_venda_q2_fim", "");
      setGozoDateError(null);
    } else if (opcaoAdicional === "vender") {
      form.setValue("gozo_quinzena1_inicio", "");
      form.setValue("gozo_quinzena1_fim", "");
      form.setValue("gozo_quinzena2_inicio", "");
      form.setValue("gozo_quinzena2_fim", "");
    } else if (opcaoAdicional === "gozo_diferente") {
      form.setValue("dias_vendidos", 0);
      form.setValue("gozo_venda_inicio", "");
      form.setValue("gozo_venda_fim", "");
      form.setValue("gozo_venda_q1_inicio", "");
      form.setValue("gozo_venda_q1_fim", "");
      form.setValue("gozo_venda_q2_inicio", "");
      form.setValue("gozo_venda_q2_fim", "");
      setGozoDateError(null);
    }
  }, [opcaoAdicional]);

  // Reset form when ferias changes or dialog opens
  useEffect(() => {
    if (!open) return;
    if (ferias) {
      const hasVenda = ferias.vender_dias && (ferias.dias_vendidos || 0) > 0;
      const hasGozo = ferias.gozo_diferente;
      let opcao: "nenhum" | "vender" | "gozo_diferente" = "nenhum";
      if (hasVenda) opcao = "vender";
      else if (hasGozo) opcao = "gozo_diferente";

      const isStdSale = hasVenda && (ferias.dias_vendidos || 0) <= 10;
      const qv = ferias.quinzena_venda || 1;

      form.reset({
        colaborador_id: ferias.colaborador_id || "",
        quinzena1_inicio: ferias.quinzena1_inicio || "",
        quinzena1_fim: ferias.quinzena1_fim || "",
        quinzena2_inicio: ferias.quinzena2_inicio || "",
        quinzena2_fim: ferias.quinzena2_fim || "",
        opcao_adicional: opcao,
        gozo_periodos: hasGozo
          ? (ferias.gozo_quinzena1_inicio && ferias.gozo_quinzena2_inicio ? "ambos" : ferias.gozo_quinzena1_inicio ? "1" : ferias.gozo_quinzena2_inicio ? "2" : "ambos")
          : "ambos",
        gozo_quinzena1_inicio: hasGozo ? (ferias.gozo_quinzena1_inicio || "") : "",
        gozo_quinzena1_fim: hasGozo ? (ferias.gozo_quinzena1_fim || "") : "",
        gozo_quinzena2_inicio: hasGozo ? (ferias.gozo_quinzena2_inicio || "") : "",
        gozo_quinzena2_fim: hasGozo ? (ferias.gozo_quinzena2_fim || "") : "",
        dias_vendidos: ferias.dias_vendidos || 0,
        quinzena_venda: qv,
        gozo_venda_inicio: isStdSale ? (qv === 1 ? (ferias.gozo_quinzena1_inicio || "") : (ferias.gozo_quinzena2_inicio || "")) : "",
        gozo_venda_fim: isStdSale ? (qv === 1 ? (ferias.gozo_quinzena1_fim || "") : (ferias.gozo_quinzena2_fim || "")) : "",
        gozo_venda_periodos: hasVenda && !isStdSale && ferias.gozo_quinzena2_inicio ? "2" : "1",
        gozo_venda_q1_inicio: hasVenda && !isStdSale ? (ferias.gozo_quinzena1_inicio || "") : "",
        gozo_venda_q1_fim: hasVenda && !isStdSale ? (ferias.gozo_quinzena1_fim || "") : "",
        gozo_venda_q2_inicio: hasVenda && !isStdSale ? (ferias.gozo_quinzena2_inicio || "") : "",
        gozo_venda_q2_fim: hasVenda && !isStdSale ? (ferias.gozo_quinzena2_fim || "") : "",
        is_excecao: ferias.is_excecao || false,
        excecao_motivo: ferias.excecao_motivo || "",
        excecao_justificativa: ferias.excecao_justificativa || "",
      });
    } else {
      form.reset({
        colaborador_id: "",
        quinzena1_inicio: "",
        quinzena1_fim: "",
        quinzena2_inicio: "",
        quinzena2_fim: "",
        opcao_adicional: "nenhum",
        gozo_periodos: "ambos",
        gozo_quinzena1_inicio: "",
        gozo_quinzena1_fim: "",
        gozo_quinzena2_inicio: "",
        gozo_quinzena2_fim: "",
        dias_vendidos: 0,
        quinzena_venda: 1,
        gozo_venda_inicio: "",
        gozo_venda_fim: "",
        gozo_venda_periodos: "1",
        gozo_venda_q1_inicio: "",
        gozo_venda_q1_fim: "",
        gozo_venda_q2_inicio: "",
        gozo_venda_q2_fim: "",
        is_excecao: false,
        excecao_motivo: "",
        excecao_justificativa: "",
      });
    }
    setConflicts([]);
    setGozoDateError(null);
    if (!ferias) {
      setExcecaoTipo(null);
      setExcDistribuicaoTipo("");
      setExcDiasVendidos(0);
      setExcPeriodos([]);
    } else if (ferias.gozo_flexivel) {
      setExcecaoTipo(ferias.vender_dias ? "vender" : ferias.gozo_diferente ? "gozo_diferente" : null);
      setExcDistribuicaoTipo(ferias.distribuicao_tipo || "");
      setExcDiasVendidos(ferias.dias_vendidos || 0);
      setExcPeriodos([]);
    } else {
      setExcecaoTipo(null);
      setExcDistribuicaoTipo("");
      setExcDiasVendidos(0);
      setExcPeriodos([]);
    }
  }, [ferias, open]);

  // Check conflicts
  const checkConflicts = async (data: FeriasFormData) => {
    if (!data.colaborador_id) return;
    setCheckingConflicts(true);
    const foundConflicts: ConflictInfo[] = [];
    try {
      const selectedColab = colaboradores.find((c) => c.id === data.colaborador_id);
      if (!selectedColab) return;

      const { data: substituteSectors } = await supabase
        .from("ferias_colaborador_setores_substitutos")
        .select("setor_id")
        .eq("colaborador_id", data.colaborador_id);
      
      const allSectorIds = [selectedColab.setor_titular_id];
      if (substituteSectors) {
        substituteSectors.forEach(s => { if (s.setor_id) allSectorIds.push(s.setor_id); });
      }

      const { data: sameSetorColabs } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, setor_titular_id")
        .in("setor_titular_id", allSectorIds)
        .eq("status", "ativo")
        .neq("id", data.colaborador_id);

      if (sameSetorColabs && sameSetorColabs.length > 0) {
        const colabIds = sameSetorColabs.map((c) => c.id);
        const { data: existingFerias } = await supabase
          .from("ferias_ferias")
          .select("*, colaborador:ferias_colaboradores!colaborador_id(nome, setor_titular_id)")
          .in("colaborador_id", colabIds)
          .in("status", ["pendente", "aprovada", "em_gozo"]);

        if (existingFerias) {
          const q1Start = parseISO(data.quinzena1_inicio);
          const q1End = parseISO(data.quinzena1_fim);
          const q2Start = data.quinzena2_inicio ? parseISO(data.quinzena2_inicio) : null;
          const q2End = data.quinzena2_fim ? parseISO(data.quinzena2_fim) : null;

          for (const ef of existingFerias) {
            if (ferias && ef.id === ferias.id) continue;
            const efQ1Start = parseISO(ef.quinzena1_inicio);
            const efQ1End = parseISO(ef.quinzena1_fim);
            const efQ2Start = ef.quinzena2_inicio ? parseISO(ef.quinzena2_inicio) : null;
            const efQ2End = ef.quinzena2_fim ? parseISO(ef.quinzena2_fim) : null;

            let overlap = false;
            overlap = (q1Start <= efQ1End && q1End >= efQ1Start);
            if (efQ2Start && efQ2End) {
              overlap = overlap || (q1Start <= efQ2End && q1End >= efQ2Start);
            }
            if (q2Start && q2End) {
              overlap = overlap || (q2Start <= efQ1End && q2End >= efQ1Start);
              if (efQ2Start && efQ2End) {
                overlap = overlap || (q2Start <= efQ2End && q2End >= efQ2Start);
              }
            }

            if (overlap) {
              const isSubstitute = (ef.colaborador as any)?.setor_titular_id !== selectedColab.setor_titular_id;
              foundConflicts.push({
                colaborador_nome: (ef.colaborador as any)?.nome || "Desconhecido",
                tipo: isSubstitute ? "Setor substituto" : "Mesmo setor",
                periodo: `${format(efQ1Start, "dd/MM")} - ${format(efQ1End, "dd/MM")}${efQ2Start && efQ2End ? ` / ${format(efQ2Start, "dd/MM")} - ${format(efQ2End, "dd/MM")}` : ""}`,
              });
            }
          }
        }
      }

      const { data: familyConflicts } = await supabase
        .from("ferias_conflitos")
        .select("*, colaborador1:colaborador1_id(id, nome), colaborador2:colaborador2_id(id, nome)")
        .or(`colaborador1_id.eq.${data.colaborador_id},colaborador2_id.eq.${data.colaborador_id}`);

      if (familyConflicts && familyConflicts.length > 0) {
        for (const fc of familyConflicts) {
          const relatedId = fc.colaborador1_id === data.colaborador_id ? fc.colaborador2_id : fc.colaborador1_id;
          const relatedName = fc.colaborador1_id === data.colaborador_id ? (fc.colaborador2 as any)?.nome : (fc.colaborador1 as any)?.nome;

          const { data: relatedFerias } = await supabase
            .from("ferias_ferias")
            .select("*")
            .eq("colaborador_id", relatedId)
            .in("status", ["pendente", "aprovada", "em_gozo"]);

          if (relatedFerias) {
            const q1Start = parseISO(data.quinzena1_inicio);
            const q1End = parseISO(data.quinzena1_fim);

            for (const rf of relatedFerias) {
              if (ferias && rf.id === ferias.id) continue;
              const rfQ1Start = parseISO(rf.quinzena1_inicio);
              const rfQ1End = parseISO(rf.quinzena1_fim);
              const noOverlap = !(q1Start <= rfQ1End && q1End >= rfQ1Start);
              if (noOverlap) {
                foundConflicts.push({
                  colaborador_nome: relatedName || "Familiar",
                  tipo: "Familiar sem coincidência",
                  periodo: `${format(rfQ1Start, "dd/MM")} - ${format(rfQ1End, "dd/MM")}`,
                });
              }
            }
          }
        }
      }

      setConflicts(foundConflicts);
    } catch (error) {
      console.error("Error checking conflicts:", error);
    } finally {
      setCheckingConflicts(false);
    }
  };

  const watchedFields = form.watch(["colaborador_id", "quinzena1_inicio", "quinzena1_fim", "quinzena2_inicio", "quinzena2_fim"]);
  
  useEffect(() => {
    const values = form.getValues();
    if (values.colaborador_id && values.quinzena1_inicio && values.quinzena1_fim) {
      const debounce = setTimeout(() => checkConflicts(values), 500);
      return () => clearTimeout(debounce);
    }
  }, [watchedFields]);

  const periodoAquisitivo = (() => {
    if (!selectedColab?.data_admissao || !q1Inicio) return null;
    try {
      const admissao = parseISO(selectedColab.data_admissao);
      const feriasYear = parseISO(q1Inicio).getFullYear();
      const admDay = admissao.getDate();
      const admMonth = admissao.getMonth();
      let startYear = feriasYear;
      const cycleStart = new Date(startYear, admMonth, admDay);
      if (cycleStart > parseISO(q1Inicio)) startYear--;
      const inicio = format(new Date(startYear, admMonth, admDay), "yyyy-MM-dd");
      const fimDate = new Date(startYear + 1, admMonth, admDay);
      fimDate.setDate(fimDate.getDate() - 1);
      const fim = format(fimDate, "yyyy-MM-dd");
      return { inicio, fim };
    } catch { return null; }
  })();

  const formatDateBR = (dateStr: string) => {
    try { return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR }); } catch { return dateStr; }
  };

  // Save mutation
  const mutation = useMutation({
    mutationFn: async (data: FeriasFormData) => {
      let gozoQ1Inicio = null;
      let gozoQ1Fim = null;
      let gozoQ2Inicio = null;
      let gozoQ2Fim = null;
      let venderDias = false;
      let diasVend = 0;
      let quinzenaVendaVal: number | null = null;
      let gozoDiferente = false;
      let gozoFlexivel = false;
      let distribuicaoTipoVal: string | null = null;

      if (data.is_excecao && excecaoTipo) {
        gozoFlexivel = true;
        distribuicaoTipoVal = excDistribuicaoTipo || null;

        if (excecaoTipo === "vender") {
          venderDias = true;
          diasVend = excDiasVendidos;
          quinzenaVendaVal = excDistribuicaoTipo === "2" ? 2 : 1;
          if (excPeriodos.length > 0) {
            gozoQ1Inicio = excPeriodos[0].data_inicio || null;
            gozoQ1Fim = excPeriodos[0].data_fim || null;
          }
          if (excPeriodos.length > 1) {
            gozoQ2Inicio = excPeriodos[1].data_inicio || null;
            gozoQ2Fim = excPeriodos[1].data_fim || null;
          }
        } else if (excecaoTipo === "gozo_diferente") {
          gozoDiferente = true;
          const p1 = excPeriodos.filter(p => p.referencia_periodo === 1);
          const p2 = excPeriodos.filter(p => p.referencia_periodo === 2);
          if (p1.length > 0) {
            gozoQ1Inicio = p1[0].data_inicio || null;
            gozoQ1Fim = p1[p1.length - 1].data_fim || null;
          }
          if (p2.length > 0) {
            gozoQ2Inicio = p2[0].data_inicio || null;
            gozoQ2Fim = p2[p2.length - 1].data_fim || null;
          }
        }
      } else {
        if (data.opcao_adicional === "vender" && (data.dias_vendidos || 0) > 0) {
          venderDias = true;
          diasVend = data.dias_vendidos || 0;
          quinzenaVendaVal = data.quinzena_venda || 1;

          if (diasVend <= 10) {
            if (quinzenaVendaVal === 1) {
              gozoQ1Inicio = data.gozo_venda_inicio || null;
              gozoQ1Fim = data.gozo_venda_fim || null;
            } else {
              gozoQ2Inicio = data.gozo_venda_inicio || null;
              gozoQ2Fim = data.gozo_venda_fim || null;
            }
          } else {
            gozoQ1Inicio = data.gozo_venda_q1_inicio || null;
            gozoQ1Fim = data.gozo_venda_q1_fim || null;
            if (data.gozo_venda_periodos === "2") {
              gozoQ2Inicio = data.gozo_venda_q2_inicio || null;
              gozoQ2Fim = data.gozo_venda_q2_fim || null;
            }
          }
        } else if (data.opcao_adicional === "gozo_diferente") {
          gozoDiferente = true;
          if (data.gozo_periodos === "1" || data.gozo_periodos === "ambos") {
            gozoQ1Inicio = data.gozo_quinzena1_inicio || null;
            gozoQ1Fim = data.gozo_quinzena1_fim || null;
          }
          if (data.gozo_periodos === "2" || data.gozo_periodos === "ambos") {
            gozoQ2Inicio = data.gozo_quinzena2_inicio || null;
            gozoQ2Fim = data.gozo_quinzena2_fim || null;
          }
        }
      }

      const payload: any = {
        colaborador_id: data.colaborador_id,
        quinzena1_inicio: data.quinzena1_inicio,
        quinzena1_fim: data.quinzena1_fim,
        quinzena2_inicio: data.quinzena2_inicio || null,
        quinzena2_fim: data.quinzena2_fim || null,
        gozo_diferente: gozoDiferente,
        gozo_quinzena1_inicio: gozoQ1Inicio,
        gozo_quinzena1_fim: gozoQ1Fim,
        gozo_quinzena2_inicio: gozoQ2Inicio,
        gozo_quinzena2_fim: gozoQ2Fim,
        vender_dias: venderDias,
        dias_vendidos: venderDias ? diasVend : null,
        quinzena_venda: venderDias ? quinzenaVendaVal : null,
        status: isEditing ? ferias.status : "aprovada",
        is_excecao: data.is_excecao,
        excecao_motivo: data.is_excecao ? data.excecao_motivo : null,
        excecao_justificativa: data.is_excecao ? data.excecao_justificativa : null,
        periodo_aquisitivo_inicio: periodoAquisitivo?.inicio || null,
        periodo_aquisitivo_fim: periodoAquisitivo?.fim || null,
        gozo_flexivel: gozoFlexivel,
        distribuicao_tipo: distribuicaoTipoVal,
      };

      let feriasId: string;
      if (isEditing) {
        const { error } = await supabase.from("ferias_ferias").update(payload).eq("id", ferias.id);
        if (error) throw error;
        feriasId = ferias.id;
      } else {
        const { data: inserted, error } = await supabase.from("ferias_ferias").insert(payload).select("id").single();
        if (error) throw error;
        feriasId = inserted.id;
      }

      if (gozoFlexivel && excPeriodos.length > 0) {
        await supabase.from("ferias_gozo_periodos" as any).delete().eq("ferias_id", feriasId);
        const periodosPayload = excPeriodos
          .filter(p => p.data_inicio && p.data_fim && p.dias > 0)
          .map((p, idx) => ({
            ferias_id: feriasId,
            tipo: excecaoTipo,
            referencia_periodo: p.referencia_periodo || null,
            numero: idx + 1,
            dias: p.dias,
            data_inicio: p.data_inicio,
            data_fim: p.data_fim,
          }));
        if (periodosPayload.length > 0) {
          const { error: pError } = await supabase.from("ferias_gozo_periodos" as any).insert(periodosPayload);
          if (pError) throw pError;
        }
      } else if (isEditing) {
        await supabase.from("ferias_gozo_periodos" as any).delete().eq("ferias_id", feriasId);
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Férias atualizada com sucesso!" : "Férias cadastrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ferias-colaboradores-com-ferias"] });
      onSuccess();
    },
    onError: (error) => {
      console.error("Error saving férias:", error);
      toast.error("Erro ao salvar férias");
    },
  });

  const validateVacation = (data: FeriasFormData) => {
    const errors: string[] = [];
    let requiresException = false;
    let exceptionReason = "";

    const q1Start = parseISO(data.quinzena1_inicio);
    const q1Month = q1Start.getMonth() + 1;
    if (q1Month === 1 || q1Month === 12) {
      requiresException = true;
      exceptionReason = "mes_bloqueado";
      errors.push("Férias em janeiro ou dezembro requerem exceção");
    }

    if (data.quinzena2_inicio) {
      const q2Start = parseISO(data.quinzena2_inicio);
      const q2Month = q2Start.getMonth() + 1;
      if (q2Month === 1 || q2Month === 12) {
        requiresException = true;
        exceptionReason = "mes_bloqueado";
        errors.push("Férias em janeiro ou dezembro requerem exceção");
      }
    }

    if (data.opcao_adicional === "vender" && data.dias_vendidos && data.dias_vendidos > 10) {
      requiresException = true;
      exceptionReason = "venda_acima_limite";
      errors.push("Venda acima de 10 dias requer exceção");
    }
    if (conflicts.length > 0 && !data.is_excecao) {
      requiresException = true;
      exceptionReason = "conflito_setor";
    }
    return { isValid: errors.length === 0 || data.is_excecao, errors, requiresException, exceptionReason };
  };

  const onSubmit = (data: FeriasFormData) => {
    const validation = validateVacation(data);
    if (validation.requiresException && !data.is_excecao) {
      toast.error(validation.errors[0] || "Esta operação requer marcar como exceção");
      return;
    }
    if (data.is_excecao && (!data.excecao_motivo || !data.excecao_justificativa)) {
      toast.error("Preencha o motivo e justificativa da exceção");
      return;
    }
    if (gozoDateError) {
      toast.error(gozoDateError);
      return;
    }
    mutation.mutate(data);
  };

  const outroPeriodoLabel = quinzenaVenda === 1 ? "2º" : "1º";
  const periodoVendaLabel = quinzenaVenda === 1 ? "1º" : "2º";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {isEditing ? "Editar Férias" : "Nova Férias"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* SEÇÃO 1: Tipo de Cadastro */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Tipo de cadastro</p>
              <div className="flex gap-2">
                <Button type="button" variant={!isExcecao ? "default" : "outline"} size="sm"
                  onClick={() => { form.setValue("is_excecao", false); form.setValue("excecao_motivo", ""); form.setValue("excecao_justificativa", ""); }}>
                  Padrão
                </Button>
                <Button type="button" variant={isExcecao ? "destructive" : "outline"} size="sm"
                  onClick={() => form.setValue("is_excecao", true)}>
                  <ShieldAlert className="h-4 w-4 mr-1" /> Exceção
                </Button>
              </div>
              {isExcecao && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="pt-4 space-y-3">
                    <FormField control={form.control} name="excecao_motivo" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Motivo da exceção *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="mes_bloqueado">Férias em janeiro/dezembro</SelectItem>
                            <SelectItem value="venda_acima_limite">Venda acima de 10 dias</SelectItem>
                            <SelectItem value="conflito_setor">Conflito de setor</SelectItem>
                            <SelectItem value="conflito_equipe">Conflito de equipe</SelectItem>
                            <SelectItem value="ajuste_setor">Ajuste de setor</SelectItem>
                            <SelectItem value="periodo_aquisitivo">Período aquisitivo irregular</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="excecao_justificativa" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Justificativa *</FormLabel>
                        <FormControl><Textarea placeholder="Descreva a justificativa para a exceção..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>
              )}
            </div>

            <Separator />

            {/* SEÇÃO 2: Colaborador e Períodos Oficiais */}
            <div className="space-y-4">
              <FormField control={form.control} name="colaborador_id" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Colaborador *</FormLabel>
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" aria-expanded={comboboxOpen}
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={isEditing}>
                          {field.value ? colaboradores.find(c => c.id === field.value)?.nome || "Selecione..." : "Buscar colaborador..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nome..." />
                        <CommandList>
                          <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                          {colaboradoresDisponiveis.map((c) => (
                            <CommandItem key={c.id} value={c.nome} onSelect={() => { field.onChange(c.id); setComboboxOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", field.value === c.id ? "opacity-100" : "opacity-0")} />
                              {c.nome}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              {familiarId && feriasFamiliar && feriasFamiliar.length > 0 && (
                <Alert className="border-primary/20 bg-primary/5">
                  <Users className="h-4 w-4" />
                  <AlertTitle>Familiar vinculado: {familiarNome || "—"}</AlertTitle>
                  <AlertDescription className="text-sm">
                    <p className="mb-1">Férias do familiar:</p>
                    <ul className="list-disc list-inside">
                      {feriasFamiliar.map((ff, i) => {
                        const q1i = ff.gozo_diferente && ff.gozo_quinzena1_inicio ? ff.gozo_quinzena1_inicio : ff.quinzena1_inicio;
                        const q1f = ff.gozo_diferente && ff.gozo_quinzena1_fim ? ff.gozo_quinzena1_fim : ff.quinzena1_fim;
                        const q2i = ff.gozo_diferente && ff.gozo_quinzena2_inicio ? ff.gozo_quinzena2_inicio : ff.quinzena2_inicio;
                        const q2f = ff.gozo_diferente && ff.gozo_quinzena2_fim ? ff.gozo_quinzena2_fim : ff.quinzena2_fim;
                        return <li key={i}>1º: {formatDateBR(q1i)} a {formatDateBR(q1f)}{q2i ? ` | 2º: ${formatDateBR(q2i)} a ${formatDateBR(q2f!)}` : ""}</li>;
                      })}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {familiarId && (!feriasFamiliar || feriasFamiliar.length === 0) && (
                <Alert className="border-muted">
                  <Users className="h-4 w-4" />
                  <AlertTitle>Familiar vinculado: {familiarNome || "—"}</AlertTitle>
                  <AlertDescription className="text-sm text-muted-foreground">Nenhuma férias cadastrada para o familiar ainda.</AlertDescription>
                </Alert>
              )}

              {periodoAquisitivo && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4 text-primary" />Período Aquisitivo (automático)</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-sm">{formatDateBR(periodoAquisitivo.inicio)} a {formatDateBR(periodoAquisitivo.fim)}</p></CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">1º Período (15 dias)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="quinzena1_inicio" render={({ field }) => (
                    <FormItem><FormLabel>Data de Início *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormItem>
                    <FormLabel>Data de Fim (automático)</FormLabel>
                    <Input type="date" value={q1Fim} readOnly className="bg-muted cursor-not-allowed" />
                    {q1Inicio && q1Fim && <p className="text-xs text-muted-foreground mt-1">15 dias a partir de {formatDateBR(q1Inicio)}</p>}
                  </FormItem>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">2º Período (15 dias)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="quinzena2_inicio" render={({ field }) => (
                    <FormItem><FormLabel>Data de Início *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormItem>
                    <FormLabel>Data de Fim (automático)</FormLabel>
                    <Input type="date" value={q2Fim} readOnly className="bg-muted cursor-not-allowed" />
                    {q2Inicio && q2Fim && <p className="text-xs text-muted-foreground mt-1">15 dias a partir de {formatDateBR(q2Inicio)}</p>}
                  </FormItem>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* SEÇÃO 3: Opções adicionais */}
            {isExcecao ? (
              <div className="space-y-4">
                <p className="text-sm font-medium">Opções de exceção</p>
                <ExcecaoPeriodosSection
                  excecaoTipo={excecaoTipo}
                  onExcecaoTipoChange={setExcecaoTipo}
                  distribuicaoTipo={excDistribuicaoTipo}
                  onDistribuicaoTipoChange={setExcDistribuicaoTipo}
                  diasVendidos={excDiasVendidos}
                  onDiasVendidosChange={setExcDiasVendidos}
                  periodos={excPeriodos}
                  onPeriodosChange={setExcPeriodos}
                  q1Inicio={q1Inicio}
                  q1Fim={q1Fim}
                  q2Inicio={q2Inicio}
                  q2Fim={q2Fim}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-medium">Vender dias de férias</p>
                <RadioGroup value={opcaoAdicional} onValueChange={(v) => form.setValue("opcao_adicional", v as any)} className="flex flex-col gap-3">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nenhum" id="opcao-nenhum" />
                    <Label htmlFor="opcao-nenhum">Nenhum</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="vender" id="opcao-vender" />
                    <Label htmlFor="opcao-vender">Vender dias de férias</Label>
                  </div>
                </RadioGroup>

                {isVendaPadrao && (
                  <div className="space-y-4 pl-7 border-l-2 border-primary/20">
                    <FormField control={form.control} name="dias_vendidos" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade de dias a vender (máx. 10)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={10} {...field} value={field.value ?? 0}
                            onChange={(e) => field.onChange(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="quinzena_venda" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Período da venda</FormLabel>
                        <Select onValueChange={(v) => { field.onChange(parseInt(v)); form.setValue("gozo_venda_inicio", ""); form.setValue("gozo_venda_fim", ""); setGozoDateError(null); }} value={String(field.value || 1)}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="1">1º Período</SelectItem>
                            <SelectItem value="2">2º Período</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <Alert className="border-primary/30 bg-primary/5">
                      <Info className="h-4 w-4 text-primary" />
                      <AlertDescription className="text-sm">
                        O {outroPeriodoLabel} período será gozado integralmente (15 dias). No {periodoVendaLabel} período, serão gozados {diasGozoNoPeriodoVenda} dia{diasGozoNoPeriodoVenda !== 1 ? "s" : ""}.
                      </AlertDescription>
                    </Alert>

                    {diasGozoNoPeriodoVenda > 0 && (
                      <Card className="border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-primary">
                            Gozo do {periodoVendaLabel} período — {diasGozoNoPeriodoVenda} dia{diasGozoNoPeriodoVenda !== 1 ? "s" : ""}
                          </CardTitle>
                          {((quinzenaVenda === 1 && q1Inicio && q1Fim) || (quinzenaVenda === 2 && q2Inicio && q2Fim)) && (
                            <p className="text-xs text-muted-foreground">
                              Período oficial: {formatDateBR(quinzenaVenda === 1 ? q1Inicio : q2Inicio)} a {formatDateBR(quinzenaVenda === 1 ? q1Fim : q2Fim)}
                            </p>
                          )}
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="gozo_venda_inicio" render={({ field }) => (
                            <FormItem><FormLabel>Data de Início do Gozo</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormItem>
                            <FormLabel>Data de Fim (automático)</FormLabel>
                            <Input type="date" value={form.watch("gozo_venda_fim") || ""} readOnly className="bg-muted cursor-not-allowed" />
                          </FormItem>
                        </CardContent>
                        {gozoDateError && (
                          <div className="px-6 pb-4">
                            <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription className="text-sm">{gozoDateError}</AlertDescription></Alert>
                          </div>
                        )}
                      </Card>
                    )}

                    <Card className="border-muted bg-muted/30">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex justify-between text-sm"><span>Dias totais de férias:</span><span className="font-semibold">30 dias</span></div>
                        <div className="flex justify-between text-sm text-destructive"><span>Dias vendidos ({periodoVendaLabel} período):</span><span className="font-semibold">-{diasVendidos} dias</span></div>
                        <div className="border-t pt-2 flex justify-between text-sm font-bold"><span>Dias de gozo:</span><span>{diasGozo} dias ({outroPeriodoLabel}: 15 + {periodoVendaLabel}: {diasGozoNoPeriodoVenda})</span></div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {isVenda && diasVendidos === 0 && (
                  <div className="space-y-4 pl-7 border-l-2 border-primary/20">
                    <FormField control={form.control} name="dias_vendidos" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade de dias a vender (máx. 10)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={10} {...field} value={field.value ?? 0}
                            onChange={(e) => field.onChange(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
              </div>
            )}

            {/* SEÇÃO 4: Conflitos */}
            {conflicts.length > 0 && (
              <>
                <Separator />
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Conflitos Detectados</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {conflicts.map((c, i) => (
                        <li key={i}><strong>{c.colaborador_nome}</strong> ({c.tipo}): {c.periodo}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-sm">Marque como "Exceção" no topo se deseja prosseguir.</p>
                  </AlertDescription>
                </Alert>
              </>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending || !!gozoDateError}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
