## Objetivo
Garantir que o texto digitado no campo **Observações** seja exibido por completo nos PDFs de **Afastamentos** e **Perdas de Folga**, sem cortes com reticências.

## Contexto atual
Ambos os relatórios usam `jsPDF` em modo paisagem (A4). As linhas têm altura fixa de 7 mm e os textos são truncados com reticências (`truncate(...)`) antes de serem desenhados:

- `AfastamentosPDFGenerator.tsx`: observações truncadas em 28 caracteres.
- `PerdasFolgaPDFGenerator.tsx`: observações truncadas em 35 caracteres.

Como a altura da linha é fixa, mesmo que reduzíssemos a fonte o corte continuaria para textos maiores. A solução é **quebrar o texto em várias linhas e expandir a altura da linha dinamicamente**.

## Passos

### 1. AfastamentosPDFGenerator.tsx
- Substituir a função `truncate` por `splitTextToSize` do jsPDF para as colunas que podem conter texto longo (nome, setor, motivo e, principalmente, observações).
- Calcular a altura de cada linha com base na maior quantidade de linhas geradas entre as colunas daquela linha.
- Ajustar o desenho do fundo zebrado para a nova altura.
- Recalcular a verificação de quebra de página (`pageHeight - 18`) considerando a altura real da próxima linha.
- Se necessário, redistribuir larguras das colunas anteriores para dar mais espaço à coluna de observações, sem alterar os dados ou filtros.

### 2. PerdasFolgaPDFGenerator.tsx
- Aplicar a mesma lógica de quebra de linha e altura dinâmica para observações.
- Aproveitar para também quebrar textos longos das colunas `Colaborador`, `Setor` e `Motivo`, mantendo a tabela legível.
- Ajustar retângulos de fundo e quebras de página conforme a nova altura variável.

### 3. Testes/QA
- Gerar PDFs de exemplo com observações curtas, médias e muito longas.
- Verificar se:
  - Nenhum texto aparece cortado com "…".
  - O conteúdo não ultrapassa as margens.
  - Linhas adjacentes não se sobrepõem.
  - Quebras de página continuam funcionando corretamente.

## O que não muda
- Os diálogos de filtro (colaboradores, motivos, mês/ano) permanecem iguais.
- A lógica de busca no Supabase e os dados retornados não são alterados.
- O formato do PDF continua sendo A4 paisagem, gerado no cliente.