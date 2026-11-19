import { describe, it, expect, vi, beforeEach } from "vitest";

const db: Record<string, any[]> = {};
vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    const q: any = {
      select: () => q, eq: () => q, gte: () => q, lte: () => q, in: () => q,
      then: (r: any) => r({ data: db[table] || [], error: null }),
    };
    return q;
  };
  return { supabase: { from: (t: string) => chain(t) } };
});

import { generateVacations } from "./vacationGenerator";

const setor = { id: "s1", nome: "Financeiro" };
const colab = (id: string) => ({ id, nome: id, familiar_id: null, setor_titular_id: "s1", data_admissao: "2020-01-10", setor_titular: setor });
const ferias = (id: string, i1: string, f1: string, i2: string, f2: string) => ({
  id: "f" + id, colaborador_id: id, quinzena1_inicio: i1, quinzena1_fim: f1, quinzena2_inicio: i2, quinzena2_fim: f2,
  status: "aprovada", origem: "manual", colaborador: { id, nome: id, setor_titular_id: "s1" },
});
const ivone = (extra: any = {}) => ({
  colaborador_id: "ivone", status: "pendente", periodo1_mes: 2, periodo2_mes: 5, periodo3_mes: 10,
  periodo_preferencia: 3, modo_periodo: "15_15", vender_dias: false, dias_vender: 0,
  data_inicio_preferencia: null, data_inicio_q2_preferencia: null, colaborador: colab("ivone"), ...extra,
});
const mes = (d: string) => Number(d.slice(5, 7));

beforeEach(() => {
  db.ferias_configuracoes = []; db.ferias_colaborador_setores_substitutos = []; db.ferias_ferias = [];
});

describe("gerador com 3 meses e preferência", () => {
  it("usa o mês preferido quando livre, em ordem cronológica", async () => {
    db.ferias_formulario_anual = [ivone()];
    const r = await generateVacations(2027);
    const v = r.success[0];
    expect([mes(v.quinzena1_inicio), mes(v.quinzena2_inicio)]).toEqual([2, 10]);
    expect(v.preferencia_atendida).toBe(true);
  });

  it("2º período tenta Maio quando Fevereiro está ocupado", async () => {
    db.ferias_formulario_anual = [ivone()];
    db.ferias_ferias = [ferias("x", "2027-02-01", "2027-02-28", "2027-03-01", "2027-03-15")];
    const r = await generateVacations(2027);
    const v = r.success[0];
    expect([mes(v.quinzena1_inicio), mes(v.quinzena2_inicio)]).toEqual([5, 10]);
  });

  it("preferido ocupado: usa outros meses sem conflito", async () => {
    db.ferias_formulario_anual = [ivone()];
    db.ferias_ferias = [ferias("x", "2027-10-01", "2027-10-31", "2027-11-01", "2027-11-15")];
    const r = await generateVacations(2027);
    const v = r.success[0];
    expect([mes(v.quinzena1_inicio), mes(v.quinzena2_inicio)]).toEqual([2, 5]);
    expect(v.preferencia_atendida).toBe(false);
  });

  it("datas exatas são mantidas", async () => {
    db.ferias_formulario_anual = [ivone({ data_inicio_preferencia: "2027-10-04", data_inicio_q2_preferencia: "2027-05-10" })];
    const r = await generateVacations(2027);
    const v = r.success[0];
    expect([v.quinzena1_inicio, v.quinzena2_inicio]).toEqual(["2027-05-10", "2027-10-04"]);
  });
});
