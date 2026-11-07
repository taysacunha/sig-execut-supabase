import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { buildExcludedShiftsMap, isShiftExcludedFor } from "./schedulePostValidation";

const p2l = new Map([["p1", "bessa"], ["p2", "bessa"]]);

describe("feriados / datas excluídas na validação", () => {
  it("dia inteiro excluído remove manhã e tarde", () => {
    const m = buildExcludedShiftsMap([{ period_id: "p1", excluded_date: "2026-11-02", excluded_shifts: null }], p2l);
    expect(isShiftExcludedFor(m, "p1", "bessa", "2026-11-02", "morning")).toBe(true);
    expect(isShiftExcludedFor(m, "p1", "bessa", "2026-11-02", "afternoon")).toBe(true);
    expect(isShiftExcludedFor(m, "p1", "bessa", "2026-11-03", "morning")).toBe(false);
  });
  it("exclusão só da manhã mantém a tarde", () => {
    const m = buildExcludedShiftsMap([{ period_id: "p1", excluded_date: "2026-11-02", excluded_shifts: ["morning"] }], p2l);
    expect(isShiftExcludedFor(m, "p1", "bessa", "2026-11-02", "afternoon")).toBe(false);
  });
  it("exclusão em outro período do mesmo local também vale", () => {
    const m = buildExcludedShiftsMap([{ period_id: "p2", excluded_date: "2026-11-02", excluded_shifts: [] }], p2l);
    expect(isShiftExcludedFor(m, "p1", "bessa", "2026-11-02", "morning")).toBe(true);
  });
});
