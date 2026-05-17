// Cálculos da premiação por quinzena, conforme planilha "FÉRIAS_PREMIAÇÃO_CÁLCULOS".
// Mapeamento das células da planilha:
//   B4 = valor da premiação (input do usuário)
//   B5 = B4 / 3                 (acréscimo de 1/3)
//   B6 = B4 + B5                (total)
//   B7 = B6 / 30 * dias_vendidos
//   B8 = B5 / 30 * dias_gozados (omitido quando dias_vendidos = 15)
//   B9 = B7 + B8                (total a receber)
//
// Cenário "não vende" (dias_vendidos = 0, gozo 15):
//   PREMIAÇÃO = B4, Acréscimo 1/3 = B5, Recebe = B5.

export type CenarioVenda = 0 | 5 | 10 | 15;

export interface PremiacaoCalculo {
  cenario: CenarioVenda;
  diasGozados: 0 | 5 | 10 | 15;
  valorPremiacao: number;     // B4
  acrescimoUmTerco: number;   // B5
  total: number;              // B6
  vendaParcela: number;       // B7
  umTercoGozados: number;     // B8 (0 quando vende 15)
  recebe: number;             // B9
  comissao15: number;         // B4/2 — usado apenas no cenário "não vende"
  umTercoComissao: number;    // comissao15/3 — usado apenas no cenário "não vende"
}

function r2(n: number) { return Math.round(n * 100) / 100; }

export function calcularPremiacao(valorPremiacao: number, dias_vendidos: CenarioVenda): PremiacaoCalculo {
  const b4 = valorPremiacao;
  const b5 = b4 / 3;
  const b6 = b4 + b5;
  const diasGozados = (15 - dias_vendidos) as 0 | 5 | 10 | 15;

  let b7 = 0;
  let b8 = 0;
  let recebe = 0;
  let comissao15 = 0;
  let umTercoComissao = 0;

  if (dias_vendidos === 0) {
    comissao15 = b4 / 2;
    umTercoComissao = comissao15 / 3;
    recebe = umTercoComissao;
  } else {
    b7 = (b6 / 30) * dias_vendidos;
    b8 = dias_vendidos === 15 ? 0 : (b5 / 30) * diasGozados;
    recebe = b7 + b8;
  }

  return {
    cenario: dias_vendidos,
    diasGozados,
    valorPremiacao: r2(b4),
    acrescimoUmTerco: r2(b5),
    total: r2(b6),
    vendaParcela: r2(b7),
    umTercoGozados: r2(b8),
    recebe: r2(recebe),
    comissao15: r2(comissao15),
    umTercoComissao: r2(umTercoComissao),
  };
}

export function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
