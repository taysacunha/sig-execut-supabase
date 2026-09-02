# Corrigir a inconsistência de horas na página /dev

## Diagnóstico confirmado

- O **TOTAL GERAL** exibido no rodapé soma `hours` da tabela consolidada `dev_tracker`.
- O **TOTAL DO HISTÓRICO** soma `hours` da tabela cronológica `dev_tracker_log`, respeitando os filtros da aba.
- São cadastros independentes, atualizados separadamente; portanto, hoje não existe garantia de igualdade.
- A consulta direta aos valores do banco não pôde ser executada porque a ferramenta de leitura do Supabase está desabilitada, e a sessão do preview não estava autenticada. A diferença exata ainda será levantada durante a execução.

## Ajuste proposto

### 1. Uma única fonte oficial para horas
- Definir `dev_tracker_log` como fonte oficial de **datas, horas e valores**.
- O total geral da página e dos PDFs será calculado exclusivamente a partir do histórico completo, sem filtros.
- Filtros continuarão produzindo um total filtrado, identificado claramente como **Total do período filtrado**.

### 2. Separar resumo de histórico
- Manter `dev_tracker` apenas como catálogo/resumo de funcionalidades e descrições, sem tratá-lo como segundo total financeiro.
- Na aba **Todos** e nas abas por sistema, exibir as horas consolidadas a partir dos lançamentos históricos daquele sistema.
- Na aba **Histórico**, não exibir simultaneamente um segundo rodapé com outro total; mostrar apenas o total oficial do histórico e, quando houver filtros, o total filtrado.

### 3. Reconciliação dos dados existentes
- Comparar totais por sistema nas duas tabelas e identificar exatamente onde estão as diferenças.
- Ajustar os lançamentos históricos existentes para que representem todo o trabalho já consolidado, sem duplicar ações.
- Não alterar títulos, descrições ou datas já corretos sem necessidade.
- Executar a correção por migration idempotente e registrar claramente os valores antes/depois.

### 4. Evitar novas divergências
- Ao criar, editar ou excluir um lançamento cronológico, todos os totais e resumos serão atualizados a partir da mesma consulta/cache.
- Remover qualquer soma de horas baseada diretamente em `dev_tracker` da interface e dos PDFs.
- Adicionar uma verificação visual discreta caso algum registro histórico tenha sistema inválido ou horas ausentes, impedindo a emissão de relatório inconsistente.

### 5. Relatório final
- O PDF consolidado e o PDF histórico usarão a mesma base e fecharão no mesmo total quando não houver filtros.
- O PDF filtrado indicará explicitamente o período/sistema aplicado e apresentará o subtotal correspondente, sem chamá-lo de total geral.
- Validar a tela e os dois PDFs com os totais por sistema e o total final antes da entrega.

## Detalhes técnicos

- Centralizar os cálculos em dados de `dev_tracker_log` carregados uma única vez pela página.
- Derivar totais geral, por sistema, por mês e filtrado com funções compartilhadas para evitar fórmulas divergentes.
- Criar migration de reconciliação somente após consultar os dados reais das duas tabelas.
- Preservar a restrição de acesso exclusiva da `/dev` e não alterar `/dev/deploy-guide`.
- Esta correção da própria página `/dev` não será lançada no histórico, conforme a regra vigente do projeto.
