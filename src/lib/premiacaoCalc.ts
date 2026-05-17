// Cálculos da premiação por quinzena, conforme planilha "FÉRIAS_PREMIAÇÃO_CÁLCULOS".
// O usuário digita o VALOR MENSAL da premiação. O valor por quinzena = mensal / 2.
//
// Cenários (por quinzena):
// - Vende 0 (gozo 15): comissão 15d = quinzena; Recebe = quinzena / 3
// - Vende 5 (gozo 10): base=quinzena; +1/3=quinzena/3; total=base+1/3=quinzena*4/3
//                       venda5+1/3 = total*5/30; 1/3·10d = (quinzena/3)*10/30
//                       Recebe = venda5+1/3 + 1/3·10d  (≈ quinzena/3)
// - Vende 10 (gozo 5): venda10+1/3 = total*10/30; 1/3·5d = (quinzena/3)*5/30
//                       Recebe = venda10+1/3 + 1/3·5d
// - Vende 15 (gozo 0): venda15+1/3 = total*15/30 = total/2
//                       Recebe = total/2

export type CenarioVenda = 0 | 5 | 10 | 15;

export interface PremiacaoCalculo {
  cenario: CenarioVenda;
  diasGozados: 0 | 5 | 10 | 15;
  valorMensal: number;
  quinzena: number;       // mensal / 2
  acrescimoUmTerco: number; // quinzena / 3
  total: number;          // quinzena + 1/3 = quinzena*4/3
  vendaParcelaComUmTerco: number; // 0 se vende 0
  umTercoDiasGozados: number;     // 0 se vende 15
  recebe: number;         // total a receber
}

function r2(n: number) { return Math.round(n * 100) / 100; }

export function calcularPremiacao(valorMensal: number, dias_vendidos: CenarioVenda): PremiacaoCalculo {
  const quinzena = valorMensal / 2;
  const acrescimoUmTerco = quinzena / 3;
  const total = quinzena + acrescimoUmTerco; // quinzena * 4/3
  const diasGozados = (15 - dias_vendidos) as 0 | 5 | 10 | 15;

  let vendaParcelaComUmTerco = 0;
  let umTercoDiasGozados = 0;
  let recebe = 0;

  if (dias_vendidos === 0) {
    // Não vende: recebe 1/3 da comissão (= quinzena)
    recebe = quinzena / 3;
  } else {
    vendaParcelaComUmTerco = (total * dias_vendidos) / 30;
    umTercoDiasGozados = (acrescimoUmTerco * diasGozados) / 30;
    recebe = vendaParcelaComUmTerco + umTercoDiasGozados;
  }

  return {
    cenario: dias_vendidos,
    diasGozados,
    valorMensal: r2(valorMensal),
    quinzena: r2(quinzena),
    acrescimoUmTerco: r2(acrescimoUmTerco),
    total: r2(total),
    vendaParcelaComUmTerco: r2(vendaParcelaComUmTerco),
    umTercoDiasGozados: r2(umTercoDiasGozados),
    recebe: r2(recebe),
  };
}

export function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
