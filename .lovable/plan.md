## Correção do cenário "não vende" na premiação

### Problema
Para colaborador que não vende dias (goza os 15), o cálculo atual usa B5 = B4/3 (1.600/3 = 533,33) como valor recebido. Está errado.

### Regra correta
Para `dias_vendidos = 0`, partindo da premiação base B4 = 1.600:
- **Comissão de 15 dias** = B4 / 2 → 800,00
- **1/3 sobre a comissão** = 800 / 3 → 266,67
- **RECEBIDO** = 266,67

O recibo deve continuar exibindo `PREMIAÇÃO = 1.600,00` (valor base), mas a linha de cálculo e o valor recebido devem usar os novos valores.

### Layout do PDF/preview no cenário "não vende"
```
PREMIAÇÃO                                       R$ 1.600,00
COMISSÃO 15 DIAS DE FÉRIAS                      R$   800,00
1/3 SOBRE A COMISSÃO                            R$   266,67
RECEBIDO DIA dd/mm/aaaa                         R$   266,67
```

### Alterações
**`src/lib/premiacaoCalc.ts`**
- Adicionar campos: `comissao15` (B4/2) e `umTercoComissao` (comissao15/3) usados somente quando `cenario === 0`.
- Para `cenario === 0`: `recebe = umTercoComissao` (≈ 266,67), sem alterar B4 exibido.
- Manter intactos cenários 5/10/15 (lógica B4–B9 atual permanece).

**`src/lib/premiacaoPdf.ts`**
- No bloco `if (calc.cenario === 0)`, substituir as linhas atuais por:
  - `PREMIAÇÃO` → `formatBRL(valorPremiacao)` (1.600)
  - `COMISSÃO 15 DIAS DE FÉRIAS` → `formatBRL(comissao15)` (800)
  - `1/3 SOBRE A COMISSÃO` → `formatBRL(umTercoComissao)` (266,67)
  - `RECEBIDO DIA …` → `formatBRL(recebe)` (266,67, em negrito)

**Preview no `PremiacaoDialog.tsx`**
- Atualizar a tabela de preview do cenário "não vende" para refletir as quatro linhas acima, espelhando o PDF.

### Não muda
- Cenários vende 5/10/15.
- Dialog "Lançar Premiação" (campos, datas).
- Hooks, schema, badges, coluna "Recebimento atestado", "Última exportação".
