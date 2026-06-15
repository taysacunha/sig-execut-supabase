Plano de correção

1. Usar a mesma fonte que a aba “Perdas de Folga” vê
- Passar as perdas carregadas em `FeriasFolgas` para `GeradorFolgasDialog`.
- No gerador, montar o bloqueio por perda pela união de três fontes: perdas da aba, cache local e consulta fresca ao Supabase.
- Resultado esperado: se a perda aparece na aba de perdas, o gerador obrigatoriamente considera essa pessoa bloqueada, sem precisar atualizar a página.

2. Atualizar o cache imediatamente ao registrar/remover perda
- Ao registrar perda, retornar a linha inserida e atualizar manualmente os caches relevantes do React Query, além de invalidar/refazer as consultas.
- Ao remover perda, limpar imediatamente essa pessoa dos caches do período.
- Resultado esperado: abrir o gerador logo após registrar/remover já reflete o estado novo.

3. Bloqueio absoluto dentro do preview
- Centralizar a regra: `colaborador_id` com perda no período nunca entra em unidade individual, familiar, crédito extra ou linha selecionável.
- Se aparecer em qualquer etapa por erro de lógica, converter para linha excluída com status “Perda registrada”.
- Remover também da seção “Créditos de Folga Disponíveis” enquanto houver perda no mês.

4. Trava final antes de salvar
- Antes de salvar a escala, consultar perdas novamente no Supabase.
- Se algum selecionado tiver perda registrada, cancelar o salvamento com mensagem clara e não inserir folga para essa pessoa.
- Resultado esperado: mesmo em caso de UI/cache inconsistente, a escala não salva colaborador com perda.

5. Validação visual rápida
- Verificar no preview que uma colaboradora com perda aparece apenas como “Perda registrada” em excluídos, e não como disponível/selecionável.
- Verificar também o caminho inverso: removendo a perda, ela volta a ficar elegível sem reload.