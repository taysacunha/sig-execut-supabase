import { expect, it } from "vitest";
import { podeExcluirCentroCusto } from "./centroCustoAcoes";

it("permite exclusão para admin com acesso de edição", () => {
  expect(podeExcluirCentroCusto("admin", true)).toBe(true);
});
it("permite exclusão para superadmin com acesso de edição", () => {
  expect(podeExcluirCentroCusto("super_admin", true)).toBe(true);
});
it("nega exclusão para demais perfis mesmo com edição", () => {
  for (const role of ["supervisor", "manager", "broker", "collaborator", null]) {
    expect(podeExcluirCentroCusto(role, true)).toBe(false);
  }
});
it("exige acesso de edição a Cadastros", () => {
  expect(podeExcluirCentroCusto("admin", false)).toBe(false);
});