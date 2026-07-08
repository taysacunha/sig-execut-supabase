## Problema

Em `Estoque > Placas`, aba **Disponíveis**, existem dois blocos:

1. **Saldos por material e local** — agrega `estoque_saldos` dos materiais marcados como placa.
2. **Placas disponíveis** — lista as unidades físicas em `estoque_placas` com `status='disponivel'`.

O `tipo_uso` e o `tamanho` usados no bloco de saldos e nos filtros da aba são **inferidos do nome** do material através de `inferPlacaAttributes(material.nome)` (arquivo `src/hooks/useEstoquePlacas.ts`). A regra é grosseira: se o nome não contém a palavra "aluga", considera `venda`; se não contém "1x1" nem "2x2", considera `outro`.

O material cadastrado pelo Ruan chama-se **"Placa 2x2 Lona"** (sem "Aluga" nem "Venda" no nome). Resultado:

- A linha aparece no bloco de saldos classificada erradamente como `tipo_uso = 'venda'`.
- Ao filtrar por **Tipo = Aluga**, o registro some, mesmo sendo uma placa de aluga.
- Os filtros da aba não têm rótulo visível, dificultando entender o que cada `Select` faz.

Causa raiz: `estoque_materiais` não guarda `tipo_uso` nem `tamanho` para materiais-placa; a UI deriva esses atributos do texto do nome, que é opcional/livre. O `NovaPlacaDialog` já pergunta os dois campos, mas só os usa para montar o nome — nunca persiste.

## Solução

Passar a persistir `tipo_uso`, `tamanho` e `tamanho_outro` em `estoque_materiais` (fonte da verdade) e consumir esses campos na aba Placas. Backfill dos materiais existentes usando o inferidor atual como aproximação inicial. Rotular os filtros.

### 1. Migração — `estoque_materiais` ganha atributos de placa

Novo arquivo `db/migrations/<timestamp>_estoque_materiais_placa_atributos.sql`:

- `ALTER TABLE public.estoque_materiais ADD COLUMN IF NOT EXISTS tipo_uso text CHECK (tipo_uso IN ('venda','aluga'))`.
- `ADD COLUMN IF NOT EXISTS tamanho text CHECK (tamanho IN ('1x1','2x2','outro'))`.
- `ADD COLUMN IF NOT EXISTS tamanho_outro text`.
- Backfill: para todos os materiais com `is_placa = true` e colunas nulas, preencher via regex/`lower(nome)` — `aluga` quando o nome contém "aluga", senão `venda`; `1x1`/`2x2` quando o nome contém essas strings, senão `outro` com `tamanho_outro` extraído (mesma heurística do `inferPlacaAttributes`).
- `CREATE INDEX IF NOT EXISTS idx_estoque_materiais_placa_atributos ON public.estoque_materiais(tipo_uso, tamanho) WHERE is_placa = true`.

Não altera RLS nem grants (já cobertos pela tabela).

### 2. Cadastro/edição — passar a gravar os atributos

`src/components/estoque/materiais/NovaPlacaDialog.tsx`:

- No `insert` (linha ~84) e no `update` de reativação (linha ~73), incluir `tipo_uso`, `tamanho`, `tamanho_outro`.

### 3. Hook e tipos — expor os novos campos

`src/hooks/useEstoquePlacas.ts`:

- Estender `interface MaterialPlaca` com `tipo_uso: TipoUso | null`, `tamanho: Tamanho | null`, `tamanho_outro: string | null`.
- Adicionar helper `resolvePlacaAttributes(material)` que devolve `material.tipo_uso / tamanho / tamanho_outro` quando presentes e cai no `inferPlacaAttributes(nome)` como fallback.

### 4. Aba Placas — usar os atributos persistidos

`src/pages/estoque/EstoquePlacas.tsx`:

- `useQuery("estoque-materiais-placa")` (linha ~85): selecionar também `tipo_uso, tamanho, tamanho_outro`.
- `resumoSaldosPlaca` (linha ~126): trocar `inferPlacaAttributes(material?.nome || "")` por `resolvePlacaAttributes(material)`.

`src/components/estoque/placas/NovaSaidaDialog.tsx`:

- Mesmo tratamento em `syncAttributesFromMaterial` e no `useQuery` de `materiaisPlaca` (linhas ~81 e ~61).

### 5. Rótulos nos filtros da aba Placas

`src/pages/estoque/EstoquePlacas.tsx` (linha ~515, o `grid` dos 5 filtros):

- Envolver cada campo em um `<div className="space-y-1">` com `<Label>` acima: **Buscar**, **Material**, **Tipo de uso**, **Tamanho**, **Local**.
- Mesmo padrão já usado em outros formulários do módulo (`Label` de `@/components/ui/label`).

## Detalhes técnicos

- Compatibilidade retroativa: enquanto os materiais antigos não forem migrados, o helper `resolvePlacaAttributes` cai no comportamento atual, então nada quebra.
- Alterações apenas em frontend + uma migração aditiva. Nenhum registro de placa individual é alterado.
- O fluxo de "Placas disponíveis" (tabela de baixo) já usa `p.tipo_uso` diretamente da linha da placa; continua funcionando.

## Fora do escopo

- Não estamos alterando a exibição do PDF, a aba Saldos, nem histórico de placas.
- Não estamos criando UI para editar tipo/tamanho de materiais já existentes; se necessário, isso vira uma tarefa posterior.

Inclua também os ajustes da  exibição do PDF, a aba Saldos, nem histórico de placas, que você colocou como fora do escopo, mas é para incluir.