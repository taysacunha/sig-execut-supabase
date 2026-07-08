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
  Placa, TipoUso, Tamanho, TIPO_USO_LABELS, TAMANHO_LABELS, usePlacas, resolvePlacaAttributes,
} from "@/hooks/useEstoquePlacas";

const fromEstoque = (t: string) => supabase.from(t as any);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface LocalRow { id: string; nome: string; }
interface SaldoRow { id: string; material_id: string; local_armazenamento_id: string; quantidade: number; }
interface MaterialPlacaRow {
  id: string;
  nome: string;
  is_placa: boolean;
  is_active: boolean;
  tipo_uso: TipoUso | null;
  tamanho: Tamanho | null;
  tamanho_outro: string | null;
}

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
    const attrs = resolvePlacaAttributes(material);
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
        .select("id, nome, is_placa, is_active, tipo_uso, tamanho, tamanho_outro")
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

  const totaisPorMaterial = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of saldos) {
      if (s.quantidade > 0) {
        map.set(s.material_id, (map.get(s.material_id) ?? 0) + s.quantidade);
      }
    }
    return map;
  }, [saldos]);

  const materiaisPlacaComSaldo = useMemo(() => {
    return materiaisPlaca
      .map((m) => {
        const total = totaisPorMaterial.get(m.id) ?? 0;
        return { id: m.id, nome: `${m.nome} (${total})`, total };
      })
      .filter((m) => m.total > 0)
      .map(({ id, nome }) => ({ id, nome }));
  }, [materiaisPlaca, totaisPorMaterial]);

  const { data: placas = [] } = usePlacas();

  const locaisComSaldo = useMemo(() => {
    if (!materialId) return [];
    const ids = new Set(
      saldos.filter((s) => s.material_id === materialId && s.quantidade > 0)
        .map((s) => s.local_armazenamento_id)
    );
    return locais.filter((l) => ids.has(l.id));
  }, [locais, saldos, materialId]);

  const saldoLocal = useMemo(() => {
    if (!localId || !materialId) return 0;
    return saldos.find((s) => s.material_id === materialId && s.local_armazenamento_id === localId)?.quantidade ?? 0;
  }, [saldos, localId, materialId]);

  const saldoSelecionado = useMemo(() => {
    if (!localId || !materialId) return null;
    return saldos.find((s) => s.material_id === materialId && s.local_armazenamento_id === localId) || null;
  }, [saldos, localId, materialId]);

  const placasDisponiveis = useMemo(() => {
    return placas.filter((p) =>
      p.status === "disponivel"
      && p.material_id === materialId
      && (!localId || p.local_armazenamento_id === localId)
    );
  }, [placas, materialId, localId]);

  const disponiveisComCodigo = useMemo(
    () => placasDisponiveis.filter((p) => !!p.codigo?.trim()),
    [placasDisponiveis]
  );

  const disponiveisSemCodigo = useMemo(
    () => placasDisponiveis.filter((p) => !p.codigo?.trim()),
    [placasDisponiveis]
  );

  useEffect(() => {
    if (modo === "existente" && disponiveisComCodigo.length === 0 && disponiveisSemCodigo.length > 0 && materialId && localId) {
      setModo("novo");
    }
    if (modo === "novo" && disponiveisSemCodigo.length === 0 && disponiveisComCodigo.length > 0 && materialId && localId) {
      setModo("existente");
    }
  }, [disponiveisComCodigo.length, disponiveisSemCodigo.length, modo, materialId, localId]);

  const placaSelecionada = useMemo(
    () => placas.find((p) => p.id === placaId) || null,
    [placas, placaId]
  );

  useEffect(() => {
    if (modo !== "novo") { setCodigoCheck("vazio"); return; }
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
  }, [novoCodigo, modo]);

  const mutation = useMutation({
    mutationFn: async () => {
      const imv = imovel.trim();
      if (!materialId || !materialSelecionado) throw new Error("Selecione o material da placa");
      if (!localId) throw new Error("Selecione o local de armazenamento");
      if (!imv) throw new Error("Código do imóvel obrigatório");
      if (imv.length > 30) throw new Error("Código do imóvel muito longo (máx 30)");
      if (saldoLocal <= 0) throw new Error("Saldo zerado neste local. Registre uma entrada na aba Saldos antes.");
      if (!saldoSelecionado) throw new Error("Saldo não encontrado para este material/local");

      let placa: Placa | null = null;

      if (modo === "existente") {
        if (!placaId) throw new Error("Selecione uma placa disponível ou crie um novo código");
        const found = placas.find((p) => p.id === placaId);
        if (!found) throw new Error("Placa não encontrada");
        if (found.material_id !== materialId) throw new Error("A placa selecionada não pertence ao material escolhido");
        if (found.status !== "disponivel") throw new Error("Placa não está mais disponível");
        if (!found.codigo?.trim()) throw new Error("Selecione uma placa com código cadastrado ou use Criar novo código");
        placa = found;

        const updatePayload: any = {
          status: "instalada",
          imovel_codigo_atual: imv,
          data_instalacao_atual: data,
        };

        const { error } = await fromEstoque("estoque_placas").update(updatePayload).eq("id", placa.id);
        if (error) throw error;
      } else {
        const c = novoCodigo.trim();
        if (!c) throw new Error("Informe o novo código");
        if (c.length > 30) throw new Error("Código muito longo (máx 30 caracteres)");

        const { data: existente } = await fromEstoque("estoque_placas")
          .select("id").eq("codigo", c).limit(1).maybeSingle();
        if (existente) throw new Error(`Código "${c}" já existe.`);

        const placaSemCodigo = disponiveisSemCodigo[0];
        if (!placaSemCodigo) {
          throw new Error("Não há placa física sem código disponível para receber este código.");
        }

        const updatePayload: any = {
          codigo: c,
          status: "instalada",
          imovel_codigo_atual: imv,
          data_instalacao_atual: data,
          observacoes: obs.trim() || null,
        };

        const { data: atualizada, error } = await fromEstoque("estoque_placas")
          .update(updatePayload)
          .eq("id", placaSemCodigo.id)
          .select("*")
          .single();
        if (error) throw error;
        placa = atualizada as unknown as Placa;

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
      queryClient.invalidateQueries({ queryKey: ["estoque-saldos-placas"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais-placa"] });
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
        ? !!placaId
        : disponiveisSemCodigo.length > 0 && !!novoCodigo.trim() && codigoCheck !== "duplicado");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova saída para imóvel</DialogTitle>
          <DialogDescription>
            Escolha o material da placa e o local. A saída consome 1 unidade do saldo registrado na aba Saldos.
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
              emptyMessage="Nenhum material de placa ativo encontrado. Cadastre na aba Materiais."
            />
            {materialSelecionado && (
              <p className="text-xs text-muted-foreground">
                {TIPO_USO_LABELS[tipoUso]} · {tamanho === "outro" ? (tamanhoOutro || "outro") : TAMANHO_LABELS[tamanho]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Local de armazenamento *</Label>
            {materialId && locaisComSaldo.length === 0 ? (
              <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md p-2">
                Nenhum local tem saldo deste material. Registre uma entrada na aba Saldos antes.
              </p>
            ) : (
              <Select
                value={localId}
                onValueChange={(v) => { setLocalId(v); setPlacaId(""); }}
                disabled={!materialId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={materialId ? "Selecione" : "Escolha o material primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {locaisComSaldo.map((l) => {
                    const qtd = saldos.find((s) => s.material_id === materialId && s.local_armazenamento_id === l.id)?.quantidade ?? 0;
                    return (
                      <SelectItem key={l.id} value={l.id}>{l.nome} ({qtd})</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            {localId && (
              <p className={`text-xs ${saldoLocal > 0 ? "text-muted-foreground" : "text-destructive"}`}>
                Saldo disponível deste material neste local: <strong>{saldoLocal}</strong>
                {saldoLocal === 0 && " — registre uma entrada na aba Saldos antes."}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Código da placa *</Label>
            <RadioGroup value={modo} onValueChange={(v) => setModo(v as Modo)} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existente" id="modo-existente" disabled={disponiveisComCodigo.length === 0} />
                <Label htmlFor="modo-existente" className="cursor-pointer text-sm font-normal">
                  Selecionar disponível ({disponiveisComCodigo.length})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="novo" id="modo-novo" disabled={disponiveisSemCodigo.length === 0} />
                <Label htmlFor="modo-novo" className="cursor-pointer text-sm font-normal">
                  Criar novo código
                </Label>
              </div>
            </RadioGroup>

            {modo === "existente" ? (
              <>
              <Select value={placaId} onValueChange={setPlacaId} disabled={disponiveisComCodigo.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={
                    disponiveisComCodigo.length === 0
                      ? "Nenhum código cadastrado disponível"
                      : "Selecione um código disponível"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {disponiveisComCodigo.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </>
            ) : (
              <>
                <Input
                  value={novoCodigo}
                  onChange={(e) => setNovoCodigo(e.target.value)}
                  maxLength={30}
                  placeholder="Ex: P-1234"
                  disabled={disponiveisSemCodigo.length === 0}
                />
                {disponiveisSemCodigo.length === 0 && (
                  <p className="text-xs text-destructive">Não há placa sem código disponível para vincular um novo código.</p>
                )}
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