# Corrigir a inconsistência de horas na página /dev

## Diagnóstico confirmado

- O **TOTAL GERAL** exibido no rodapé soma `hours` da tabela consolidada `dev_tracker`.
- O **TOTAL DO HISTÓRICO** soma `hours` da tabela cronológica `dev_tracker_log`, respeitando os filtros da aba.
- São cadastros independentes, atualizados separadamente; isso contraria a regra solicitada de apresentar o mesmo conteúdo em duas organizações diferentes.
- A diferença exata será levantada pelo **SQL Editor do projeto Supabase**, sem depender de permissões adicionais no Lovable. Nenhuma correção de dados será feita por estimativa.

## Ajuste proposto

### 1. Uma base única, duas visualizações
- Definir `dev_tracker_log` como fonte oficial de todos os lançamentos: **data, sistema/categoria, funcionalidade, descrição, tipo, horas e valor**.
- A visão **por categorias/sistema** e a visão **cronológica** exibirão exatamente os mesmos lançamentos, mudando apenas o agrupamento e a ordenação.
- O total geral da página e dos PDFs será calculado exclusivamente a partir do histórico completo, sem filtros.
- Filtros continuarão produzindo um subtotal identificado claramente como **Total do período filtrado**.

### 2. Corrigir a estrutura da página
- Substituir a leitura de `dev_tracker` nas abas **Todos** e por sistema pela mesma lista de `dev_tracker_log` usada no Histórico.
- Agrupar essa lista por sistema/categoria nas abas consolidadas e por data/mês na aba Histórica.
- Não manter dois cadastros editáveis nem dois totais concorrentes.
- Quando não houver filtros, **Total Geral** e **Total do Histórico** serão necessariamente iguais; com filtros, a tela mostrará claramente o subtotal filtrado e o total geral completo.

### 3. Auditoria e recuperação integral das horas
- Executar no SQL Editor uma consulta somente de leitura que apresente: total das duas tabelas, totais por sistema e lista completa dos registros de ambas. O resultado será usado para fechar a diferença real antes de qualquer alteração.
- Comparar totais e registros por sistema nas duas tabelas, produzindo uma relação objetiva do que existe apenas no consolidado, apenas no histórico e do que tem horas divergentes.
- Preservar todos os lançamentos históricos já válidos e recuperar cada funcionalidade/hora ausente; não aceitar uma perda aproximada de 500 horas nem reduzir o consolidado para forçar igualdade.
- Para itens antigos sem data individual comprovável, usar a melhor data documental disponível nas migrations/planos e marcar a origem da reconstrução, em vez de inventar ou descartar horas.
- Gerar uma migration idempotente de reconciliação para execução no SQL Editor do Supabase, sem duplicações, registrando totais por sistema e total geral antes/depois.
- Só considerar a base reconciliada quando a soma histórica cobrir integralmente o total legítimo já registrado e todas as diferenças estiverem justificadas.

### 4. Evitar novas divergências
- Criar, editar ou excluir um lançamento será feito uma única vez em `dev_tracker_log`; todas as abas e totais serão atualizados pela mesma consulta/cache.
- Remover da interface e dos PDFs qualquer leitura ou soma paralela baseada em `dev_tracker`.
- Descontinuar a edição direta do cadastro consolidado para impedir que duas fontes voltem a divergir.
- Adicionar uma verificação visual discreta caso algum registro histórico tenha sistema inválido ou horas ausentes, impedindo a emissão de relatório inconsistente.

### 5. Relatório final
- O PDF consolidado e o PDF histórico usarão a mesma base e fecharão no mesmo total quando não houver filtros.
- O PDF filtrado indicará explicitamente o período/sistema aplicado e apresentará o subtotal correspondente, sem chamá-lo de total geral.
- Validar a tela e os dois PDFs com os totais por sistema, por mês e total final antes da entrega.
- Exibir um bloqueio no botão de PDF se a auditoria detectar lançamentos inválidos, evitando entregar um relatório sabidamente inconsistente.

## Detalhes técnicos

- Centralizar listagem e cálculos em dados de `dev_tracker_log` carregados uma única vez pela página.
- Derivar totais geral, por sistema, por mês e filtrado com funções compartilhadas para evitar fórmulas divergentes.
- Consultar os dados reais pelo SQL Editor e criar a migration de reconciliação somente depois de fechar a auditoria registro a registro.
- Manter `dev_tracker` apenas como legado durante a transição; depois da validação, ele não participará mais da página nem dos relatórios.
- Preservar a restrição de acesso exclusiva da `/dev` e não alterar `/dev/deploy-guide`.
- Esta correção da própria página `/dev` não será lançada no histórico, conforme a regra vigente do projeto.
