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
import { useSystemAccess } from "@/hooks/useSystemAccess";
import { TipoUso, Tamanho, TIPO_USO_LABELS, TAMANHO_LABELS } from "@/hooks/useEstoquePlacas";

const fromEstoque = (t: string) => supabase.from(t as any);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface MaterialPlacaRow { id: string; nome: string; is_placa: boolean; is_active: boolean; }
interface LocalRow { id: string; nome: string; is_active: boolean; }

export function NovaPlacaDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { user } = useSystemAccess();

  const [codigo, setCodigo] = useState("");
  const [tipoUso, setTipoUso] = useState<TipoUso>("venda");
  const [tamanho, setTamanho] = useState<Tamanho>("1x1");
  const [tamanhoOutro, setTamanhoOutro] = useState("");
  const [localId, setLocalId] = useState("");
  const [obs, setObs] = useState("");
  const [codigoCheck, setCodigoCheck] = useState<"ok" | "duplicado" | "vazio">("vazio");

  useEffect(() => {
    if (open) {
      setCodigo(""); setTipoUso("venda"); setTamanho("1x1"); setTamanhoOutro("");
      setLocalId(""); setObs(""); setCodigoCheck("vazio");
    }
  }, [open]);

  // Material com is_placa=true (ou fallback por nome)
  const { data: materialPlaca, isLoading: loadingMat } = useQuery({
    queryKey: ["estoque-material-placa"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_materiais")
        .select("id, nome, is_placa, is_active")
        .eq("is_active", true);
      if (error) throw error;
      const rows = (data as unknown as MaterialPlacaRow[]) || [];
      const flagged = rows.find((m) => m.is_placa);
      if (flagged) return flagged;
      // Fallback: nome começa com "placa"
      return rows.find((m) => m.nome.toLowerCase().startsWith("placa")) || null;
    },
    enabled: open,
  });

  const { data: locais = [] } = useQuery({
    queryKey: ["estoque-locais-nova-placa"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_locais_armazenamento")
        .select("id, nome, is_active").eq("is_active", true).order("nome");
      if (error) throw error;
      return (data as unknown as LocalRow[]) || [];
    },
    enabled: open,
  });

  // Verifica duplicidade do código com debounce simples
  useEffect(() => {
    const c = codigo.trim();
    if (!c) { setCodigoCheck("vazio"); return; }
    let cancelled = false;
    const t: ReturnType<typeof setTimeout> = setTimeout(async () => {
      const { data } = await fromEstoque("estoque_placas")
        .select("id").eq("codigo", c).limit(1).maybeSingle();
      if (cancelled) return;
      setCodigoCheck(data ? "duplicado" : "ok");
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [codigo]);

  const mutation = useMutation({
    mutationFn: async () => {
      const c = codigo.trim();
      if (!c) throw new Error("Código obrigatório");
      if (c.length > 30) throw new Error("Código muito longo (máx 30 caracteres)");
      if (!materialPlaca) {
        throw new Error("Nenhum material marcado como 'Placa'. Edite o material em /estoque/materiais ou rode a migration.");
      }
      if (!localId) throw new Error("Local de armazenamento obrigatório");
      if (tamanho === "outro" && !tamanhoOutro.trim()) throw new Error("Especifique o tamanho");

      // Dupla verificação no servidor
      const { data: existente } = await fromEstoque("estoque_placas")
        .select("id, status").eq("codigo", c).limit(1).maybeSingle();
      if (existente) throw new Error(`Código "${c}" já existe no sistema. Códigos de placa são únicos.`);

      const { data: nova, error } = await fromEstoque("estoque_placas").insert({
        codigo: c,
        material_id: materialPlaca.id,
        tipo_uso: tipoUso,
        tamanho,
        tamanho_outro: tamanho === "outro" ? tamanhoOutro.trim() : null,
        local_armazenamento_id: localId,
        status: "disponivel",
        observacoes: obs.trim() || null,
        created_by: user?.id,
      } as any).select("id").single();
      if (error) throw error;

      await fromEstoque("estoque_placas_historico").insert({
        placa_id: (nova as any).id,
        tipo: "criacao",
        data_evento: new Date().toISOString().slice(0, 10),
        observacoes: obs.trim() || null,
        user_id: user?.id,
      } as any);

      await fromEstoque("estoque_movimentacoes").insert({
        material_id: materialPlaca.id,
        tipo: "entrada",
        quantidade: 1,
        local_destino_id: localId,
        responsavel_user_id: user?.id,
        observacoes: `Nova placa cadastrada: ${c}`,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-placas"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos-check"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
      toast.success("Placa cadastrada no estoque!");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao cadastrar placa"),
  });

  const podeSalvar =
    !!materialPlaca &&
    !!codigo.trim() &&
    codigoCheck !== "duplicado" &&
    !!localId &&
    (tamanho !== "outro" || !!tamanhoOutro.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Placa</DialogTitle>
          <DialogDescription>
            Pré-cadastra um código de placa para uso futuro. O código deve ser único no sistema.
            <br />
            <span className="text-xs">
              Este cadastro <strong>não altera o saldo</strong> — o saldo é controlado em
              <strong> /estoque/saldos</strong>. A baixa só acontece quando a placa é instalada em um imóvel.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {loadingMat ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando material...
            </div>
          ) : !materialPlaca ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              Nenhum material está marcado como "Placa". Vá em <strong>/estoque/materiais</strong>, edite
              o material correspondente e marque a flag <em>is_placa</em>, ou execute a migration de ajustes.
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Material vinculado: <strong>{materialPlaca.nome}</strong>
            </div>
          )}

          <div className="space-y-2">
            <Label>Código da placa *</Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              maxLength={30}
              placeholder="Ex: P-1234"
            />
            {codigoCheck === "duplicado" && (
              <p className="text-xs text-destructive">Este código já está cadastrado.</p>
            )}
            {codigoCheck === "ok" && (
              <p className="text-xs text-green-600">Código disponível.</p>
            )}
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
            <Label>Local de armazenamento *</Label>
            <Select value={localId} onValueChange={setLocalId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {locais.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!podeSalvar || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cadastrar placa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}