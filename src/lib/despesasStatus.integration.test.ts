import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
async function status(atual: string, vencimento: string, hoje: string, pago = 0, total = 100, baixa: string | null = null) {
  const { data, error } = await db.rpc("despesas_status_por_vencimento", { _status: atual, _venc: vencimento, _hoje: hoje, _pago: pago, _total: total, _baixa: baixa as unknown as string });
  if (error) throw error;
  return data;
}
describe("Regra de vencimento no banco", () => {
  it("06/10: vencimento 10/10 não está vencido", async () => expect(await status("vencido", "2026-10-10", "2026-10-06")).toBe("a_vencer"));
  it("vence hoje sem atraso", async () => expect(await status("vencido", "2026-10-10", "2026-10-10")).toBe("a_vencer"));
  it("dia seguinte está vencido", async () => expect(await status("a_vencer", "2026-10-10", "2026-10-11")).toBe("vencido"));
  it("preserva parcial", async () => expect(await status("vencido", "2026-10-10", "2026-10-11", 20)).toBe("pago_parcial"));
  it("preserva pagamento completo", async () => expect(await status("pago", "2026-10-10", "2026-10-06", 100)).toBe("pago"));
  it.each(["cancelado", "quitado", "gimob"])("preserva %s", async estado => expect(await status(estado, "2026-10-10", "2026-10-11")).toBe(estado));
  it("preserva baixa sem valor", async () => expect(await status("pago", "2026-10-10", "2026-10-11", 0, 0, "2026-10-10")).toBe("pago"));
});