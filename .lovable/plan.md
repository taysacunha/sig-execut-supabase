# Plano: Filtros de referência no Calendário de Despesas

Adicionar na página `/despesas/calendario` três novos filtros de referência para localizar lançamentos:
- **Código do imóvel** — seleção por imóvel (exibe `codigo — descricao`).
- **Número da pasta** — campo numérico textual.
- **Código de venda** — campo numérico textual.

## Alterações previstas

### 1. Tipos e query de lançamentos
- Atualizar `LancamentoFiltros` em `src/hooks/useDespesasLancamentos.ts` incluindo:
  - `imovelId?: string`
  - `referenciaNumeroPasta?: string`
  - `referenciaNumeroVenda?: string`
- Ajustar `useLancamentos` para aplicar os filtros quando preenchidos:
  - `.eq("imovel_id", filtros.imovelId)`
  - `.ilike("referencia_numero_pasta", "%${valor}%")` para pasta
  - `.ilike("referencia_numero_venda", "%${valor}%")` para venda

### 2. Interface de filtros
- Em `src/pages/despesas/DespesasCalendario.tsx`, adicionar na seção de filtros:
  - `ComboboxSelect` de imóvel, reaproveitando o lookup `imoveis` (já disponível em `useDespesasLookups`).
  - Dois inputs numéricos para pasta e venda (com limpeza de não-dígitos).
- Ajustar o layout da grade de filtros para acomodar os novos campos sem quebrar em telas médias.

### 3. Persistência na URL (opcional, se couber no escopo)
- Considerar sincronizar os novos filtros com `URLSearchParams` para que o usuário possa compartilhar links de busca.

### 4. Banco de dados
- Verificar se os índices existentes (`idx_desp_lanc_ref_pasta`, `idx_desp_lanc_ref_venda`, `idx_desp_lanc_imovel`) cobrem os novos filtros. Se estiverem faltando, adicionar via migration.

### 5. Validação
- Verificar se a combinação dos filtros retorna resultados corretos no preview.
- Confirmar que os filtros limpam corretamente ao clicar em limpar/busca vazia.
