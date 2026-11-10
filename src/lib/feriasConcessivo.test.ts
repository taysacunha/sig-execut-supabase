import { describe, it, expect } from "vitest";
import { getConcessivoInfo, suggestSecondPeriod, periodsOverlap } from "./feriasConcessivo";

describe("getConcessivoInfo", () => {
  it("preferência em março/2027 com aquisitivo só a partir de julho/2027 fica antes do concessivo", () => {
    // admitido 01/07/2025 → aquisitivo 01/07/2025–30/06/2026 → concessivo 01/07/2026–30/06/2027
    // 2026 já gozado: admitido 01/07/2026 → concessivo começa 01/07/2027
    const info = getConcessivoInfo("2026-07-01", "2027-03-01")!;
    expect(info.antesDoConcessivo).toBe(true);
    expect(info.concessivoInicio).toBe("2027-07-01");
    expect(info.concessivoFim).toBe("2028-06-30");
  });
  it("data dentro do concessivo não gera aviso", () => {
    const info = getConcessivoInfo("2025-07-01", "2027-04-01")!;
    expect(info.antesDoConcessivo).toBe(false);
    expect(info.concessivoFim).toBe("2027-06-30");
  });
});

describe("suggestSecondPeriod", () => {
  it("nunca sobrepõe o 1º período nem colegas e respeita o fim do concessivo (caso Érika)", () => {
    const q1 = { inicio: "2027-04-16", fim: "2027-04-30" };
    const ocupados = [{ inicio: "2027-05-01", fim: "2027-05-15" }];
    for (const seed of ["a", "b", "erika", "x1", "zz"]) {
      const s = suggestSecondPeriod({ q1, limiteInicio: "2027-02-01", limiteFim: "2027-05-31", ocupados, seed })!;
      expect(s).not.toBeNull();
      expect(periodsOverlap(s, q1)).toBe(false);
      expect(periodsOverlap(s, ocupados[0])).toBe(false);
      expect(s.fim <= "2027-05-31").toBe(true);
    }
  });
  it("retorna null quando não há janela livre", () => {
    const s = suggestSecondPeriod({ q1: { inicio: "2027-04-01", fim: "2027-04-15" }, limiteInicio: "2027-04-01", limiteFim: "2027-04-20", ocupados: [] });
    expect(s).toBeNull();
  });
});
