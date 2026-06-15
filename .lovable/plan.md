## Plano

1. **Fonte única da verdade para perdas do mês**
   - No `GeradorFolgasDialog`, antes de gerar o preview, consultar diretamente a tabela `ferias_folgas_perdas` para o `ano` e `mês` atuais.
   - Usar essa resposta direta para decidir exclusão por perda, sem depender do cache do React Query.

2. **Regra objetiva no gerador**
   - Se existir registro em `ferias_folgas_perdas` para `colaborador_id + ano + mes`, o colaborador entra no preview como excluído com motivo `Perda registrada`.
   - Se não existir registro, ele não será excluído por perda e volta a disputar folga normalmente, salvo outras regras como férias, afastamento ou experiência.

3. **Sincronização após registrar/remover perda**
   - Após registrar ou apagar perda, invalidar/refazer todas as queries relacionadas e também remover dados antigos do cache do gerador para evitar estado preso.
   - Ao abrir o Gerador, limpar preview antigo e buscar perdas atualizadas.

4. **Feedback de diagnóstico no preview**
   - Mostrar no diagnóstico do Gerador quantas perdas foram consideradas no momento da geração.
   - Isso deixa claro se o preview está usando a situação atual: com registro bloqueia; sem registro libera.

## Detalhes técnicos

- Alterar apenas:
  - `src/components/ferias/folgas/GeradorFolgasDialog.tsx`
  - `src/components/ferias/folgas/PerdaFolgaDialog.tsx`
  - `src/pages/ferias/FeriasFolgas.tsx`
- Não precisa alterar banco de dados.
- Não muda as demais regras de férias, afastamento, experiência, familiares ou créditos.