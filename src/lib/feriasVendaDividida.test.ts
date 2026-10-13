import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { resolverVendaConsolidada, validarVendaDividida, vendaContabilPorPeriodo } from "./feriasVenda";
import { intervalosVendaDividida } from "./feriasVendaIntervalos";
import { calcularPremiacao } from "./premiacaoCalc";

const base = { opcaoAdicional: "vender", excecaoTipo: "vender" as const, diasVendidos: 10, quinzenaVenda: 3, q1BloqueadoParaVenda: false, isExcecao: false };
const datas = { quinzena1_inicio: "2026-09-01", quinzena1_fim: "2026-09-15", quinzena2_inicio: "2026-10-01", quinzena2_fim: "2026-10-15", quinzena_venda: 3 };
const validacao = { periodo: 3, dias: 10, q1Bloqueado: false, q2Cancelado: false, q2Inicio: datas.quinzena2_inicio, q2Fim: datas.quinzena2_fim };

describe("Venda padrão de 10 dias dividida", () => {
  it("grava 5/5 e permanece padrão", () => {
    expect(resolverVendaConsolidada(base)).toEqual({ venderDias: true, diasVendidos: 10, quinzenaVenda: 3, diasVendidosQ1: 5, diasVendidosQ2: 5 });
  });
  it.each([5, 9, 11, 15])("rejeita divisão com total %s", dias => {
    expect(() => resolverVendaConsolidada({ ...base, diasVendidos: dias })).toThrow();
  });
  it("mantém 10 no primeiro", () => expect(resolverVendaConsolidada({ ...base, quinzenaVenda: 1 }).diasVendidosQ1).toBe(10));
  it("mantém 10 no segundo", () => expect(resolverVendaConsolidada({ ...base, quinzenaVenda: 2 }).diasVendidosQ2).toBe(10));
  it("bloqueia primeiro já concluído sem correção", () => expect(() => resolverVendaConsolidada({ ...base, q1BloqueadoParaVenda: true })).toThrow());
  it("aceita divisão histórica autorizada", () => expect(validarVendaDividida(validacao)).toBeNull());
  it("bloqueia segundo cancelado", () => expect(validarVendaDividida({ ...validacao, q2Cancelado: true })).not.toBeNull());
  it("bloqueia segundo ausente", () => expect(validarVendaDividida({ ...validacao, q2Inicio: null })).not.toBeNull());
  it.each(["enviadoQ1", "enviadoQ2"] as const)("protege alocação enviada: %s", campo => expect(validarVendaDividida({ ...validacao, alocacaoAlterada: true, [campo]: true })).not.toBeNull());
  it("preserva divisão enviada sem alteração", () => expect(validarVendaDividida({ ...validacao, alocacaoAlterada: false, enviadoQ1: true })).toBeNull());
});

describe("Contador, gozo e folgas", () => {
  it("contador retorna 5 no primeiro, 5 no segundo e total 10", () => {
    const { v1, v2 } = vendaContabilPorPeriodo({ dias_vendidos: 10, quinzena_venda: 3 });
    expect(v1).toBe(5); expect(v2).toBe(5); expect(v1 + v2).toBe(10);
    expect(15 - v1).toBe(10); expect(15 - v2).toBe(10);
  });
  it("preserva limite contábil das exceções sem inferir divisão", () => expect(vendaContabilPorPeriodo({ dias_vendidos: 25, quinzena_venda: 1 })).toEqual({ v1: 10, v2: 0 }));
  it("fallback desconta 5 por período e não altera datas oficiais", () => {
    const intervalos = intervalosVendaDividida(datas);
    expect(intervalos.map(i => i.diasGozados)).toEqual([10, 10]);
    expect(intervalos.map(i => format(i.end, "yyyy-MM-dd"))).toEqual(["2026-09-10", "2026-10-10"]);
    expect(datas.quinzena1_fim).toBe("2026-09-15");
  });
  it("datas reais não sofrem segundo desconto", () => {
    const intervalos = intervalosVendaDividida({ ...datas, gozo_quinzena1_inicio: "2026-09-01", gozo_quinzena1_fim: "2026-09-10", gozo_quinzena2_inicio: "2026-10-01", gozo_quinzena2_fim: "2026-10-10" });
    expect(intervalos.map(i => i.diasGozados)).toEqual([10, 10]);
  });
  it("folgas usa subperíodos reais mesmo atravessando meses", () => {
    const intervalos = intervalosVendaDividida({ ...datas, _gozoPeriodos: [{ tipo: "vender", data_inicio: "2026-09-26", data_fim: "2026-10-05" }, { tipo: "vender", data_inicio: "2026-10-12", data_fim: "2026-10-21" }] });
    expect(intervalos.map(i => i.diasGozados)).toEqual([10, 10]);
    expect(format(intervalos[0].end, "yyyy-MM-dd")).toBe("2026-10-05");
  });
  it("premiação reconhece gozo de 10 dias em cada cenário de venda de 5", () => expect(calcularPremiacao(3000, 5).diasGozados).toBe(10));
});