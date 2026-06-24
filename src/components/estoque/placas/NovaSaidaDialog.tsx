import { useEffect, useMemo, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MaterialCombobox } from "@/components/estoque/MaterialCombobox";
import { useSystemAccess } from "@/hooks/useSystemAccess";
import {
  Placa, TipoUso, Tamanho, TIPO_USO_LABELS, TAMANHO_LABELS, usePlacas, inferPlacaAttributes,
} from "@/hooks/useEstoquePlacas";

const fromEstoque = (t: string) => supabase.from(t as any);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface LocalRow { id: string; nome: string; }
interface SaldoRow { id: string; material_id: string; local_armazenamento_id: string; quantidade: number; }
interface MaterialPlacaRow { id: string; nome: string; is_placa: boolean; is_active: boolean; }

type Modo = "existente" | "novo";

export function NovaSaidaDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { user } = useSystemAccess();

  const [materialId, setMaterialId] = useState("");
  const [localId, setLocalId] = useState("");
  const [tipoUso, setTipoUso] = useState<TipoUso>("venda");
  const [tamanho, setTamanho] = useState<Tamanho>("1x1");
  const [tamanhoOutro, setTamanhoOutro] = useState("");
  const [modo, setModo] = useState<Modo>("existente");
  const [placaId, setPlacaId] = useState("");
  const [novoCodigo, setNovoCodigo] = useState("");
  const [codigoCheck, setCodigoCheck] = useState<"ok" | "duplicado" | "vazio">("vazio");
  const [imovel, setImovel] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (open) {
      setMaterialId(""); setLocalId(""); setTipoUso("venda"); setTamanho("1x1"); setTamanhoOutro("");
      setModo("existente"); setPlacaId(""); setNovoCodigo(""); setCodigoCheck("vazio");
      setImovel(""); setData(new Date().toISOString().slice(0, 10)); setObs("");
    }
  }, [open]);

  const syncAttributesFromMaterial = (material: MaterialPlacaRow | undefined) => {
    if (!material) return;
    const attrs = inferPlacaAttributes(material.nome);
    setTipoUso(attrs.tipo_uso);
    setTamanho(attrs.tamanho);
    setTamanhoOutro(attrs.tamanho_outro || "");
    setPlacaId("");
  };

  const { data: locais = [] } = useQuery({
    queryKey: ["estoque-locais-nova-saida"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_locais_armazenamento")
        .select("id, nome").eq("is_active", true).order("nome");
      if (error) throw error;
      return (data as unknown as LocalRow[]) || [];
    },
    enabled: open,
  });

  const { data: materiaisPlaca = [] } = useQuery({
    queryKey: ["estoque-materiais-placa"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_materiais")
        .select("id, nome, is_placa, is_active")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      const rows = (data as unknown as MaterialPlacaRow[]) || [];
      return rows.filter((m) => m.is_placa || m.nome.toLowerCase().startsWith("placa"));
    },
    enabled: open,
  });

  const materialSelecionado = useMemo(
    () => materiaisPlaca.find((m) => m.id === materialId),
    [materiaisPlaca, materialId]
  );

  const { data: saldos = [] } = useQuery({
    queryKey: ["estoque-saldos-nova-saida"],
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_saldos")
        .select("id, material_id, local_armazenamento_id, quantidade");
      if (error) throw error;
      return (data as unknown as SaldoRow[]) || [];
    },
    enabled: open,
  });

  const { data: placas = [] } = usePlacas();

  const saldoLocal = useMemo(() => {
    if (!localId || !materialId) return 0;
    return saldos.find((s) => s.material_id === materialId && s.local_armazenamento_id === localId)?.quantidade ?? 0;
  }, [saldos, localId, materialId]);

  const saldoSelecionado = useMemo(() => {
    if (!localId || !materialId) return null;
    return saldos.find((s) => s.material_id === materialId && s.local_armazenamento_id === localId) || null;
  }, [saldos, localId, materialId]);

  const disponiveis = useMemo(() => {
    return placas.filter((p) =>
      p.status === "disponivel"
      && p.material_id === materialId
      && (!localId || p.local_armazenamento_id === localId)
      && p.tipo_uso === tipoUso
      && p.tamanho === tamanho
    );
  }, [placas, materialId, localId, tipoUso, tamanho]);

  const placaSelecionada = useMemo(
    () => placas.find((p) => p.id === placaId) || null,
    [placas, placaId]
  );
  const precisaAtribuirCodigo = modo === "existente" && !!placaSelecionada && !placaSelecionada.codigo;

  useEffect(() => {
    const precisa = modo === "novo" || precisaAtribuirCodigo;
    if (!precisa) { setCodigoCheck("vazio"); return; }
    const c = novoCodigo.trim();
    if (!c) { setCodigoCheck("vazio"); return; }
    let cancelled = false;
    const t: ReturnType<typeof setTimeout> = setTimeout(async () => {
      const { data } = await fromEstoque("estoque_placas")
        .select("id").eq("codigo", c).limit(1).maybeSingle();
      if (cancelled) return;
      setCodigoCheck(data ? "duplicado" : "ok");
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [novoCodigo, modo, precisaAtribuirCodigo]);

  const mutation = useMutation({
    mutationFn: async () => {
      const imv = imovel.trim();
      if (!materialId || !materialSelecionado) throw new Error("Selecione o material da placa");
      if (!localId) throw new Error("Selecione o local de armazenamento");
      if (!imv) throw new Error("Código do imóvel obrigatório");
      if (imv.length > 30) throw new Error("Código do imóvel muito longo (máx 30)");
      if (saldoLocal <= 0) throw new Error("Saldo zerado neste local. Lance entrada em /estoque/saldos antes.");
      if (!saldoSelecionado) throw new Error("Saldo não encontrado para este material/local");

      let placa: Placa | null = null;

      if (modo === "existente") {
        if (!placaId) throw new Error("Selecione uma placa disponível ou crie um novo código");
        const found = placas.find((p) => p.id === placaId);
        if (!found) throw new Error("Placa não encontrada");
        if (found.status !== "disponivel") throw new Error("Placa não está mais disponível");
        placa = found;

        const updatePayload: any = {
          status: "instalada",
          imovel_codigo_atual: imv,
          data_instalacao_atual: data,
        };

        if (!found.codigo) {
          const c = novoCodigo.trim();
          if (!c) throw new Error("Informe o código da placa para atribuir nesta saída");
          if (c.length > 30) throw new Error("Código muito longo (máx 30 caracteres)");
          const { data: existente } = await fromEstoque("estoque_placas")
            .select("id").eq("codigo", c).limit(1).maybeSingle();
          if (existente) throw new Error(`Código "${c}" já existe.`);
          updatePayload.codigo = c;
          placa = { ...found, codigo: c };
        }

        const { error } = await fromEstoque("estoque_placas").update(updatePayload).eq("id", placa.id);
        if (error) throw error;
      } else {
        const c = novoCodigo.trim();
        if (!c) throw new Error("Informe o novo código");
        if (c.length > 30) throw new Error("Código muito longo (máx 30 caracteres)");
        if (tamanho === "outro" && !tamanhoOutro.trim()) throw new Error("Especifique o tamanho");

        const { data: existente } = await fromEstoque("estoque_placas")
          .select("id").eq("codigo", c).limit(1).maybeSingle();
        if (existente) throw new Error(`Código "${c}" já existe.`);

        const { data: nova, error } = await fromEstoque("estoque_placas").insert({
          codigo: c,
          material_id: materialId,
          tipo_uso: tipoUso,
          tamanho,
          tamanho_outro: tamanho === "outro" ? tamanhoOutro.trim() : null,
          local_armazenamento_id: localId,
          status: "instalada",
          imovel_codigo_atual: imv,
          data_instalacao_atual: data,
          observacoes: obs.trim() || null,
          created_by: user?.id,
        } as any).select("*").single();
        if (error) throw error;
        placa = nova as unknown as Placa;

        await fromEstoque("estoque_placas_historico").insert({
          placa_id: placa.id,
          tipo: "criacao",
          data_evento: data,
          observacoes: `Código criado já na saída para imóvel ${imv}`,
          user_id: user?.id,
        } as any);
      }

      const novaQuantidade = saldoSelecionado.quantidade - 1;
      if (novaQuantidade <= 0) {
        const { error } = await fromEstoque("estoque_saldos").delete().eq("id", saldoSelecionado.id);
        if (error) throw error;
      } else {
        const { error } = await fromEstoque("estoque_saldos")
          .update({ quantidade: novaQuantidade } as any)
          .eq("id", saldoSelecionado.id);
        if (error) throw error;
      }

      await fromEstoque("estoque_placas_historico").insert({
        placa_id: placa!.id,
        tipo: "instalacao",
        imovel_codigo: imv,
        data_evento: data,
        observacoes: obs.trim() || null,
        user_id: user?.id,
      } as any);

      await fromEstoque("estoque_movimentacoes").insert({
        material_id: placa!.material_id,
        tipo: "saida",
        quantidade: 1,
        local_origem_id: placa!.local_armazenamento_id,
        responsavel_user_id: user?.id,
        observacoes: `Placa ${placa!.codigo ?? "(sem código)"} instalada no imóvel ${imv}`,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-placas"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos-check"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos-nova-saida"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
      toast.success("Placa instalada no imóvel!");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao registrar saída"),
  });

  const podeSalvar =
    !!localId
    && !!materialId
    && saldoLocal > 0
    && !!imovel.trim()
    && (modo === "existente"
        ? !!placaId && (!precisaAtribuirCodigo || (!!novoCodigo.trim() && codigoCheck !== "duplicado"))
        : !!novoCodigo.trim() && codigoCheck !== "duplicado" && (tamanho !== "outro" || !!tamanhoOutro.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova saída para imóvel</DialogTitle>
          <DialogDescription>
            Escolha o material da placa e o local. A saída consome 1 unidade do saldo cadastrado em /estoque/saldos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label>Material da placa *</Label>
            <MaterialCombobox
              materiais={materiaisPlaca}
              value={materialId}
              onChange={(id) => {
                setMaterialId(id);
                setLocalId("");
                setPlacaId("");
                syncAttributesFromMaterial(materiaisPlaca.find((m) => m.id === id));
              }}
              placeholder="Selecione o material-placa"
              emptyMessage="Nenhum material de placa ativo encontrado. Cadastre em /estoque/materiais."
            />
          </div>

          <div className="space-y-2">
            <Label>Local de armazenamento *</Label>
            <Select value={localId} onValueChange={(v) => { setLocalId(v); setPlacaId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {locais.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {localId && (
              <p className={`text-xs ${saldoLocal > 0 ? "text-muted-foreground" : "text-destructive"}`}>
                Saldo disponível deste material neste local: <strong>{saldoLocal}</strong>
                {saldoLocal === 0 && " — lance entrada em /estoque/saldos antes."}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de uso *</Label>
              <Select value={tipoUso} onValueChange={(v) => { setTipoUso(v as TipoUso); setPlacaId(""); }}>
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
              <Select value={tamanho} onValueChange={(v) => { setTamanho(v as Tamanho); setPlacaId(""); }}>
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
            <Label>Código da placa *</Label>
            <RadioGroup value={modo} onValueChange={(v) => setModo(v as Modo)} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existente" id="modo-existente" />
                <Label htmlFor="modo-existente" className="cursor-pointer text-sm font-normal">
                  Selecionar disponível ({disponiveis.length})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="novo" id="modo-novo" />
                <Label htmlFor="modo-novo" className="cursor-pointer text-sm font-normal">
                  Criar novo código
                </Label>
              </div>
            </RadioGroup>

            {modo === "existente" ? (
              <>
              <Select value={placaId} onValueChange={setPlacaId} disabled={disponiveis.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={
                    disponiveis.length === 0
                      ? "Nenhum código disponível com esses filtros"
                      : "Selecione um código disponível"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {disponiveis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo || `(sem código) — ${p.id.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {precisaAtribuirCodigo && (
                <>
                  <Input
                    value={novoCodigo}
                    onChange={(e) => setNovoCodigo(e.target.value)}
                    maxLength={30}
                    placeholder="Atribua o código agora (ex: P-1234)"
                  />
                  {codigoCheck === "duplicado" && (
                    <p className="text-xs text-destructive">Este código já está cadastrado.</p>
                  )}
                  {codigoCheck === "ok" && (
                    <p className="text-xs text-green-600">Código disponível.</p>
                  )}
                </>
              )}
              </>
            ) : (
              <>
                <Input
                  value={novoCodigo}
                  onChange={(e) => setNovoCodigo(e.target.value)}
                  maxLength={30}
                  placeholder="Ex: P-1234"
                />
                {codigoCheck === "duplicado" && (
                  <p className="text-xs text-destructive">Este código já está cadastrado.</p>
                )}
                {codigoCheck === "ok" && (
                  <p className="text-xs text-green-600">Código disponível.</p>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Código do imóvel *</Label>
              <Input value={imovel} onChange={(e) => setImovel(e.target.value)} maxLength={30} />
            </div>
            <div className="space-y-2">
              <Label>Data da instalação *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
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
            Confirmar saída
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}