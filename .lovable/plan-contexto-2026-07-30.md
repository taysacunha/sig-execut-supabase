Ajustar largura do campo "Valor" na aba Beneficiários do diálogo de Repasse

## Contexto
O usuário reportou que o campo de valor na aba Beneficiários do `RepasseDialog` está muito pequeno, dificultando a visualização do valor digitado. O campo aparece tanto na linha de adição de novo beneficiário quanto no modo de edição inline de beneficiários existentes.

## Objetivo
Ampliar o campo de valor para que o usuário consiga visualizar confortavelmente os valores inseridos, sem quebrar o layout do diálogo.

## Alterações propostas

### 1. Aumentar a largura da coluna de valor na tabela de beneficiários
- No `TableHead` de "Valor", remover a classe genérica e atribuir uma largura mínima maior (ex.: `w-40` ou `min-w-[10rem]`).
- No modo de edição inline, envolver o `Input` de valor em uma célula com `className="w-40"` ou similar.

### 2. Reorganizar o grid de adição de novo beneficiário
- Atualmente o grid é `md:grid-cols-[2fr_1fr_1fr_auto]`. A coluna de valor (1fr) fica apertada.
- Mudar para `md:grid-cols-[2fr_minmax(10rem,1fr)_1fr_auto]` ou `md:grid-cols-[2fr_140px_1fr_auto]` para garantir largura mínima no campo de valor.
- Garantir que o `Input` de valor ocupe 100% da célula e tenha `text-right` para alinhamento de moeda.

### 3. Validar responsividade
- Testar no viewport atual do usuário (1126x691 CSS px; dpr=1.25) para garantir que o campo não fique cortado.
- Em telas menores, o grid pode empilhar em uma coluna, mantendo a usabilidade.

### 4. Verificar consistência visual
- Manter o botão "Restante" ao lado do input de valor na adição.
- Preservar o mascaramento de valores (olho) já implementado no contexto `DespesasValuesContext`.

## Arquivos afetados
- `src/components/despesas/RepasseDialog.tsx` — ajustes de layout na aba Beneficiários.

## Critérios de aceitação
- O campo de valor na aba Beneficiários deve ter largura suficiente para exibir valores como "R$ 30.000,00" sem truncamento.
- O layout do diálogo não deve ultrapassar a tela ou quebrar em colunas desproporcionais.
- O modo de edição inline deve refletir o mesmo alargamento da coluna de valor.
