# Fechar as pontas soltas de permissões, veículos, recorrências e imóveis

## Diagnóstico confirmado no código

1. **Campos vazios em Veículos:** a página carrega Motorista e Proprietário por `despesas_pessoas` e Centro de custo por `despesas_centros_custo`. As regras dessas tabelas auxiliares ainda dependem de outras abas e não reconhecem **Veículos**. Por isso, STI consegue abrir a página, mas os dados relacionados chegam vazios. Esse comportamento está incorreto: visualizar Veículos deve bastar para visualizar Motorista, Proprietário e Centro de custo dos veículos acessíveis, sem exigir acesso a Cadastros.
2. **Recorrências de veículos fora do Calendário:** a função genérica que transforma recorrências em lançamentos ainda não copia `veiculo_id`. A recorrência fica vinculada ao veículo, mas o lançamento nasce sem esse vínculo; como o Calendário de Veículos mostra apenas lançamentos com `veiculo_id`, ele não aparece.
3. **Centro “Apoio” ausente em Novo Bem:** a política da lista de centros não reconhece a aba **Bens**. Portanto, mesmo com Bens habilitado e o centro “Apoio” concedido na página de permissões, o seletor pode ficar incompleto.
4. **Erro ao editar imóvel:** a tela oferece a situação `em_aquisicao`, mas a regra atual de `despesas_imoveis` aceita somente `alugado`, `vago`, `vendido` e `proprio_uso`. Salvar “Em aquisição” viola exatamente `despesas_imoveis_situacao_check`.

## Correção

1. **Auditar STI, Taysa e Germana no banco**
   - Comparar perfil, acesso ao sistema Despesas, níveis das abas e centros de custo concedidos.
   - Conferir o centro “Apoio”, os veículos afetados, suas pessoas relacionadas e as recorrências/lançamentos vinculados.
   - Separar claramente diferença legítima de configuração de falha das regras.

2. **Alinhar os dados auxiliares às páginas que dependem deles**
   - Fazer a permissão **Visualizar Veículos** liberar os nomes de Motorista e Proprietário e o nome do Centro de custo vinculados aos veículos acessíveis, independentemente de acesso a Cadastros.
   - Fazer a permissão **Visualizar Bens** liberar os nomes necessários de Responsável/Fornecedor e os centros de custo concedidos ao usuário, independentemente de acesso a Cadastros.
   - Preservar a proteção dos demais dados pessoais: as páginas consumirão somente identificador e nome nos seletores e relacionamentos.
   - Restaurar nas regras de Veículos o filtro por centros de custo permitidos, removido acidentalmente quando Veículos ganhou permissão própria; assim, a permissão da aba define a função disponível e a permissão de centro define quais registros podem ser vistos.
   - Manter edição/exclusão desses cadastros restrita às permissões atuais; a mudança será somente na leitura necessária aos formulários e relacionamentos.
   - Garantir que STI veja Motorista, Proprietário e Centro de custo sem receber acesso à página Cadastros.

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
   - STI: centro “Apoio” disponível no novo bem quando a concessão já registrada para ele for confirmada, sem exigir acesso a Cadastros.
   - Recorrências: lançamentos existentes reparados e novos lançamentos aparecendo no Calendário de Veículos.
   - Germana: imóvel salvo sem violar a regra de situação.
   - Registrar a correção completa no histórico de desenvolvimento.

## Detalhes técnicos

- A alteração de banco será feita por migração única e idempotente, preservando RLS e permissões por centro de custo.
- A atualização de lançamentos existentes usará `serie_recorrencia_id` como origem confiável e somente preencherá `veiculo_id IS NULL`.
- Não será ampliado acesso geral ao módulo: as leituras auxiliares continuarão condicionadas às abas e aos centros permitidos.
- Como a leitura do banco está bloqueada no momento, nenhum dado específico de STI, Taysa ou Germana será tratado como confirmado até a auditoria do passo 1.
