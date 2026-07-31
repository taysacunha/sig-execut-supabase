import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, Check, X, CalendarPlus, RotateCcw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Repasse, RepasseConta, RepasseItemOrigem, RepasseItemTipo,
  useSaveRepasseItem, useDeleteRepasseItem, useUpdateRepasseStatus,
  useSaveRepasseBeneficiario, useDeleteRepasseBeneficiario,
  useRepasseInquilinos, useAddCompetencia, useLimitesAnuais, useSaveLimiteAnual,
  useDeleteRepasse, useUpdateRepasseCampos,
} from "@/hooks/useDespesasRepasses";
import { ComboboxSelect } from "@/components/ui/combobox-select";
import { usePessoas } from "@/hooks/useDespesasPessoas";
import {
  useDespesasValues,
  DespesasValuesScope,
  ToggleValuesButton,
} from "@/contexts/DespesasValuesContext";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conta: RepasseConta | null;
}

const origens: { v: RepasseItemOrigem; l: string }[] = [
  { v: "aluguel", l: "Aluguel" },
  { v: "reembolso", l: "Reembolso" },
  { v: "encargo", l: "Encargo" },
  { v: "taxa_admin", l: "Taxa admin." },
  { v: "ajuste", l: "Ajuste" },
  { v: "outro", l: "Outro" },
];

const statusLabel: Record<string, string> = {
  aberto: "Aberto", fechado: "Fechado", pago: "Pago", cancelado: "Cancelado",
};

function mesLabel(competencia: string) {
  return new Date(competencia + "T00:00:00")
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(".", "");
}

