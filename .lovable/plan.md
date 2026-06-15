Plano para corrigir de forma definitiva a regra de perda no preview:

1. Tornar a perda uma regra de bloqueio absoluta no gerador
- Antes de qualquer alocação, buscar perdas frescas de `ferias_folgas_perdas` para o `ano` e `mes` atuais.
- Montar um `Set` de `colaborador_id` com perda registrada.
- Excluir qualquer colaborador desse `Set` antes da formação de unidades individuais/familiares.
- Se um familiar tiver perda, apenas esse colaborador deve ficar excluído; o outro só participa se não tiver perda própria.

2. Adicionar uma trava final de segurança no preview
- Depois da distribuição, remover qualquer linha alocada cujo `colaborador_id` esteja no `Set` de perdas.
- Inserir esse colaborador apenas na lista de excluídos com status `Perda registrada`.
- Isso impede que qualquer etapa posterior, crédito ou rebalanceamento recoloque a pessoa como disponível.

3. Sincronizar cadastro e gerador
- Ao registrar ou excluir uma perda, invalidar/refazer as queries de perdas do mês e limpar previews antigos.
- Ao abrir o gerador, garantir leitura fresca das perdas do período antes de permitir gerar preview.

4. Deixar o diagnóstico claro
- Exibir no alerta do preview quantas perdas foram lidas do banco e quais colaboradores foram bloqueados por perda.
- Isso facilita confirmar imediatamente se o registro usado no preview é o mesmo da aba “Perdas de Folga”.

Arquivos envolvidos:
- `src/components/ferias/folgas/GeradorFolgasDialog.tsx`
- `src/components/ferias/folgas/PerdaFolgaDialog.tsx`
- `src/pages/ferias/FeriasFolgas.tsx`

Critério de aceite:
- Se existe perda registrada para colaborador + ano + mês, ele não aparece como disponível no preview.
- Se a perda for removida, ele volta a aparecer como elegível no preview sem recarregar a página.
- O preview nunca salva folga para colaborador com perda registrada no mês.