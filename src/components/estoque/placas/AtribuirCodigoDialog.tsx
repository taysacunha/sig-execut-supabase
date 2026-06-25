import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { Placa, TIPO_USO_LABELS, formatPlacaTamanho } from "@/hooks/useEstoquePlacas";

const fromEstoque = (t: string) => supabase.from(t as any);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  placa: Placa | null;
  materialNome: string;
  localNome: string;
}

export function AtribuirCodigoDialog({ open, onOpenChange, placa, materialNome, localNome }: Props) {
  const queryClient = useQueryClient();
  const { user } = useSystemAccess();
  const [codigo, setCodigo] = useState("");
  const [check, setCheck] = useState<"ok" | "duplicado" | "vazio">("vazio");

  useEffect(() => { if (open) { setCodigo(""); setCheck("vazio"); } }, [open]);

  useEffect(() => {
    const c = codigo.trim();
    if (!c) { setCheck("vazio"); return; }
    let cancelled = false;
    const t: ReturnType<typeof setTimeout> = setTimeout(async () => {
      const { data } = await fromEstoque("estoque_placas")
        .select("id").eq("codigo", c).limit(1).maybeSingle();
      if (cancelled) return;
      setCheck(data ? "duplicado" : "ok");
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [codigo]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!placa) throw new Error("Placa inválida");
      const c = codigo.trim();
      if (!c) throw new Error("Informe o código");
      if (c.length > 30) throw new Error("Código muito longo (máx 30)");

      const { data: existente } = await fromEstoque("estoque_placas")
        .select("id").eq("codigo", c).limit(1).maybeSingle();
      if (existente) throw new Error(`Código "${c}" já existe.`);

      const { error } = await fromEstoque("estoque_placas")
        .update({ codigo: c } as any).eq("id", placa.id);
      if (error) throw error;

      await fromEstoque("estoque_placas_historico").insert({
        placa_id: placa.id,
        tipo: "criacao",
        data_evento: new Date().toISOString().slice(0, 10),
        observacoes: "Código atribuído posteriormente",
        user_id: user?.id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-placas"] });
      toast.success("Código atribuído!");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atribuir código"),
  });

  if (!placa) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir código à placa</DialogTitle>
          <DialogDescription>
            Defina o código de identificação desta unidade física.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">Material:</span> <strong>{materialNome}</strong></div>
            <div><span className="text-muted-foreground">Tipo:</span> {TIPO_USO_LABELS[placa.tipo_uso]} · {formatPlacaTamanho(placa.tamanho, placa.tamanho_outro)}</div>
            <div><span className="text-muted-foreground">Local:</span> {localNome}</div>
          </div>

          <div className="space-y-2">
            <Label>Novo código *</Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              maxLength={30}
              placeholder="Ex: P-1234"
              autoFocus
            />
            {check === "duplicado" && (
              <p className="text-xs text-destructive">Este código já está cadastrado.</p>
            )}
            {check === "ok" && (
              <p className="text-xs text-green-600">Código disponível.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={mutation.isPending || !codigo.trim() || check === "duplicado"}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar código
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}