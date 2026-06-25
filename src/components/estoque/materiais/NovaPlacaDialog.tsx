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
}

interface CategoriaRow { id: string; nome: string; is_active: boolean; }

const buildNomePlaca = (tipoUso: TipoUso, tamanho: Tamanho, tamanhoOutro: string) => {
  const tipo = tipoUso === "aluga" ? "Aluga" : "Venda";
  const medida = tamanho === "outro" ? tamanhoOutro.trim() : tamanho.toUpperCase();
  return `Placa ${tipo} ${medida}`.trim();
};

export function NovaPlacaDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const [tipoUso, setTipoUso] = useState<TipoUso>("venda");
  const [tamanho, setTamanho] = useState<Tamanho>("1x1");
  const [tamanhoOutro, setTamanhoOutro] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("none");
  const [estoqueMinimo, setEstoqueMinimo] = useState(0);
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (open) {
      setTipoUso("venda"); setTamanho("1x1"); setTamanhoOutro("");
      setCategoriaId("none"); setEstoqueMinimo(0); setObs("");
    }
  }, [open]);

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
      const nome = buildNomePlaca(tipoUso, tamanho, tamanhoOutro);

      const { data: existente, error: checkError } = await fromEstoque("estoque_materiais")
        .select("id, is_active")
        .ilike("nome", nome)
        .limit(1)
        .maybeSingle();
      if (checkError) throw checkError;
      if (existente) {
        const { error: updateError } = await fromEstoque("estoque_materiais")
          .update({ is_active: true, is_placa: true } as any)
          .eq("id", (existente as any).id);
        if (updateError) throw updateError;
        return;
      }

      const categoriaNome = categoriaId === "none"
        ? null
        : categorias.find((c) => c.id === categoriaId)?.nome || null;

      const { error } = await fromEstoque("estoque_materiais").insert({
        nome,
        descricao: obs.trim() || null,
        unidade_medida: "un",
        categoria: categoriaNome,
        categoria_id: categoriaId === "none" ? null : categoriaId,
        estoque_minimo: estoqueMinimo,
        is_placa: true,
        is_active: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais-ativos"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais-placa"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos-check"] });
      toast.success("Material de placa cadastrado!");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao cadastrar material de placa"),
  });

  const podeSalvar =
    (tamanho !== "outro" || !!tamanhoOutro.trim());

  const nomePreview = tamanho === "outro" && !tamanhoOutro.trim()
    ? "Placa Venda/Aluga ..."
    : buildNomePlaca(tipoUso, tamanho, tamanhoOutro);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Placa</DialogTitle>
          <DialogDescription>
            Cadastre a placa como material. Depois registre o saldo na aba <strong>Saldos</strong> para ela aparecer na aba <strong>Placas</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            Nome que será cadastrado: <strong>{nomePreview}</strong>
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
            Cadastrar material
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}