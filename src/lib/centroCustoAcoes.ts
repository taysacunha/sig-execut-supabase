export function podeExcluirCentroCusto(role: string | null, podeEditarCadastros: boolean): boolean {
  return podeEditarCadastros && (role === "admin" || role === "super_admin");
}