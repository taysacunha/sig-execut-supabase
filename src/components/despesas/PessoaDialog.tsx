import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Pessoa, PessoaInput, PapelPessoa, PAPEIS_PESSOA, useSavePessoa,
  buscarPessoasPorCpfCnpj, labelPapel,
} from "@/hooks/useDespesasPessoas";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Pessoa | null;
  papelPreSelecionado?: PapelPessoa;
  onSaved?: (id: string) => void;
}

export function PessoaDialog({ open, onOpenChange, editing, papelPreSelecionado, onSaved }: Props) {
  const saveMut = useSavePessoa();

  const empty = (): PessoaInput => ({
    nome: "",
    tipo_pessoa: "fisica",
    cpf_cnpj: null,
    oab: null,
    creci: null,
    papeis: papelPreSelecionado ? [papelPreSelecionado] : [],
    email: null,
    telefone: null,
    observacao: null,
    papel_outro_descricao: null,
  });

  const [form, setForm] = useState<PessoaInput>(empty());
  const [duplicatas, setDuplicatas] = useState<Awaited<ReturnType<typeof buscarPessoasPorCpfCnpj>>>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checando, setChecando] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const { id: _i, created_at: _c, updated_at: _u, is_active: _a, ...rest } = editing;
      setForm(rest);
    } else {
      setForm(empty());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, papelPreSelecionado]);

  const togglePapel = (p: PapelPessoa) => {
    setForm((f) => ({
      ...f,
      papeis: f.papeis.includes(p) ? f.papeis.filter((x) => x !== p) : [...f.papeis, p],
    }));
  };

  const outroSelecionado = form.papeis.includes("outro");
  const outroDescricaoOk = !outroSelecionado
    || (form.papel_outro_descricao?.trim().length ?? 0) >= 2;
  const podeSalvar =
    form.nome.trim().length > 0 && form.papeis.length > 0 && outroDescricaoOk;

  async function persistir() {
    try {
      const id = await saveMut.mutateAsync({ id: editing?.id, input: form });
      toast.success(editing ? "Pessoa atualizada" : "Pessoa criada");
      onSaved?.(id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  }

  async function salvar() {
    const norm = form.cpf_cnpj?.replace(/\D/g, "") || "";
    if (!norm) return persistir();
    setChecando(true);
    try {
      const dups = await buscarPessoasPorCpfCnpj(norm, editing?.id);
      if (dups.length > 0) {
        setDuplicatas(dups);
        setConfirmOpen(true);
        return;
      }
      await persistir();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao verificar duplicidade");
    } finally {
      setChecando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2 py-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.tipo_pessoa} onValueChange={(v: "fisica" | "juridica") => setForm({ ...form, tipo_pessoa: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fisica">Pessoa física</SelectItem>
                <SelectItem value="juridica">Pessoa jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{form.tipo_pessoa === "juridica" ? "CNPJ" : "CPF"}</Label>
            <Input
              value={form.cpf_cnpj ?? ""}
              onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value || null })}
              maxLength={20}
              placeholder="Somente números"
            />
          </div>
          <div className="space-y-2">
            <Label>OAB</Label>
            <Input value={form.oab ?? ""} onChange={(e) => setForm({ ...form, oab: e.target.value || null })} maxLength={30} />
          </div>
          <div className="space-y-2">
            <Label>CRECI</Label>
            <Input value={form.creci ?? ""} onChange={(e) => setForm({ ...form, creci: e.target.value || null })} maxLength={30} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value || null })} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value || null })} maxLength={30} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Papéis *</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 rounded-md border p-3">
              {PAPEIS_PESSOA.map((p) => (
                <label key={p.v} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={form.papeis.includes(p.v)}
                    onCheckedChange={() => togglePapel(p.v)}
                  />
                  {p.l}
                </label>
              ))}
            </div>
            {form.papeis.length === 0 && (
              <p className="text-xs text-muted-foreground">Selecione ao menos um papel.</p>
            )}
            {outroSelecionado && (
              <div className="space-y-1 pt-1">
                <Label>Descrição do papel "Outro" *</Label>
                <Input
                  value={form.papel_outro_descricao ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, papel_outro_descricao: e.target.value || null })
                  }
                  maxLength={120}
                  placeholder="Descreva o papel desta pessoa"
                />
                {!outroDescricaoOk && (
                  <p className="text-xs text-muted-foreground">
                    Informe uma descrição com pelo menos 2 caracteres.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Observação</Label>
            <Textarea rows={2} value={form.observacao ?? ""} onChange={(e) => setForm({ ...form, observacao: e.target.value || null })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!podeSalvar || saveMut.isPending}>
            {saveMut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}