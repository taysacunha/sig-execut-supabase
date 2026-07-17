import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Lancamento, LancamentoInput, LancamentoTipo, useDespesasLookups,
  useSaveLancamento,
} from "@/hooks/useDespesasLancamentos";
import {
  RecorrenciaBlock, RecorrenciaFormState,
} from "./RecorrenciaBlock";
import { useSaveRecorrencia } from "@/hooks/useDespesasRecorrencias";
import { DuplicidadeAlert } from "./DuplicidadeAlert";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Lancamento | null;
  tipoDefault?: LancamentoTipo;
}

export function LancamentoDialog({ open, onOpenChange, editing, tipoDefault }: Props) {
  const { centros, categorias, planos, subcategorias, contas, pessoas } = useDespesasLookups();
  const saveMut = useSaveLancamento();
  const saveRecMut = useSaveRecorrencia();

  const emptyForm = (): LancamentoInput => ({
    tipo: tipoDefault ?? "a_pagar",
    descricao: "",
    documento_numero: null,
    pessoa_id: null,
    centro_custo_id: "",
    categoria_id: null,
    plano_conta_id: null,
    subcategoria_id: null,
    conta_bancaria_id: null,
    data_competencia: new Date().toISOString().slice(0, 10),
    data_vencimento: new Date().toISOString().slice(0, 10),
    valor_total: 0,
    observacao: null,
  });

  const [form, setForm] = useState<LancamentoInput>(emptyForm());
  const [rec, setRec] = useState<RecorrenciaFormState>({
    ativa: false,
    tipo: "mensal",
    data_fim: null,
    dia_vencimento: new Date().getDate(),
    meses_fixos: [],
    janela_geracao_meses: 12,
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        tipo: editing.tipo,
        descricao: editing.descricao,
        documento_numero: editing.documento_numero,
        pessoa_id: editing.pessoa_id,
        centro_custo_id: editing.centro_custo_id,
        categoria_id: editing.categoria_id,
        plano_conta_id: editing.plano_conta_id,
        subcategoria_id: editing.subcategoria_id,
        conta_bancaria_id: editing.conta_bancaria_id,
        data_competencia: editing.data_competencia,
        data_vencimento: editing.data_vencimento,
        valor_total: Number(editing.valor_total),
        observacao: editing.observacao,
      });
      setRec({
        ativa: false,
        tipo: "mensal",
        data_fim: null,
        dia_vencimento: new Date(editing.data_vencimento + "T00:00:00").getDate(),
        meses_fixos: [],
        janela_geracao_meses: 12,
      });
    } else {
      setForm(emptyForm());
      setRec({
        ativa: false,
        tipo: "mensal",
        data_fim: null,
        dia_vencimento: new Date().getDate(),
        meses_fixos: [],
        janela_geracao_meses: 12,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const subcatsFiltradas = useMemo(() => {
    if (!form.plano_conta_id) return [];
    return (subcategorias.data ?? []).filter((s) => s.plano_conta_id === form.plano_conta_id);
  }, [subcategorias.data, form.plano_conta_id]);

  const podeSalvar =
    form.descricao.trim().length > 0 &&
    !!form.centro_custo_id &&
    form.valor_total > 0 &&
    !!form.data_vencimento &&
    !!form.data_competencia;

  async function salvar() {
    try {
      await saveMut.mutateAsync({ id: editing?.id, input: form });
      if (!editing && rec.ativa) {
        await saveRecMut.mutateAsync({
          input: {
            ativo: true,
            tipo: rec.tipo,
            data_inicio: form.data_vencimento,
            data_fim: rec.data_fim,
            dia_vencimento: rec.dia_vencimento,
            meses_fixos: rec.meses_fixos,
            janela_geracao_meses: rec.janela_geracao_meses,
            lanc_tipo: form.tipo,
            descricao: form.descricao,
            valor_total: form.valor_total,
            centro_custo_id: form.centro_custo_id,
            categoria_id: form.categoria_id ?? null,
            plano_conta_id: form.plano_conta_id ?? null,
            subcategoria_id: form.subcategoria_id ?? null,
            conta_bancaria_id: form.conta_bancaria_id ?? null,
            pessoa_id: form.pessoa_id ?? null,
            observacao: form.observacao ?? null,
          },
        });
        toast.success("Recorrência criada e ocorrências futuras geradas");
      } else {
        toast.success(editing ? "Lançamento atualizado" : "Lançamento criado");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar lançamento");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar lançamento" : "Novo lançamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(v: LancamentoTipo) => setForm({ ...form, tipo: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a_pagar">Conta a Pagar</SelectItem>
                <SelectItem value="a_receber">Conta a Receber</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nº do documento</Label>
            <Input
              value={form.documento_numero ?? ""}
              onChange={(e) => setForm({ ...form, documento_numero: e.target.value || null })}
              placeholder="NF, boleto, contrato…"
              maxLength={60}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Descrição *</Label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>Centro de custo *</Label>
            <Select
              value={form.centro_custo_id}
              onValueChange={(v) => setForm({ ...form, centro_custo_id: v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(centros.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Pessoa</Label>
            <Select
              value={form.pessoa_id ?? "__none__"}
              onValueChange={(v) => setForm({ ...form, pessoa_id: v === "__none__" ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem pessoa —</SelectItem>
                {(pessoas.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={form.categoria_id ?? "__none__"}
              onValueChange={(v) => setForm({ ...form, categoria_id: v === "__none__" ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem categoria —</SelectItem>
                {(categorias.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Plano de conta</Label>
            <Select
              value={form.plano_conta_id ?? "__none__"}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  plano_conta_id: v === "__none__" ? null : v,
                  subcategoria_id: null,
                })
              }
            >
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem plano —</SelectItem>
                {(planos.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subcategoria</Label>
            <Select
              value={form.subcategoria_id ?? "__none__"}
              onValueChange={(v) => setForm({ ...form, subcategoria_id: v === "__none__" ? null : v })}
              disabled={!form.plano_conta_id}
            >
              <SelectTrigger>
                <SelectValue placeholder={form.plano_conta_id ? "Opcional" : "Escolha um plano primeiro"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem subcategoria —</SelectItem>
                {subcatsFiltradas.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Conta bancária (previsão)</Label>
            <Select
              value={form.conta_bancaria_id ?? "__none__"}
              onValueChange={(v) => setForm({ ...form, conta_bancaria_id: v === "__none__" ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem conta —</SelectItem>
                {(contas.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data de competência *</Label>
            <Input
              type="date"
              value={form.data_competencia}
              onChange={(e) => setForm({ ...form, data_competencia: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Data de vencimento *</Label>
            <Input
              type="date"
              value={form.data_vencimento}
              onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Valor total (R$) *</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.valor_total}
              onChange={(e) => setForm({ ...form, valor_total: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Observação</Label>
            <Textarea
              value={form.observacao ?? ""}
              onChange={(e) => setForm({ ...form, observacao: e.target.value || null })}
              rows={2}
            />
          </div>

          <div className="md:col-span-2">
            <DuplicidadeAlert
              valor={form.valor_total}
              data_vencimento={form.data_vencimento}
              centro_custo_id={form.centro_custo_id}
              pessoa_id={form.pessoa_id}
              plano_conta_id={form.plano_conta_id}
              conta_bancaria_id={form.conta_bancaria_id}
              ignorar_id={editing?.id ?? null}
            />
          </div>

          {!editing && (
            <RecorrenciaBlock value={rec} onChange={setRec} />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!podeSalvar || saveMut.isPending || saveRecMut.isPending}>
            {(saveMut.isPending || saveRecMut.isPending) ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}