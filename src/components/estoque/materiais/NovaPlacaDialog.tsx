import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TipoUso, Tamanho, TIPO_USO_LABELS, TAMANHO_LABELS } from "@/hooks/useEstoquePlacas";

const fromEstoque = (t: string) => supabase.from(t as any);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editingMaterial?: {
    id: string;
    nome: string;
    tipo_uso: TipoUso | null;
    tamanho: Tamanho | null;
    tamanho_outro: string | null;
    descricao: string | null;
    estoque_minimo: number;
    categoria_id: string | null;
  } | null;
}

interface CategoriaRow { id: string; nome: string; is_active: boolean; }

const buildNomePlaca = (tipoUso: TipoUso, tamanho: Tamanho, tamanhoOutro: string, variante: string) => {
  const tipo = tipoUso === "aluga" ? "Aluga" : "Venda";
  const medida = tamanho === "outro" ? tamanhoOutro.trim() : tamanho.toUpperCase();
  const base = `Placa ${tipo} ${medida}`.trim();
  const v = variante.trim();
  return v ? `${base} ${v}` : base;
};

/**
 * Extrai a "variante" do nome preservando texto extra além do padrão
 * "Placa <Venda|Aluga> <medida>". Ex.: "Placa Aluga 2x2 Lona" → "Lona".
 */
function extractVariante(nome: string, tipoUso: TipoUso | null, tamanho: Tamanho | null, tamanhoOutro: string | null): string {
  if (!nome || !tipoUso || !tamanho) return "";
  const tipo = tipoUso === "aluga" ? "Aluga" : "Venda";
  const medida = tamanho === "outro" ? (tamanhoOutro || "").trim() : tamanho.toUpperCase();
  const base = `Placa ${tipo} ${medida}`.trim();
  if (!base) return "";
  const lowerNome = nome.trim();
  const lowerBase = base.toLowerCase();
  if (lowerNome.toLowerCase().startsWith(lowerBase)) {
    return lowerNome.slice(base.length).trim();
  }
  return "";
}

