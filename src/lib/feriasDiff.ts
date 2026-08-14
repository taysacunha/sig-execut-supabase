import { format, parseISO } from "date-fns";

export interface FeriasDiffRow {
  label: string;
  antes: string;
  depois: string;
  destaque?: boolean;
}

export interface GozoPeriodoLike {
  tipo?: string | null;
  referencia_periodo?: number | null;
  dias?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
}

const VAZIO = "—";

export const fmtData = (v?: string | null): string => {
  if (!v) return VAZIO;
  try {
    return format(parseISO(String(v).slice(0, 10)), "dd/MM/yyyy");
  } catch {
    return String(v);
  }
};

const fmtBool = (v: any) => (v ? "Sim" : "Não");
const fmtTexto = (v: any) => {
  if (v === null || v === undefined || v === "") return VAZIO;
  return String(v);
};
const fmtNum = (v: any) => (v === null || v === undefined || v === "" ? VAZIO : String(v));

const DISTRIBUICAO_LABEL: Record<string, string> = {
  "1": "1º período",
  "2": "2º período",
  ambos: "Ambos os períodos",
  livre: "Livre",
};

const MOTIVO_CANC_LABEL: Record<string, string> = {
  desligamento: "Desligamento",
  acordo: "Acordo com o colaborador",
  outro: "Outro",
};

const norm = (v: any) => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v;
  return String(v);
};

const same = (a: any, b: any) => norm(a) === norm(b);

const fmtPeriodoLinha = (p: GozoPeriodoLike, idx: number) => {
  const ref =
    p.referencia_periodo === 0
      ? "Livre"
      : p.referencia_periodo === 2
        ? "2º período"
        : "1º período";
  const tipo = p.tipo === "gozo_diferente" ? "Gozo diferente" : "Venda";
  return `${idx + 1}. ${fmtData(p.data_inicio)} a ${fmtData(p.data_fim)} — ${p.dias ?? 0} dia(s) · ${ref} · ${tipo}`;
};

const chavePeriodos = (list: GozoPeriodoLike[]) =>
  [...list]
    .filter((p) => p.data_inicio && p.data_fim)
    .sort((a, b) => String(a.data_inicio).localeCompare(String(b.data_inicio)))
    .map((p) => `${p.data_inicio}|${p.data_fim}|${p.dias ?? 0}|${p.referencia_periodo ?? 1}|${p.tipo ?? ""}`)
    .join(";");

export const listarPeriodos = (list: GozoPeriodoLike[]): string[] => {
  const filtrados = [...list]
    .filter((p) => p.data_inicio && p.data_fim)
    .sort((a, b) => String(a.data_inicio).localeCompare(String(b.data_inicio)));
  if (filtrados.length === 0) return [];
  return filtrados.map(fmtPeriodoLinha);
};

interface CampoDef {
  key: string;
  label: string;
  fmt: (v: any) => string;
  destaque?: boolean;
}

const CAMPOS: CampoDef[] = [
  { key: "is_excecao", label: "Tipo de cadastro", fmt: (v) => (v ? "Exceção" : "Padrão"), destaque: true },
  { key: "excecao_motivo", label: "Motivo da exceção", fmt: fmtTexto },
  { key: "excecao_justificativa", label: "Justificativa da exceção", fmt: fmtTexto },
  { key: "quinzena1_inicio", label: "1º período — início", fmt: fmtData },
  { key: "quinzena1_fim", label: "1º período — fim", fmt: fmtData },
  { key: "quinzena2_inicio", label: "2º período — início", fmt: fmtData },
  { key: "quinzena2_fim", label: "2º período — fim", fmt: fmtData },
  { key: "q2_cancelado", label: "2º período cancelado", fmt: fmtBool, destaque: true },
  {
    key: "q2_cancelamento_motivo",
    label: "Motivo do cancelamento do 2º período",
    fmt: (v) => (v ? MOTIVO_CANC_LABEL[String(v)] || String(v) : VAZIO),
  },
  { key: "q2_cancelamento_justificativa", label: "Justificativa do cancelamento", fmt: fmtTexto },
  { key: "gozo_diferente", label: "Gozo diferente", fmt: fmtBool },
  { key: "gozo_quinzena1_inicio", label: "Gozo 1º período — início", fmt: fmtData },
  { key: "gozo_quinzena1_fim", label: "Gozo 1º período — fim", fmt: fmtData },
  { key: "gozo_quinzena2_inicio", label: "Gozo 2º período — início", fmt: fmtData },
  { key: "gozo_quinzena2_fim", label: "Gozo 2º período — fim", fmt: fmtData },
  { key: "vender_dias", label: "Vende dias", fmt: fmtBool, destaque: true },
  { key: "dias_vendidos", label: "Dias vendidos", fmt: fmtNum },
  {
    key: "quinzena_venda",
    label: "Período da venda",
    fmt: (v) => (v ? `${v}º período` : VAZIO),
  },
  { key: "dias_vendidos_q1", label: "Dias vendidos no 1º período", fmt: fmtNum },
  { key: "dias_vendidos_q2", label: "Dias vendidos no 2º período", fmt: fmtNum },
  { key: "gozo_flexivel", label: "Gozo flexível", fmt: fmtBool },
  {
    key: "distribuicao_tipo",
    label: "Distribuição do gozo",
    fmt: (v) => (v ? DISTRIBUICAO_LABEL[String(v)] || String(v) : VAZIO),
  },
  { key: "periodo_aquisitivo_inicio", label: "Período aquisitivo — início", fmt: fmtData },
  { key: "periodo_aquisitivo_fim", label: "Período aquisitivo — fim", fmt: fmtData },
];

export interface FeriasDiffResult {
  rows: FeriasDiffRow[];
  periodosMudaram: boolean;
  periodosAntes: string[];
  periodosDepois: string[];
}

export function diffFerias(
  antes: Record<string, any> | null | undefined,
  depois: Record<string, any>,
  periodosAntes: GozoPeriodoLike[] = [],
  periodosDepois: GozoPeriodoLike[] = [],
): FeriasDiffResult {
  const rows: FeriasDiffRow[] = [];
  const base = antes || {};
  for (const campo of CAMPOS) {
    const a = base[campo.key];
    const b = depois[campo.key];
    if (!same(a, b)) {
      rows.push({
        label: campo.label,
        antes: campo.fmt(a),
        depois: campo.fmt(b),
        destaque: campo.destaque,
      });
    }
  }
  const periodosMudaram = chavePeriodos(periodosAntes) !== chavePeriodos(periodosDepois);
  return {
    rows,
    periodosMudaram,
    periodosAntes: listarPeriodos(periodosAntes),
    periodosDepois: listarPeriodos(periodosDepois),
  };
}