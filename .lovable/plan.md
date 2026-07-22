## Ajustes no módulo Despesas

### 1. Campo "Valor total" opcional

- Em `src/components/despesas/LancamentoDialog.tsx`: remover asterisco do label, remover `form.valor_total > 0` do `podeSalvar`, aceitar vazio/`null`.
- Em `src/hooks/useDespesasLancamentos.ts`: `valor_total` no `LancamentoInput` passa a ser `number | null`.
- Migration nova `db/migrations/20260731120000_despesas_valor_opcional.sql`:
  - `ALTER TABLE despesas_lancamentos ALTER COLUMN valor_total DROP NOT NULL;`
  - `ALTER TABLE despesas_recorrencias ALTER COLUMN valor_total DROP NOT NULL;`
  - Ajustar `despesas_gerar_ocorrencias` para propagar `NULL` normalmente (já propaga; sem mudança lógica).
  - Ajustar cálculos/relatórios que usam `valor_total` para `COALESCE(valor_total, 0)` onde necessário.
- Exibir valor como opcional em listagens: se `NULL`, mostrar "—" no calendário e relatórios.

### 2. Valores que variam por mês (recorrência com valor por ocorrência)

- Reforçar mensagem no bloco de recorrência: "O valor definido aqui é apenas uma previsão. Cada ocorrência gerada pode ser editada individualmente com o valor real do mês."
- Como cada ocorrência já vira uma linha em `despesas_lancamentos` editável, basta permitir editar `valor_total` na ocorrência (já é possível). Nada de schema novo — apenas texto de ajuda e permitir salvar recorrência sem valor (usa `NULL` como previsão em aberto).

### 3. Remover campo "Subcategoria"

- Remover o bloco `<Label>Subcategoria</Label>` em `LancamentoDialog.tsx`.
- Remover `subcategorias` do hook `useDespesasLookups` e `subcategoria_id` de `LancamentoInput`/`emptyForm`/`setForm`/`salvar`.
- Remover referências em `RecorrenciaBlock` e `useDespesasRecorrencias` (manter coluna no BD para não quebrar dados antigos; apenas parar de expor e enviar sempre `null`).
- Não remover a tabela `despesas_subcategorias` do BD (mantém histórico).

### 4. Referências: 4 campos simultâneos, ao menos 1 obrigatório

Substituir o Select "tipo de referência + um campo dinâmico" por um bloco com os quatro campos visíveis em paralelo:

```text
Referência (informe ao menos um):
[ Nº de Pasta ]  [ Cód. Venda ]
[ Imóvel (combobox) ]  [ Pessoa (combobox) ]
```

- Remover `referencia_tipo` da UI e do payload enviado (mantida no BD para dados antigos; nova regra grava sempre `NULL`).
- Migration `db/migrations/20260731130000_despesas_referencia_multi.sql`:
  - `DROP` do CHECK `despesas_lancamentos_referencia_ck` e `despesas_recorrencias_referencia_ck`.
  - Novo CHECK exigindo ao menos um preenchido:
  `CHECK (pessoa_id IS NOT NULL OR imovel_id IS NOT NULL OR (referencia_numero_pasta IS NOT NULL) OR (referencia_numero_venda IS NOT NULL))`.
  - Adicionar `referencia_numero_pasta text` e `referencia_numero_venda text` (ambos `~ '^[0-9]+$'` quando não nulo). Backfill a partir de `referencia_tipo`+`referencia_numero`.
- Atualizar `LancamentoInput`, `useSaveLancamento`, `RecorrenciaBlock`, `despesas_gerar_ocorrencias` para propagar os quatro campos.
- Validação no `podeSalvar`: exigir pelo menos um dos quatro.

### 5. Admin (Taysa) sem imóveis visíveis

Causa confirmada: após o fix `despesas_centros_permitidos_deny_default`, a função só retorna centros para `super_admin` ou usuários com entradas em `despesas_centros_custo_permissoes`. Admin comum sem entradas explícitas fica com lista vazia → RLS de `despesas_imoveis` (e outras tabelas escopadas por centro) filtra tudo.

Correção: tratar `admin` como super no escopo de leitura de despesas.

- Migration `db/migrations/20260731140000_despesas_centros_admin_scope.sql`:
  - Atualizar `public.despesas_centros_permitidos(uuid)` para retornar todos os centros ativos também quando o usuário tiver role `admin` (não apenas `super_admin`).
  - Manter deny-default para colaboradores/gerentes/supervisores sem entradas explícitas.
- Nenhuma mudança no frontend.

### 6. Reforço do posicionamento do sistema (registro, não controle financeiro)

- Ajustar `src/pages/despesas/DespesasHelp.tsx`: bloco no topo deixando explícito "Este é um sistema de acompanhamento (agenda de contas); valores são opcionais e servem apenas de referência. O controle financeiro é feito em sistema externo." **Não precisa desse texto, só quero que você verifique o que já foi feito e crie um sistema de registro e controle, e não financeiro**
- Ajustar títulos/labels de valor para "Valor (opcional)".

## Detalhes técnicos

Arquivos alterados:

- `src/components/despesas/LancamentoDialog.tsx`
- `src/components/despesas/RecorrenciaBlock.tsx`
- `src/hooks/useDespesasLancamentos.ts`
- `src/hooks/useDespesasRecorrencias.ts`
- `src/pages/despesas/DespesasCalendario.tsx` (exibir "—" quando `valor_total` nulo)
- `src/pages/despesas/DespesasHelp.tsx`
- `src/pages/despesas/DespesasRelatorios.tsx` (COALESCE em somas)

Migrations novas (executar na ordem):

1. `20260731120000_despesas_valor_opcional.sql`
2. `20260731130000_despesas_referencia_multi.sql`
3. `20260731140000_despesas_centros_admin_scope.sql`

Sem mudanças em RLS além do item 5. `referencia_tipo`/`referencia_numero`/`subcategoria_id` permanecem no schema para preservar histórico.