# PDFs da página /dev com texto completo

## Problema

Nos dois PDFs gerados na página `/dev` (aba principal e aba Histórico), os campos **Funcionalidade** e **Descrição** são cortados com `substring(...)` antes de ir para o PDF, e cada lançamento é impresso em uma única linha — qualquer texto mais longo desaparece.

## Correção

Em `src/pages/DevTracker.tsx` (`handleExportPDF`) e `src/components/dev/DevHistoryTab.tsx` (`handleExportPDF`):

1. **Remover todos os `substring(...)`** — título e descrição vão para o PDF na íntegra.
2. **Quebra automática de linha** com `doc.splitTextToSize(texto, larguraDaColuna)`:
   - Descrição usa a largura disponível da coluna até o campo de horas (aprox. 120–185mm conforme o modo com/sem valor).
   - Título/funcionalidade quebra em até 2 linhas na coluna dele.
   - Descrição respeita as quebras de linha já existentes no texto (`\n`), pois `splitTextToSize` as preserva.
3. **Altura de linha dinâmica**: a linha passa a ter a altura do maior bloco (título vs. descrição), em vez de 5mm fixos.
4. **Quebra de página por linha inteira**: se a linha completa não couber no restante da página, abre página nova antes de imprimi-la (evita texto cortado entre páginas); a cada nova página o cabeçalho das colunas é reimpresso.
5. Manter inalterados: layout paisagem, cabeçalho, subtotais por mês/grupo, total geral, colunas de Horas/Valor condicionadas a `showValue`, e os nomes dos arquivos.

## Verificação

- Typecheck ao final (`bunx tsgo --noEmit -p tsconfig.app.json`).
- Gerar o PDF via preview e conferir visualmente que descrições longas aparecem completas, em múltiplas linhas, sem sobrepor a linha seguinte nem cortar entre páginas.

## Registro no histórico

Esta alteração é desenvolvimento da própria página `/dev` e, conforme a regra do projeto, **não** gera lançamento em `dev_tracker_log`.
