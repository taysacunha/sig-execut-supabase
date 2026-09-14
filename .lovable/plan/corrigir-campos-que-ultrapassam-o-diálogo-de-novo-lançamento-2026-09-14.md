# Corrigir campos que ultrapassam o diálogo de novo lançamento

## Objetivo
Manter o diálogo amplo para os seletores, mas impedir que os campos **Tipo** e **Nº do documento** encostem ou passem pelas laterais e pela barra de rolagem.

## Alterações
- Aplicar uma pequena margem horizontal interna na área rolável do formulário, reservando espaço entre os campos, a borda esquerda e a barra de rolagem à direita.
- Garantir que as duas colunas possam encolher corretamente dentro da grade e que `Tipo` e `Nº do documento` respeitem 100% da largura disponível.
- Manter a distribuição em duas colunas no computador e uma coluna em telas menores.
- Não reduzir a largura geral do diálogo nem desfazer os seletores largos e os textos completos já ajustados.

## Validação
- Abrir **+ A pagar** e **+ A receber** no calendário de Despesas.
- Conferir que os dois campos ficam inteiramente visíveis, com folga equivalente nas laterais e sem sobreposição com a barra de rolagem.
- Verificar o comportamento em largura de notebook e celular, além da compilação do projeto.

## Detalhes técnicos
A correção ficará restrita ao conteúdo do formulário em `LancamentoDialog`, usando contenção de largura (`min-w-0`/`w-full`) e uma reserva horizontal interna na área rolável. Nenhuma regra global dos demais diálogos será alterada.
