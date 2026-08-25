import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ColaboradorVinculo {
  id: string;
  colaborador_id: string;
  data_admissao: string;
  data_demissao: string | null;
  tipo_desligamento: string | null;
  motivo: string | null;
  observacao: string | null;
  registrado_por: string | null;
  created_at: string;
  updated_at: string;
}

export const TIPOS_DESLIGAMENTO: { v: string; l: string }[] = [
  { v: "pedido_demissao", l: "Pedido de demissão" },
  { v: "dispensa_sem_justa_causa", l: "Dispensa sem justa causa" },
  { v: "dispensa_justa_causa", l: "Dispensa por justa causa" },
  { v: "fim_contrato", l: "Fim de contrato" },
  { v: "aposentadoria", l: "Aposentadoria" },
  { v: "falecimento", l: "Falecimento" },
  { v: "outro", l: "Outro" },
];

export const labelTipoDesligamento = (v?: string | null) =>
  TIPOS_DESLIGAMENTO.find((t) => t.v === v)?.l ?? (v || "-");

export const VINCULOS_KEY = "ferias-colaborador-vinculos";

export function useColaboradorVinculos(colaboradorId?: string | null) {
  return useQuery({
    queryKey: [VINCULOS_KEY, colaboradorId],
    enabled: !!colaboradorId,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ferias_colaborador_vinculos")
        .select("*")
        .eq("colaborador_id", colaboradorId)
        .order("data_admissao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ColaboradorVinculo[];
    },
  });
}

async function registrarAuditoria(
  recordId: string,
  action: string,
  payload: Record<string, unknown>,
) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    await (supabase as any).from("module_audit_logs").insert({
      module_name: "ferias",
      table_name: "ferias_colaboradores",
      record_id: recordId,
      action,
      new_data: payload,
      changed_by: userData?.user?.id ?? null,
      changed_by_email: userData?.user?.email ?? "sistema@interno",
    });
  } catch (e) {
    // auditoria não deve bloquear a operação principal
    console.warn("Falha ao registrar auditoria de vínculo:", e);
  }
}

export interface DesativarInput {
  colaboradorId: string;
  colaboradorNome: string;
  tipo: "desligamento" | "temporario";
  dataDemissao?: string | null;
  tipoDesligamento?: string | null;
  motivo?: string | null;
  observacao?: string | null;
  cancelarFeriasFuturas?: boolean;
}

export function useDesativarColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DesativarInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      if (input.tipo === "desligamento") {
        if (!input.dataDemissao) throw new Error("Informe a data de demissão.");

        // encerra o vínculo aberto mais recente (ou cria um já encerrado)
        const { data: abertos, error: errSel } = await (supabase as any)
          .from("ferias_colaborador_vinculos")
          .select("id, data_admissao")
          .eq("colaborador_id", input.colaboradorId)
          .is("data_demissao", null)
          .order("data_admissao", { ascending: false })
          .limit(1);
        if (errSel) throw errSel;

        const aberto = (abertos ?? [])[0];
        if (aberto) {
          if (input.dataDemissao < aberto.data_admissao) {
            throw new Error(
              "A data de demissão não pode ser anterior à data de admissão do vínculo.",
            );
          }
          const { error } = await (supabase as any)
            .from("ferias_colaborador_vinculos")
            .update({
              data_demissao: input.dataDemissao,
              tipo_desligamento: input.tipoDesligamento || null,
              motivo: input.motivo || null,
              observacao: input.observacao || null,
              registrado_por: uid,
            })
            .eq("id", aberto.id);
          if (error) throw error;
        }

        const { error: errColab } = await (supabase as any)
          .from("ferias_colaboradores")
          .update({
            status: "inativo",
            motivo_inativacao: "desligamento",
            data_demissao: input.dataDemissao,
            observacao_inativacao: input.observacao || null,
          })
          .eq("id", input.colaboradorId);
        if (errColab) throw errColab;

        if (input.cancelarFeriasFuturas) {
          await (supabase as any)
            .from("ferias_ferias")
            .delete()
            .eq("colaborador_id", input.colaboradorId)
            .gt("quinzena1_inicio", input.dataDemissao);
          await (supabase as any)
            .from("ferias_folgas")
            .delete()
            .eq("colaborador_id", input.colaboradorId)
            .gt("data_sabado", input.dataDemissao);
        }
      } else {
        const { error } = await (supabase as any)
          .from("ferias_colaboradores")
          .update({
            status: "inativo",
            motivo_inativacao: "temporario",
            data_demissao: null,
            observacao_inativacao: input.observacao || null,
          })
          .eq("id", input.colaboradorId);
        if (error) throw error;
      }

      await registrarAuditoria(input.colaboradorId, "DESATIVACAO_COLABORADOR", {
        colaborador: input.colaboradorNome,
        tipo: input.tipo,
        data_demissao: input.dataDemissao ?? null,
        tipo_desligamento: input.tipoDesligamento ?? null,
        motivo: input.motivo ?? null,
        observacao: input.observacao ?? null,
        ferias_futuras_canceladas: !!input.cancelarFeriasFuturas,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ferias-colaboradores"] });
      qc.invalidateQueries({ queryKey: [VINCULOS_KEY] });
      qc.invalidateQueries({ queryKey: ["ferias-ferias"] });
    },
  });
}