export function NovaPlacaDialog({ open, onOpenChange, editingMaterial }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!editingMaterial;

  const [tipoUso, setTipoUso] = useState<TipoUso>("venda");
  const [tamanho, setTamanho] = useState<Tamanho>("1x1");
  const [tamanhoOutro, setTamanhoOutro] = useState("");
  const [variante, setVariante] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("none");
  const [estoqueMinimo, setEstoqueMinimo] = useState(0);
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editingMaterial) {
      const tu: TipoUso = editingMaterial.tipo_uso || "venda";
      const tm: Tamanho = editingMaterial.tamanho || "outro";
      const to = editingMaterial.tamanho_outro || "";
      setTipoUso(tu);
      setTamanho(tm);
      setTamanhoOutro(to);
      setVariante(extractVariante(editingMaterial.nome, tu, tm, to));
      setCategoriaId(editingMaterial.categoria_id || "none");
      setEstoqueMinimo(editingMaterial.estoque_minimo ?? 0);
      setObs(editingMaterial.descricao || "");
    } else {
      setTipoUso("venda"); setTamanho("1x1"); setTamanhoOutro("");
      setVariante(""); setCategoriaId("none"); setEstoqueMinimo(0); setObs("");
    }
  }, [open, editingMaterial]);

  const { data: categorias = [] } = useQuery({
    queryKey: ["estoque-categorias-nova-placa"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_categorias")
        .select("id, nome, is_active").eq("is_active", true).order("nome");
      if (error) throw error;
      return (data as unknown as CategoriaRow[]) || [];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (tamanho === "outro" && !tamanhoOutro.trim()) throw new Error("Especifique o tamanho");
      const nome = buildNomePlaca(tipoUso, tamanho, tamanhoOutro, variante);
      const categoriaNome = categoriaId === "none"
        ? null
        : categorias.find((c) => c.id === categoriaId)?.nome || null;

      if (isEdit && editingMaterial) {
        // Se o nome mudou, checar colisão com outro material
        if (nome.toLowerCase() !== editingMaterial.nome.toLowerCase()) {
          const { data: colisao, error: colErr } = await fromEstoque("estoque_materiais")
            .select("id")
            .ilike("nome", nome)
            .neq("id", editingMaterial.id)
            .limit(1)
            .maybeSingle();
          if (colErr) throw colErr;
          if (colisao) throw new Error(`Já existe outro material com o nome "${nome}"`);
        }
        const { error } = await fromEstoque("estoque_materiais")
          .update({
            nome,
            descricao: obs.trim() || null,
            categoria: categoriaNome,
            categoria_id: categoriaId === "none" ? null : categoriaId,
            estoque_minimo: estoqueMinimo,
            is_placa: true,
            tipo_uso: tipoUso,
            tamanho,
            tamanho_outro: tamanho === "outro" ? (tamanhoOutro.trim() || null) : null,
          } as any)
          .eq("id", editingMaterial.id);
        if (error) throw error;
        return;
      }

      const { data: existente, error: checkError } = await fromEstoque("estoque_materiais")
        .select("id, is_active")
        .ilike("nome", nome)
        .limit(1)
        .maybeSingle();
      if (checkError) throw checkError;
      if (existente) {
        const { error: updateError } = await fromEstoque("estoque_materiais")
          .update({
            is_active: true,
            is_placa: true,
            tipo_uso: tipoUso,
            tamanho,
            tamanho_outro: tamanho === "outro" ? (tamanhoOutro.trim() || null) : null,
          } as any)
          .eq("id", (existente as any).id);
        if (updateError) throw updateError;
        return;
      }

      const { error } = await fromEstoque("estoque_materiais").insert({
        nome,
        descricao: obs.trim() || null,
        unidade_medida: "un",
        categoria: categoriaNome,
        categoria_id: categoriaId === "none" ? null : categoriaId,
        estoque_minimo: estoqueMinimo,
        is_placa: true,
        is_active: true,
        tipo_uso: tipoUso,
        tamanho,
        tamanho_outro: tamanho === "outro" ? (tamanhoOutro.trim() || null) : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais-ativos"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais-placa"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos-placas"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos-check"] });
      toast.success(isEdit ? "Placa atualizada!" : "Material de placa cadastrado!");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || (isEdit ? "Erro ao atualizar placa" : "Erro ao cadastrar material de placa")),
  });

  const podeSalvar =
    (tamanho !== "outro" || !!tamanhoOutro.trim());

  const nomePreview = tamanho === "outro" && !tamanhoOutro.trim()
    ? "Placa Venda/Aluga ..."
    : buildNomePlaca(tipoUso, tamanho, tamanhoOutro, variante);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Placa" : "Nova Placa"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Ajuste os atributos da placa. O nome é recalculado a partir de Tipo de uso, Tamanho e Variante."
              : <>Cadastre a placa como material. Depois registre o saldo na aba <strong>Saldos</strong> para ela aparecer na aba <strong>Placas</strong>.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            {isEdit ? "Novo nome:" : "Nome que será cadastrado:"} <strong>{nomePreview}</strong>
            {isEdit && editingMaterial && editingMaterial.nome !== nomePreview && (
              <div className="mt-1 text-xs text-muted-foreground">
                (Nome atual: <em>{editingMaterial.nome}</em>)
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de uso *</Label>
              <Select value={tipoUso} onValueChange={(v) => setTipoUso(v as TipoUso)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_USO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tamanho *</Label>
              <Select value={tamanho} onValueChange={(v) => setTamanho(v as Tamanho)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TAMANHO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tamanho === "outro" && (
            <div className="space-y-2">
              <Label>Especifique o tamanho *</Label>
              <Input value={tamanhoOutro} onChange={(e) => setTamanhoOutro(e.target.value)} maxLength={30} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Variante / material da placa (opcional)</Label>
            <Input
              value={variante}
              onChange={(e) => setVariante(e.target.value)}
              maxLength={30}
              placeholder="Ex.: Lona, PVC, MDF"
            />
            <p className="text-xs text-muted-foreground">
              Aparece no final do nome, para diferenciar placas do mesmo tipo e tamanho.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Estoque mínimo</Label>
            <Input
              type="number"
              min={0}
              value={estoqueMinimo}
              onChange={(e) => setEstoqueMinimo(parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição/observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!podeSalvar || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Salvar alterações" : "Cadastrar material"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}