## Motivo do erro

O problema não parece ser instrução do usuário: é lógica do sistema.

Hoje o cadastro salva `dias_vendidos` como total, mas a tela tenta descobrir a divisão por período indiretamente a partir de `ferias_gozo_periodos`. Essa tabela guarda os dias de gozo real, não os dias vendidos. Por isso, no caso do Diego:

```text
Venda correta: 1º período = 5 dias vendidos; 2º período = 15 dias vendidos
Gozo real:     1º período = 10 dias gozados; 2º período = 0 dias gozados
```

A regra atual faz `15 - dias_gozo` por período, mas sem gravar/usar `dias_vendidos_q1` e `dias_vendidos_q2` de forma confiável. Além disso, a consulta da página de férias não está buscando o campo `tipo` de `ferias_gozo_periodos`, então qualquer período pode ser tratado como venda por fallback. O resultado é que a exibição pode inverter ou cair no comportamento legado, mostrando “15 dias no 1º período”.

## Plano de correção

1. **Criar uma função única para resolver venda por período**
   - Prioridade 1: usar `dias_vendidos_q1` e `dias_vendidos_q2`, quando existirem.
   - Prioridade 2: quando não existirem, inferir pelo gozo real apenas se a soma bater com `dias_vendidos`.
   - Prioridade 3: fallback legado usando `quinzena_venda`, mas com venda acima de 15 distribuída corretamente.

2. **Corrigir o salvamento no `FeriasDialog`**
   - Ao salvar férias com venda, gravar explicitamente:
     - `dias_vendidos_q1`
     - `dias_vendidos_q2`
   - Para o Diego, o payload deve ficar:
     - `dias_vendidos = 20`
     - `dias_vendidos_q1 = 5`
     - `dias_vendidos_q2 = 15`
   - Isso remove a ambiguidade e impede inversões futuras.

3. **Corrigir a página `/ferias/ferias`**
   - Buscar também o campo `tipo` em `ferias_gozo_periodos`.
   - Usar a função única para exibir o campo “Venda”.
   - O Diego passará a aparecer como:
     - `1º período: 5 dias`
     - `2º período: 15 dias`

4. **Corrigir o diálogo de premiação**
   - Usar a mesma regra única de venda por período.
   - Assim o lançamento de premiação vai considerar o período certo, sem inverter gozo e venda.

5. **Corrigir registros antigos já inconsistentes**
   - Para registros antigos sem `dias_vendidos_q1/q2`, a tela continuará inferindo quando possível.
   - Se os dados antigos forem ambíguos, o sistema não deve inventar o contrário: deve usar o fallback legado ou exigir edição/salvamento do registro para preencher a divisão explícita.

## Resultado esperado

- Diego com 20 dias vendidos será exibido como `1º período: 5 dias` e `2º período: 15 dias`.
- Rejane com 10 dias vendidos no primeiro e 5 no segundo será exibida e premiada corretamente.
- A lógica deixa de depender de interpretação invertida entre “dias gozados” e “dias vendidos”.