## Objetivo

Criar uma **nova pasta única** com TODAS as migrations do projeto (as oficiais de `supabase/migrations/` + as soltas de `.lovable/*.sql`), sem mexer em nada do que já existe. Essa nova pasta vira a fonte de verdade para self-hosted e o padrão para migrations futuras.

## Decisões propostas

### 1. Nome e local da nova pasta
**`db/migrations/`** na raiz do projeto.

Por que não dentro de `supabase/`? Porque o Supabase CLI lê automaticamente `supabase/migrations/` — se eu duplicar conteúdo lá dentro, ele tentaria reaplicar tudo e quebraria. Uma pasta fora (`db/migrations/`) fica isolada: o Lovable/Supabase continua usando `supabase/migrations/` normalmente, e você usa `db/migrations/` quando for subir o self-hosted.

(Se preferir outro nome — `migrations/`, `self-hosted/migrations/`, `sql/` — me diz.)

### 2. O que vai dentro
Cópia exata de:
- Todos os ~50 arquivos de `supabase/migrations/*.sql` (mantendo o nome com timestamp).
- Todos os 24 `.sql` de `.lovable/`, **renomeados** com prefixo de timestamp para entrarem na ordem cronológica correta de aplicação.

Exemplo de renomeação:
```
.lovable/dev_tracker_migration.sql
  → db/migrations/20251015000001_dev_tracker_migration.sql

.lovable/backfill_quinzena_venda.sql
  → db/migrations/20260514000001_backfill_quinzena_venda.sql
```

Os timestamps das cópias de `.lovable/` vão ser escolhidos para ficarem **antes** das migrations oficiais que dependem deles (ex: `dev_tracker_migration` antes de qualquer migration que altere `dev_tracker`).

### 3. Idempotência
As cópias dos arquivos de `.lovable/` serão ajustadas para ficarem idempotentes (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` antes de `CREATE POLICY`, `UPDATE ... WHERE ... IS NULL`). Assim rodam com segurança num self-hosted limpo **e** num banco que já tem parte do conteúdo aplicado.

As cópias de `supabase/migrations/` ficam **idênticas** ao original (não vou mexer no conteúdo, só copiar).

### 4. README
Crio `db/migrations/README.md` explicando:
- O que é a pasta e por que existe (espelho completo para self-hosted).
- Ordem de aplicação (alfabética por nome do arquivo).
- Regra: **toda migration nova daqui em diante é criada também aqui**, idempotente.
- Como aplicar num self-hosted: `psql -f` em ordem, ou `supabase db push` apontando pra essa pasta.

### 5. O que NÃO vou fazer
- Não mexo em `supabase/migrations/`.
- Não mexo nem apago nada em `.lovable/`.
- Não rodo nenhum SQL no banco atual (a pasta é só arquivo no repo).

## Detalhes técnicos

- 24 arquivos em `.lovable/*.sql` + ~50 em `supabase/migrations/` ≈ 74 arquivos copiados em `db/migrations/`.
- Conflito de timestamp: as migrations oficiais começam em `20251020`. Vou usar `20251015xxxxxx` a `20251019xxxxxx` para enfileirar as de `.lovable/` que precisam vir antes, e timestamps posteriores às últimas oficiais para as que vieram depois (backfills, fixes recentes).
- Ordem entre arquivos de `.lovable/` será definida lendo cada SQL e colocando dependências (criar tabela → adicionar coluna → backfill → fix policy) na sequência correta.

## Confirmações antes de executar

1. **Nome da pasta**: `db/migrations/` está bom, ou prefere outro?
2. **Idempotência nas cópias de `.lovable/`**: posso ajustar pra ficarem seguras de rodar várias vezes (recomendo), ou copia exatamente igual ao original?
3. **Migrations futuras**: confirma que daqui pra frente toda migration nova vai pra **duas** pastas (`supabase/migrations/` para o Lovable + `db/migrations/` para o self-hosted)?
