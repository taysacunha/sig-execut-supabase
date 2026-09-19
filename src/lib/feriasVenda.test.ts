import { describe, expect, it } from "vitest";
import { diffFerias } from "@/lib/feriasDiff";
import { resolverVendaConsolidada } from "@/lib/feriasVenda";

describe("resolverVendaConsolidada", () => {
  it("reconhece a venda padrão no primeiro salvamento sem mudar as datas oficiais", () => {
    const venda = resolverVendaConsolidada({
      opcaoAdicional: "vender",
      excecaoTipo: "vender",
      diasVendidos: 10,
      quinzenaVenda: 2,
      q1BloqueadoParaVenda: false,
      isExcecao: false,
    });

    expect(venda).toEqual({
      venderDias: true,
      diasVendidos: 10,
      quinzenaVenda: 2,
      diasVendidosQ1: 0,
      diasVendidosQ2: 10,
    });
  });

  it("mantém a venda no segundo período quando o primeiro já foi gozado", () => {
    const venda = resolverVendaConsolidada({
      opcaoAdicional: "vender",
      excecaoTipo: "vender",
      diasVendidos: 10,
      quinzenaVenda: 1,
      q1BloqueadoParaVenda: true,
      isExcecao: false,
    });

    expect(venda.quinzenaVenda).toBe(2);
    expect(venda.diasVendidosQ2).toBe(10);
  });
});

describe("confirmação da venda de férias", () => {
  it("mostra a venda e o gozo real de 22 a 26/09 já na primeira alteração", () => {
    const antes = {
      vender_dias: false,
      dias_vendidos: null,
      quinzena_venda: null,
      dias_vendidos_q1: null,
      dias_vendidos_q2: null,
      gozo_flexivel: false,
      distribuicao_tipo: null,
    };
    const depois = {
      ...antes,
      vender_dias: true,
      dias_vendidos: 10,
      quinzena_venda: 2,
      dias_vendidos_q1: 0,
      dias_vendidos_q2: 10,
      gozo_flexivel: true,
      distribuicao_tipo: "2",
    };
    const periodosDepois = [{
      tipo: "vender",
      referencia_periodo: 2,
      dias: 5,
      data_inicio: "2026-09-22",
      data_fim: "2026-09-26",
    }];

    const diff = diffFerias(antes, depois, [], periodosDepois);

    expect(diff.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Vende dias", antes: "Não", depois: "Sim" }),
      expect.objectContaining({ label: "Dias vendidos", depois: "10" }),
      expect.objectContaining({ label: "Período da venda", depois: "2º período" }),
    ]));
    expect(diff.periodosMudaram).toBe(true);
    expect(diff.periodosDepois[0]).toContain("22/09/2026 a 26/09/2026");
  });
});