export interface ReativarInput {
  colaboradorId: string;
  colaboradorNome: string;
  eraDesligamento: boolean;
  novaDataAdmissao?: string | null;
  observacao?: string | null;
}

export function useReativarColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReativarInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      if (input.eraDesligamento) {
        if (!input.novaDataAdmissao) throw new Error("Informe a nova data de admissão.");

        const { data: ultimos, error: errSel } = await (supabase as any)
          .from("ferias_colaborador_vinculos")
          .select("data_demissao")
          .eq("colaborador_id", input.colaboradorId)
          .order("data_admissao", { ascending: false })
          .limit(1);
        if (errSel) throw errSel;
        const ultimaDemissao = (ultimos ?? [])[0]?.data_demissao as string | null | undefined;
        if (ultimaDemissao && input.novaDataAdmissao <= ultimaDemissao) {
          throw new Error(
            "A nova data de admissão deve ser posterior à data de demissão anterior.",
          );
        }

        const { error } = await (supabase as any)
          .from("ferias_colaborador_vinculos")
          .insert({
            colaborador_id: input.colaboradorId,
            data_admissao: input.novaDataAdmissao,
            observacao: input.observacao || null,
            registrado_por: uid,
          });
        if (error) throw error;
      }

      const payload: Record<string, unknown> = {
        status: "ativo",
        motivo_inativacao: null,
        observacao_inativacao: null,
      };
      if (input.eraDesligamento) {
        payload.data_admissao = input.novaDataAdmissao;
        payload.data_demissao = null;
        payload.aviso_previo_inicio = null;
        payload.aviso_previo_fim = null;
      }

      const { error: errColab } = await (supabase as any)
        .from("ferias_colaboradores")
        .update(payload)
        .eq("id", input.colaboradorId);
      if (errColab) throw errColab;

      await registrarAuditoria(input.colaboradorId, "REATIVACAO_COLABORADOR", {
        colaborador: input.colaboradorNome,
        recontratacao: input.eraDesligamento,
        nova_data_admissao: input.novaDataAdmissao ?? null,
        observacao: input.observacao ?? null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ferias-colaboradores"] });
      qc.invalidateQueries({ queryKey: [VINCULOS_KEY] });
    },
  });
}

export interface ImpactosDesligamento {
  feriasFuturas: number;
  folgasFuturas: number;
  creditosPendentes: number;
}

export function useImpactosDesligamento(colaboradorId?: string | null, dataCorte?: string) {
  return useQuery({
    queryKey: ["ferias-impactos-desligamento", colaboradorId, dataCorte],
    enabled: !!colaboradorId && !!dataCorte,
    queryFn: async (): Promise<ImpactosDesligamento> => {
      const [ferias, folgas, creditos] = await Promise.all([
        (supabase as any)
          .from("ferias_ferias")
          .select("id", { count: "exact", head: true })
          .eq("colaborador_id", colaboradorId)
          .gt("quinzena1_inicio", dataCorte),
        (supabase as any)
          .from("ferias_folgas")
          .select("id", { count: "exact", head: true })
          .eq("colaborador_id", colaboradorId)
          .gt("data_sabado", dataCorte),
        (supabase as any)
          .from("ferias_folgas_creditos")
          .select("id", { count: "exact", head: true })
          .eq("colaborador_id", colaboradorId)
          .eq("status", "pendente"),
      ]);
      return {
        feriasFuturas: ferias.count ?? 0,
        folgasFuturas: folgas.count ?? 0,
        creditosPendentes: creditos.count ?? 0,
      };
    },
  });
}
