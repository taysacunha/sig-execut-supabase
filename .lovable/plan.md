## Problema
Na página `Vendas > Relatórios`, aba **Corretores**, o botão de olho (`Eye`/`EyeOff`) no topo (`SalesReports.tsx`) alterna o state `showValues`, mas esse valor **não é repassado** ao componente `BrokerIndividualReport`. Por isso, o card **VGV Total** do relatório individual continua exibindo o valor mesmo com o olho desativado.

## Correção (apenas frontend, escopo mínimo)

### 1. `src/components/vendas/BrokerIndividualReport.tsx`
- Adicionar prop opcional `showValues?: boolean` (default `true` para não quebrar outros usos) na interface `BrokerIndividualReportProps` e na assinatura da função.
- No card **VGV Total** (linha ~679), trocar:
  ```tsx
  <div className="text-xl font-bold text-primary">{formatCurrencyFull(totalVGV)}</div>
  ```
  por:
  ```tsx
  <div className="text-xl font-bold text-primary">
    {showValues ? formatCurrencyFull(totalVGV) : "R$ ******"}
  </div>
  ```

### 2. `src/pages/vendas/SalesReports.tsx`
- Linha 815: passar a prop:
  ```tsx
  <BrokerIndividualReport teamFilter={selectedTeamId} showValues={showValues} />
  ```

## Fora do escopo
- Gráfico "Evolução de VGV", tooltips, PDF export e demais lugares que exibem valores monetários no relatório individual não serão alterados, pois o usuário pediu especificamente o card **VGV Total**.