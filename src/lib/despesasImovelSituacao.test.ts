import { describe, expect, it } from "vitest";
import { isImovelSituacao } from "./despesasImovelSituacao";

describe("situações aceitas no cadastro de imóveis", () => {
  it("aceita em temporada para criação e edição", () => {
    expect(isImovelSituacao("em_temporada")).toBe(true);
  });

  it("preserva todas as situações anteriores", () => {
    for (const value of ["alugado", "vago", "vendido", "proprio_uso", "em_aquisicao"]) {
      expect(isImovelSituacao(value)).toBe(true);
    }
  });

  it("rejeita situações desconhecidas", () => {
    expect(isImovelSituacao("temporada_inexistente")).toBe(false);
  });
});