## Plano de correção

Corrigir a premiação para que ela use a quinzena de venda como fonte principal dos dias vendidos, sem inverter venda e gozo.

### Comportamento esperado no caso do Pedro

- **1º período**: 15 dias vendidos, 0 dias usufruídos, usando as datas oficiais do 1º período como referência da venda.
- **2º período**: 0 dias vendidos, 15 dias usufruídos, usando as datas reais/oficiais do 2º período como referência do gozo.

### Ajustes propostos

1. **Corrigir cálculo de dias vendidos por período em `PremiacaoDialog.tsx**`
  - Se `quinzena_venda = 1` e `dias_vendidos = 15`, a 1ª quinzena recebe os 15 dias vendidos.
  - A 2ª quinzena recebe 0 vendidos e 15 usufruídos.
  - Manter fallback seguro para registros antigos sem `quinzena_venda`, respeitando o padrão já usado no módulo de Férias.
2. **Corrigir datas exibidas na premiação**
  - Para período totalmente vendido: preencher as datas com o período oficial vendido, não com uma data de gozo do outro período.
  - Para período usufruído: preencher as datas reais de gozo quando existirem; caso contrário, usar a quinzena oficial correspondente.
3. **Corrigir valores salvos e PDF**
  - Salvar `dias_vendidos` e `dias_gozados` coerentes com o período selecionado.
  - Gerar o PDF usando o mesmo cenário exibido no preview.
4. **Validação manual focada**
  - Conferir no fluxo de premiação que o caso Pedro fica: 1º período vendido 15/0 usufruído e 2º período vendido 0/15 usufruído.
  - Sem alterar cadastro de férias, banco, RLS ou edge functions.
5. Remoção da referência das células da tabela.
  1. Remova do dialog as referências as células da tabela, como por exemplo B4. Não precisa referenciar isso. Então remova os textos que mostrar isso do dialog, tanto de inclusão com de edição.
    &nbsp;