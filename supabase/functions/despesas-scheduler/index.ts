// Executa rotinas diárias do módulo Despesas:
// 1) Gera próximas ocorrências de todas as séries de recorrência ativas.
// 2) Marca lançamentos em atraso como `vencido`.
// 3) Cria notificações de proximidade e vencidos respeitando preferências.
//
// Deve ser agendado via pg_cron. Não requer JWT (é chamada por cron interno)
// e usa a SERVICE_ROLE_KEY para poder gravar em tabelas restritas.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Prefs = {
  user_id: string;
  dias_antecedencia: number[];
  notificar_vencidos: boolean;
  notificar_pagos: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const resumo = { series: 0, criadas: 0, vencidos_marcados: 0, notificacoes: 0, erros: [] as string[] };

  try {
    // 1) Gerar ocorrências para todas as séries ativas
    const { data: series, error: sErr } = await supabase
      .from("despesas_recorrencias")
      .select("id")
      .eq("ativo", true);
    if (sErr) throw sErr;
    resumo.series = series?.length ?? 0;

    for (const s of series ?? []) {
      const { data: criadas, error: gErr } = await supabase.rpc(
        "despesas_gerar_ocorrencias",
        { _serie: s.id, _ate: null },
      );
      if (gErr) { resumo.erros.push(`serie ${s.id}: ${gErr.message}`); continue; }
      resumo.criadas += Number(criadas ?? 0);
    }

    // 2) Marcar como vencido lançamentos com data_vencimento < hoje que ainda
    //    estão em `a_vencer` ou `pago_parcial`.
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: vencidos, error: vErr } = await supabase
      .from("despesas_lancamentos")
      .update({ status: "vencido" })
      .lt("data_vencimento", hoje)
      .in("status", ["a_vencer", "pago_parcial"])
      .select("id");
    if (vErr) throw vErr;
    resumo.vencidos_marcados = vencidos?.length ?? 0;

    // 3) Notificações — busca preferências de todos os usuários com permissão de
    //    visualizar o módulo (temos apenas as prefs de quem já ajustou).
    const { data: prefs, error: pErr } = await supabase
      .from("despesas_notificacoes_preferencias")
      .select("*");
    if (pErr) throw pErr;

    // Default: se um usuário nunca ajustou, usar 7 e 1 dias + vencidos.
    // Só gera notificações para usuários que já ajustaram; a UI oferece defaults.
    for (const p of (prefs ?? []) as Prefs[]) {
      // 3a) Proximidade
      for (const dias of p.dias_antecedencia ?? []) {
        const alvo = new Date();
        alvo.setDate(alvo.getDate() + dias);
        const alvoStr = alvo.toISOString().slice(0, 10);

        const { data: lancs, error: lErr } = await supabase
          .from("despesas_lancamentos")
          .select("id, descricao, data_vencimento, valor_total, tipo")
          .eq("data_vencimento", alvoStr)
          .in("status", ["a_vencer", "pago_parcial"]);
        if (lErr) { resumo.erros.push(`prox ${dias}: ${lErr.message}`); continue; }

        for (const l of lancs ?? []) {
          const { error: nErr } = await supabase
            .from("despesas_notificacoes")
            .insert({
              user_id: p.user_id,
              lancamento_id: l.id,
              tipo: "proximidade",
              dias_para_vencer: dias,
              mensagem: `${l.tipo === "a_pagar" ? "A pagar" : "A receber"} em ${dias} dia(s): ${l.descricao}`,
            })
            .select("id");
          if (!nErr) resumo.notificacoes++;
          // conflitos por unique index são silenciosamente ignorados
        }
      }

      // 3b) Vencidos
      if (p.notificar_vencidos) {
        const { data: lancs, error: lErr } = await supabase
          .from("despesas_lancamentos")
          .select("id, descricao, tipo")
          .eq("status", "vencido");
        if (lErr) { resumo.erros.push(`venc: ${lErr.message}`); continue; }

        for (const l of lancs ?? []) {
          const { error: nErr } = await supabase
            .from("despesas_notificacoes")
            .insert({
              user_id: p.user_id,
              lancamento_id: l.id,
              tipo: "vencido",
              dias_para_vencer: null,
              mensagem: `${l.tipo === "a_pagar" ? "A pagar" : "A receber"} vencido: ${l.descricao}`,
            })
            .select("id");
          if (!nErr) resumo.notificacoes++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, resumo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message, resumo }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});