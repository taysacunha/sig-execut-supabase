## Plano

1. Ajustar o layout do `GeradorFolgasDialog` para garantir altura fixa calculável no estado de preview.
   - Trocar o `max-h-[90vh]` isolado por uma altura explícita do diálogo, mantendo limite responsivo.
   - Preservar o header e o rodapé fixos.

2. Corrigir a área central do preview para ser a única região rolável.
   - Envolver a lista/accordion dos setores em um contêiner com `min-h-0`, `flex-1` e `overflow-hidden`.
   - Garantir que o `ScrollArea` receba altura real (`h-full`) para que o viewport interno consiga rolar.

3. Manter os alertas fora do fluxo principal do preview.
   - Preservar o botão/popover “Ver alertas”, sem recolocar a div de alertas ocupando espaço vertical.

4. Validar o resultado no viewport atual.
   - Confirmar que, após gerar preview, Administração/Apoio e os demais setores ficam acessíveis por scroll, enquanto “Voltar” e “Salvar folgas” permanecem visíveis.