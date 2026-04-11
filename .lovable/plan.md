
Objetivo: corrigir de vez o card “Próximas Férias” para que a Taysa apareça quando tiver início em 24/04.

Diagnóstico mais provável pelo código atual:
1. O card já considera 1º e 2º período, então o problema restante tende a estar na origem dos dados.
2. O dashboard só usa `ferias_gozo_periodos` quando `gozo_flexivel = true`. Em outras telas, a lógica já é mais tolerante e considera os períodos flexíveis pela existência dos registros. Se a Taysa tiver subperíodos salvos mas o flag estiver inconsistente, o card ignora a data real.
3. A query de “Próximas Férias” busca todas as férias e filtra no cliente. Isso pode sofrer com o limite padrão de 1000 linhas do Supabase e deixar registros de fora sem aviso.
4. Depois de salvar/editar férias, o fluxo atual invalida `["ferias-ferias"]`, mas não invalida `["ferias-dashboard-proximas"]`. Com `staleTime` de 5 minutos no app, o card pode continuar mostrando cache antigo.

Plano de correção:
1. Confirmar a origem do caso da Taysa
- No modo de implementação, consultar o registro dela em `ferias_ferias` e, se existir, em `ferias_gozo_periodos`.
- Verificar especialmente:
  - `status`
  - `quinzena1_inicio` / `quinzena2_inicio`
  - `gozo_quinzena1_inicio` / `gozo_quinzena2_inicio`
  - `gozo_flexivel`
  - existência de linhas em `ferias_gozo_periodos`

2. Tornar a leitura de datas do dashboard consistente com o restante do módulo
- Extrair uma helper local no `FeriasDashboard.tsx` para resolver inícios reais da férias.
- Regra:
  - se houver períodos em `ferias_gozo_periodos`, usar esses períodos como fonte principal
  - senão, se `gozo_diferente`, usar `gozo_quinzena1/2`
  - senão, usar `quinzena1/2`
- Isso elimina dependência excessiva do flag `gozo_flexivel`.

3. Corrigir a query de “Próximas Férias” para não depender de carregar tudo
- Evitar buscar todas as férias sem recorte.
- Montar a lista usando apenas registros relevantes para a janela de hoje até +30 dias:
  - férias padrão/gozo diferente com datas de início no intervalo
  - férias flexíveis com `ferias_gozo_periodos.data_inicio` no intervalo
- Se necessário, unir os dois conjuntos no cliente e deduplicar por `ferias.id`.

4. Atualizar o cache do dashboard quando férias forem alteradas
- Ao salvar/excluir férias em `FeriasDialog.tsx` e `FeriasFerias.tsx`, invalidar também:
  - `["ferias-dashboard-proximas"]`
  - `["ferias-dashboard-ferias-mes"]`
  - `["ferias-dashboard-alertas"]`
- Assim o card reflete a alteração imediatamente, sem esperar os 5 minutos do cache.

Arquivos a ajustar:
1. `src/pages/ferias/FeriasDashboard.tsx`
2. `src/pages/ferias/FeriasFerias.tsx`
3. `src/components/ferias/ferias/FeriasDialog.tsx` (se a invalidação ficar centralizada no próprio dialog)

Validação após implementar:
1. Confirmar que a Taysa aparece no card com 24/04.
2. Testar férias com:
- 1º período
- 2º período
- `gozo_diferente`
- períodos em `ferias_gozo_periodos`
3. Editar uma férias e verificar se o dashboard atualiza na hora, sem precisar esperar cache.
