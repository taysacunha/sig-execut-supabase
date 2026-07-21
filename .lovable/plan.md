## Ajustes no campo Referência (LancamentoDialog)

### 1. Tornar Referência obrigatória
- Em `src/components/despesas/LancamentoDialog.tsx`:
  - Marcar o label "Referência" com asterisco de obrigatório.
  - Validar no submit: se `referencia_tipo` estiver vazio, bloquear salvamento com toast "Selecione o tipo de referência".
  - Manter as validações já existentes do subcampo (número/imóvel/pessoa obrigatórios conforme tipo).
- Espelhar a obrigatoriedade em `src/pages/despesas/DespesasRecorrencias.tsx` (mesma regra do formulário de recorrências).
- Não alterar constraints do banco por enquanto (dados legados podem ter `referencia_tipo` nulo); a obrigatoriedade fica na camada de UI para novos lançamentos/edições.

### 2. Busca no seletor de Imóvel
- Substituir o `Select` atual de imóveis por um Combobox pesquisável (padrão já usado no projeto: `Popover` + `Command` do shadcn — mesmo componente usado, por exemplo, em selects de corretor/pessoa).
- Campo de busca filtra por:
  - Código do imóvel (`codigo`)
  - Descrição/nome (`descricao` / `nome`)
- Exibir no item: `código — descrição` para facilitar identificação.
- Manter lista vinda de `useDespesasLookups` (imóveis ativos); adicionar `codigo` ao retorno se ainda não estiver incluído.
- Aplicar o mesmo Combobox no seletor de imóvel em `DespesasRecorrencias.tsx` para manter consistência.

### 3. Verificação
- Rodar typecheck; abrir o dialog "Novo lançamento" no Calendário e validar:
  - Tentar salvar sem referência → bloqueio com aviso.
  - Selecionar "Imóvel" → busca por código e por descrição funciona; item selecionado aparece corretamente.
