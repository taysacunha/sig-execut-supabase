## Tornar visíveis os materiais abaixo do estoque mínimo

### Contexto

Na página `EstoqueSaldos.tsx`, o card amarelo mostra apenas a contagem ("4 materiais abaixo do estoque mínimo"), sem indicar quais. Já existe uma aba "Por material" com a coluna Status (Baixo/OK), mas o usuário precisa rolar e identificar manualmente.

### Solução

Tornar o card de alerta clicável: ao clicar, abre um `Dialog` listando os materiais com saldo total abaixo do mínimo, consolidados em todas as unidades/locais.

### Alterações em `src/pages/estoque/EstoqueSaldos.tsx`

1. **Adicionar estado** `lowStockDialog: boolean`.
2. **Computar `materiaisAbaixoMinimo**` a partir de `consolidadoPorMaterial` (já existe), filtrando `total <= estoque_minimo && estoque_minimo > 0`. Cada item já tem: nome, unidade, total, mínimo, nº de locais.
3. **Transformar o card de alerta em botão**:
  - Adicionar `cursor-pointer hover:bg-amber-200/60` e `onClick={() => setLowStockDialog(true)}`.
  - Adicionar ícone `ChevronRight` no fim + texto "Ver lista" para deixar claro que é clicável.
4. **Criar `Dialog**` com:
  - Título: "Materiais abaixo do estoque mínimo"
  - Tabela com colunas: Material | Saldo atual | Mínimo | Falta | Locais
    - "Falta" = `estoque_minimo - total` (mostrado em vermelho)
  - Ordenada pela maior diferença (mais crítico primeiro)
  - Linha clicável que fecha o dialog e (opcional) faz scroll/filtro — nesta rodada apenas exibir.
  - Botão "Fechar".

### Escopo

- Apenas `EstoqueSaldos.tsx`. Sem mudanças de backend, sem nova rota.
- Reutilizar componentes shadcn já importados (`Dialog`, `Table`, `Badge`).

Já que vai virar botão, coloque algo que possa voltar a mostrar tudo. Tipo um limpa filtro.