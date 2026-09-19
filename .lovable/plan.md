# Fechar as pontas soltas de permissões, veículos, recorrências e imóveis

## Diagnóstico confirmado no código

1. **Campos vazios em Veículos:** a página carrega Motorista e Proprietário por `despesas_pessoas` e Centro de custo por `despesas_centros_custo`. As regras de leitura dessas tabelas auxiliares não incluem a permissão da aba **Veículos** (nem **Bens**, no caso de centros/pessoas). Assim, um usuário pode ver o veículo, mas receber vazios nos dados relacionados. Isso explica a diferença por perfil/permissões; a comparação exata entre STI e Taysa será feita no banco antes da alteração.
2. **Recorrências de veículos fora do Calendário:** a função genérica que transforma recorrências em lançamentos ainda não copia `veiculo_id`. A recorrência fica vinculada ao veículo, mas o lançamento nasce sem esse vínculo; como o Calendário de Veículos mostra apenas lançamentos com `veiculo_id`, ele não aparece.
3. **Centro “Apoio” ausente em Novo Bem:** a permissão da aba **Bens** e a permissão por centro de custo são controles separados. Além disso, a política da lista de centros não contempla a aba Bens. O resultado pode ser uma lista incompleta mesmo quando a pessoa acessa a página.
4. **Erro ao editar imóvel:** a tela oferece a situação `em_aquisicao`, mas a regra atual de `despesas_imoveis` aceita somente `alugado`, `vago`, `vendido` e `proprio_uso`. Salvar “Em aquisição” viola exatamente `despesas_imoveis_situacao_check`.

## Correção

1. **Auditar STI, Taysa e Germana no banco**
   - Comparar perfil, acesso ao sistema Despesas, níveis das abas e centros de custo concedidos.
   - Conferir o centro “Apoio”, os veículos afetados, suas pessoas relacionadas e as recorrências/lançamentos vinculados.
   - Separar claramente diferença legítima de configuração de falha das regras.

2. **Alinhar os dados auxiliares às páginas que dependem deles**
   - Permitir leitura de pessoas para quem pode visualizar Veículos ou Bens, preservando a proteção dos dados pessoais e retornando somente os campos necessários na interface.
   - Permitir que Veículos e Bens carreguem centros de custo, limitados aos centros explicitamente concedidos ao usuário.
   - Manter edição/exclusão desses cadastros restrita às permissões atuais; a mudança será somente na leitura necessária aos formulários e relacionamentos.
   - Garantir que STI veja Motorista, Proprietário e Centro de custo dos veículos que já pode visualizar.

3. **Corrigir e reparar recorrências de veículos**
   - Atualizar `despesas_gerar_ocorrencias` para copiar `veiculo_id` da recorrência para cada lançamento gerado.
   - Corrigir lançamentos existentes que tenham `serie_recorrencia_id` apontando para recorrência de veículo, mas estejam com `veiculo_id` vazio.
   - Não alterar lançamentos manuais nem substituir vínculos já preenchidos.
   - Validar o Calendário de Veículos no mês e no ano, incluindo o filtro por veículo e o escopo de centro de custo do usuário.

4. **Corrigir a situação “Em aquisição” dos imóveis**
   - Atualizar `despesas_imoveis_situacao_check` para aceitar `em_aquisicao`, em conformidade com a opção já disponível na tela.
   - Conferir os imóveis afetados antes e depois e testar a edição feita por um usuário com permissão adequada.
   - Traduzir esse tipo de erro para uma mensagem compreensível caso outro valor inválido apareça futuramente.

5. **Validar os quatro cenários e registrar em `/dev`**
   - STI: campos relacionados preenchidos nos veículos permitidos.
   - STI: centro “Apoio” disponível no novo bem somente se estiver concedido ao usuário; caso contrário, corrigir a concessão identificada na auditoria.
   - Recorrências: lançamentos existentes reparados e novos lançamentos aparecendo no Calendário de Veículos.
   - Germana: imóvel salvo sem violar a regra de situação.
   - Registrar a correção completa no histórico de desenvolvimento.

## Detalhes técnicos

- A alteração de banco será feita por migração única e idempotente, preservando RLS e permissões por centro de custo.
- A atualização de lançamentos existentes usará `serie_recorrencia_id` como origem confiável e somente preencherá `veiculo_id IS NULL`.
- Não será ampliado acesso geral ao módulo: as leituras auxiliares continuarão condicionadas às abas e aos centros permitidos.
- Como a leitura do banco está bloqueada no momento, nenhum dado específico de STI, Taysa ou Germana será tratado como confirmado até a auditoria do passo 1.
