## Objetivo

Esclarecer o dialog "Nova Placa" e migrar automaticamente os 5 materiais-placa existentes (+ saldos) para o novo modelo `estoque_placas`.

## 1. Ajustes no dialog Nova Placa (`src/components/estoque/materiais/NovaPlacaDialog.tsx`)

- **Texto da descrição**: substituir o bloco atual por uma frase curta:
  > "Cadastre um tipo de placa (ex: Placa Aluga 1x1 Lona). O código é atribuído na entrada em /estoque/placas."
- **Remover** o aviso "Este cadastro não altera o saldo…" e a linha "Material vinculado: …" (e também o estado de erro/loading desse material, já que fica implícito).
- O resto do dialog (Categoria, Tipo de uso, Tamanho, Local, Observações) permanece como está.
- A vinculação ao material `is_placa` continua acontecendo internamente (transparente para o usuário).

## 2. Migração de dados dos 5 materiais-placa existentes

Dados conhecidos hoje:

| Material antigo            | Saldo total | tipo_uso | tamanho            |
|----------------------------|-------------|----------|--------------------|
| Placa Venda 3,00X0,70      | 2           | venda    | outro (3,00x0,70)  |
| Placa Venda 2X2 LONA       | 4           | venda    | 2x2                |
| Placa Venda 1X1 LONA       | 2           | venda    | 1x1                |
| Placa Aluga 1X1 LONA       | 3           | aluga    | 1x1                |
| Placa - Vende              | 32          | venda    | outro (não esp.)   |

**Estratégia (script SQL único, executado via insert tool):**

1. Garantir que existe **um único** material "âncora" com `is_placa = true` (ex.: criar/atualizar `Placa` genérico). Os 5 antigos viram `is_active = false` para sumir do dropdown de Novo Material, mas ficam preservados para histórico.
2. Para cada linha de `estoque_saldos` desses 5 materiais, gerar `quantidade` registros em `estoque_placas` com:
   - `material_id` = id do material-âncora
   - `tipo_uso` e `tamanho` inferidos pelo nome (regex), `tamanho_outro` quando `outro`
   - `local_armazenamento_id` = do saldo
   - `status` = `disponivel`
   - `codigo` = NULL (será atribuído na entrada)
   - `observacoes` = "Migrado de <nome antigo>"
3. Inserir 1 linha em `estoque_placas_historico` por placa criada (`tipo = 'criacao'`).
4. Apagar as linhas correspondentes em `estoque_saldos` (os 5 materiais antigos). O trigger `recalcular_saldo_placas` recompõe os saldos do material-âncora automaticamente.
5. Marcar os 5 materiais antigos como `is_active = false` e `is_placa = false`.

Total esperado: **43 placas** criadas em `estoque_placas` (2+4+2+3+32).

## 3. Verificação pós-migração

- Conferir `SELECT count(*) FROM estoque_placas` = 43.
- Conferir `estoque_saldos` do material-âncora reflete 43 distribuídos por local.
- Abrir `/estoque/placas` e ver as 43 placas listadas (sem código).
- Abrir `/estoque/materiais` e ver que os 5 antigos não aparecem mais (ou aparecem como inativos, conforme filtro da página).

## Arquivos afetados

- **Editar**: `src/components/estoque/materiais/NovaPlacaDialog.tsx`
- **SQL (insert tool, dados)**: criação do material-âncora + INSERTs em `estoque_placas`/`historico` + UPDATE em materiais antigos + DELETE em saldos antigos.

## Fora de escopo

- Mudanças no fluxo de entrada/saída em `/estoque/placas` (já implementado).
- Alterações em RLS, schema (`estoque_placas` já tem `categoria_id` e `codigo` nullable).
- Edição de outros dialogs.
