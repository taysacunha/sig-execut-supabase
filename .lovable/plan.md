

# Plano: Corrigir target fixo de Andrea (e qualquer corretor)

## Causa raiz — uma única linha de código

**Linhas 2927-2928** do `scheduleGenerator.ts`:

```typescript
if (prevWeekStats && prevWeekStats.external_count >= 2) {
  target = 1;
}
```

Se Andrea (ou qualquer corretor) teve 2 externos na semana anterior, o target cai para 1 na semana seguinte. Com target=1:

1. Ela recebe 1 externo nos passes iniciais
2. O sorting (linha 1876) verifica `externalShiftCount < targetExternals` — com 1/1, ela está "satisfeita"
3. Outros corretores com target=2 passam na frente
4. Andrea nunca recebe o 2º externo
5. Demandas ficam sem alocação

Isso se repete semana após semana: target=1 → recebe 1 → próxima semana teve 1 (não 2) → mas o padrão já se estabeleceu pela fila.

## Correção — cirúrgica, sem mexer em mais nada

**Remover as linhas 2927-2928**. O target base será sempre 2 para todos os corretores, sem alternância. A distribuição equilibrada já é garantida pelo sorting por `externalShiftCount` (linha 1884) e pelo gate global — não precisa de redução artificial de target.

Nenhuma outra mudança necessária. Nenhuma regra precisa ser quebrada. Andrea simplesmente será tratada igual aos demais.

