import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { sugerirResolucoes, sugerirJanelas, aplicarJanela } from "./feriasConflitoSugestoes";
import type { GeneratedVacation, GenerationContext } from "./vacationGenerator";

const colab = (id: string, setor = "s1") => ({ id, nome: id, familiar_id: null, setor_titular_id: setor, data_admissao: "2020-01-10" });
const form = (id: string, setor = "s1") => ({ colaborador_id: id, colaborador: colab(id, setor) } as any);
const vac = (id: string, i1: string, f1: string, i2: string, f2: string, extra: Partial<GeneratedVacation> = {}): GeneratedVacation => ({
  colaborador_id: id, colaborador_nome: id, setor_nome: "Fin", quinzena1_inicio: i1, quinzena1_fim: f1, quinzena2_inicio: i2, quinzena2_fim: f2,
  vender_dias: false, dias_vendidos: 0, quinzena_venda: 2, is_excecao: false, excecao_motivo: null, conflicts: [], familiar_match: false, origem: "formulario_anual", ...extra,
});
const ctx = (extra: Partial<GenerationContext> = {}): GenerationContext => ({
  existingVacations: [], forms: [form("maria"), form("amally"), form("outro", "s2")], substituteSectors: {}, sectorToColabs: {}, rules: { BLOQUEAR_JAN_DEZ: "true" }, ...extra,
});
const sobrepoe = (a: string, b: string, c: string, d: string) => a <= d && b >= c;

describe("sugestões para resolver conflito de férias", () => {
  const maria = vac("maria", "2027-04-01", "2027-04-15", "2027-08-02", "2027-08-16", {
    conflicts: [{ tipo: "setor", descricao: "", colaborador_id: "amally", colaborador_nome: "amally", periodo: 1, outro_periodo: 2, outro_inicio: "2027-04-05", outro_fim: "2027-04-19" }],
  });
  const amally = vac("amally", "2027-03-01", "2027-03-15", "2027-04-05", "2027-04-19");

  it("sugere datas para os dois sentidos sem coincidir com colegas nem com o outro período", () => {
    const [s] = sugerirResolucoes(maria, [maria, amally], ctx(), 2027);
    expect(s.moverOutro.moverId).toBe("amally");
    expect(s.moverEste.moverId).toBe("maria");
    for (const o of s.moverOutro.opcoes) {
      expect(sobrepoe(o.inicio, o.fim, "2027-04-01", "2027-04-15")).toBe(false); // período mantido de Maria
      expect(sobrepoe(o.inicio, o.fim, "2027-08-02", "2027-08-16")).toBe(false);
      expect(sobrepoe(o.inicio, o.fim, "2027-03-01", "2027-03-15")).toBe(false); // outro período de Amally
    }
    for (const o of s.moverEste.opcoes) {
      expect(sobrepoe(o.inicio, o.fim, "2027-04-05", "2027-04-19")).toBe(false);
      expect(sobrepoe(o.inicio, o.fim, "2027-03-01", "2027-03-15")).toBe(false);
    }
    expect(s.moverOutro.opcoes.length).toBeGreaterThan(0);
    expect(s.moverEste.opcoes.length).toBeGreaterThan(0);
  });

  it("mantém a duração de 15 dias e não sugere janeiro nem dezembro", () => {
    const ops = sugerirJanelas({ vacation: amally, periodo: 2, todos: [maria, amally], ctx: ctx(), ano: 2027, limite: 50 });
    for (const o of ops) {
      const dias = (Date.parse(o.fim) - Date.parse(o.inicio)) / 86400000 + 1;
      expect(dias).toBe(15);
      expect(["01", "12"]).not.toContain(o.inicio.slice(5, 7));
      expect(["01", "12"]).not.toContain(o.fim.slice(5, 7));
    }
  });

  it("colega de outro setor não bloqueia a sugestão", () => {
    const outro = vac("outro", "2027-04-16", "2027-04-30", "2027-09-01", "2027-09-15");
    const ops = sugerirJanelas({ vacation: amally, periodo: 2, todos: [maria, amally, outro], ctx: ctx(), ano: 2027, limite: 1 });
    expect(ops[0].inicio).toBe("2027-04-16");
  });

  it("colega com férias já cadastradas não recebe sugestão de mudança", () => {
    const m = { ...maria, conflicts: [{ ...maria.conflicts[0], ja_cadastrado: true }] };
    const [s] = sugerirResolucoes(m, [m], ctx({ existingVacations: [{ colaborador_id: "amally", quinzena1_inicio: "2027-04-05", quinzena1_fim: "2027-04-19", colaborador: { setor_titular_id: "s1" } }] }), 2027);
    expect(s.moverOutro.opcoes).toHaveLength(0);
    expect(s.moverOutro.bloqueio).toMatch(/já tem férias cadastradas/);
    expect(s.moverEste.opcoes.length).toBeGreaterThan(0);
  });

  it("aplicar sugestão mantém o 1º período como o mais cedo", () => {
    const r = aplicarJanela(amally, 2, "2027-02-01", "2027-02-15");
    expect(r.quinzena1_inicio).toBe("2027-02-01");
    expect(r.quinzena2_inicio).toBe("2027-03-01");
  });
});