function RepasseDialogInner({ open, onOpenChange, conta }: Props) {
  const { showValues, formatValue } = useDespesasValues();
  const money = (n: number) => (showValues ? formatValue(n) : "R$ ******");
  const saveItem = useSaveRepasseItem();
  const delItem = useDeleteRepasseItem();
  const updStatus = useUpdateRepasseStatus();
  const saveBenef = useSaveRepasseBeneficiario();
  const delBenef = useDeleteRepasseBeneficiario();
  const addComp = useAddCompetencia();
  const delRepasse = useDeleteRepasse();
  const updCampos = useUpdateRepasseCampos();
  const saveLimiteAnual = useSaveLimiteAnual();
  const pessoas = usePessoas({});
  const inquilinos = useRepasseInquilinos(conta?.proprietario_id ?? null);

  const competencias = useMemo(
    () => (conta?.competencias ?? []).slice().sort((a, b) => (a.competencia < b.competencia ? 1 : -1)),
    [conta],
  );

  const anos = useMemo(
    () =>
      Array.from(new Set(competencias.map((c) => c.competencia.slice(0, 4)))).sort(),
    [competencias],
  );

  const [selecionada, setSelecionada] = useState<string>("todas");
  const [anoAba, setAnoAba] = useState<string>("");
  useEffect(() => {
    const ultimoAno = anos.length ? anos[anos.length - 1] : "";
    setAnoAba(ultimoAno);
    const doAno = competencias
      .filter((c) => c.competencia.slice(0, 4) === ultimoAno)
      .map((c) => c.competencia)
      .sort();
    setSelecionada(doAno.length ? doAno[doAno.length - 1] : "todas");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conta?.id, competencias.length]);

  const mesesDoAno = useMemo(
    () =>
      competencias
        .filter((c) => c.competencia.slice(0, 4) === anoAba)
        .slice()
        .sort((a, b) => (a.competencia < b.competencia ? -1 : 1)),
    [competencias, anoAba],
  );

  const repasse: Repasse | null =
    selecionada === "todas" ? null : competencias.find((c) => c.competencia === selecionada) ?? null;

  const anoSelecionado = repasse
    ? Number(repasse.competencia.slice(0, 4))
    : new Date().getFullYear();
  const limitesAnuais = useLimitesAnuais(conta?.id ?? null, anoSelecionado);

  const [novaComp, setNovaComp] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const benefVazio = {
    pessoa_id: null as string | null,
    valor: 0,
    valor_limite: "" as string,
    limite_anual: "" as string,
    data_recebimento: "",
    is_residual: false,
    observacao: "",
  };
  const [novoBenef, setNovoBenef] = useState(benefVazio);
  const [novo, setNovo] = useState<{
    tipo: RepasseItemTipo; origem: RepasseItemOrigem; descricao: string;
    valor: number; imovel_id: string | null;
  }>({ tipo: "credito", origem: "aluguel", descricao: "", valor: 0, imovel_id: null });

  useEffect(() => {
    setNovoBenef(benefVazio);
    setNovo({ tipo: "credito", origem: "aluguel", descricao: "", valor: 0, imovel_id: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repasse?.id]);

  const [confirmDelete, setConfirmDelete] = useState<
    { tipo: "item" | "benef"; id: string; label: string } | null
  >(null);
  const [confirmDelComp, setConfirmDelComp] = useState<Repasse | null>(null);
  const [reabrir, setReabrir] = useState<{ repasse: Repasse; justificativa: string } | null>(null);
  const [itemDuplicado, setItemDuplicado] = useState<{ id: string; label: string } | null>(null);
  const [limitesAbertos, setLimitesAbertos] = useState(false);
  const [editItem, setEditItem] = useState<
    {
      id: string; tipo: RepasseItemTipo; origem: RepasseItemOrigem;
      descricao: string; valor: number; imovel_id: string | null;
    } | null
  >(null);
  const [editBenef, setEditBenef] = useState<
    {
      id: string; pessoa_id: string | null; valor: number; valor_limite: string;
      limite_anual: string; data_recebimento: string; is_residual: boolean; observacao: string;
    } | null
  >(null);

  if (!conta) return null;

  const imovelOptions = (inquilinos.data ?? []).map((i) => ({
    value: i.imovel_id,
    label: `${i.imovel_codigo ? `${i.imovel_codigo} — ` : ""}${i.imovel_descricao}`,
    keywords: [i.endereco ?? "", i.inquilino?.nome ?? ""],
  }));
  const imovelLabel = (id: string | null | undefined) =>
    id ? imovelOptions.find((o) => o.value === id)?.label ?? "—" : "—";

  // Totais: competência selecionada ou consolidado de todas
  const base = repasse ? [repasse] : competencias;
  const totalBruto = base.reduce((s, r) => s + Number(r.valor_bruto || 0), 0);
  const totalTaxa = base.reduce((s, r) => s + Number(r.taxa_administracao_valor || 0), 0);
  const totalLiquido = base.reduce((s, r) => s + Number(r.valor_liquido || 0), 0);

  const beneficiarios = repasse?.beneficiarios ?? [];
  const distribuido = beneficiarios.reduce((s, b) => s + Number(b.valor || 0), 0);
  const restante = Number(repasse?.valor_liquido || 0) - distribuido;

  const limiteAnualDe = (pessoaId: string) =>
    limitesAnuais.data?.find((l) => l.pessoa_id === pessoaId)?.valor_limite ?? null;

  const recebidoNoAno = (pessoaId: string) =>
    competencias
      .filter((c) => c.competencia.slice(0, 4) === String(anoSelecionado))
      .reduce(
        (s, c) =>
          s + (c.beneficiarios ?? [])
            .filter((b) => b.pessoa_id === pessoaId)
            .reduce((t, b) => t + Number(b.valor || 0), 0),
        0,
      );

  const podeEditarItens = repasse?.status === "aberto";
  const podeEditarBenef = !!repasse && repasse.status !== "pago" && repasse.status !== "cancelado";

  const origemLabel = (o: RepasseItemOrigem) => origens.find((x) => x.v === o)?.l ?? o;

  // Duplicidade: mesmo tipo + origem + imóvel dentro da competência (itens manuais)
  const itemDuplicadoDe = (
    dados: { tipo: RepasseItemTipo; origem: RepasseItemOrigem; imovel_id: string | null },
    ignorarId?: string,
  ) =>
    (repasse?.itens ?? []).find(
      (it) =>
        it.id !== ignorarId &&
        !it.lancamento_id &&
        it.tipo === dados.tipo &&
        it.origem === dados.origem &&
        (it.imovel_id ?? null) === (dados.imovel_id ?? null),
    ) ?? null;

  // Pessoas distintas com movimento ou limite no ano selecionado
  const pessoasDoAno = (() => {
    const map = new Map<string, string>();
    competencias
      .filter((c) => c.competencia.slice(0, 4) === String(anoSelecionado))
      .forEach((c) =>
        (c.beneficiarios ?? []).forEach((b) =>
          map.set(b.pessoa_id, b.pessoa?.nome ?? "—"),
        ),
      );
    (limitesAnuais.data ?? []).forEach((l) => {
      if (!map.has(l.pessoa_id)) {
        const p = (pessoas.data ?? []).find((x) => x.id === l.pessoa_id);
        map.set(l.pessoa_id, p?.nome ?? "—");
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  })();

  async function adicionarCompetencia() {
    if (!conta || !novaComp) { toast.error("Informe o mês/ano da competência"); return; }
    try {
      await addComp.mutateAsync({ contaId: conta.id, competencia: `${novaComp}-01` });
      toast.success("Competência adicionada");
      setAnoAba(novaComp.slice(0, 4));
      setSelecionada(`${novaComp}-01`);
      setAddOpen(false);
      setNovaComp("");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  async function excluirCompetencia() {
    if (!confirmDelComp) return;
    try {
      await delRepasse.mutateAsync(confirmDelComp.id);
      const restantes = competencias
        .filter((c) => c.id !== confirmDelComp.id)
        .map((c) => c.competencia)
        .sort();
      setSelecionada(restantes.length ? restantes[restantes.length - 1] : "todas");
      if (restantes.length) setAnoAba(restantes[restantes.length - 1].slice(0, 4));
      setConfirmDelComp(null);
      toast.success("Competência excluída");
    } catch (e: any) { toast.error(e?.message ?? "Erro ao excluir competência"); }
  }

  async function confirmarReabertura() {
    if (!reabrir) return;
    const just = reabrir.justificativa.trim();
    if (just.length < 10) {
      toast.error("Informe uma justificativa com pelo menos 10 caracteres");
      return;
    }
    try {
      await updStatus.mutateAsync({ id: reabrir.repasse.id, status: "fechado" });
      const carimbo = `[Reabertura ${new Date().toLocaleDateString("pt-BR")}] ${just}`;
      await updCampos.mutateAsync({
        id: reabrir.repasse.id,
        campos: {
          observacao: reabrir.repasse.observacao
            ? `${reabrir.repasse.observacao}\n${carimbo}`
            : carimbo,
        },
      });
      toast.success("Competência reaberta (status: fechado)");
      setReabrir(null);
    } catch (e: any) { toast.error(e?.message ?? "Erro ao reabrir"); }
  }

  async function adicionar() {
    if (!repasse) return;
    if (!novo.descricao.trim() || novo.valor <= 0) {
      toast.error("Preencha descrição e valor");
      return;
    }
    const dup = itemDuplicadoDe(novo);
    if (dup) {
      setItemDuplicado({
        id: dup.id,
        label: `${novo.tipo === "credito" ? "Crédito" : "Débito"} / ${origemLabel(novo.origem)}${
          novo.imovel_id ? ` — ${imovelLabel(novo.imovel_id)}` : " — sem imóvel"
        }`,
      });
      return;
    }
    try {
      await saveItem.mutateAsync({ repasse_id: repasse.id, ...novo } as any);
      setNovo({ tipo: "credito", origem: "aluguel", descricao: "", valor: 0, imovel_id: null });
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  async function adicionarBenef() {
    if (!repasse || !conta) return;
    if (!novoBenef.pessoa_id || novoBenef.valor <= 0) {
      toast.error("Selecione a pessoa e informe um valor");
      return;
    }
    const limAno = limiteAnualDe(novoBenef.pessoa_id);
    const limAnoNovo = novoBenef.limite_anual !== "" ? Number(novoBenef.limite_anual) : limAno;
    if (
      limAnoNovo !== null &&
      recebidoNoAno(novoBenef.pessoa_id) + novoBenef.valor > Number(limAnoNovo) + 0.009
    ) {
      toast.error(
        `Limite do ano ${anoSelecionado} atingido para este beneficiário. Aumente o "Limite ano" para liberar mais.`,
      );
      return;
    }
    try {
      await saveBenef.mutateAsync({
        repasse_id: repasse.id,
        pessoa_id: novoBenef.pessoa_id,
        valor: novoBenef.valor,
        valor_limite: novoBenef.valor_limite === "" ? null : Number(novoBenef.valor_limite),
        data_recebimento: novoBenef.data_recebimento || null,
        is_residual: novoBenef.is_residual,
        observacao: novoBenef.observacao || null,
        ordem: beneficiarios.length + 1,
      } as any);
      if (novoBenef.limite_anual !== "") {
        await saveLimiteAnual.mutateAsync({
          conta_id: conta.id,
          pessoa_id: novoBenef.pessoa_id,
          ano: anoSelecionado,
          valor_limite: Number(novoBenef.limite_anual),
        });
      }
      setNovoBenef(benefVazio);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  async function marcarPago() {
    if (!repasse) return;
    if (distribuido <= 0) {
      toast.error("Defina ao menos um beneficiário antes de baixar o repasse.");
      return;
    }
    if (distribuido > Number(repasse.valor_liquido || 0) + 0.009) {
      toast.error("Soma dos beneficiários excede o valor líquido.");
      return;
    }
    try {
      await updStatus.mutateAsync({
        id: repasse.id, status: "pago",
        data_pagamento: new Date().toISOString().slice(0, 10),
      });
      toast.success("Competência marcada como paga — lançamento criado no calendário");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  async function confirmarExclusao() {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.tipo === "item") await delItem.mutateAsync(confirmDelete.id);
      else await delBenef.mutateAsync(confirmDelete.id);
      toast.success("Excluído com sucesso");
      setConfirmDelete(null);
    } catch (e: any) { toast.error(e?.message ?? "Erro ao excluir"); }
  }

  async function salvarItemEdit() {
    if (!repasse || !editItem) return;
    if (!editItem.descricao.trim() || editItem.valor <= 0) {
      toast.error("Preencha descrição e valor");
      return;
    }
    const dup = itemDuplicadoDe(editItem, editItem.id);
    if (dup) {
      toast.error(
        `Já existe um item de ${editItem.tipo === "credito" ? "Crédito" : "Débito"} / ${origemLabel(
          editItem.origem,
        )} para este imóvel nesta competência.`,
      );
      return;
    }
    try {
      await saveItem.mutateAsync({
        id: editItem.id, repasse_id: repasse.id, tipo: editItem.tipo,
        origem: editItem.origem, descricao: editItem.descricao,
        valor: editItem.valor, imovel_id: editItem.imovel_id,
      } as any);
      toast.success("Item atualizado");
      setEditItem(null);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  async function salvarBenefEdit() {
    if (!repasse || !conta || !editBenef) return;
    if (!editBenef.pessoa_id || editBenef.valor <= 0) {
      toast.error("Selecione a pessoa e informe um valor");
      return;
    }
    const limAnoEdit = editBenef.limite_anual === "" ? null : Number(editBenef.limite_anual);
    if (limAnoEdit !== null) {
      const outros = recebidoNoAno(editBenef.pessoa_id) -
        (beneficiarios.find((b) => b.id === editBenef.id)?.valor ?? 0);
      if (outros + editBenef.valor > limAnoEdit + 0.009) {
        toast.error(
          `Limite do ano ${anoSelecionado} atingido para este beneficiário. Aumente o "Limite ano" para liberar mais.`,
        );
        return;
      }
    }
    try {
      await saveBenef.mutateAsync({
        id: editBenef.id, repasse_id: repasse.id, pessoa_id: editBenef.pessoa_id,
        valor: editBenef.valor,
        valor_limite: editBenef.valor_limite === "" ? null : Number(editBenef.valor_limite),
        data_recebimento: editBenef.data_recebimento || null,
        is_residual: editBenef.is_residual,
        observacao: (editBenef.observacao || null) as any,
      } as any);
      await saveLimiteAnual.mutateAsync({
        conta_id: conta.id,
        pessoa_id: editBenef.pessoa_id,
        ano: anoSelecionado,
        valor_limite: editBenef.limite_anual === "" ? null : Number(editBenef.limite_anual),
      });
      toast.success("Beneficiário atualizado");
      setEditBenef(null);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  async function distribuir() {
    if (!repasse) return;
    const lista = beneficiarios.slice().sort((a, b) => a.ordem - b.ordem);
    if (lista.length === 0) {
      toast.error("Cadastre os beneficiários antes de distribuir.");
      return;
    }
    const residual = lista.find((b) => b.is_residual);
    if (!residual) {
      toast.error("Marque um beneficiário como residual (normalmente a proprietária).");
      return;
    }
    let saldo = Number(repasse.valor_liquido || 0);
    const updates: { id: string; pessoa_id: string; valor: number }[] = [];
    for (const b of lista) {
      if (b.id === residual.id) continue;
      const limiteMes = b.valor_limite === null || b.valor_limite === undefined
        ? saldo : Number(b.valor_limite);
      const limAno = limiteAnualDe(b.pessoa_id);
      const saldoAnual = limAno === null
        ? Infinity
        : Math.max(0, Number(limAno) - (recebidoNoAno(b.pessoa_id) - Number(b.valor || 0)));
      const v = Math.max(0, Math.min(limiteMes, saldo, saldoAnual));
      saldo = Number((saldo - v).toFixed(2));
      updates.push({ id: b.id, pessoa_id: b.pessoa_id, valor: v });
    }
    updates.push({ id: residual.id, pessoa_id: residual.pessoa_id, valor: Number(saldo.toFixed(2)) });
    try {
      for (const u of updates) {
        await saveBenef.mutateAsync({ id: u.id, repasse_id: repasse.id, pessoa_id: u.pessoa_id, valor: 0 } as any);
      }
      for (const u of updates) {
        await saveBenef.mutateAsync({ id: u.id, repasse_id: repasse.id, pessoa_id: u.pessoa_id, valor: u.valor } as any);
      }
      toast.success("Valores distribuídos conforme os limites");
    } catch (e: any) { toast.error(e?.message ?? "Erro ao distribuir"); }
  }

  const totalItens = repasse
    ? (repasse.itens ?? []).length
    : competencias.reduce((s, c) => s + (c.itens ?? []).length, 0);
  const totalBenef = repasse
    ? beneficiarios.length
    : competencias.reduce((s, c) => s + (c.beneficiarios ?? []).length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] sm:max-h-[95vh]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle>
              Repasse — {conta.proprietario?.nome}
              <span className="text-muted-foreground font-normal"> · {conta.centro_custo?.nome}</span>
            </DialogTitle>
            <ToggleValuesButton />
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* Barra de competências: anos + meses */}
        <div className="sticky top-0 z-10 shrink-0 space-y-2 rounded-md border bg-background p-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={selecionada === "todas" ? "default" : "outline"}
              onClick={() => setSelecionada("todas")}
            >
              Todas
            </Button>
            {anos.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={anoAba === a && selecionada !== "todas" ? "default" : "outline"}
                onClick={() => {
                  setAnoAba(a);
                  const doAno = competencias
                    .filter((c) => c.competencia.slice(0, 4) === a)
                    .map((c) => c.competencia)
                    .sort();
                  setSelecionada(doAno[0] ?? "todas");
                }}
              >
                {a}
              </Button>
            ))}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
            <Button size="sm" variant="ghost" onClick={() => setAddOpen((v) => !v)}>
              <CalendarPlus className="h-4 w-4 mr-1" />Competência
            </Button>
            {addOpen && (
              <div className="flex items-center shrink-0">
                <Input
                  type="month" className="h-9 w-52 shrink-0 px-3"
                  value={novaComp}
                  onChange={(e) => setNovaComp(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setAddOpen(false);
                      setNovaComp("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="ml-6 shrink-0"
                  onClick={adicionarCompetencia}
                  disabled={addComp.isPending}
                >
                  Adicionar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-2 shrink-0"
                  onClick={() => {
                    setAddOpen(false);
                    setNovaComp("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            )}
            </div>
          </div>
          {selecionada !== "todas" && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-2">
              {mesesDoAno.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Nenhuma competência neste ano.
                </span>
              ) : (
                mesesDoAno.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={selecionada === c.competencia ? "default" : "outline"}
                    onClick={() => setSelecionada(c.competencia)}
                    className="gap-2"
                  >
                    {mesLabel(c.competencia)}
                    <Badge variant="secondary" className="px-1 text-[10px]">
                      {statusLabel[c.status]}
                    </Badge>
                  </Button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            {repasse ? mesLabel(repasse.competencia) : `Consolidado · ${competencias.length} competência(s)`}
          </span>
          <span className="text-muted-foreground">
            Bruto <span className="font-semibold text-foreground">{money(totalBruto)}</span>
          </span>
          <span className="text-muted-foreground">
            Taxa admin. <span className="font-semibold text-destructive">−{money(totalTaxa)}</span>
          </span>
          <span className="text-muted-foreground">
            Líquido <span className="font-semibold text-primary">{money(totalLiquido)}</span>
          </span>
          {repasse && (
            <span className="text-muted-foreground">
              Status <span className="font-semibold text-foreground">{statusLabel[repasse.status]}</span>
            </span>
          )}
        </div>

        {competencias.length === 0 ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            Nenhuma competência cadastrada. Use o botão “Competência” acima para adicionar o primeiro mês.
          </div>
        ) : (
        <Tabs defaultValue="beneficiarios" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="beneficiarios">Beneficiários · {totalBenef}</TabsTrigger>
            <TabsTrigger value="itens">Itens · {totalItens}</TabsTrigger>
            <TabsTrigger value="imoveis">Imóveis · {(inquilinos.data ?? []).length}</TabsTrigger>
          </TabsList>

          {/* ------------------------------ BENEFICIÁRIOS */}
          <TabsContent value="beneficiarios" className="mt-3">
            {!repasse ? (
              <div className="space-y-4">
                {competencias.map((c) => (
                  <div key={c.id}>
                    <div className="mb-1 text-sm font-semibold">
                      {mesLabel(c.competencia)}{" "}
                      <span className="text-muted-foreground font-normal">
                        · líquido {money(Number(c.valor_liquido))} · {statusLabel[c.status]}
                      </span>
                    </div>
                    <Table className="table-fixed">
                      <TableHeader><TableRow>
                        <TableHead>Pessoa</TableHead>
                        <TableHead className="text-right w-40">Valor</TableHead>
                        <TableHead className="text-right w-40">Limite mensal</TableHead>
                        <TableHead className="w-36">Recebido em</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {(c.beneficiarios ?? []).length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">
                            Sem beneficiários nesta competência.
                          </TableCell></TableRow>
                        ) : (c.beneficiarios ?? []).slice().sort((a, b) => a.ordem - b.ordem).map((b) => (
                          <TableRow key={b.id}>
                            <TableCell>{b.pessoa?.nome ?? "—"}{b.is_residual ? " · sobra" : ""}</TableCell>
                            <TableCell className="text-right">{money(Number(b.valor))}</TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {b.valor_limite == null ? "—" : money(Number(b.valor_limite))}
                            </TableCell>
                            <TableCell className="text-sm">
                              {b.data_recebimento
                                ? new Date(b.data_recebimento + "T00:00:00").toLocaleDateString("pt-BR")
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            ) : (
            <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Distribuição de {mesLabel(repasse.competencia)}</h3>
                {podeEditarBenef && (
                  <Button type="button" variant="outline" size="sm" onClick={distribuir}
                    disabled={saveBenef.isPending} title="Distribuir respeitando os limites mensal e anual">
                    Distribuir por limite
                  </Button>
                )}
              </div>
              <div className="text-sm">
                Distribuído: <span className="font-medium">{money(distribuido)}</span>
                {" · "}Restante:{" "}
                <span className={restante < 0 ? "text-destructive font-medium" : "text-emerald-600 font-medium"}>
                  {money(restante)}
                </span>
              </div>
            </div>

            <p className="mb-2 text-xs text-muted-foreground">
              <strong>Valor</strong> é o que a pessoa recebe neste mês. <strong>Limite mês</strong> é o teto
              dela na competência e <strong>Limite ano</strong> o teto no ano {anoSelecionado}: é um
              <strong> valor único para o ano todo</strong>, vale para todas as competências desta conta —
              informar em um mês já vale para os demais (reinformar apenas substitui o valor).
              Quem estiver marcado em <strong>Sobra</strong> recebe todo o restante do
              líquido ao usar “Distribuir por limite” — normalmente a proprietária.
            </p>

            <div className="mb-3 rounded-md border">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
                onClick={() => setLimitesAbertos((v) => !v)}
              >
                <span>Limites anuais de {anoSelecionado} · {pessoasDoAno.length} beneficiário(s)</span>
                <span className="text-xs text-muted-foreground">
                  {limitesAbertos ? "ocultar" : "mostrar"}
                </span>
              </button>
              {limitesAbertos && (
                <div className="border-t p-3">
                  {pessoasDoAno.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Nenhum beneficiário com movimento ou limite neste ano.
                    </div>
                  ) : (
                    <Table className="table-fixed">
                      <TableHeader><TableRow>
                        <TableHead>Pessoa</TableHead>
                        <TableHead className="text-right w-40">Limite do ano</TableHead>
                        <TableHead className="text-right w-40">Consumido</TableHead>
                        <TableHead className="text-right w-40">Saldo</TableHead>
                        <TableHead className="w-40" />
                      </TableRow></TableHeader>
                      <TableBody>
                        {pessoasDoAno.map((p) => {
                          const lim = limiteAnualDe(p.id);
                          const usado = recebidoNoAno(p.id);
                          const saldo = lim === null ? null : Number(lim) - usado;
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="break-words">{p.nome}</TableCell>
                              <TableCell className="text-right">
                                {lim === null ? "sem limite" : money(Number(lim))}
                              </TableCell>
                              <TableCell className="text-right">{money(usado)}</TableCell>
                              <TableCell
                                className={`text-right ${
                                  saldo !== null && saldo < 0 ? "text-destructive" : ""
                                }`}
                              >
                                {saldo === null ? "—" : money(saldo)}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  className="text-right"
                                  placeholder="definir limite"
                                  defaultValue={lim === null ? "" : String(lim)}
                                  onBlur={(e) => {
                                    const v = e.target.value;
                                    const novoLim = v === "" ? null : Number(v);
                                    if (novoLim === (lim === null ? null : Number(lim))) return;
                                    saveLimiteAnual.mutate({
                                      conta_id: conta.id,
                                      pessoa_id: p.id,
                                      ano: anoSelecionado,
                                      valor_limite: novoLim,
                                    }, {
                                      onSuccess: () => {
                                        limitesAnuais.refetch();
                                        toast.success("Limite anual atualizado");
                                      },
                                      onError: (err: any) => toast.error(err?.message ?? "Erro"),
                                    });
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Um limite por beneficiário por ano. Ao atingir o limite, novos valores são bloqueados
                    até que o limite seja aumentado aqui.
                  </p>
                </div>
              )}
            </div>

            <Table className="table-fixed">
              <TableHeader><TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead className="w-[20%]">Pessoa</TableHead>
                <TableHead className="text-right w-[12%]">Valor</TableHead>
                <TableHead className="text-right w-[12%]">Limite mês</TableHead>
                <TableHead className="text-right w-[15%]">Limite ano {anoSelecionado}</TableHead>
                <TableHead className="w-[12%]">Recebido em</TableHead>
                <TableHead className="text-center w-16" title="Recebe o valor restante do mês">Sobra</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="w-24" />
              </TableRow></TableHeader>
              <TableBody>
                {beneficiarios.slice().sort((a, b) => a.ordem - b.ordem).map((b, i) =>
                  editBenef?.id === b.id ? (
                    <TableRow key={b.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <ComboboxSelect
                          value={editBenef.pessoa_id}
                          onChange={(v) => setEditBenef({ ...editBenef, pessoa_id: v })}
                          options={(pessoas.data ?? []).map((p) => ({
                            value: p.id,
                            label: `${p.nome} (${p.tipo_pessoa === "juridica" ? "PJ" : "PF"})`,
                            keywords: [p.cpf_cnpj ?? "", ...(p.papeis ?? [])],
                          }))}
                          placeholder="Selecione uma pessoa"
                          searchPlaceholder="Buscar…"
                        />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" min={0} className="text-right w-full"
                          value={editBenef.valor}
                          onChange={(e) => setEditBenef({ ...editBenef, valor: Number(e.target.value) })} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" min={0} className="text-right w-full"
                          placeholder="sem limite" value={editBenef.valor_limite}
                          onChange={(e) => setEditBenef({ ...editBenef, valor_limite: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" min={0} className="text-right w-full"
                          placeholder="opcional" value={editBenef.limite_anual}
                          onChange={(e) => setEditBenef({ ...editBenef, limite_anual: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input type="date" className="w-full" value={editBenef.data_recebimento}
                          onChange={(e) => setEditBenef({ ...editBenef, data_recebimento: e.target.value })} />
                      </TableCell>
                      <TableCell className="text-center">
                        <input type="checkbox" checked={editBenef.is_residual}
                          title="Recebe o valor restante do mês"
                          onChange={(e) => setEditBenef({ ...editBenef, is_residual: e.target.checked })} />
                      </TableCell>
                      <TableCell>
                        <Input value={editBenef.observacao}
                          onChange={(e) => setEditBenef({ ...editBenef, observacao: e.target.value })} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={salvarBenefEdit} disabled={saveBenef.isPending} title="Salvar">
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditBenef(null)} title="Cancelar">
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={b.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="align-top">
                        <div className="font-medium">{b.pessoa?.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground break-words">
                          {b.pessoa?.tipo_pessoa === "juridica" ? "PJ" : "PF"}
                          {b.pessoa?.cpf_cnpj ? ` · ${b.pessoa.cpf_cnpj}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {money(Number(b.valor))}
                        {b.is_residual && (
                          <div className="text-[11px] text-muted-foreground">
                            sobra do mês {money(restante + Number(b.valor))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {b.valor_limite == null ? "—" : money(Number(b.valor_limite))}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {limiteAnualDe(b.pessoa_id) === null ? "—" : (
                          <>
                            {money(Number(limiteAnualDe(b.pessoa_id)))}
                            <div className="text-[11px]">
                              consumido {money(recebidoNoAno(b.pessoa_id))}
                            </div>
                            <div className="text-[11px]">
                              saldo {money(Number(limiteAnualDe(b.pessoa_id)) - recebidoNoAno(b.pessoa_id))}
                            </div>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {b.data_recebimento
                          ? new Date(b.data_recebimento + "T00:00:00").toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {b.is_residual ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground break-words">{b.observacao ?? ""}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {podeEditarBenef && (
                          <>
                            <Button size="icon" variant="ghost" title="Editar"
                              onClick={() => setEditBenef({
                                id: b.id, pessoa_id: b.pessoa_id, valor: Number(b.valor),
                                valor_limite: b.valor_limite == null ? "" : String(b.valor_limite),
                                limite_anual: limiteAnualDe(b.pessoa_id) === null
                                  ? "" : String(limiteAnualDe(b.pessoa_id)),
                                data_recebimento: b.data_recebimento ?? "",
                                is_residual: b.is_residual,
                                observacao: b.observacao ?? "",
                              })}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Excluir"
                              onClick={() => setConfirmDelete({
                                tipo: "benef", id: b.id, label: b.pessoa?.nome ?? "Beneficiário",
                              })}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>

            {podeEditarBenef && (
              <div className="mt-3 grid gap-2 md:grid-cols-[1.8fr_minmax(110px,1fr)_minmax(110px,1fr)_minmax(110px,1fr)_minmax(130px,1fr)_1.2fr_auto_auto] items-end">
                <div className="space-y-1">
                  <Label>Pessoa</Label>
                  <ComboboxSelect
                    value={novoBenef.pessoa_id}
                    onChange={(v) => setNovoBenef({ ...novoBenef, pessoa_id: v })}
                    options={(pessoas.data ?? []).map((p) => ({
                      value: p.id,
                      label: `${p.nome} (${p.tipo_pessoa === "juridica" ? "PJ" : "PF"})`,
                      keywords: [p.cpf_cnpj ?? "", ...(p.papeis ?? [])],
                    }))}
                    placeholder="Selecione uma pessoa"
                    searchPlaceholder="Buscar…"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Valor (do mês)</Label>
                  <Input type="number" step="0.01" min={0} className="text-right"
                    value={novoBenef.valor}
                    onChange={(e) => setNovoBenef({ ...novoBenef, valor: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>Limite mês (teto)</Label>
                  <Input type="number" step="0.01" min={0} className="text-right" placeholder="opcional"
                    value={novoBenef.valor_limite}
                    onChange={(e) => setNovoBenef({ ...novoBenef, valor_limite: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Limite ano {anoSelecionado}</Label>
                  <Input type="number" step="0.01" min={0} className="text-right" placeholder="opcional"
                    value={novoBenef.limite_anual}
                    onChange={(e) => setNovoBenef({ ...novoBenef, limite_anual: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Recebido em</Label>
                  <Input type="date" value={novoBenef.data_recebimento}
                    onChange={(e) => setNovoBenef({ ...novoBenef, data_recebimento: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Observação</Label>
                  <Input value={novoBenef.observacao}
                    onChange={(e) => setNovoBenef({ ...novoBenef, observacao: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="whitespace-nowrap">Sobra</Label>
                  <div className="flex h-10 items-center justify-center">
                    <input type="checkbox" checked={novoBenef.is_residual}
                      title="Recebe o valor restante do mês"
                      onChange={(e) => setNovoBenef({ ...novoBenef, is_residual: e.target.checked })} />
                  </div>
                </div>
                <Button onClick={adicionarBenef} disabled={saveBenef.isPending} title="Adicionar beneficiário">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              O limite anual é opcional e único por beneficiário no ano {anoSelecionado} — informe uma vez
              (aqui, na edição da linha ou no painel “Limites anuais”) e ele vale para todas as
              competências desta conta. Apenas um beneficiário pode ficar com a sobra.
            </p>
            </>
            )}
          </TabsContent>

          {/* ------------------------------ ITENS */}
          <TabsContent value="itens" className="mt-3">
            {!repasse ? (
              <div className="space-y-4">
                {competencias.map((c) => (
                  <div key={c.id}>
                    <div className="mb-1 text-sm font-semibold">
                      {mesLabel(c.competencia)}{" "}
                      <span className="text-muted-foreground font-normal">
                        · bruto {money(Number(c.valor_bruto))} · taxa {money(Number(c.taxa_administracao_valor))}
                        {" "}· líquido {money(Number(c.valor_liquido))}
                      </span>
                    </div>
                    <Table className="table-fixed">
                      <TableHeader><TableRow>
                        <TableHead className="w-28">Tipo</TableHead>
                        <TableHead className="w-32">Origem</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-[24%]">Imóvel</TableHead>
                        <TableHead className="text-right w-36">Valor</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {(c.itens ?? []).length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">
                            Sem itens nesta competência.
                          </TableCell></TableRow>
                        ) : (c.itens ?? []).map((it) => (
                          <TableRow key={it.id}>
                            <TableCell>{it.tipo === "credito" ? "Crédito" : "Débito"}</TableCell>
                            <TableCell>{origens.find((o) => o.v === it.origem)?.l ?? it.origem}</TableCell>
                            <TableCell className="break-words">{it.descricao}</TableCell>
                            <TableCell className="text-sm text-muted-foreground break-words">
                              {imovelLabel(it.imovel_id)}
                            </TableCell>
                            <TableCell className={`text-right ${it.tipo === "debito" ? "text-destructive" : ""}`}>
                              {it.tipo === "debito" ? "−" : ""}{money(Number(it.valor))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            ) : (
            <>
            <Table className="table-fixed">
              <TableHeader><TableRow>
                <TableHead className="w-28">Tipo</TableHead>
                <TableHead className="w-36">Origem</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[22%]">Imóvel</TableHead>
                <TableHead className="text-right w-36">Valor</TableHead>
                <TableHead className="w-24" />
              </TableRow></TableHeader>
              <TableBody>
                {(repasse.itens ?? []).map((it) => editItem?.id === it.id ? (
                  <TableRow key={it.id}>
                    <TableCell>
                      <Select value={editItem.tipo} onValueChange={(v: RepasseItemTipo) => setEditItem({ ...editItem, tipo: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="credito">Crédito</SelectItem>
                          <SelectItem value="debito">Débito</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={editItem.origem} onValueChange={(v: RepasseItemOrigem) => setEditItem({ ...editItem, origem: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{origens.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input value={editItem.descricao}
                        onChange={(e) => setEditItem({ ...editItem, descricao: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <ComboboxSelect
                        value={editItem.imovel_id}
                        onChange={(v) => setEditItem({ ...editItem, imovel_id: v })}
                        options={imovelOptions}
                        placeholder="Sem imóvel"
                        searchPlaceholder="Buscar imóvel…"
                        allowClear
                      />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" className="text-right"
                        value={editItem.valor}
                        onChange={(e) => setEditItem({ ...editItem, valor: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={salvarItemEdit} disabled={saveItem.isPending} title="Salvar">
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditItem(null)} title="Cancelar">
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={it.id}>
                    <TableCell>{it.tipo === "credito" ? "Crédito" : "Débito"}</TableCell>
                    <TableCell>{origens.find((o) => o.v === it.origem)?.l ?? it.origem}</TableCell>
                    <TableCell className="break-words">{it.descricao}</TableCell>
                    <TableCell className="text-sm text-muted-foreground break-words">
                      {imovelLabel(it.imovel_id)}
                    </TableCell>
                    <TableCell className={`text-right ${it.tipo === "debito" ? "text-destructive" : ""}`}>
                      {it.tipo === "debito" ? "−" : ""}{money(Number(it.valor))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {podeEditarItens && (
                        <>
                          <Button size="icon" variant="ghost" title="Editar"
                            onClick={() => setEditItem({
                              id: it.id, tipo: it.tipo, origem: it.origem,
                              descricao: it.descricao, valor: Number(it.valor),
                              imovel_id: it.imovel_id ?? null,
                            })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Excluir"
                            onClick={() => setConfirmDelete({ tipo: "item", id: it.id, label: it.descricao })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {podeEditarItens && (
              <div className="mt-3 grid gap-2 md:grid-cols-[130px_150px_1.4fr_1.4fr_170px] items-end">
                <div className="space-y-1"><Label>Tipo</Label>
                  <Select value={novo.tipo} onValueChange={(v: RepasseItemTipo) => setNovo({ ...novo, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credito">Crédito</SelectItem>
                      <SelectItem value="debito">Débito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Origem</Label>
                  <Select value={novo.origem} onValueChange={(v: RepasseItemOrigem) => setNovo({ ...novo, origem: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{origens.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Descrição</Label>
                  <Input value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
                </div>
                <div className="space-y-1"><Label>Imóvel</Label>
                  <ComboboxSelect
                    value={novo.imovel_id}
                    onChange={(v) => setNovo({ ...novo, imovel_id: v })}
                    options={imovelOptions}
                    placeholder="Sem imóvel"
                    searchPlaceholder="Buscar imóvel…"
                    allowClear
                  />
                </div>
                <div className="space-y-1"><Label>Valor</Label>
                  <div className="flex gap-2">
                    <Input type="number" step="0.01" value={novo.valor}
                      onChange={(e) => setNovo({ ...novo, valor: Number(e.target.value) })} />
                    <Button size="icon" onClick={adicionar}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            )}
            </>
            )}
          </TabsContent>

          {/* ------------------------------ IMÓVEIS */}
          <TabsContent value="imoveis" className="mt-3">
            <div className="border rounded-md p-3">
              {inquilinos.isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando…</div>
              ) : (inquilinos.data ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum imóvel vinculado a este proprietário.</div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {(inquilinos.data ?? []).map((r) => (
                    <li key={r.imovel_id} className="flex flex-wrap gap-x-2">
                      <span className="font-medium">
                        {r.imovel_codigo ? `${r.imovel_codigo} — ` : ""}{r.imovel_descricao}
                      </span>
                      <span className="text-muted-foreground">
                        {r.inquilino
                          ? `→ ${r.inquilino.nome} (${r.inquilino.tipo_pessoa === "juridica" ? "PJ" : "PF"}${r.inquilino.cpf_cnpj ? ` · ${r.inquilino.cpf_cnpj}` : ""})`
                          : "→ Sem inquilino"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="text-xs text-muted-foreground mt-2">Para alterar, edite o cadastro do imóvel.</div>
            </div>
          </TabsContent>
        </Tabs>
        )}
        </div>

        <DialogFooter className="shrink-0 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {repasse && (
            repasse.status === "pago" ? (
              <Button variant="outline" onClick={() => setReabrir({ repasse, justificativa: "" })}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reabrir {mesLabel(repasse.competencia)}
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => setConfirmDelComp(repasse)}>
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir {mesLabel(repasse.competencia)}
              </Button>
            )
          )}
          {repasse?.status === "aberto" && (
            <Button variant="outline" onClick={() => updStatus.mutate({ id: repasse.id, status: "fechado" })}>
              Fechar {mesLabel(repasse.competencia)}
            </Button>
          )}
          {repasse && repasse.status !== "pago" && repasse.status !== "cancelado" && (
            <Button onClick={marcarPago}>Marcar {mesLabel(repasse.competencia)} como pago</Button>
          )}
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDelete?.tipo === "item" ? "Excluir item?" : "Excluir beneficiário?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.label} — esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmarExclusao(); }}
              disabled={delItem.isPending || delBenef.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelComp} onOpenChange={(o) => !o && setConfirmDelComp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir competência?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelComp ? mesLabel(confirmDelComp.competencia) : ""} — todos os itens e
              beneficiários deste mês serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); excluirCompetencia(); }}
              disabled={delRepasse.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!reabrir} onOpenChange={(o) => !o && setReabrir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir competência paga?</AlertDialogTitle>
            <AlertDialogDescription>
              {reabrir ? mesLabel(reabrir.repasse.competencia) : ""} voltará ao status “Fechado”,
              permitindo ajustes ou exclusão. Justifique a reabertura (mínimo 10 caracteres).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            rows={3}
            placeholder="Motivo da reabertura"
            value={reabrir?.justificativa ?? ""}
            onChange={(e) =>
              setReabrir((r) => (r ? { ...r, justificativa: e.target.value } : r))
            }
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmarReabertura(); }}
              disabled={updStatus.isPending || updCampos.isPending}
            >
              Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}


export function RepasseDialog(props: Props) {
  return (
    <DespesasValuesScope active={props.open}>
      <RepasseDialogInner {...props} />
    </DespesasValuesScope>
  );
}
