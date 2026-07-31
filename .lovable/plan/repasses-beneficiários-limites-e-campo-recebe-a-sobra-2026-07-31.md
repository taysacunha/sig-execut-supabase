# Repasses — beneficiários: limites e campo "recebe a sobra"

## Como funciona hoje (confirmado no código)

- **Valor**: o que o beneficiário recebe naquela competência (mês). É o valor efetivo.
- **Limite mês**: teto opcional daquele beneficiário no mês. Um gatilho no banco impede salvar Valor maior que o limite mensal.
- **Limite ano**: teto opcional por pessoa dentro do ano da competência, guardado na conta de repasse (não no mês). Por isso ele **não aparece no formulário de adicionar** — só existe na coluna "Limite ano" da tabela e é editável ao clicar no lápis da linha. Na leitura, a coluna mostra o limite e quanto a pessoa já recebeu no ano.
- **Recebe a sobra (residual)**: marca um único beneficiário por competência (normalmente a proprietária). O botão **"Distribuir por limite"** preenche os demais até o limite mensal (respeitando também o saldo anual) e joga **todo o restante do líquido** para o beneficiário marcado. Sem ninguém marcado, o botão avisa e não distribui.
- **Desalinhamento**: o checkbox "Recebe a sobra" está renderizado **dentro da célula/campo Observação**, tanto na linha de edição quanto no formulário de adicionar — é isso que empurra o layout.

## O que será ajustado

1. **Coluna própria para "Sobra"**: tirar o checkbox de dentro de Observação e criar uma coluna curta e centralizada "Sobra" na tabela (com dica "Recebe o valor restante do mês"), alinhada em todas as linhas. Observação volta a ser só o texto.
2. **Formulário de adicionar**: reorganizar a grade para Pessoa | Valor | Limite mês | Limite ano | Recebido em | Observação | Sobra | Adicionar, com o checkbox em coluna própria (não abaixo de Observação) e **incluir o campo Limite ano já na adição**, salvo junto com o beneficiário.
3. **Clareza dos campos**: rótulos com dica curta — "Valor (do mês)", "Limite mês (teto)", "Limite ano (teto no ano)" — e um texto de ajuda acima da tabela explicando em uma linha a diferença entre valor, teto mensal, teto anual e sobra.
4. **Sobra visível**: mostrar na linha do residual o quanto sobra para ela (líquido menos os demais), para conferência antes de distribuir.

## Detalhes técnicos

- `src/components/despesas/RepasseDialog.tsx`: nova coluna "Sobra" no cabeçalho e nas linhas (leitura e edição), ajuste das larguras `table-fixed`, remoção do checkbox de dentro da célula Observação, grade do formulário de adicionar com coluna de limite anual e de sobra.
- No `adicionarBenef`, chamar também `useSaveLimiteAnual` quando o campo Limite ano for preenchido (mesma chamada já usada na edição).
- Sem mudanças de banco: `valor_limite`/`is_residual` já existem em `despesas_repasse_beneficiarios` e o limite anual em `despesas_repasse_benef_limite_anual`.