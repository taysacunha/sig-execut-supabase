## Objetivo
No relatório individual do corretor (`Relatórios > Corretores`), o card **Leads** hoje mostra apenas `Recebidos` (número grande) e a linha `Ativos: X | Visitas: Y`. Adicionar logo abaixo a informação de **Descartados**, com contagem, percentual e um ícone de alerta (âmbar) ou check (verde), seguindo exatamente o mesmo padrão visual já usado no dialog de Avaliação.

## Regra do ícone (idêntica à Avaliação)
- `archived / received > 0.5` (mais de 50% descartados) → `AlertTriangle` âmbar.
- Caso contrário → `CheckCircle2` verde.
- Se `received === 0` → considerar sem alerta (check verde), percentual `0%`.

## Alterações (apenas frontend)

### `src/components/vendas/BrokerIndividualReport.tsx`
1. Query `broker-leads-history` (linha ~248): incluir `leads_archived` no `select` e no objeto retornado (novo campo `descartados`).
2. Totais (linha ~376): adicionar
   - `totalLeadsArchived = reportLeadsData.reduce((acc, l) => acc + l.descartados, 0)`
   - `archivedPercent = totalLeads > 0 ? Math.round(totalLeadsArchived / totalLeads * 100) : 0`
   - `hasLeadsAlert = totalLeads > 0 && totalLeadsArchived / totalLeads > 0.5`
3. Imports: adicionar `AlertTriangle` e `CheckCircle2` de `lucide-react`.
4. Card **Leads** (linhas ~724-737): manter valor grande (`totalLeads`) e a linha `Ativos: X | Visitas: Y`; adicionar logo abaixo uma segunda linha com o ícone (alerta/check) + `Descartados: N (P%)`, ex.:

   ```tsx
   <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
     {hasLeadsAlert
       ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
       : <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
     Descartados: {totalLeadsArchived} ({archivedPercent}%)
   </p>
   ```

Nenhum outro arquivo, query ou lógica de negócio é alterado. Sem mudanças no PDF/export nem no dialog de avaliação.
