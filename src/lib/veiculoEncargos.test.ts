import { describe, expect, it } from "vitest";
import { datasParcelasVeiculo, proximoCicloVeiculo, podeBaixarEncargoVeiculo } from "./veiculoEncargos";

describe("encargos de veículos", () => {
  it("gera três parcelas atravessando 2026 e 2027", () => {
    expect(datasParcelasVeiculo("2026-11-01", 3)).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
  });
  it("usa a data de 2027 sem antecipar para 2026", () => {
    expect(proximoCicloVeiculo("2027-07-01", null)).toBe(2027);
  });
  it("após 2027 permite somente 2028 em diante", () => {
    expect(proximoCicloVeiculo("2027-07-01", 2027)).toBe(2028);
  });
  it("ajusta mês curto sem perder o dia original seguinte", () => {
    expect(datasParcelasVeiculo("2027-01-31", 3)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });
  it("permite baixa sem depender de valor e exige data", () => {
    expect(podeBaixarEncargoVeiculo("a_vencer", "2026-10-18")).toBe(true);
    expect(podeBaixarEncargoVeiculo("pago", "2026-10-18")).toBe(false);
    expect(podeBaixarEncargoVeiculo("vencido", "")).toBe(false);
  });
});