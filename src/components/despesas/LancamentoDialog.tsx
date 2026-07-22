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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComboboxSelect } from "@/components/ui/combobox-select";
import {
  Lancamento, LancamentoInput, LancamentoTipo, useDespesasLookups,
  useSaveLancamento, useLancamentoCredenciais, useSaveLancamentoCredenciais,
  LancamentoCredenciais,
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
  const { centros, categorias, planos, contas, pessoas, imoveis } = useDespesasLookups();
  const saveMut = useSaveLancamento();
  const saveRecMut = useSaveRecorrencia();
  const credQuery = useLancamentoCredenciais(editing?.id ?? null);
  const saveCredMut = useSaveLancamentoCredenciais();

  const emptyForm = (): LancamentoInput => ({
    tipo: tipoDefault ?? "a_pagar",
    descricao: "",
    documento_numero: null,
    pessoa_id: null,
    imovel_id: null,
    referencia_tipo: null,
    referencia_numero: null,
    referencia_numero_pasta: null,
    referencia_numero_venda: null,
    centro_custo_id: "",
    categoria_id: null,
    plano_conta_id: null,
    subcategoria_id: null,
    conta_bancaria_id: null,
    data_competencia: new Date().toISOString().slice(0, 10),
    data_vencimento: new Date().toISOString().slice(0, 10),
    valor_total: null,
    observacao: null,
  });

  const [form, setForm] = useState<LancamentoInput>(emptyForm());
  const [credenciais, setCredenciais] = useState<LancamentoCredenciais>({});
  const [imovelPopoverOpen, setImovelPopoverOpen] = useState(false);
  const canEditCredenciais = !credQuery.isError; // sem permissão → RLS bloqueia leitura
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
        imovel_id: editing.imovel_id,
        referencia_tipo: editing.referencia_tipo,
        referencia_numero: editing.referencia_numero,
        referencia_numero_pasta: editing.referencia_numero_pasta,
        referencia_numero_venda: editing.referencia_numero_venda,
        centro_custo_id: editing.centro_custo_id,
        categoria_id: editing.categoria_id,
        plano_conta_id: editing.plano_conta_id,
        subcategoria_id: editing.subcategoria_id,
        conta_bancaria_id: editing.conta_bancaria_id,
        data_competencia: editing.data_competencia,
        data_vencimento: editing.data_vencimento,
        valor_total: editing.valor_total == null ? null : Number(editing.valor_total),
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
      setCredenciais({});
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

  useEffect(() => {
    if (editing && credQuery.data) setCredenciais(credQuery.data);
    else if (editing && credQuery.isFetched && !credQuery.data) setCredenciais({});
  }, [editing, credQuery.data, credQuery.isFetched]);

  const referenciaPreenchida =
    !!form.pessoa_id ||
    !!form.imovel_id ||
    (!!form.referencia_numero_pasta && /^[0-9]+$/.test(form.referencia_numero_pasta)) ||
    (!!form.referencia_numero_venda && /^[0-9]+$/.test(form.referencia_numero_venda));

  const podeSalvar =
    form.descricao.trim().length > 0 &&
    !!form.centro_custo_id &&
    !!form.data_vencimento &&
    !!form.data_competencia &&
    referenciaPreenchida;

  async function salvar() {
    try {
      if (!referenciaPreenchida) {
        toast.error("Preencha pelo menos um campo de referência (Pasta, Venda, Imóvel ou Pessoa)");
        return;
      }
      // Novos lançamentos gravam sempre nos campos novos; referencia_tipo/número
      // legado permanece apenas para histórico.
      const payload: LancamentoInput = { ...form, referencia_tipo: null, referencia_numero: null };
      const savedId = await saveMut.mutateAsync({ id: editing?.id, input: payload });
      if (canEditCredenciais) {
        try {
          await saveCredMut.mutateAsync({ lancamentoId: savedId, credenciais });
        } catch (credErr: any) {
          // Se não tiver permissão, apenas ignora silenciosamente as credenciais.
          if (credErr?.code !== "42501" && credErr?.code !== "PGRST301") throw credErr;
        }
      }
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
            subcategoria_id: null,
            conta_bancaria_id: form.conta_bancaria_id ?? null,
            pessoa_id: form.pessoa_id ?? null,
            imovel_id: form.imovel_id ?? null,
            referencia_tipo: null,
            referencia_numero: null,
            referencia_numero_pasta: form.referencia_numero_pasta ?? null,
            referencia_numero_venda: form.referencia_numero_venda ?? null,
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

          <div className="space-y-2 md:col-span-2 border rounded-md p-3">
            <Label className="text-sm">Referência *</Label>
            <p className="text-xs text-muted-foreground">
              Informe ao menos um dos campos abaixo. Você pode preencher mais de um.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nº de Pasta</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Somente números"
                  value={form.referencia_numero_pasta ?? ""}
                  onChange={(e) => {
                    const only = e.target.value.replace(/\D+/g, "");
                    setForm({ ...form, referencia_numero_pasta: only || null });
                  }}
                  maxLength={20}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cód. Venda</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Somente números"
                  value={form.referencia_numero_venda ?? ""}
                  onChange={(e) => {
                    const only = e.target.value.replace(/\D+/g, "");
                    setForm({ ...form, referencia_numero_venda: only || null });
                  }}
                  maxLength={20}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Imóvel</Label>
                <Popover open={imovelPopoverOpen} onOpenChange={setImovelPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={imovelPopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      {(() => {
                        const sel = (imoveis.data ?? []).find((i) => i.id === form.imovel_id);
                        if (!sel) return <span className="text-muted-foreground">Selecione o imóvel</span>;
                        return <span className="truncate">{sel.codigo ? `${sel.codigo} — ` : ""}{sel.descricao}</span>;
                      })()}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                    <Command
                      filter={(value, search) => {
                        return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                      }}
                    >
                      <CommandInput placeholder="Buscar por código ou descrição…" />
                      <CommandList>
                        <CommandEmpty>Nenhum imóvel encontrado.</CommandEmpty>
                        <CommandGroup>
                          {form.imovel_id && (
                            <CommandItem
                              value="__limpar__"
                              onSelect={() => {
                                setForm({ ...form, imovel_id: null });
                                setImovelPopoverOpen(false);
                              }}
                            >
                              <span className="text-xs text-muted-foreground">Limpar seleção</span>
                            </CommandItem>
                          )}
                          {(imoveis.data ?? []).map((i) => {
                            const label = `${i.codigo ?? ""} ${i.descricao} ${i.endereco ?? ""}`.trim();
                            return (
                              <CommandItem
                                key={i.id}
                                value={label}
                                onSelect={() => {
                                  setForm({ ...form, imovel_id: i.id });
                                  setImovelPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    form.imovel_id === i.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="truncate">
                                  {i.codigo ? `${i.codigo} — ` : ""}{i.descricao}
                                </span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Pessoa</Label>
                <ComboboxSelect
                  value={form.pessoa_id}
                  onChange={(v) => setForm({ ...form, pessoa_id: v })}
                  options={(pessoas.data ?? []).map((p) => ({ value: p.id, label: p.nome }))}
                  placeholder="Selecione a pessoa"
                  searchPlaceholder="Buscar pessoa…"
                  emptyText="Nenhuma pessoa encontrada."
                  allowClear
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Centro de custo *</Label>
            <ComboboxSelect
              value={form.centro_custo_id || null}
              onChange={(v) => setForm({ ...form, centro_custo_id: v ?? "" })}
              options={(centros.data ?? []).map((c) => ({ value: c.id, label: c.nome }))}
              placeholder="Selecione"
              searchPlaceholder="Buscar centro de custo…"
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <ComboboxSelect
              value={form.categoria_id}
              onChange={(v) => setForm({ ...form, categoria_id: v })}
              options={(categorias.data ?? []).map((c) => ({ value: c.id, label: c.nome }))}
              placeholder="Opcional"
              searchPlaceholder="Buscar categoria…"
              allowClear
            />
          </div>

          <div className="space-y-2">
            <Label>Plano de conta</Label>
            <ComboboxSelect
              value={form.plano_conta_id}
              onChange={(v) => setForm({ ...form, plano_conta_id: v })}
              options={(planos.data ?? []).map((p) => ({ value: p.id, label: p.nome }))}
              placeholder="Opcional"
              searchPlaceholder="Buscar plano…"
              allowClear
            />
          </div>

          <div className="space-y-2">
            <Label>Conta bancária (previsão)</Label>
            <ComboboxSelect
              value={form.conta_bancaria_id}
              onChange={(v) => setForm({ ...form, conta_bancaria_id: v })}
              options={(contas.data ?? []).map((c) => ({ value: c.id, label: c.nome }))}
              placeholder="Opcional"
              searchPlaceholder="Buscar conta…"
              allowClear
            />
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
            <Label>Valor total (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Opcional"
              value={form.valor_total ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setForm({ ...form, valor_total: v === "" ? null : Number(v) });
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Este módulo é uma agenda de acompanhamento. O valor é opcional e pode variar a cada ocorrência.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Observação</Label>
            <Textarea
              value={form.observacao ?? ""}
              onChange={(e) => setForm({ ...form, observacao: e.target.value || null })}
              rows={2}
            />
          </div>

          {canEditCredenciais && (
          <div className="md:col-span-2 border rounded-md p-3 space-y-2">
            <Label className="text-sm">Credenciais / contato (opcional)</Label>
            <p className="text-xs text-muted-foreground">
              Visível apenas para editores/admins do módulo Despesas.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { k: "telefone", l: "Telefone" },
                { k: "site", l: "Site / link" },
                { k: "login", l: "Login" },
                { k: "senha", l: "Senha" },
                { k: "contato", l: "Contato" },
              ].map(({ k, l }) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{l}</Label>
                  <Input
                    type={k === "senha" ? "password" : "text"}
                    value={credenciais?.[k] ?? ""}
                    onChange={(e) => {
                      const next = { ...(credenciais ?? {}) };
                      if (e.target.value) next[k] = e.target.value;
                      else delete next[k];
                      setCredenciais(next);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          )}

          <div className="md:col-span-2">
            <DuplicidadeAlert
              valor={form.valor_total ?? 0}
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