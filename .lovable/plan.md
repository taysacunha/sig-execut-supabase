## Plano: corrigir definitivamente o caso Maria de Lourdes

### Diagnóstico do que faltou

1. **Conflito falso com Iasmin**
   - A checagem de conflito ainda monta os intervalos novos a partir dos períodos oficiais (`quinzena1` e `quinzena2`) quando o cadastro está no modo **Padrão**.
   - No caso de venda padrão do 2º período, ela deveria comparar o gozo real: `22/06/2026 a 01/07/2026`, mas continua considerando também o período oficial completo até `06/07/2026` ou o 1º período já gozado.
   - Por isso aparece conflito mesmo sem sobreposição real.

2. **Ainda aparecem 25 dias**
   - A tela padrão ainda usa `diasGozo = 30 - diasVendidos` e `diasGozoNoPeriodoVenda = 15 - diasVendidos` sem descontar o 1º período já gozado como saldo indisponível para edição.
   - Para Maria, o saldo editável é só o 2º período: `15 - 5 = 10 dias`, não `30 - 5 = 25`.

3. **Erro da regra dez/jan no Padrão**
   - A regra de janeiro/dezembro está correta em exigir exceção quando se cria/altera férias em jan/dez.
   - Mas, ao editar um cadastro em que o 1º período jan/dez já foi gozado e não foi alterado, o sistema não deve bloquear o ajuste do 2º período por causa desse 1º período histórico. Deve validar jan/dez apenas para períodos que estão sendo alterados ou ainda editáveis.

4. **“1º Período” e “Ambos” ainda aparecem**
   - A correção anterior foi aplicada parcialmente apenas no seletor de venda em exceção.
   - O bloco de “Gozo em datas diferentes” ainda renderiza fixo `["1", "2", "ambos"]`, ignorando `q1JaGozada`.
   - Além disso, o modo Padrão ainda permite escolher venda no 1º período, mesmo quando Q1 já está gozada.

### Ajuste proposto

#### 1. Criar uma função única para períodos reais de gozo
No `FeriasDialog.tsx`, criar uma função auxiliar para montar os intervalos reais usados em:
- alerta de conflitos;
- validação de afastamentos;
- regra de conflito antes de salvar.

Ela vai considerar:
- exceção com `ferias_gozo_periodos`: usar os subperíodos reais;
- venda padrão: usar o período não vendido integral e, no período vendido, usar apenas o intervalo de gozo informado (`gozo_venda_inicio/fim`);
- venda padrão com Q1 já gozada e venda no 2º período: comparar somente o gozo real editável do 2º período (`22/06 a 01/07`) e não revalidar Q1 histórico;
- gozo diferente: usar as datas reais de gozo;
- sem ajustes: usar os períodos oficiais.

#### 2. Corrigir o cálculo visual de dias no modo Padrão
Quando `q1JaGozada = true`:
- limitar a venda padrão ao 2º período;
- calcular dias totais disponíveis como `15`;
- calcular dias de gozo como `15 - diasVendidos`;
- mostrar resumo como:
  - Dias totais do período aquisitivo: 30
  - Já gozados (1º período): -15
  - Disponíveis para ajuste: 15
  - Dias vendidos: -5
  - Dias de gozo: 10

#### 3. Bloquear o 1º período já gozado no Padrão
No seletor “Período da venda”:
- se Q1 estiver já gozada, ocultar ou desabilitar “1º Período”;
- forçar `quinzena_venda = 2` automaticamente se estiver como `1`;
- exibir aviso informando que o 1º período já foi gozado e só o 2º pode ser ajustado, a menos que a data do 1º período seja alterada para uma data ainda não gozada.

#### 4. Corrigir opções de exceção para gozo diferente
No `ExcecaoPeriodosSection.tsx`:
- usar as opções filtradas também no bloco “Gozo em datas diferentes”;
- se `q1JaGozada = true`, mostrar apenas “2º Período”; opcionalmente manter “Livre” apenas para venda, não para gozo diferente;
- impedir renderização do `SubPeriodosList` do 1º período quando Q1 já está gozada;
- garantir que `distribuicaoTipo` seja resetado para `2` quando vier como `1` ou `ambos`.

#### 5. Ajustar regra jan/dez para edição de Q1 já gozada
No `validateVacation`:
- continuar exigindo exceção para novas férias em janeiro/dezembro;
- continuar exigindo exceção se o usuário alterar Q1 para janeiro/dezembro;
- em edição, se Q1 já está gozada e as datas de Q1 não foram alteradas, não usar esse Q1 histórico como motivo para bloquear o salvamento padrão do ajuste do 2º período;
- validar Q2 normalmente, pois ele é o período sendo ajustado.

#### 6. Mensagem de erro mais clara
Quando o Padrão for bloqueado, a mensagem deve listar o motivo exato, por exemplo:
- “Férias em janeiro/dezembro no 2º período exige exceção”; ou
- “Conflito de setor com Iasmin...”; ou
- “Venda acima de 10 dias exige exceção”.

### Arquivos a alterar

| Arquivo | Alteração |
|---|---|
| `src/components/ferias/ferias/FeriasDialog.tsx` | Corrigir intervalos reais de gozo, cálculo de dias disponíveis, validação jan/dez e bloqueio do 1º período já gozado no Padrão |
| `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx` | Filtrar “1º Período” e “Ambos” também em gozo diferente e impedir subperíodos de Q1 consumida |

### Resultado esperado para Maria de Lourdes

- Ajustando o 2º período para venda de 5 dias:
  - período real comparado: `22/06/2026 a 01/07/2026`;
  - não deve aparecer conflito com Iasmin (`13/07 a 27/07` não sobrepõe);
  - resumo deve mostrar 10 dias de gozo disponíveis no 2º período, não 25;
  - no Padrão, não deve bloquear por causa do 1º período já gozado em dez/jan;
  - em Exceção, “1º Período” e “Ambos” não devem aparecer enquanto Q1 permanecer já gozada e inalterada.