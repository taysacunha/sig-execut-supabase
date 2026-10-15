import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComboboxSelect } from "@/components/ui/combobox-select";
import {
  LinhaTelefonica, LinhasLookup, formatarTelefone, useSaveLinha,
} from "@/hooks/useDespesasLinhas";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  linha: LinhaTelefonica | null;
  lookup: LinhasLookup;
  onOpened?: () => void;
  existentes?: LinhaTelefonica[];
}

const vazio = {
  tipo: "celular", numero: "", operadora_id: "", empresa_contratada: "", empresa_pessoa_id: "", unidade_id: "",
  setor_id: "", responsavel_id: "", valor_contratado: "", tipo_valor: "individual",
  capacidade_internet: "", modelo_aparelho: "", observacoes: "", centro_custo_id: "",
};

export function LinhaDialog({ open, onOpenChange, linha, lookup, onOpened, existentes = [] }: Props) {
  const [f, setF] = useState<Record<string, string>>(vazio);
  const save = useSaveLinha();
  const set = (k: string, v: string | null) => setF((p) => ({ ...p, [k]: v ?? "" }));

  useEffect(() => {
    if (!open) return;
    onOpened?.();
    setF(linha ? Object.fromEntries(Object.entries({ ...vazio, ...linha }).map(([k, v]) => [k, v == null ? "" : String(v)])) : vazio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, linha]);

  const celular = f.tipo === "celular";
  const setores = lookup.setores.filter((s) => !f.unidade_id || !s.unidade_id || s.unidade_id === f.unidade_id);
  const operadoras = lookup.operadoras.filter((o) => o.is_active || o.id === f.operadora_id);
  const digitos = f.numero.replace(/\D/g, "");

  async function salvar() {
    if (digitos.length < 10) return toast.error("Informe o número com DDD (10 ou 11 dígitos).");
    if (!f.operadora_id) return toast.error("Selecione a operadora.");
    if (!f.unidade_id) return toast.error("Selecione a unidade instalada.");
    const valor = f.valor_contratado ? Number(f.valor_contratado.replace(",", ".")) : null;
    if (valor != null && (isNaN(valor) || valor < 0)) return toast.error("Valor contratado inválido.");
    const dup = existentes.find((x) => x.id !== linha?.id && x.numero.replace(/\D/g, "") === digitos);
    if (dup) return toast.error(`Já existe uma linha cadastrada com o número ${dup.numero}.`);
    const emp = lookup.empresas.find((e) => e.id === f.empresa_pessoa_id);
    try {
      await save.mutateAsync({
        id: linha?.id,
        tipo: f.tipo as any,
        numero: formatarTelefone(f.numero),
        operadora_id: f.operadora_id,
        empresa_pessoa_id: f.empresa_pessoa_id || null,
        empresa_contratada: emp ? emp.nome : (f.empresa_pessoa_id ? f.empresa_contratada || null : null),
        unidade_id: f.unidade_id,
        setor_id: f.setor_id || null,
        responsavel_id: f.responsavel_id || null,
        valor_contratado: valor,
        tipo_valor: valor != null ? (f.tipo_valor as any) : null,
        capacidade_internet: celular ? f.capacidade_internet.trim() || null : null,
        modelo_aparelho: celular ? f.modelo_aparelho.trim() || null : null,
        observacoes: f.observacoes.trim() || null,
        centro_custo_id: f.centro_custo_id || null,
        ...(linha ? {} : { situacao: "ativa" as const }),
      });
      toast.success(linha ? "Linha atualizada" : "Linha cadastrada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar a linha");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{linha ? "Editar linha telefônica" : "Nova linha telefônica"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2 px-1 min-w-0">
          <div className="space-y-2 min-w-0">
            <Label>Tipo *</Label>
            <Select value={f.tipo} onValueChange={(v) => set("tipo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="celular">Celular</SelectItem>
                <SelectItem value="fixo">Fixo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 min-w-0">
            <Label>Número *</Label>
            <Input value={f.numero} onChange={(e) => set("numero", formatarTelefone(e.target.value))} placeholder="(83) 99999-9999" inputMode="numeric" />
          </div>
          <div className="space-y-2 min-w-0">
            <Label>Operadora *</Label>
            <ComboboxSelect options={operadoras.map((o) => ({ value: o.id, label: o.nome }))} value={f.operadora_id} onChange={(v) => set("operadora_id", v)} placeholder="Selecione" emptyText="Cadastre operadoras em Cadastros > Operadoras" />
          </div>
          <div className="space-y-2 min-w-0">
            <Label>Empresa contratada</Label>
            <ComboboxSelect options={lookup.empresas.map((e) => ({ value: e.id, label: e.cpf_cnpj ? `${e.nome} (${e.cpf_cnpj})` : e.nome }))} value={f.empresa_pessoa_id} onChange={(v) => set("empresa_pessoa_id", v)} placeholder="Selecione a pessoa jurídica" emptyText="Cadastre a empresa em Cadastros > Pessoas (Pessoa Jurídica)" allowClear />
          </div>
          <div className="space-y-2 min-w-0">
            <Label>Unidade instalada *</Label>
            <ComboboxSelect options={lookup.unidades.map((u) => ({ value: u.id, label: u.nome }))} value={f.unidade_id} onChange={(v) => { set("unidade_id", v); set("setor_id", null); }} placeholder="Selecione" />
          </div>
          <div className="space-y-2 min-w-0">
            <Label>Setor</Label>
            <ComboboxSelect options={setores.map((s) => ({ value: s.id, label: s.nome }))} value={f.setor_id} onChange={(v) => set("setor_id", v)} placeholder="Selecione" allowClear />
          </div>
          <div className="space-y-2 min-w-0">
            <Label>Pessoa responsável</Label>
            <ComboboxSelect options={lookup.colaboradores.map((c) => ({ value: c.id, label: c.nome }))} value={f.responsavel_id} onChange={(v) => set("responsavel_id", v)} placeholder="Opcional" allowClear />
          </div>
          <div className="space-y-2 min-w-0">
            <Label>Centro de custo</Label>
            <ComboboxSelect options={lookup.centros.map((c) => ({ value: c.id, label: c.nome }))} value={f.centro_custo_id} onChange={(v) => set("centro_custo_id", v)} placeholder="Opcional" allowClear />
          </div>
          <div className="space-y-2 min-w-0">
            <Label>Valor contratado (R$)</Label>
            <Input value={f.valor_contratado} onChange={(e) => set("valor_contratado", e.target.value.replace(/[^\d.,]/g, ""))} placeholder="Opcional" inputMode="decimal" />
          </div>
          <div className="space-y-2 min-w-0">
            <Label>Valor é</Label>
            <Select value={f.tipo_valor || "individual"} onValueChange={(v) => set("tipo_valor", v)} disabled={!f.valor_contratado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual (só desta linha)</SelectItem>
                <SelectItem value="global">Global (plano com várias linhas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {celular && (
            <>
              <div className="space-y-2 min-w-0">
                <Label>Capacidade de internet</Label>
                <Input value={f.capacidade_internet} onChange={(e) => set("capacidade_internet", e.target.value)} placeholder="Ex.: 20 GB" maxLength={60} />
              </div>
              <div className="space-y-2 min-w-0">
                <Label>Modelo do aparelho</Label>
                <Input value={f.modelo_aparelho} onChange={(e) => set("modelo_aparelho", e.target.value)} placeholder="Ex.: Samsung A15" maxLength={120} />
              </div>
            </>
          )}
          <div className="space-y-2 sm:col-span-2 min-w-0">
            <Label>Observações</Label>
            <Textarea value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} maxLength={1000} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
