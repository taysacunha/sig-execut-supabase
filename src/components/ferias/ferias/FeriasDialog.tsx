import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import { format, parseISO, addDays, addYears, differenceInDays } from "date-fns";
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
  const [excHydrating, setExcHydrating] = useState(false);
  const [selectedPeriodoKey, setSelectedPeriodoKey] = useState<string>("");

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

  // Fetch afastamentos for selected collaborator
  const { data: afastamentos = [] } = useQuery({
    queryKey: ["ferias-afastamentos-dialog", selectedColabId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_afastamentos")
        .select("id, data_inicio, data_fim, motivo, motivo_descricao")
        .eq("colaborador_id", selectedColabId!)
        .order("data_inicio");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedColabId,
  });

  // Fetch available credits for selected collaborator
  const { data: creditosDisponiveis = [] } = useQuery({
    queryKey: ["ferias-creditos-dialog", selectedColabId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_folgas_creditos")
        .select("id, dias, tipo")
        .eq("colaborador_id", selectedColabId!)
        .eq("status", "disponivel");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedColabId,
  });

  const creditosFolga = creditosDisponiveis.filter((c: any) => c.tipo === "folga");
  const creditosFerias = creditosDisponiveis.filter((c: any) => c.tipo === "ferias");
  const totalDiasFolga = creditosFolga.reduce((s: number, c: any) => s + (c.dias || 0), 0);
  const totalDiasFerias = creditosFerias.reduce((s: number, c: any) => s + (c.dias || 0), 0);

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
  const gozoVendaFim = form.watch("gozo_venda_fim");
  const gozoVendaPeriodos = form.watch("gozo_venda_periodos");
  const gozoVendaQ1Inicio = form.watch("gozo_venda_q1_inicio");
  const gozoVendaQ2Inicio = form.watch("gozo_venda_q2_inicio");
  const gozoQ1Inicio = form.watch("gozo_quinzena1_inicio");
  const gozoQ2Inicio = form.watch("gozo_quinzena2_inicio");

  // Q1 considerada "já gozada": editando um registro em que o 1º período oficial
  // permanece igual ao banco e já terminou, ou está em status posterior ao Q1.
  const q1JaGozada = useMemo(() => {
    if (!isEditing || !ferias) return false;
    const q1Unchanged = q1Inicio === ferias.quinzena1_inicio && q1Fim === ferias.quinzena1_fim;
    if (!q1Unchanged || !ferias.quinzena1_fim) return false;

    const statusConsumido = ["q1_concluida", "em_gozo_q2", "em_gozo", "concluida"].includes(ferias.status);
    const fimQ1JaPassou = parseISO(ferias.quinzena1_fim) < new Date();
    return statusConsumido || fimQ1JaPassou;
  }, [isEditing, ferias, q1Inicio, q1Fim]);

  const isVenda = opcaoAdicional === "vender";
  const isGozoDiferente = opcaoAdicional === "gozo_diferente";
  const quinzenaVendaEfetiva = q1JaGozada ? 2 : quinzenaVenda;
  const diasDisponiveisPadrao = q1JaGozada ? 15 : 30;
  const diasGozo = Math.max(0, diasDisponiveisPadrao - diasVendidos);
  const diasGozoNoPeriodoVenda = Math.max(0, 15 - diasVendidos);
  const isVendaPadrao = isVenda && diasVendidos <= 10 && diasVendidos >= 1;
  const isVendaExcecao = isVenda && diasVendidos > 10;
  const forceSingleGozo = isVendaExcecao && diasVendidos > 15;

  const buildNewVacationIntervals = useCallback((data: FeriasFormData): { start: Date; end: Date }[] => {
    const intervals: { start: Date; end: Date }[] = [];
    const shouldSkipConsumedQ1 = q1JaGozada;

    if (data.is_excecao && excecaoTipo && excPeriodos.length > 0) {
      for (const p of excPeriodos) {
        if (shouldSkipConsumedQ1 && p.referencia_periodo === 1) continue;
        if (p.data_inicio && p.data_fim) intervals.push({ start: parseISO(p.data_inicio), end: parseISO(p.data_fim) });
      }
      return intervals;
    }

    if (data.opcao_adicional === "vender" && (data.dias_vendidos || 0) > 0) {
      const vendaPeriodo = shouldSkipConsumedQ1 ? 2 : (data.quinzena_venda || 1);
      if (vendaPeriodo === 1) {
        if (data.gozo_venda_inicio && data.gozo_venda_fim) intervals.push({ start: parseISO(data.gozo_venda_inicio), end: parseISO(data.gozo_venda_fim) });
        if (data.quinzena2_inicio && data.quinzena2_fim) intervals.push({ start: parseISO(data.quinzena2_inicio), end: parseISO(data.quinzena2_fim) });
      } else {
        if (!shouldSkipConsumedQ1 && data.quinzena1_inicio && data.quinzena1_fim) intervals.push({ start: parseISO(data.quinzena1_inicio), end: parseISO(data.quinzena1_fim) });
        if (data.gozo_venda_inicio && data.gozo_venda_fim) intervals.push({ start: parseISO(data.gozo_venda_inicio), end: parseISO(data.gozo_venda_fim) });
      }
      return intervals;
    }

    if (data.opcao_adicional === "gozo_diferente") {
      if (!shouldSkipConsumedQ1 && (data.gozo_periodos === "1" || data.gozo_periodos === "ambos") && data.gozo_quinzena1_inicio && data.gozo_quinzena1_fim) {
        intervals.push({ start: parseISO(data.gozo_quinzena1_inicio), end: parseISO(data.gozo_quinzena1_fim) });
      }
      if ((data.gozo_periodos === "2" || data.gozo_periodos === "ambos") && data.gozo_quinzena2_inicio && data.gozo_quinzena2_fim) {
        intervals.push({ start: parseISO(data.gozo_quinzena2_inicio), end: parseISO(data.gozo_quinzena2_fim) });
      }
      return intervals;
    }

    if (!shouldSkipConsumedQ1 && data.quinzena1_inicio && data.quinzena1_fim) intervals.push({ start: parseISO(data.quinzena1_inicio), end: parseISO(data.quinzena1_fim) });
    if (data.quinzena2_inicio && data.quinzena2_fim) intervals.push({ start: parseISO(data.quinzena2_inicio), end: parseISO(data.quinzena2_fim) });
    return intervals;
  }, [q1JaGozada, excecaoTipo, excPeriodos]);

  const isResettingRef = useRef(false);

  useEffect(() => {
    if (isResettingRef.current) return;
    if (forceSingleGozo) {
      form.setValue("gozo_venda_periodos", "1");
    }
  }, [forceSingleGozo]);

  useEffect(() => {
    if (q1JaGozada && isVenda && quinzenaVenda !== 2) {
      form.setValue("quinzena_venda", 2);
      form.setValue("gozo_venda_inicio", "");
      form.setValue("gozo_venda_fim", "");
      setGozoDateError(null);
    }
  }, [q1JaGozada, isVenda, quinzenaVenda]);

  useEffect(() => {
    if (isResettingRef.current) return;
    if (q1Inicio) {
      try {
        const endDate = addDays(parseISO(q1Inicio), 14);
        form.setValue("quinzena1_fim", format(endDate, "yyyy-MM-dd"));
      } catch { /* ignore */ }
    }
  }, [q1Inicio]);

  useEffect(() => {
    if (isResettingRef.current) return;
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
      const periodoInicio = quinzenaVendaEfetiva === 1 ? q1Inicio : q2Inicio;
      const periodoFim = quinzenaVendaEfetiva === 1 ? q1Fim : q2Fim;
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
  }, [gozoVendaInicio, isVendaPadrao, quinzenaVendaEfetiva, q1Inicio, q1Fim, q2Inicio, q2Fim, diasGozoNoPeriodoVenda]);

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
    if (isResettingRef.current) return;
    if (isVenda && diasVendidos > 10) {
      form.setValue("is_excecao", true);
      form.setValue("excecao_motivo", "venda_acima_limite");
    }
  }, [isVenda, diasVendidos]);

  useEffect(() => {
    if (isResettingRef.current) return;
    if (!isExcecao && opcaoAdicional === "gozo_diferente") {
      form.setValue("opcao_adicional", "nenhum");
    }
    if (!isExcecao && isVenda && diasVendidos > 10) {
      form.setValue("dias_vendidos", 10);
    }
  }, [isExcecao]);

  useEffect(() => {
    if (isResettingRef.current) return;
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
    isResettingRef.current = true;
    if (ferias) {
      const hasFlexible = !!ferias.gozo_flexivel;
      const hasVenda = ferias.vender_dias && (ferias.dias_vendidos || 0) > 0;
      const hasGozo = ferias.gozo_diferente;
      const inferredIsExcecao = !!(ferias.is_excecao || hasFlexible || hasVenda || hasGozo);
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
        is_excecao: inferredIsExcecao,
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
      setExcHydrating(false);
    } else {
      // Always try to load gozo_periodos when editing, regardless of gozo_flexivel flag
      setExcHydrating(true);
      (async () => {
        const { data: existingPeriodos } = await supabase
          .from("ferias_gozo_periodos" as any)
          .select("id, ferias_id, numero, dias, data_inicio, data_fim, referencia_periodo, tipo")
          .eq("ferias_id", ferias.id)
          .order("numero");
        const loaded = ((existingPeriodos as any[]) || []).sort((a, b) => {
          const byDate = (a.data_inicio || "").localeCompare(b.data_inicio || "");
          return byDate !== 0 ? byDate : (a.numero || 0) - (b.numero || 0);
        });
        if (loaded.length > 0) {
          // Infer excecaoTipo from periodo data
          const tipos = [...new Set(loaded.map((p: any) => p.tipo))];
          const inferredTipo: "vender" | "gozo_diferente" | null = 
            tipos.includes("vender") ? "vender" : 
            tipos.includes("gozo_diferente") ? "gozo_diferente" : 
            (ferias.vender_dias ? "vender" : ferias.gozo_diferente ? "gozo_diferente" : null);
          
          // Infer distribuicaoTipo from referencia_periodo values
          const refs = [...new Set(loaded.map((p: any) => p.referencia_periodo))];
          let inferredDist = ferias.distribuicao_tipo || "";
          if (!inferredDist) {
            if (refs.includes(0)) inferredDist = "livre";
            else if (refs.includes(1) && refs.includes(2)) inferredDist = "ambos";
            else if (refs.includes(1)) inferredDist = "1";
            else if (refs.includes(2)) inferredDist = "2";
          }

          form.setValue("is_excecao", true);
          form.setValue("opcao_adicional", inferredTipo || "nenhum");
          setExcecaoTipo(inferredTipo);
          setExcDistribuicaoTipo(inferredDist);
          setExcDiasVendidos(ferias.dias_vendidos || 0);
          setExcPeriodos(loaded.map((p: any) => ({
            id: p.id || crypto.randomUUID(),
            referencia_periodo: p.referencia_periodo,
            dias: p.dias,
            data_inicio: p.data_inicio,
            data_fim: p.data_fim,
          })));
        } else {
          // No gozo_periodos found — use flags from the main record
          const hasException = !!(ferias.is_excecao || ferias.gozo_flexivel || ferias.vender_dias || ferias.gozo_diferente);
          form.setValue("is_excecao", hasException);
          const inferredOpcao = ferias.vender_dias ? "vender" : ferias.gozo_diferente ? "gozo_diferente" : "nenhum";
          form.setValue("opcao_adicional", inferredOpcao);
          setExcecaoTipo(inferredOpcao === "nenhum" ? null : inferredOpcao);
          setExcDistribuicaoTipo(ferias.distribuicao_tipo || "");
          setExcDiasVendidos(ferias.dias_vendidos || 0);
          setExcPeriodos([]);
        }
        setTimeout(() => setExcHydrating(false), 50);
      })();
    }
    setTimeout(() => { isResettingRef.current = false; }, 0);
  }, [ferias, open]);

  // Check conflicts
  const checkConflicts = async (data: FeriasFormData) => {
    if (!data.colaborador_id) return;
    setCheckingConflicts(true);
    const foundConflicts: ConflictInfo[] = [];
    try {
      const selectedColab = colaboradores.find((c) => c.id === data.colaborador_id);
      if (!selectedColab) return;

      // (a) mesmo setor titular; (b) eu cubro o setor titular dele; (c) ele cobre meu setor titular
      const [{ data: mySubsRows }, { data: coversMyRows }] = await Promise.all([
        supabase
          .from("ferias_colaborador_setores_substitutos")
          .select("setor_id")
          .eq("colaborador_id", data.colaborador_id),
        supabase
          .from("ferias_colaborador_setores_substitutos")
          .select("colaborador_id")
          .eq("setor_id", selectedColab.setor_titular_id),
      ]);

      const mySubstituteSectors = (mySubsRows || [])
        .map((s: any) => s.setor_id)
        .filter(Boolean) as string[];
      const colabsThatCoverMySector = (coversMyRows || [])
        .map((c: any) => c.colaborador_id)
        .filter((id: string | null) => id && id !== data.colaborador_id) as string[];

      // Caso (a) + (b): por setor titular
      const setorIdsForTitular = [selectedColab.setor_titular_id, ...mySubstituteSectors];
      const { data: byTitular } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, setor_titular_id")
        .in("setor_titular_id", setorIdsForTitular)
        .eq("status", "ativo")
        .neq("id", data.colaborador_id);

      // Caso (c): por id (quem cobre meu setor)
      let byCoverage: { id: string; nome: string; setor_titular_id: string }[] = [];
      if (colabsThatCoverMySector.length > 0) {
        const { data } = await supabase
          .from("ferias_colaboradores")
          .select("id, nome, setor_titular_id")
          .in("id", colabsThatCoverMySector)
          .eq("status", "ativo");
        byCoverage = (data as any) || [];
      }

      const sameSetorMap = new Map<string, { id: string; nome: string; setor_titular_id: string }>();
      [...(byTitular || []), ...byCoverage].forEach((c: any) => sameSetorMap.set(c.id, c));
      const sameSetorColabs = Array.from(sameSetorMap.values());

      const mesmoSetorIds = new Set(
        (byTitular || [])
          .filter((c: any) => c.setor_titular_id === selectedColab.setor_titular_id)
          .map((c: any) => c.id)
      );
      const euCubroIds = new Set(
        (byTitular || [])
          .filter((c: any) => c.setor_titular_id !== selectedColab.setor_titular_id)
          .map((c: any) => c.id)
      );
      const eleCobreIds = new Set(colabsThatCoverMySector);

      if (sameSetorColabs && sameSetorColabs.length > 0) {
        const colabIds = sameSetorColabs.map((c) => c.id);
        const { data: existingFerias } = await supabase
          .from("ferias_ferias")
          .select("*, colaborador:ferias_colaboradores!colaborador_id(nome, setor_titular_id)")
          .in("colaborador_id", colabIds)
          .in("status", ["pendente", "aprovada", "em_gozo_q1", "q1_concluida", "em_gozo_q2", "em_gozo"]);

        if (existingFerias && existingFerias.length > 0) {
          const newIntervals = buildNewVacationIntervals(data);

          // Batch-fetch gozo_periodos for existing ferias with gozo_flexivel
          const flexivelIds = existingFerias
            .filter(ef => ef.gozo_flexivel && !(ferias && ef.id === ferias.id))
            .map(ef => ef.id);
          
          let gozoPeriodosMap: Record<string, { data_inicio: string; data_fim: string }[]> = {};
          if (flexivelIds.length > 0) {
            const { data: gozoPeriodos } = await supabase
              .from("ferias_gozo_periodos" as any)
              .select("ferias_id, data_inicio, data_fim")
              .in("ferias_id", flexivelIds);
            if (gozoPeriodos) {
              for (const gp of gozoPeriodos as any[]) {
                if (!gozoPeriodosMap[gp.ferias_id]) gozoPeriodosMap[gp.ferias_id] = [];
                gozoPeriodosMap[gp.ferias_id].push(gp);
              }
            }
          }

          for (const ef of existingFerias) {
            if (ferias && ef.id === ferias.id) continue;

            // Extract real absence intervals for existing vacation
            const efIntervals: { start: Date; end: Date }[] = [];
            if (ef.gozo_flexivel && gozoPeriodosMap[ef.id]?.length > 0) {
              for (const gp of gozoPeriodosMap[ef.id]) {
                efIntervals.push({ start: parseISO(gp.data_inicio), end: parseISO(gp.data_fim) });
              }
            } else if (ef.gozo_diferente && ef.gozo_quinzena1_inicio) {
              efIntervals.push({ start: parseISO(ef.gozo_quinzena1_inicio), end: parseISO(ef.gozo_quinzena1_fim) });
              if (ef.gozo_quinzena2_inicio) {
                efIntervals.push({ start: parseISO(ef.gozo_quinzena2_inicio), end: parseISO(ef.gozo_quinzena2_fim) });
              }
            } else {
              efIntervals.push({ start: parseISO(ef.quinzena1_inicio), end: parseISO(ef.quinzena1_fim) });
              if (ef.quinzena2_inicio) {
                efIntervals.push({ start: parseISO(ef.quinzena2_inicio), end: parseISO(ef.quinzena2_fim) });
              }
            }

            // Check overlap between new and existing intervals
            let overlap = false;
            for (const ni of newIntervals) {
              for (const ei of efIntervals) {
                if (ni.start <= ei.end && ni.end >= ei.start) {
                  overlap = true;
                  break;
                }
              }
              if (overlap) break;
            }

            if (overlap) {
              const colabId = (ef as any).colaborador_id;
              let tipo = "Mesmo setor";
              if (mesmoSetorIds.has(colabId)) tipo = "Mesmo setor";
              else if (euCubroIds.has(colabId)) tipo = "Setor substituto (você cobre)";
              else if (eleCobreIds.has(colabId)) tipo = "Setor substituto (ele cobre)";
              const periodoStr = efIntervals
                .map(i => `${format(i.start, "dd/MM")} - ${format(i.end, "dd/MM")}`)
                .join(" / ");
              foundConflicts.push({
                colaborador_nome: (ef.colaborador as any)?.nome || "Desconhecido",
                tipo,
                periodo: periodoStr,
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
            .in("status", ["pendente", "aprovada", "em_gozo_q1", "q1_concluida", "em_gozo_q2", "em_gozo"]);

          if (relatedFerias) {
            const newIntervals = buildNewVacationIntervals(data);

            // Fetch gozo_periodos for flexible related ferias
            const flexRelIds = relatedFerias.filter(rf => rf.gozo_flexivel).map(rf => rf.id);
            let relGozoMap: Record<string, { data_inicio: string; data_fim: string }[]> = {};
            if (flexRelIds.length > 0) {
              const { data: relGozos } = await supabase
                .from("ferias_gozo_periodos" as any)
                .select("ferias_id, data_inicio, data_fim")
                .in("ferias_id", flexRelIds);
              if (relGozos) {
                for (const gp of relGozos as any[]) {
                  if (!relGozoMap[gp.ferias_id]) relGozoMap[gp.ferias_id] = [];
                  relGozoMap[gp.ferias_id].push(gp);
                }
              }
            }

            for (const rf of relatedFerias) {
              if (ferias && rf.id === ferias.id) continue;

              // Extract real intervals for related vacation
              const rfIntervals: { start: Date; end: Date }[] = [];
              if (rf.gozo_flexivel && relGozoMap[rf.id]?.length > 0) {
                for (const gp of relGozoMap[rf.id]) {
                  rfIntervals.push({ start: parseISO(gp.data_inicio), end: parseISO(gp.data_fim) });
                }
              } else if (rf.gozo_diferente && rf.gozo_quinzena1_inicio) {
                rfIntervals.push({ start: parseISO(rf.gozo_quinzena1_inicio), end: parseISO(rf.gozo_quinzena1_fim) });
                if (rf.gozo_quinzena2_inicio) {
                  rfIntervals.push({ start: parseISO(rf.gozo_quinzena2_inicio), end: parseISO(rf.gozo_quinzena2_fim) });
                }
              } else {
                rfIntervals.push({ start: parseISO(rf.quinzena1_inicio), end: parseISO(rf.quinzena1_fim) });
                if (rf.quinzena2_inicio) {
                  rfIntervals.push({ start: parseISO(rf.quinzena2_inicio), end: parseISO(rf.quinzena2_fim) });
                }
              }

              // Family: conflict when NO overlap (they want to coincide)
              let hasOverlap = false;
              for (const ni of newIntervals) {
                for (const ri of rfIntervals) {
                  if (ni.start <= ri.end && ni.end >= ri.start) {
                    hasOverlap = true;
                    break;
                  }
                }
                if (hasOverlap) break;
              }

              if (!hasOverlap) {
                const periodoStr = rfIntervals
                  .map(i => `${format(i.start, "dd/MM")} - ${format(i.end, "dd/MM")}`)
                  .join(" / ");
                foundConflicts.push({
                  colaborador_nome: relatedName || "Familiar",
                  tipo: "Familiar sem coincidência",
                  periodo: periodoStr,
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
  }, [watchedFields, excecaoTipo, excPeriodos, opcaoAdicional, diasVendidos, quinzenaVenda, gozoVendaInicio, gozoVendaFim, q1JaGozada]);

  // Fetch all ferias for selected collaborator to calculate period balances
  const { data: colabAllFerias = [] } = useQuery({
    queryKey: ["ferias-colab-periodos", selectedColabId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_ferias")
        .select("id, colaborador_id, quinzena1_inicio, quinzena1_fim, quinzena2_inicio, quinzena2_fim, dias_vendidos, status, periodo_aquisitivo_inicio, periodo_aquisitivo_fim")
        .eq("colaborador_id", selectedColabId!)
        .neq("status", "cancelada");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedColabId,
  });

  const { data: colabQuitacoes = [] } = useQuery({
    queryKey: ["ferias-colab-quitacoes", selectedColabId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_periodos_quitados" as any)
        .select("id, colaborador_id, periodo_inicio, dias_quitados")
        .eq("colaborador_id", selectedColabId!);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!selectedColabId,
  });

  // Build acquisition periods for selected collaborator
  const periodosAquisitivos = useMemo(() => {
    if (!selectedColab?.data_admissao) return [];
    const today = new Date();
    const admissao = parseISO(selectedColab.data_admissao);
    const anosDesde = Math.floor(differenceInDays(today, admissao) / 365);
    const maxP = Math.max(anosDesde + 1, 1);
    const result: Array<{ inicio: string; fim: string; saldo: number; label: string }> = [];

    for (let i = 0; i < maxP; i++) {
      const pInicio = addYears(admissao, i);
      const pFim = addYears(admissao, i + 1);
      if (pInicio > today) continue;
      const inicioStr = format(pInicio, "yyyy-MM-dd");
      const fimStr = format(pFim, "yyyy-MM-dd");
      const concessivoFim = addYears(pFim, 1);

      // Calculate days used
      const linked = colabAllFerias.filter(f => {
        // Exclude current ferias being edited
        if (ferias && f.id === ferias.id) return false;
        if (f.periodo_aquisitivo_inicio && f.periodo_aquisitivo_fim) {
          return f.periodo_aquisitivo_inicio === inicioStr && f.periodo_aquisitivo_fim === fimStr;
        }
        const q1 = f.quinzena1_inicio;
        return q1 >= inicioStr && q1 < format(concessivoFim, "yyyy-MM-dd");
      });

      let diasUsados = 0;
      for (const f of linked) {
        let dias = 0;
        if (f.quinzena1_inicio && f.quinzena1_fim) {
          dias += differenceInDays(parseISO(f.quinzena1_fim), parseISO(f.quinzena1_inicio)) + 1;
        }
        if (f.quinzena2_inicio && f.quinzena2_fim) {
          dias += differenceInDays(parseISO(f.quinzena2_fim), parseISO(f.quinzena2_inicio)) + 1;
        }
        dias -= (f.dias_vendidos || 0);
        diasUsados += Math.max(0, dias) + (f.dias_vendidos || 0);
      }

      // Add manual quitações
      const quit = colabQuitacoes.find((q: any) => q.periodo_inicio === inicioStr);
      if (quit) diasUsados += (quit as any).dias_quitados || 0;

      const saldo = Math.max(0, 30 - diasUsados);
      const inicioFmt = format(pInicio, "dd/MM/yyyy");
      const fimFmt = format(pFim, "dd/MM/yyyy");
      const statusLabel = saldo === 0 ? "✓ Quitado" : concessivoFim <= today ? `⚠ Vencido (${saldo}d)` : `${saldo}d disponíveis`;

      result.push({
        inicio: inicioStr,
        fim: fimStr,
        saldo,
        label: `${inicioFmt} a ${fimFmt} — ${statusLabel}`,
      });
    }
    return result;
  }, [selectedColab, colabAllFerias, colabQuitacoes, ferias]);

  // Auto-select period when collaborator or q1 changes
  useEffect(() => {
    if (isResettingRef.current) return;
    if (ferias?.periodo_aquisitivo_inicio && ferias?.periodo_aquisitivo_fim) {
      setSelectedPeriodoKey(`${ferias.periodo_aquisitivo_inicio}|${ferias.periodo_aquisitivo_fim}`);
      return;
    }
    if (!selectedColab?.data_admissao || !q1Inicio || periodosAquisitivos.length === 0) {
      setSelectedPeriodoKey("");
      return;
    }
    // Auto-detect based on q1Inicio
    try {
      const admissao = parseISO(selectedColab.data_admissao);
      const feriasDate = parseISO(q1Inicio);
      const feriasYear = feriasDate.getFullYear();
      const admDay = admissao.getDate();
      const admMonth = admissao.getMonth();
      let startYear = feriasYear;
      const cycleStart = new Date(startYear, admMonth, admDay);
      if (cycleStart > feriasDate) startYear--;
      const inicio = format(new Date(startYear, admMonth, admDay), "yyyy-MM-dd");
      const fimDate = new Date(startYear + 1, admMonth, admDay);
      const fim = format(fimDate, "yyyy-MM-dd");
      const match = periodosAquisitivos.find(p => p.inicio === inicio && p.fim === fim);
      if (match) setSelectedPeriodoKey(`${match.inicio}|${match.fim}`);
    } catch { /* ignore */ }
  }, [q1Inicio, selectedColab, periodosAquisitivos]);

  const periodoAquisitivo = useMemo(() => {
    if (!selectedPeriodoKey) return null;
    const [inicio, fim] = selectedPeriodoKey.split("|");
    if (!inicio || !fim) return null;
    return { inicio, fim };
  }, [selectedPeriodoKey]);

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
          quinzenaVendaVal = q1JaGozada ? 2 : (data.quinzena_venda || 1);

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
          .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
          .map((p, idx) => ({
            ferias_id: feriasId,
            tipo: excecaoTipo,
            referencia_periodo: p.referencia_periodo ?? 1,
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
      queryClient.invalidateQueries({ queryKey: ["ferias-dashboard-proximas"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-dashboard-ferias-mes"] });
      queryClient.invalidateQueries({ queryKey: ["ferias-dashboard-alertas"] });
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

    const q1ShouldValidateMonth = !q1JaGozada || data.quinzena1_inicio !== ferias?.quinzena1_inicio || data.quinzena1_fim !== ferias?.quinzena1_fim;
    const q1Start = parseISO(data.quinzena1_inicio);
    const q1Month = q1Start.getMonth() + 1;
    if (q1ShouldValidateMonth && (q1Month === 1 || q1Month === 12)) {
      requiresException = true;
      exceptionReason = "mes_bloqueado";
      errors.push("Férias em janeiro ou dezembro no 1º período requerem exceção");
    }

    if (data.quinzena2_inicio) {
      const q2Start = parseISO(data.quinzena2_inicio);
      const q2Month = q2Start.getMonth() + 1;
      if (q2Month === 1 || q2Month === 12) {
        requiresException = true;
        exceptionReason = "mes_bloqueado";
        errors.push("Férias em janeiro ou dezembro no 2º período requerem exceção");
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
      errors.push(`Conflito de setor: ${conflicts.map(c => c.colaborador_nome).join(", ")}`);
    }
    return { isValid: errors.length === 0 || data.is_excecao, errors, requiresException, exceptionReason };
  };

  // Check afastamento conflicts with vacation periods
  const afastamentoConflicts = useMemo(() => {
    if (afastamentos.length === 0) return [];
    const vacIntervals = buildNewVacationIntervals(form.getValues())
      .map((periodo) => ({ start: format(periodo.start, "yyyy-MM-dd"), end: format(periodo.end, "yyyy-MM-dd") }));
    const conflicts: { afastamento: typeof afastamentos[0]; periodo: string }[] = [];
    for (const af of afastamentos) {
      for (const vi of vacIntervals) {
        if (af.data_inicio <= vi.end && af.data_fim >= vi.start) {
          conflicts.push({ afastamento: af, periodo: `${formatDateBR(vi.start)} a ${formatDateBR(vi.end)}` });
          break;
        }
      }
    }
    return conflicts;
  }, [afastamentos, buildNewVacationIntervals, q1Inicio, q1Fim, q2Inicio, q2Fim, opcaoAdicional, diasVendidos, quinzenaVenda, gozoVendaInicio, gozoVendaFim, form]);

  const onSubmit = (data: FeriasFormData) => {
    const validation = validateVacation(data);
    if (validation.requiresException && !data.is_excecao) {
      const motivoLabel: Record<string, string> = {
        mes_bloqueado: "Férias em janeiro ou dezembro",
        venda_acima_limite: "Venda acima de 10 dias",
        conflito_setor: "Conflito de setor",
      };
      const label = motivoLabel[validation.exceptionReason] || "Esta operação";
      const detalhes = validation.errors.length > 0 ? ` Motivo: ${validation.errors.join("; ")}.` : "";
      toast.error(
        `${label} exige cadastro como exceção.${detalhes} Clique em "Exceção" no topo do formulário e preencha motivo + justificativa.`,
        { duration: 6000 }
      );
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
    // Block save if vacation overlaps afastamento
    if (afastamentoConflicts.length > 0) {
      toast.error("Férias conflitam com período de afastamento. Ajuste as datas antes de salvar.");
      return;
    }
    // Validate sub-period chronological order and overlaps
    if (excecaoTipo && excPeriodos.length > 1) {
      const preenchidos = excPeriodos.filter(p => p.data_inicio && p.data_fim);
      for (let i = 1; i < preenchidos.length; i++) {
        if (preenchidos[i].data_inicio < preenchidos[i - 1].data_inicio) {
          toast.error("Os subperíodos devem ser informados em ordem cronológica.");
          return;
        }
      }
      const sorted = [...preenchidos].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].data_inicio <= sorted[i - 1].data_fim) {
          toast.error(`Sub-períodos se sobrepõem: ${formatDateBR(sorted[i - 1].data_inicio)} e ${formatDateBR(sorted[i].data_inicio)}`);
          return;
        }
      }
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

        {isEditing && ferias?.enviado_contador && (
          <Alert variant="destructive" className="border-orange-500/50 bg-orange-500/10">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Férias já enviada ao contador</AlertTitle>
            <AlertDescription>
              Este registro foi encaminhado ao contador{ferias.enviado_contador_em ? ` em ${format(parseISO(ferias.enviado_contador_em), "dd/MM/yyyy", { locale: ptBR })}` : ""}. Alterações aqui ficarão apenas no sistema interno — comunique o contador separadamente se necessário.
            </AlertDescription>
          </Alert>
        )}

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

              {selectedColabId && creditosDisponiveis.length > 0 && (
                <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Créditos disponíveis</AlertTitle>
                  <AlertDescription className="text-sm">
                    Este colaborador possui <strong>{creditosDisponiveis.length} crédito(s)</strong> disponível(is)
                    {totalDiasFolga > 0 && ` (${totalDiasFolga} dia(s) de folga`}
                    {totalDiasFolga > 0 && totalDiasFerias > 0 && `, `}
                    {totalDiasFerias > 0 && `${totalDiasFolga > 0 ? "" : "("}${totalDiasFerias} dia(s) de férias`}
                    {(totalDiasFolga > 0 || totalDiasFerias > 0) && `)`}.
                    Para utilizá-los corretamente, vá para a página <strong>Créditos</strong> e clique em "Usar".
                  </AlertDescription>
                </Alert>
              )}

              {selectedColabId && periodosAquisitivos.length > 0 && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4 text-primary" />Período Aquisitivo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select value={selectedPeriodoKey} onValueChange={setSelectedPeriodoKey}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o período aquisitivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {periodosAquisitivos.map(p => (
                          <SelectItem key={`${p.inicio}|${p.fim}`} value={`${p.inicio}|${p.fim}`}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {periodoAquisitivo && (
                      <p className="text-xs text-muted-foreground mt-2">
                        O saldo exibido já desconta férias cadastradas e quitações manuais.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Afastamentos alert */}
              {afastamentos.length > 0 && (
                <Alert className={afastamentoConflicts.length > 0 ? "border-destructive/50 bg-destructive/10" : "border-amber-500/30 bg-amber-500/10"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-sm">
                    {afastamentoConflicts.length > 0 ? "⚠️ Conflito com afastamento!" : "Afastamentos registrados"}
                  </AlertTitle>
                  <AlertDescription className="text-xs space-y-1">
                    {afastamentos.map(af => (
                      <div key={af.id} className={afastamentoConflicts.some(c => c.afastamento.id === af.id) ? "font-semibold text-destructive" : ""}>
                        {formatDateBR(af.data_inicio)} a {formatDateBR(af.data_fim)} — {af.motivo_descricao || af.motivo}
                        {afastamentoConflicts.some(c => c.afastamento.id === af.id) && " (CONFLITO)"}
                      </div>
                    ))}
                    {afastamentoConflicts.length > 0 && (
                      <p className="mt-2 font-semibold text-destructive">Ajuste as datas de férias para não sobrepor períodos de afastamento.</p>
                    )}
                  </AlertDescription>
                </Alert>
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
                  isHydrating={excHydrating}
                  q1JaGozada={q1JaGozada}
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
                            {!q1JaGozada && <SelectItem value="1">1º Período</SelectItem>}
                            <SelectItem value="2">2º Período</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {q1JaGozada && (
                      <Alert className="border-amber-500/40 bg-amber-500/10">
                        <Info className="h-4 w-4" />
                        <AlertTitle className="text-sm">1º período já gozado</AlertTitle>
                        <AlertDescription className="text-sm">
                          A venda padrão será aplicada somente ao 2º período. O 1º período permanece histórico e não será recalculado nem validado contra conflitos.
                        </AlertDescription>
                      </Alert>
                    )}

                    <Alert className="border-primary/30 bg-primary/5">
                      <Info className="h-4 w-4 text-primary" />
                      <AlertDescription className="text-sm">
                        {q1JaGozada
                          ? `No ${periodoVendaLabel} período, serão gozados ${diasGozoNoPeriodoVenda} dia${diasGozoNoPeriodoVenda !== 1 ? "s" : ""}.`
                          : `O ${outroPeriodoLabel} período será gozado integralmente (15 dias). No ${periodoVendaLabel} período, serão gozados ${diasGozoNoPeriodoVenda} dia${diasGozoNoPeriodoVenda !== 1 ? "s" : ""}.`}
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
                        <div className="flex justify-between text-sm"><span>Dias totais do período aquisitivo:</span><span className="font-semibold">30 dias</span></div>
                        {q1JaGozada && <div className="flex justify-between text-sm text-muted-foreground"><span>Já gozados (1º período):</span><span className="font-semibold">-15 dias</span></div>}
                        {q1JaGozada && <div className="flex justify-between text-sm"><span>Disponíveis para ajuste:</span><span className="font-semibold">15 dias</span></div>}
                        <div className="flex justify-between text-sm text-destructive"><span>Dias vendidos ({periodoVendaLabel} período):</span><span className="font-semibold">-{diasVendidos} dias</span></div>
                        <div className="border-t pt-2 flex justify-between text-sm font-bold"><span>Dias de gozo:</span><span>{q1JaGozada ? `${diasGozo} dias` : `${diasGozo} dias (${outroPeriodoLabel}: 15 + ${periodoVendaLabel}: ${diasGozoNoPeriodoVenda})`}</span></div>
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
